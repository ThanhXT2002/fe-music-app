import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
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
  private databaseService = inject(DatabaseService);
  private audioPlayerService = inject(AudioPlayerService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  user = this.authService.currentUser;

  // Sử dụng ThemeService thay vì local signal
  preferences = this.themeService.preferences;

  // // Thêm computed signal để dễ debug
  // isDarkMode = this.themeService.isDarkMode;

  ngOnInit() {
  }

  toggleDarkMode() {
    this.themeService.toggleDarkMode();
  }

  onAutoPlayChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.themeService.updatePreferences({
      autoPlay: target.checked
    });
  }

  onShuffleModeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.themeService.updatePreferences({
      shuffleMode: target.checked
    });
  }

  onRepeatModeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.themeService.updatePreferences({
      repeatMode: target.value as 'none' | 'one' | 'all'
    });
  }

  onDownloadQualityChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.themeService.updatePreferences({
      downloadQuality: target.value as 'high' | 'medium' | 'low'
    });
  }

  onCacheSizeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.themeService.updatePreferences({
      cacheSize: parseInt(target.value)
    });
  }

  async savePreferences() {
    // ThemeService tự động save preferences, không cần implement
    console.log('Saving preferences:', this.preferences());
  }

  storageInfo() {
    const totalSize = 1024; // Mock total size in MB
    return {
      totalSize: `${totalSize} MB`,
      cacheSize: `${Math.round(this.preferences().cacheSize)} MB`,
    };
  }

  async exportData() {
    try {
      // Get all user data from database
      const songs = await this.databaseService.getAllSongs();
      const playlists = await this.databaseService.getAllPlaylists();

      const exportData = {
        preferences: this.preferences(),
        songs,
        playlists,
        exportDate: new Date().toISOString()
      };

      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `xtmusic-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
    }
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
