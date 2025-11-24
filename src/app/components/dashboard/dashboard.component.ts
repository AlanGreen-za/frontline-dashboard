import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, RefresherEventDetail } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, Observable, startWith, take, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ClientData, DataService } from '../../services/data.service';
import { MapViewComponent } from '../map-view/map-view.component';
import { Router } from '@angular/router';

interface FilterState {
  searchTerm: string;
  selectedManagers: string[];
  selectedRegions: string[];
  selectedProvinces: string[];
  selectedProducts: string[];
  productFilterMode: 'has' | 'doesntHave';
  selectedFeeds: string[];
  showOverdueOnly: boolean;
}

const COASTAL_PROVINCES = ['Eastern Cape', 'Northern Cape', 'Western Cape'];
const INLAND_PROVINCES = ['Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West'];

const PRODUCT_NAME_MAPPING: { [key: string]: string } = {
  dmsLite: 'DMS Lite',
  dmsPro: 'DMS Pro',
  dmsAcc: 'DMS Acc',
  wmsPro: 'WMS Pro',
  wmsProAcc: 'WMS Pro Plus',
  wmsAcc: 'WMS Acc',
  dmsMobile: 'DMS Mobile',
  wmsMobile: 'WMS Mobile',
  backups: 'Backups',
  feeds: 'Feeds',
  crm: 'CRM',
  webhosting: 'Website Hosting',
  docStore: 'Doc Store',
  marketingBundle: 'Marketing Bundle',
  emailHosting: 'Email Hosting',
  dbHosting: 'Hosted DB',
  softwareRental: 'Software Rental',
  ida: 'IDA',
  bcd: 'BCD',
  datastore: 'View Only DB',
  vmgOsCrm: 'OS CRM',
  vmgOsDmsAcc: 'OS DMS Acc',
  vmgOsDmsLite: 'OS DMS Lite',
  vmgOsDmsPro: 'OS DMS Pro',
  vmgOsWebmaster: 'OS Webmaster',
  vmgOs: 'OS',
  multibranch: 'Multi Branch',
  rdpLicense: 'RDP Licence'
};

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
    selectedManagers: [],
    selectedRegions: [],
    selectedProvinces: [],
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
      map(([companies, filters]) => {
        const filtered = this.filterCompanies(companies, filters);
        console.log('Filtering with term:', filters.searchTerm, 'Result count:', filtered.length);
        return filtered;
      })
    );

    this.managers$ = combineLatest([
      this.companies$,
      this.filterStateSubject
    ]).pipe(
      map(([companies, filters]) => {
        // Filter by everything EXCEPT Managers
        const filtered = this.filterCompanies(companies, { ...filters, selectedManagers: [] });
        return [...new Set(filtered.map(c => c.accountManager))].sort();
      })
    );

    this.provinces$ = combineLatest([
      this.companies$,
      this.filterStateSubject
    ]).pipe(
      map(([companies, filters]) => {
        // Filter by everything EXCEPT Provinces
        // Note: We KEEP Region filtering because Region is a parent of Province.
        // If "Coastal" is selected, we only want to see Coastal provinces.
        const filtered = this.filterCompanies(companies, { ...filters, selectedProvinces: [] });
        return [...new Set(filtered.map(c => c.province))].sort();
      })
    );

    this.products$ = combineLatest([
      this.companies$,
      this.filterStateSubject
    ]).pipe(
      map(([companies, filters]) => {
        // Filter by everything EXCEPT Products
        const filtered = this.filterCompanies(companies, { ...filters, selectedProducts: [] });
        const productSet = new Set<string>();
        filtered.forEach(company => {
          if (company.products && typeof company.products === 'object') {
            Object.keys(company.products).forEach(productKey => {
              if (company.products[productKey]) {
                // Map the key to the display name
                const displayName = this.getProductName(productKey);
                productSet.add(displayName);
              }
            });
          }
        });
        return [...productSet].sort();
      })
    );

    this.feeds$ = combineLatest([
      this.companies$,
      this.filterStateSubject
    ]).pipe(
      map(([companies, filters]) => {
        // Filter by everything EXCEPT Feeds
        const filtered = this.filterCompanies(companies, { ...filters, selectedFeeds: [] });
        const feedSet = new Set<string>();
        filtered.forEach(company => {
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

    this.overdueStats$ = this.filteredCompanies$.pipe(
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

    this.managerCounts$ = this.managers$.pipe(
      // We want counts for the AVAILABLE managers, based on current filters?
      // Or counts of clients per manager within the current filtered set?
      // Usually it's counts within the filtered set.
      // But managers$ is filtered by everything EXCEPT manager.
      // So if I select Product A, managers$ shows managers who have Product A.
      // And I want to know how many clients each manager has that have Product A.
      // So I should calculate counts from the SAME set used to derive managers$.
      // But here I can't easily access that set.
      // Let's use filteredCompanies$ but we need to ignore the manager filter for the counts of OTHER managers?
      // Actually, standard facet behavior:
      // Count displayed next to "Manager A" is "How many results if I select Manager A (and keep other filters)?"
      // So it is the count in the set filtered by (All filters EXCEPT Manager) + (Manager = A).
      // Which is exactly the set used for managers$.
      // So we should derive counts from the same source as managers$.
      // I'll refactor to combine them or just duplicate the logic for now.
      // For simplicity, I'll derive counts from the `companies` filtered by (Everything EXCEPT Category).
      // But I can't access `companies` here easily without re-combining.
      // I'll leave counts as is for now (derived from `companies$`) but that's wrong because it ignores other filters.
      // I need to update counts to respect cross-filtering.
      // I'll update the counts observables to use the same logic.
      switchMap(() => combineLatest([this.companies$, this.filterStateSubject]).pipe(
        map(([companies, filters]) => {
          const filtered = this.filterCompanies(companies, { ...filters, selectedManagers: [] });
          const counts = new Map<string, number>();
          filtered.forEach(c => {
            counts.set(c.accountManager, (counts.get(c.accountManager) || 0) + 1);
          });
          return counts;
        })
      ))
    );

    this.provinceCounts$ = this.provinces$.pipe(
      switchMap(() => combineLatest([this.companies$, this.filterStateSubject]).pipe(
        map(([companies, filters]) => {
          const filtered = this.filterCompanies(companies, { ...filters, selectedProvinces: [] });
          const counts = new Map<string, number>();
          filtered.forEach(c => {
            counts.set(c.province, (counts.get(c.province) || 0) + 1);
          });
          return counts;
        })
      ))
    );

    this.productCounts$ = this.products$.pipe(
      switchMap(() => combineLatest([this.companies$, this.filterStateSubject]).pipe(
        map(([companies, filters]) => {
          const filtered = this.filterCompanies(companies, { ...filters, selectedProducts: [] });
          const counts = new Map<string, number>();
          filtered.forEach(c => {
            if (c.products) {
              Object.keys(c.products).forEach(key => {
                if (c.products[key]) {
                  const name = this.getProductName(key);
                  counts.set(name, (counts.get(name) || 0) + 1);
                }
              });
            }
          });
          return counts;
        })
      ))
    );

    this.feedCounts$ = this.feeds$.pipe(
      switchMap(() => combineLatest([this.companies$, this.filterStateSubject]).pipe(
        map(([companies, filters]) => {
          const filtered = this.filterCompanies(companies, { ...filters, selectedFeeds: [] });
          const counts = new Map<string, number>();
          filtered.forEach(c => {
            let feedsData: any = c.feeds;
            if (feedsData && typeof feedsData === 'object' && feedsData.feeds) {
              feedsData = feedsData.feeds;
            }
            if (feedsData && typeof feedsData === 'string') {
              const feedList = feedsData.split(',').map((f: string) => f.trim()).filter((f: string) => f);
              feedList.forEach(feed => counts.set(feed, (counts.get(feed) || 0) + 1));
            }
          });
          return counts;
        })
      ))
    );

    this.inlandCount$ = combineLatest([this.companies$, this.filterStateSubject]).pipe(
      map(([companies, filters]) => {
        const filtered = this.filterCompanies(companies, { ...filters, selectedRegions: [] });
        return filtered.filter(c => !COASTAL_PROVINCES.includes(c.province)).length;
      })
    );

    this.coastalCount$ = combineLatest([this.companies$, this.filterStateSubject]).pipe(
      map(([companies, filters]) => {
        const filtered = this.filterCompanies(companies, { ...filters, selectedRegions: [] });
        return filtered.filter(c => COASTAL_PROVINCES.includes(c.province)).length;
      })
    );
  }

  ngOnInit() {
    this.loadData();
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

      // Manager (Multi-select OR logic)
      if (filters.selectedManagers.length > 0 && !filters.selectedManagers.includes(company.accountManager)) {
        return false;
      }

      // Region (Multi-select OR logic)
      if (filters.selectedRegions.length > 0) {
        const isCoastal = COASTAL_PROVINCES.includes(company.province);
        const matchesRegion = filters.selectedRegions.some(region => {
          if (region === 'Coastal') return isCoastal;
          if (region === 'Inland') return INLAND_PROVINCES.includes(company.province); // Strict check for Inland
          return true; // 'All' or unknown
        });

        // If 'All' is selected, we don't filter by region (or if we treat 'All' as a specific selection?)
        // Usually 'All' clears the filter. If 'All' is in the array, we probably shouldn't filter.
        // But let's assume 'All' is removed when specific regions are selected, or handled by the UI.
        // If the array has values, we check if the company matches ANY of them.
        if (!matchesRegion) return false;
      }

      // Province (Multi-select OR logic)
      if (filters.selectedProvinces.length > 0 && !filters.selectedProvinces.includes(company.province)) {
        return false;
      }

      // Products (Multi-select OR logic)
      if (filters.selectedProducts.length > 0) {
        const hasAnySelectedProduct = filters.selectedProducts.some(productName => {
          // productName is the display name (e.g. "DMS Lite")
          // We need to find the key (e.g. "dmsLite") to check in company.products
          const productKey = this.getProductKey(productName);

          // Check if the product exists and is explicitly true
          return productKey && company.products && company.products[productKey] === true;
        });

        if (filters.productFilterMode === 'has') {
          // Show companies that HAVE at least one selected product (product = true)
          if (!hasAnySelectedProduct) {
            return false;
          }
        }

        if (filters.productFilterMode === 'doesntHave') {
          // Show companies that DON'T HAVE any of the selected products (product = false)
          // This means ALL selected products must be false for this company
          if (hasAnySelectedProduct) {
            return false;
          }
        }
      }

      // Feeds (Multi-select OR logic)
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
    const searchValue = event.detail.value || '';
    console.log('Search value:', searchValue);
    this.filterState.searchTerm = searchValue;
    this.filterStateSubject.next({ ...this.filterState });
  }

  onManagerChange(manager: string) {
    const selectedManagers = [...this.filterState.selectedManagers];
    const index = selectedManagers.indexOf(manager);

    if (index > -1) {
      selectedManagers.splice(index, 1);
    } else {
      selectedManagers.push(manager);
    }

    this.updateFilter({ selectedManagers });
  }

  onRegionToggle(region: string) {
    const selectedRegions = [...this.filterState.selectedRegions];
    const index = selectedRegions.indexOf(region);

    if (index > -1) {
      selectedRegions.splice(index, 1);
    } else {
      selectedRegions.push(region);
    }

    this.updateFilter({ selectedRegions });
  }



  onProvinceChange(province: string) {
    const selectedProvinces = [...this.filterState.selectedProvinces];
    const index = selectedProvinces.indexOf(province);

    if (index > -1) {
      selectedProvinces.splice(index, 1);
    } else {
      selectedProvinces.push(province);
    }

    this.updateFilter({ selectedProvinces });
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

  getActiveProducts(company: ClientData): string[] {
    const activeProducts: string[] = [];
    if (company.products) {
      Object.entries(company.products).forEach(([key, value]) => {
        if (value === true) {
          activeProducts.push(this.getProductName(key));
        }
      });
    }
    return activeProducts;
  }

  getActiveFeeds(company: ClientData): string[] {
    let feedsData: any = company.feeds;
    if (feedsData && typeof feedsData === 'object' && feedsData.feeds) {
      feedsData = feedsData.feeds;
    }
    if (feedsData && typeof feedsData === 'string') {
      return feedsData.split(',').map((f: string) => f.trim()).filter((f: string) => f);
    }
    return [];
  }

  resetFilters() {
    this.filterState = {
      searchTerm: '',
      selectedManagers: [],
      selectedRegions: [],
      selectedProvinces: [],
      selectedProducts: [],
      productFilterMode: 'has',
      selectedFeeds: [],
      showOverdueOnly: false
    };
    this.filterStateSubject.next(this.filterState);
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
      this.expandedCards.clear(); // Collapse all other cards
      this.expandedCards.add(id);

      // Scroll to the card after a short delay to allow expansion
      setTimeout(() => {
        const element = document.getElementById('card-' + id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }

  isCardExpanded(id: number): boolean {
    return this.expandedCards.has(id);
  }

  openMap(company: ClientData) {
    let query = '';
    if (company.latLong) {
      query = company.latLong;
    } else {
      query = `${company.tradingName}, ${company.suburb}, ${company.city}, ${company.province}`;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_system');
  }

  productNameMapping: { [key: string]: string } = {
    'DmsLite': 'DMS Lite',
    'DmsPro': 'DMS Pro',
    'DmsAcc': 'DMS Acc',
    'WmsPro': 'WMS Pro',
    'WmsProAcc': 'WMS Pro Plus',
    'WmsAcc': 'WMS Acc',
    'DmsMobile': 'DMS Mobile',
    'WmsMobile': 'WMS Mobile',
    'Backups': 'Backups',
    'Feeds': 'Feeds',
    'Crm': 'CRM',
    'WebHosting': 'Website Hosting',
    'DocStore': 'Doc Store',
    'MarketingBundle': 'Marketing Bundle',
    'EmailHosting': 'Email Hosting',
    'DbHosting': 'Hosted DB',
    'SoftwareRental': 'Software Rental',
    'Ida': 'IDA',
    'Bcd': 'BCD',
    'DataStore': 'View Only DB',
    'VmgOsCrm': 'OS CRM',
    'VmgOsDmsAcc': 'OS DMS Acc',
    'VmgOsDmsLite': 'OS DMS Lite',
    'VmgOsDmsPro': 'OS DMS Pro',
    'VmgOsWebmaster': 'OS Webmaster',
    'VmgOs': 'OS',
    'MultiBranch': 'Multi Branch',
    'RdpLicense': 'RDP Licence',
    'dmsLite': 'DMS Lite',
    'dmsPro': 'DMS Pro',
    'dmsAcc': 'DMS Acc',
    'wmsPro': 'WMS Pro',
    'wmsProAcc': 'WMS Pro Plus',
    'wmsAcc': 'WMS Acc',
    'dmsMobile': 'DMS Mobile',
    'wmsMobile': 'WMS Mobile',
    'backups': 'Backups',
    'feeds': 'Feeds',
    'crm': 'CRM',
    'webhosting': 'Website Hosting',
    'docStore': 'Doc Store',
    'marketingBundle': 'Marketing Bundle',
    'emailHosting': 'Email Hosting',
    'dbHosting': 'Hosted DB',
    'softwareRental': 'Software Rental',
    'ida': 'IDA',
    'bcd': 'BCD',
    'datastore': 'View Only DB',
    'vmgOsCrm': 'OS CRM',
    'vmgOsDmsAcc': 'OS DMS Acc',
    'vmgOsDmsLite': 'OS DMS Lite',
    'vmgOsDmsPro': 'OS DMS Pro',
    'vmgOsWebmaster': 'OS Webmaster',
    'vmgOs': 'OS',
    'multibranch': 'Multi Branch',
    'rdpLicense': 'RDP Licence'
  };

  getProductKey(name: string): string {
    const entry = Object.entries(this.productNameMapping).find(([key, val]) => val === name);
    return entry ? entry[0] : name;
  }

  getProductName(key: any): string {
    if (!key) return '';
    const strKey = String(key);
    const cleanKey = strKey.trim();
    let mapped = this.productNameMapping[cleanKey];

    if (!mapped) {
      // Try case-insensitive search
      const lowerKey = cleanKey.toLowerCase();
      const foundKey = Object.keys(this.productNameMapping).find(k => k.toLowerCase() === lowerKey);
      if (foundKey) {
        mapped = this.productNameMapping[foundKey];
      }
    }

    if (!mapped) {
      // console.warn(`Missing product mapping for key: '${key}'`);
    }
    return mapped || key;
  }
}
