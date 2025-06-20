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
      return;
    }

    // Handle redirect result if user is coming back from Google auth
    this.authService.handleRedirectResult().subscribe({
      next: (user) => {
        if (user) {
          console.log('Login successful via redirect:', user);
          this.router.navigate(['/tabs']);
        }
      },
      error: (error) => {
        console.error('Redirect result error:', error);
        this.isLoading = false;
      }
    });
  }
  async loginWithGoogle() {
    try {
      this.isLoading = true;
      // With redirect, user will be redirected away from the app
      // and come back after authentication
      await this.authService.loginWithGoogle();
      // Note: Code after this line won't execute as user will be redirected
    } catch (error) {
      console.error('Login error:', error);
      this.isLoading = false;
      // You could show a toast or alert here
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
