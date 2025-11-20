import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, RefresherEventDetail } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import {BehaviorSubject, combineLatest, map, Observable, startWith, take} from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ClientData, DataService } from '../../services/data.service';
import { MapViewComponent } from '../map-view/map-view.component';
import { Router } from '@angular/router';

interface FilterState {
  searchTerm: string;
  selectedManager: string | null;
  selectedRegion: string;
  selectedProvince: string | null;
  showOverdueOnly: boolean;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, MapViewComponent]
})
export class DashboardComponent implements OnInit {
  companies$ = new BehaviorSubject<ClientData[]>([]);
  isAuthenticated$ = this.authService.isAuthenticated$;

  filterState: FilterState = {
    searchTerm: '',
    selectedManager: null,
    selectedRegion: 'All',
    selectedProvince: null,
    showOverdueOnly: false
  };

  private filterStateSubject = new BehaviorSubject<FilterState>(this.filterState);

  filteredCompanies$: Observable<ClientData[]>;
  managers$: Observable<string[]>;
  provinces$: Observable<string[]>;
  overdueStats$: Observable<{ count: number; percentage: number }>;

  showFilters = false;
  expandedCards = new Set<number>();
  showMap = false;

  constructor(
    private authService: AuthService,
    private dataService: DataService,
    private router: Router
  ) {
    this.filteredCompanies$ = combineLatest([
      this.companies$,
      this.filterStateSubject
    ]).pipe(
      map(([companies, filters]) => this.filterCompanies(companies, filters))
    );

    this.managers$ = this.companies$.pipe(
      map(companies => [...new Set(companies.map(c => c.accountManager))].sort())
    );

    this.provinces$ = this.companies$.pipe(
      map(companies => [...new Set(companies.map(c => c.province))].sort())
    );

    this.overdueStats$ = this.companies$.pipe(
      map(companies => {
        const total = companies.length;
        if (total === 0) return { count: 0, percentage: 0 };
        const overdue = companies.filter(c => this.isOverdue(c.lastSiteVisit)).length;
        return {
          count: overdue,
          percentage: (overdue / total) * 100
        };
      })
    );
  }

  async ngOnInit() {
    await this.authService.checkAuthStatus();
    this.authService.isAuthenticated$.pipe(take(1)).subscribe(isAuthenticated => {
      if (!isAuthenticated) {
        this.router.navigate(['/login']);
      } else {
        this.loadData();
      }
    });
  }

  loadData() {
    this.dataService.getClientData().subscribe({
      next: (data) => {
        this.companies$.next(data);
      },
      error: (err) => console.error('Error fetching data', err)
    });
  }

  doRefresh(event: any) {
    this.loadData();
    if (event && event.target) {
      event.target.complete();
    }
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  toggleMap() {
    this.showMap = !this.showMap;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Filter Logic
  filterCompanies(companies: ClientData[], filters: FilterState): ClientData[] {
    return companies.filter(company => {
      // Search Term
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const matchesSearch =
          company.tradingName.toLowerCase().includes(term) ||
          company.accountManager.toLowerCase().includes(term) ||
          company.city.toLowerCase().includes(term) ||
          company.suburb.toLowerCase().includes(term) ||
          company.province.toLowerCase().includes(term);

        if (!matchesSearch) return false;
      }

      // Manager
      if (filters.selectedManager && company.accountManager !== filters.selectedManager) {
        return false;
      }

      // Region (Approximation based on province for demo)
      if (filters.selectedRegion !== 'All') {
        const isCoastal = ['Western Cape', 'Eastern Cape', 'KwaZulu-Natal'].includes(company.province);
        if (filters.selectedRegion === 'Coastal' && !isCoastal) return false;
        if (filters.selectedRegion === 'Inland' && isCoastal) return false;
      }

      // Province
      if (filters.selectedProvince && company.province !== filters.selectedProvince) {
        return false;
      }

      // Overdue
      if (filters.showOverdueOnly && !this.isOverdue(company.lastSiteVisit)) {
        return false;
      }

      return true;
    });
  }

  // Helpers
  isOverdue(dateStr: string): boolean {
    if (!dateStr) return true;
    const lastVisit = new Date(dateStr);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    return lastVisit < sixtyDaysAgo;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  // Event Handlers
  onSearchChange(event: any) {
    this.updateFilter({ searchTerm: event.detail.value });
  }

  onManagerChange(event: any) {
    this.updateFilter({ selectedManager: event.detail.value });
  }

  onRegionChange(event: any) {
    this.updateFilter({ selectedRegion: event.detail.value });
  }

  onProvinceChange(event: any) {
    this.updateFilter({ selectedProvince: event.detail.value });
  }

  toggleOverdueFilter() {
    this.updateFilter({ showOverdueOnly: !this.filterState.showOverdueOnly });
  }

  clearFilters() {
    this.filterStateSubject.next({
      searchTerm: '',
      selectedManager: null,
      selectedRegion: 'All',
      selectedProvince: null,
      showOverdueOnly: false
    });
  }

  private updateFilter(update: Partial<FilterState>) {
    this.filterState = { ...this.filterState, ...update };
    this.filterStateSubject.next(this.filterState);
  }

  // Card Expansion
  toggleCard(id: number) {
    if (this.expandedCards.has(id)) {
      this.expandedCards.delete(id);
    } else {
      this.expandedCards.add(id);
    }
  }

  isCardExpanded(id: number): boolean {
    return this.expandedCards.has(id);
  }
}
