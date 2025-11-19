import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, combineLatest, interval, throwError } from 'rxjs';
import { map, tap, catchError, switchMap, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import {
  FrontlineResponse,
  Company,
  ProcessedCompany,
  FilterState,
  Activity,
  UserLocation,
  LocationUpdate
} from '../interfaces/frontline.interface';

@Injectable({
  providedIn: 'root'
})
export class FrontlineService {
  private readonly API_BASE = 'https://office.vmgsoftware.co.za:10011';
  private readonly OVERDUE_THRESHOLD_DAYS = 60;
  private readonly ACTIVITY_DAYS_THRESHOLD = 120;
  private readonly MAX_RECENT_ACTIVITIES = 5;

  private companiesSubject = new BehaviorSubject<ProcessedCompany[]>([]);
  public companies$ = this.companiesSubject.asObservable();

  private filterStateSubject = new BehaviorSubject<FilterState>({
    searchTerm: '',
    selectedManager: null,
    selectedRegion: 'All',
    selectedProvince: null,
    productFilters: [],
    clientAgeFilter: null,
    showOverdueOnly: false
  });
  public filterState$ = this.filterStateSubject.asObservable();

  private userLocationsSubject = new BehaviorSubject<UserLocation[]>([]);
  public userLocations$ = this.userLocationsSubject.asObservable();

  public filteredCompanies$: Observable<ProcessedCompany[]>;
  public overdueStats$: Observable<{ count: number; percentage: number; total: number }>;

  constructor(private http: HttpClient) {
    this.filteredCompanies$ = combineLatest([
      this.companies$,
      this.filterState$
    ]).pipe(
      map(([companies, filters]) => this.applyFilters(companies, filters)),
      shareReplay(1)
    );

    this.overdueStats$ = this.companies$.pipe(
      map(companies => {
        const overdueCount = companies.filter(c => c.isOverdue).length;
        const total = companies.length;
        return {
          count: overdueCount,
          percentage: total > 0 ? (overdueCount / total) * 100 : 0,
          total
        };
      }),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );
  }

loadFrontlineData(): Observable<ProcessedCompany[]> {
    // MOCK DATA FOR TESTING
    const mockData: FrontlineResponse = {
      companies: [
        {
          companyId: '1',
          tradingName: 'ABC Motors',
          accountManager: 'John Smith',
          location: {
            city: 'Johannesburg',
            suburb: 'Sandton',
            province: 'Gauteng',
            region: 'Inland',
            address: '123 Main Street'
          },
          dates: {
            startDate: '2024-01-15',
            lastSiteVisit: '2025-11-15',
            lastContact: '2024-11-01'
          },
          products: [
            { productId: '1', productName: 'Service Plan', isActive: true },
            { productId: '2', productName: 'Extended Warranty', isActive: false }
          ],
          feeds: [],
          activity: [],
          dbInfo: {
            lastSync: '2024-11-17',
            recordCount: 100,
            dataVersion: '1.0'
          },
          latLong: '-26.1076,28.0567'
        },
        {
          companyId: '2',
          tradingName: 'XYZ Dealers',
          accountManager: 'Jane Doe',
          location: {
            city: 'Cape Town',
            suburb: 'Sea Point',
            province: 'Western Cape',
            region: 'Coastal',
            address: '456 Beach Road'
          },
          dates: {
            startDate: '2023-06-01',
            lastSiteVisit: '2024-08-20',
            lastContact: '2024-09-15'
          },
          products: [
            { productId: '1', productName: 'Service Plan', isActive: true },
            { productId: '3', productName: 'GPS Tracking', isActive: true }
          ],
          feeds: [],
          activity: [],
          dbInfo: {
            lastSync: '2024-11-17',
            recordCount: 50,
            dataVersion: '1.0'
          },
          latLong: '-33.9249,18.4241'
        }
      ]
    };

    // Process the mock data
    const processedCompanies = mockData.companies.map(company => this.processCompany(company));
    this.companiesSubject.next(processedCompanies);

    // Import 'of' from rxjs at the top of the file if needed
    return new Observable(observer => {
      observer.next(processedCompanies);
      observer.complete();
    });

    // UNCOMMENT THIS WHEN BACKEND IS READY
    // return this.http.get<FrontlineResponse>(`${this.API_BASE}/Frontline`).pipe(
    //   map(response => response.companies || []),
    //   map(companies => companies.map(company => this.processCompany(company))),
    //   tap(processedCompanies => {
    //     this.companiesSubject.next(processedCompanies);
    //   }),
    //   catchError(error => {
    //     console.error('Error loading frontline data:', error);
    //     return throwError(() => error);
    //   })
    // );
  }

  private processCompany(company: Company): ProcessedCompany {
    const [lat, lng] = company.latLong ? company.latLong.split(',').map(Number) : [0, 0];

    const startDate = new Date(company.dates.startDate);
    const lastSiteVisit = new Date(company.dates.lastSiteVisit);
    const lastContact = company.dates.lastContact ? new Date(company.dates.lastContact) : undefined;

    const today = new Date();
    const daysSinceLastVisit = Math.floor((today.getTime() - lastSiteVisit.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysSinceLastVisit > this.OVERDUE_THRESHOLD_DAYS;

    const clientAge = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const recentActivities = this.filterRecentActivities(company.activity);

    return {
      ...company,
      parsedLocation: {
        latitude: lat,
        longitude: lng
      },
      parsedDates: {
        startDate,
        lastSiteVisit,
        lastContact
      },
      isOverdue,
      daysOverdue: isOverdue ? daysSinceLastVisit - this.OVERDUE_THRESHOLD_DAYS : 0,
      clientAge,
      recentActivities
    };
  }

  private filterRecentActivities(activities: Activity[]): Activity[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.ACTIVITY_DAYS_THRESHOLD);

    return activities
      .filter(activity => new Date(activity.date) >= cutoffDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, this.MAX_RECENT_ACTIVITIES);
  }

  private applyFilters(companies: ProcessedCompany[], filters: FilterState): ProcessedCompany[] {
    let filtered = [...companies];

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.tradingName.toLowerCase().includes(term) ||
        c.location.city.toLowerCase().includes(term) ||
        c.location.suburb.toLowerCase().includes(term) ||
        c.accountManager.toLowerCase().includes(term)
      );
    }

    if (filters.selectedManager) {
      filtered = filtered.filter(c => c.accountManager === filters.selectedManager);
    }

    if (filters.selectedRegion !== 'All') {
      filtered = filtered.filter(c => c.location.region === filters.selectedRegion);
    }

    if (filters.selectedProvince) {
      filtered = filtered.filter(c => c.location.province === filters.selectedProvince);
    }

    if (filters.showOverdueOnly) {
      filtered = filtered.filter(c => c.isOverdue);
    }

    return filtered;
  }

  updateFilter(filterUpdate: Partial<FilterState>): void {
    const currentState = this.filterStateSubject.value;
    this.filterStateSubject.next({
      ...currentState,
      ...filterUpdate
    });
  }

  getManagers(): Observable<string[]> {
    return this.companies$.pipe(
      map(companies => [...new Set(companies.map(c => c.accountManager))].sort())
    );
  }

  getProvinces(): Observable<string[]> {
    return this.companies$.pipe(
      map(companies => [...new Set(companies.map(c => c.location.province))].sort())
    );
  }

  getProducts(): Observable<string[]> {
    return this.companies$.pipe(
      map(companies => {
        const products = new Set<string>();
        companies.forEach(c => {
          c.products.forEach(p => products.add(p.productName));
        });
        return [...products].sort();
      })
    );
  }
}
