import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);

  ngOnInit() {
    if (this.authService.currentUser()) {
      this.router.navigate(['/tabs']);
    }
  }
  async loginWithGoogle() {
    try {
      this.isLoading.set(true);
      await this.authService.loginWithGoogle();
      await this.router.navigate(['/tabs'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}
