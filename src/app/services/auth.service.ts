import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, BehaviorSubject, throwError } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences';
import { LoginRequest, LoginResponse } from '../interfaces/frontline.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_BASE = 'https://office.vmgsoftware.co.za:10011';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'user_data';
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  private currentUserSubject = new BehaviorSubject<any>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.checkAuthStatus();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    // MOCK LOGIN FOR TESTING - Remove this when backend is ready
    if (credentials.username === 'test' && credentials.password === 'test') {
      const mockResponse: LoginResponse = {
        token: 'mock-token-12345',
        userId: 'user-001',
        username: credentials.username
      };
      
      return from(Promise.all([
        Preferences.set({ key: this.TOKEN_KEY, value: mockResponse.token }),
        Preferences.set({ key: this.USER_KEY, value: JSON.stringify({
          userId: mockResponse.userId,
          username: mockResponse.username
        })})
      ])).pipe(
        map(() => mockResponse),
        tap(() => {
          this.isAuthenticatedSubject.next(true);
          this.currentUserSubject.next({
            userId: mockResponse.userId,
            username: mockResponse.username
          });
        })
      );
    }

    // REAL LOGIN - This will be used when backend is available
    return this.http.post<LoginResponse>(
      `${this.API_BASE}/Auth/Login`,
      credentials,
      { headers }
    ).pipe(
      switchMap(response => {
        return from(Promise.all([
          Preferences.set({ key: this.TOKEN_KEY, value: response.token }),
          Preferences.set({ key: this.USER_KEY, value: JSON.stringify({
            userId: response.userId,
            username: response.username || credentials.username
          })})
        ])).pipe(
          map(() => response)
        );
      }),
      tap(response => {
        this.isAuthenticatedSubject.next(true);
        this.currentUserSubject.next({
          userId: response.userId,
          username: response.username
        });
      }),
      catchError(error => {
        console.error('Login failed:', error);
        return throwError(() => error);
      })
    );
  }

  logout(): Observable<void> {
    return from(Promise.all([
      Preferences.remove({ key: this.TOKEN_KEY }),
      Preferences.remove({ key: this.USER_KEY })
    ])).pipe(
      map(() => void 0),
      tap(() => {
        this.isAuthenticatedSubject.next(false);
        this.currentUserSubject.next(null);
      })
    );
  }

  getToken(): Observable<string | null> {
    return from(Preferences.get({ key: this.TOKEN_KEY })).pipe(
      map(result => result.value)
    );
  }

  getCurrentUser(): Observable<any> {
    return from(Preferences.get({ key: this.USER_KEY })).pipe(
      map(result => result.value ? JSON.parse(result.value) : null)
    );
  }

  private async checkAuthStatus(): Promise<void> {
    try {
      const { value: token } = await Preferences.get({ key: this.TOKEN_KEY });
      const { value: userData } = await Preferences.get({ key: this.USER_KEY });
      
      if (token) {
        this.isAuthenticatedSubject.next(true);
        if (userData) {
          this.currentUserSubject.next(JSON.parse(userData));
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.isAuthenticatedSubject.next(false);
    }
  }

  validateToken(): Observable<boolean> {
    return this.http.get(`${this.API_BASE}/Frontline`, {
      observe: 'response'
    }).pipe(
      map(response => response.status === 200),
      catchError(() => {
        this.logout();
        return from([false]);
      })
    );
  }
}