// Frontline Data Models

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId?: string;
  username?: string;
}

export interface FrontlineResponse {
  companies: Company[];
}

export interface Company {
  companyId: string;
  tradingName: string;
  registeredName?: string;
  accountManager: string;
  location: Location;
  dates: ClientDates;
  products: Product[];
  feeds: Feed[];
  activity: Activity[];
  dbInfo: DatabaseInfo;
  latLong: string; // Format: "lat,long"
}

export interface Location {
  city: string;
  suburb: string;
  province: string;
  region: 'Inland' | 'Coastal';
  address?: string;
}

export interface ClientDates {
  startDate: string; // ISO date string
  lastSiteVisit: string; // ISO date string
  lastContact?: string; // ISO date string
}

export interface Product {
  productId: string;
  productName: string;
  isActive: boolean;
  category?: string;
}

export interface Feed {
  feedId: string;
  feedName: string;
  isSubscribed: boolean;
  lastUpdated?: string;
}

export interface Activity {
  activityId: string;
  activityType: string;
  description: string;
  date: string; // ISO date string
  performedBy: string;
  notes?: string;
}

export interface DatabaseInfo {
  lastSync: string;
  recordCount: number;
  dataVersion: string;
}

// Processed/Enhanced Models
export interface ProcessedCompany extends Company {
  parsedLocation: {
    latitude: number;
    longitude: number;
  };
  parsedDates: {
    startDate: Date;
    lastSiteVisit: Date;
    lastContact?: Date;
  };
  isOverdue: boolean;
  daysOverdue: number;
  clientAge: number; // Days since startDate
  recentActivities: Activity[]; // Filtered and sorted
}

// Filter Models
export interface FilterState {
  searchTerm: string;
  selectedManager: string | null;
  selectedRegion: 'All' | 'Inland' | 'Coastal';
  selectedProvince: string | null;
  productFilters: ProductFilter[];
  clientAgeFilter: number | null; // 30, 90, 180 days
  showOverdueOnly: boolean;
}

export interface ProductFilter {
  productName: string;
  mode: 'include' | 'exclude';
}

// Real-time Location Models
export interface UserLocation {
  userId: string;
  username: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  isOnline: boolean;
}

export interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
}