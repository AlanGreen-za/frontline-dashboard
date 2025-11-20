import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

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
    private apiUrl = 'https://office.vmgsoftware.co.za:10011/Frontline';

    constructor(private http: HttpClient, private authService: AuthService) { }

    getClientData(): Observable<ClientData[]> {
        return from(this.authService.getToken()).pipe(
            switchMap(token => {
                const headers = new HttpHeaders({
                    'Authorization': `Bearer ${token}`
                });
                return this.http.get<ClientData[]>(this.apiUrl, { headers });
            })
        );
    }
}
