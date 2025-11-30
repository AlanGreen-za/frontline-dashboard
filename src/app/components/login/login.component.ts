import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../interfaces/frontline.interface';

import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonImg,
  IonInput,
  IonInputPasswordToggle,
  LoadingController,
  AlertController
} from "@ionic/angular/standalone";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonImg,
    IonInput,
    IonInputPasswordToggle
  ],
  providers: [AuthService]
})
export class LoginComponent implements OnInit {
  private formBuilder: FormBuilder =  inject(FormBuilder);
  private authService: AuthService =  inject(AuthService);
  private router: Router =  inject(Router);
  private loadingController: LoadingController =  inject(LoadingController);
  private alertController: AlertController =  inject(AlertController);
  protected loginForm: FormGroup;
  showPassword = false;


  constructor() {
    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit() {
    this.authService.checkAuthStatus().then(r => this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.router.navigate(['/dashboard']);
      }
    }));
  }


  async onLogin() {
    if (this.loginForm.invalid) {
      await this.showValidationAlert();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Logging in...',
      spinner: 'circles'
    });
    await loading.present();

    const credentials: LoginRequest = this.loginForm.value;

    this.authService.login(credentials).subscribe({
      next: async (response) => {
        await loading.dismiss();
        this.router.navigate(['/dashboard']);
      },
      error: async (error) => {
        await loading.dismiss();
        await this.showErrorAlert(error);
      }
    });
  }


  private async showValidationAlert() {
    const alert = await this.alertController.create({
      header: 'Validation Error',
      message: 'Please enter valid username and password.',
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showErrorAlert(error: any) {
    let message = 'Login failed. Please try again.';

    if (error.status === 401) {
      message = 'Invalid username or password.';
    } else if (error.status === 0) {
      message = 'Unable to connect to server. Please check your connection.';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    const alert = await this.alertController.create({
      header: 'Login Error',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  get username() {
    return this.loginForm.get('username');
  }

  get password() {
    return this.loginForm.get('password');
  }
}
