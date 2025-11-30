import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';
import {environment} from "../../environments/environment";

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
    }
}
