import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, LoadingController, AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../interfaces/frontline.interface';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  providers: [AuthService]  // Add this line
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  showPassword = false;
  IsInternal:boolean = true;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {
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
    })
    );
  }

  protected toggleConnectionMode() {
    this.IsInternal = !this.IsInternal;
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
    this.authService.IsInternal = this.IsInternal
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
