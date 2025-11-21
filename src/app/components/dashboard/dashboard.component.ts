import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, RefresherEventDetail } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, Observable, startWith, take } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ClientData, DataService } from '../../services/data.service';
import { MapViewComponent } from '../map-view/map-view.component';
import { Router } from '@angular/router';

interface FilterState {
  searchTerm: string;
  selectedManager: string | null;
  selectedRegion: string;
  selectedProvince: string | null;
  selectedProducts: string[];
  productFilterMode: 'has' | 'doesntHave';
  selectedFeeds: string[];
  showOverdueOnly: boolean;
}

const COASTAL_PROVINCES = ['Eastern Cape', 'Northern Cape', 'Western Cape'];
const INLAND_PROVINCES = ['Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West'];

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
    selectedProducts: [],
    productFilterMode: 'has',
    selectedFeeds: [],
    showOverdueOnly: false
  };

  private filterStateSubject = new BehaviorSubject<FilterState>(this.filterState);

  filteredCompanies$: Observable<ClientData[]>;
  managers$: Observable<string[]>;
  provinces$: Observable<string[]>;
  products$: Observable<string[]>;
  feeds$: Observable<string[]>;
  overdueStats$: Observable<{ count: number; percentage: number }>;
  managerCounts$: Observable<Map<string, number>>;
  provinceCounts$: Observable<Map<string, number>>;
  productCounts$: Observable<Map<string, number>>;
  feedCounts$: Observable<Map<string, number>>;
  inlandCount$: Observable<number>;
  coastalCount$: Observable<number>;

  showFilters = false;
  expandedCards = new Set<number>();
  showMap = false;
  showFeedsFilter = false;

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

    this.provinces$ = combineLatest([
      this.companies$,
      this.filterStateSubject
    ]).pipe(
      map(([companies, filters]) => {
        const allProvinces = [...new Set(companies.map(c => c.province))].sort();

        if (filters.selectedRegion === 'All') {
          return allProvinces;
        }

        const targetList = filters.selectedRegion === 'Coastal' ? COASTAL_PROVINCES : INLAND_PROVINCES;
        return allProvinces.filter(p => targetList.includes(p));
      })
    );

    this.products$ = this.companies$.pipe(
      map(companies => {
        const productSet = new Set<string>();
        companies.forEach(company => {
          if (company.products && typeof company.products === 'object') {
            Object.keys(company.products).forEach(product => {
              if (company.products[product]) {
                productSet.add(product);
              }
            });
          }
        });
        return [...productSet].sort();
      })
    );

    this.feeds$ = this.companies$.pipe(
      map(companies => {
        const feedSet = new Set<string>();
        companies.forEach(company => {
          // Get the feeds data - handle nested structure { feeds: { feeds: "..." } }
          let feedsData: any = company.feeds;
          if (feedsData && typeof feedsData === 'object' && feedsData.feeds) {
            feedsData = feedsData.feeds;
          }

          // Parse the comma-separated string
          if (feedsData && typeof feedsData === 'string') {
            const feedList = feedsData.split(',').map((f: string) => f.trim()).filter((f: string) => f);
            feedList.forEach(feed => feedSet.add(feed));
          }
        });
        return [...feedSet].sort();
      })
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

    this.managerCounts$ = this.companies$.pipe(
      map(companies => {
        const counts = new Map<string, number>();
        companies.forEach(company => {
          const manager = company.accountManager;
          counts.set(manager, (counts.get(manager) || 0) + 1);
        });
        return counts;
      })
    );

    this.provinceCounts$ = this.companies$.pipe(
      map(companies => {
        const counts = new Map<string, number>();
        companies.forEach(company => {
          const province = company.province;
          counts.set(province, (counts.get(province) || 0) + 1);
        });
        return counts;
      })
    );

    this.productCounts$ = this.companies$.pipe(
      map(companies => {
        const counts = new Map<string, number>();
        companies.forEach(company => {
          if (company.products && typeof company.products === 'object') {
            Object.keys(company.products).forEach(product => {
              if (company.products[product]) {
                counts.set(product, (counts.get(product) || 0) + 1);
              }
            });
          }
        });
        return counts;
      })
    );

    this.feedCounts$ = this.companies$.pipe(
      map(companies => {
        const counts = new Map<string, number>();
        companies.forEach(company => {
          // Get the feeds data - handle nested structure { feeds: { feeds: "..." } }
          let feedsData: any = company.feeds;
          if (feedsData && typeof feedsData === 'object' && feedsData.feeds) {
            feedsData = feedsData.feeds;
          }

          // Parse and count the comma-separated string
          if (feedsData && typeof feedsData === 'string') {
            const feedList = feedsData.split(',').map((f: string) => f.trim()).filter((f: string) => f);
            feedList.forEach(feed => {
              counts.set(feed, (counts.get(feed) || 0) + 1);
            });
          }
        });
        return counts;
      })
    );

    this.inlandCount$ = this.companies$.pipe(
      map(companies => companies.filter(c => INLAND_PROVINCES.includes(c.province)).length)
    );

    this.coastalCount$ = this.companies$.pipe(
      map(companies => companies.filter(c => COASTAL_PROVINCES.includes(c.province)).length)
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

  toggleFeedsFilter() {
    this.showFeedsFilter = !this.showFeedsFilter;
  }

  async logout() {
    await this.authService.logout();
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

      // Region
      if (filters.selectedRegion !== 'All') {
        const isCoastal = COASTAL_PROVINCES.includes(company.province);
        if (filters.selectedRegion === 'Coastal' && !isCoastal) return false;
        if (filters.selectedRegion === 'Inland' && isCoastal) return false;
        // Also handle the case where a province might not be in either list
        if (filters.selectedRegion === 'Inland' && !INLAND_PROVINCES.includes(company.province)) return false;
      }

      // Province
      if (filters.selectedProvince && company.province !== filters.selectedProvince) {
        return false;
      }

      // Products
      if (filters.selectedProducts.length > 0) {
        const hasAnySelectedProduct = filters.selectedProducts.some(product => {
          return company.products && company.products[product];
        });

        if (filters.productFilterMode === 'has' && !hasAnySelectedProduct) {
          return false;
        }
        if (filters.productFilterMode === 'doesntHave' && hasAnySelectedProduct) {
          return false;
        }
      }

      // Feeds
      if (filters.selectedFeeds.length > 0) {
        // Get the feeds data - handle nested structure { feeds: { feeds: "..." } }
        let feedsData: any = company.feeds;
        if (feedsData && typeof feedsData === 'object' && feedsData.feeds) {
          feedsData = feedsData.feeds;
        }

        // Check if company has any of the selected feeds
        if (feedsData && typeof feedsData === 'string') {
          const companyFeeds = feedsData.split(',').map((f: string) => f.trim());
          const hasAnySelectedFeed = filters.selectedFeeds.some(feed => companyFeeds.includes(feed));

          if (!hasAnySelectedFeed) {
            return false;
          }
        } else {
          // If feeds data is not a string, exclude this company
          return false;
        }
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

  calculateAge(startDate: string): string {
    if (!startDate) return 'Unknown';

    const start = new Date(startDate);
    const now = new Date();

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} yrs`);
    if (months > 0) parts.push(`${months} mos`);

    return parts.length > 0 ? parts.join(', ') : '0 mos';
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

  onProductChange(product: string) {
    const selectedProducts = [...this.filterState.selectedProducts];
    const index = selectedProducts.indexOf(product);

    if (index > -1) {
      selectedProducts.splice(index, 1);
    } else {
      selectedProducts.push(product);
    }

    this.updateFilter({ selectedProducts });
  }

  onProductFilterModeChange(mode: 'has' | 'doesntHave') {
    this.updateFilter({ productFilterMode: mode });
  }

  onFeedChange(feed: string) {
    const selectedFeeds = [...this.filterState.selectedFeeds];
    const index = selectedFeeds.indexOf(feed);

    if (index > -1) {
      selectedFeeds.splice(index, 1);
    } else {
      selectedFeeds.push(feed);
    }

    this.updateFilter({ selectedFeeds });
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
      selectedProducts: [],
      productFilterMode: 'has',
      selectedFeeds: [],
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
