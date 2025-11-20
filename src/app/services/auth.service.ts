import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { LoginRequest } from '../interfaces/frontline.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://office.vmgsoftware.co.za:10011/Auth/Login';
  private tokenKey = 'auth_token';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);

  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public IsInternal: boolean = true;

  constructor(private http: HttpClient) {
    this.checkAuthStatus();
  }

  async checkAuthStatus() {
    const { value } = await Preferences.get({ key: this.tokenKey });
    if (value) {
      this.isAuthenticatedSubject.next(true);
    } else {
      this.isAuthenticatedSubject.next(false);
    }
  }

  login(credentials: LoginRequest): Observable<any> {
    return this.http.post(this.apiUrl, credentials, { responseType: 'text' }).pipe(
      tap(async (token) => {
        await Preferences.set({ key: this.tokenKey, value: token });
        this.isAuthenticatedSubject.next(true);
      })
    );
  }

  async logout() {
    await Preferences.remove({ key: this.tokenKey });
    this.isAuthenticatedSubject.next(false);
  }

  async getToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: this.tokenKey });
    return value;
  }
}
