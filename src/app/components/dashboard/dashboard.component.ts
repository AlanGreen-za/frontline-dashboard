import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, LoadingController } from '@ionic/angular';
import { FrontlineService } from '../../services/frontline.service';
import { AuthService } from '../../services/auth.service';
import { ProcessedCompany, FilterState } from '../../interfaces/frontline.interface';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  providers: [FrontlineService, AuthService]  // Add this line
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data streams
  filteredCompanies$: Observable<ProcessedCompany[]>;
  overdueStats$: Observable<{ count: number; percentage: number; total: number }>;
  managers$: Observable<string[]>;
  provinces$: Observable<string[]>;
  currentUser$: Observable<any>;

  // UI state
  expandedCards = new Set<string>();
  showFilters = false;
  isLoading = false;

  // Current filter state
  filterState: FilterState = {
    searchTerm: '',
    selectedManager: null,
    selectedRegion: 'All',
    selectedProvince: null,
    productFilters: [],
    clientAgeFilter: null,
    showOverdueOnly: false
  };

  constructor(
    private frontlineService: FrontlineService,
    private authService: AuthService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    // Initialize observables
    this.filteredCompanies$ = this.frontlineService.filteredCompanies$;
    this.overdueStats$ = this.frontlineService.overdueStats$;
    this.managers$ = this.frontlineService.getManagers();
    this.provinces$ = this.frontlineService.getProvinces();
    this.currentUser$ = this.authService.currentUser$;
  }

  async ngOnInit() {
    await this.loadData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData() {
    const loading = await this.loadingController.create({
      message: 'Loading client data...'
    });
    await loading.present();

    this.frontlineService.loadFrontlineData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          loading.dismiss();
        },
        error: async (error) => {
          loading.dismiss();
          const alert = await this.alertController.create({
            header: 'Error',
            message: 'Failed to load client data. Please try again.',
            buttons: ['OK']
          });
          await alert.present();
        }
      });
  }

  toggleCard(companyId: string) {
    if (this.expandedCards.has(companyId)) {
      this.expandedCards.delete(companyId);
    } else {
      this.expandedCards.add(companyId);
    }
  }

  isCardExpanded(companyId: string): boolean {
    return this.expandedCards.has(companyId);
  }

  onSearchChange(event: any) {
    this.filterState.searchTerm = event.detail.value || '';
    this.frontlineService.updateFilter({ searchTerm: this.filterState.searchTerm });
  }

  onManagerChange(event: any) {
    this.filterState.selectedManager = event.detail.value;
    this.frontlineService.updateFilter({ selectedManager: this.filterState.selectedManager });
  }

  onRegionChange(event: any) {
    this.filterState.selectedRegion = event.detail.value;
    this.frontlineService.updateFilter({ selectedRegion: this.filterState.selectedRegion });
  }

  onProvinceChange(event: any) {
    this.filterState.selectedProvince = event.detail.value;
    this.frontlineService.updateFilter({ selectedProvince: this.filterState.selectedProvince });
  }

  toggleOverdueFilter() {
    this.filterState.showOverdueOnly = !this.filterState.showOverdueOnly;
    this.frontlineService.updateFilter({ showOverdueOnly: this.filterState.showOverdueOnly });
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  clearFilters() {
    this.filterState = {
      searchTerm: '',
      selectedManager: null,
      selectedRegion: 'All',
      selectedProvince: null,
      productFilters: [],
      clientAgeFilter: null,
      showOverdueOnly: false
    };
    this.frontlineService.updateFilter(this.filterState);
  }

  async doRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-ZA', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          handler: () => {
            this.authService.logout().subscribe();
          }
        }
      ]
    });
    await alert.present();
  }
}