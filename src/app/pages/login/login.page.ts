import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IonContent } from "@ionic/angular/standalone";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, CommonModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = false;

  ngOnInit() {
    // Check if user is already logged in
    if (this.authService.currentUser()) {
      this.router.navigate(['/tabs']);
    }
  }

  async loginWithGoogle() {
    try {
      this.isLoading = true;
      await this.authService.loginWithGoogle();
      await this.router.navigate(['/tabs']);
    } catch (error) {
      console.error('Login error:', error);
      // You could show a toast or alert here
    } finally {
      this.isLoading = false;
    }
  }

  async continueAsGuest() {
    try {
      this.isLoading = true;
      await this.authService.loginAsGuest();
      await this.router.navigate(['/tabs']);
    } catch (error) {
      console.error('Guest login error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
