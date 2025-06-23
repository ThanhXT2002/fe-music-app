import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { InstallPromptComponent } from "../../components/install-prompt/install-prompt.component";


@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InstallPromptComponent],
  templateUrl: './settings.page.html'
})
export class SettingsPage implements OnInit {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  user = this.authService.currentUser;

  // Sử dụng ThemeService thay vì local signal
  preferences = this.themeService.preferences;

  ngOnInit() {
  }
  toggleDarkMode() {
    this.themeService.toggleDarkMode();
  }

  async logout() {
    try {
      await this.authService.logout();
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
