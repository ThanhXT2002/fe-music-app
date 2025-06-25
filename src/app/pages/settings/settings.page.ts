import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { InstallPromptComponent } from '../../components/install-prompt/install-prompt.component';
import { User } from '@angular/fire/auth';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InstallPromptComponent],
  templateUrl: './settings.page.html',
})
export class SettingsPage implements OnInit {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  // Sử dụng signal để track user state
  user = signal<User | null>(null);

  // Sử dụng ThemeService chỉ cho dark mode
  isDarkMode = this.themeService.isDarkMode;

  ngOnInit() {
    // Subscribe to user changes
    this.authService.user$.subscribe((user) => {
      console.log('User updated in settings:', user);
      this.user.set(user);
    });
  }
  toggleDarkMode() {
    this.themeService.toggleDarkMode();
  }
  async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  // Lấy URL avatar với fallback
  getUserAvatar(): string {
    const user = this.user();
    if (user?.photoURL) {
      return user.photoURL;
    }
    return 'assets/images/default-avatar.svg';
  }

  // Xử lý lỗi khi load ảnh avatar
  onImageError(event: any): void {
    event.target.src = 'assets/images/default-avatar.svg';
  }
}
