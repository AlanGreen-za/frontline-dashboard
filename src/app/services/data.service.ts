import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import {environment} from "../../environments/environment";

export interface HealthScore {
  indicatorScore?: number;
  costByStockTypeScore?: number;
  stockListScore?: number;
  fullProfitScore?: number;
  bankDicScore?: number;
  totalScore?: number;
  maxScore?: number;
  lastRun?: string;
}

export interface ClientData {
  companyId: number;
  tradingName: string;
  startDate: string;
  accountManager: string;
  lastSiteVisit: string;
  paymentMethod: string;
  province: string;
  suburb: string;
  city: string;
  latLong: string;
  lastInvoiceAmount: number;
  mainContact: string;
  products: any;
  feeds: any;
  activity: any[];
  dbInfo: any[];
  healthScores?: {  // Container for all health check types
    dmsPro?: HealthScore;      // Current implementation
    dmsAcc?: HealthScore;      // Future
    wmsPro?: HealthScore;      // Future
    crm?: HealthScore;         // Future
    webmaster?: HealthScore;   // Future
  };
}


@Injectable({
    providedIn: 'root'
})
export class DataService {
  private apiUrl = `${environment.baseUrl}/Frontline`;

  constructor(private http: HttpClient, private authService: AuthService) { }

  getClientData(): Observable<ClientData[]> {
    return from(this.authService.getToken()).pipe(
      switchMap(tokenResponse => {
        const tokenObj = typeof tokenResponse === 'string' ? JSON.parse(tokenResponse) : tokenResponse;
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${tokenObj.token}`
        });
        return this.http.get<ClientData[]>(this.apiUrl, { headers });
      })
    );
  }  // This closes getClientData()

  // Generic method for any health score type
  getHealthScore(companyId: string, scoreType: 'dmsPro' | 'dmsAcc' | 'wmsPro' | 'crm' | 'webmaster'): Observable<any> {
    return from(this.authService.getToken()).pipe(
      switchMap(tokenResponse => {
        const tokenObj = typeof tokenResponse === 'string' ? JSON.parse(tokenResponse) : tokenResponse;
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${tokenObj.token}`
        });

        // Map score types to API endpoints
        const endpointMap = {
          dmsPro: 'DmsProScore',
          dmsAcc: 'DmsAccScore',    // Future endpoint
          wmsPro: 'WmsProScore',    // Future endpoint
          crm: 'CrmScore',          // Future endpoint
          webmaster: 'WebmasterScore' // Future endpoint
        };

        return this.http.get(`${environment.baseUrl}/api/${endpointMap[scoreType]}/${companyId}`, { headers });
      })
    );
  }

  // Convenience method for DMS Pro (current implementation)
  getDmsProScore(companyId: string): Observable<any> {
    return this.getHealthScore(companyId, 'dmsPro');
  }

}  // This closes the DataService class
