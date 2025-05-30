import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';

interface UserPreferences {
  darkMode: boolean;
  autoPlay: boolean;
  shuffleMode: boolean;
  repeatMode: 'none' | 'one' | 'all';
  downloadQuality: 'high' | 'medium' | 'low';
  notifications: boolean;
  backgroundPlay: boolean;
  storageLocation: string;
  cacheSize: number; // in MB
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        <!-- Theme Settings -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </div>

          <div class="p-4 space-y-4">
            <!-- Dark Mode Toggle -->
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">Dark Mode</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark themes</p>
              </div>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  [checked]="preferences().darkMode"
                  (change)="toggleDarkMode()">
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Playback Settings -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Playback</h2>
          </div>

          <div class="p-4 space-y-4">
            <!-- Auto Play -->
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">Auto Play</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Automatically play next song</p>
              </div>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  [checked]="preferences().autoPlay"
                  (change)="onAutoPlayChange($event)">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <!-- Shuffle Mode -->
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">Shuffle Mode</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Play songs in random order</p>
              </div>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  [checked]="preferences().shuffleMode"
                  (change)="onShuffleModeChange($event)">
                <span class="toggle-slider"></span>
              </label>
            </div>

            <!-- Repeat Mode -->
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">Repeat Mode</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Control repeat behavior</p>
              </div>
              <select
                class="select"
                [value]="preferences().repeatMode"
                (change)="onRepeatModeChange($event)">
                <option value="none">No Repeat</option>
                <option value="one">Repeat One</option>
                <option value="all">Repeat All</option>
              </select>
            </div>

            <!-- Download Quality -->
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">Download Quality</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Audio quality for downloads</p>
              </div>
              <select
                class="select"
                [value]="preferences().downloadQuality"
                (change)="onDownloadQualityChange($event)">
                <option value="high">High Quality</option>
                <option value="medium">Medium Quality</option>
                <option value="low">Low Quality</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Storage Settings -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Storage</h2>
          </div>

          <div class="p-4 space-y-4">
            <!-- Cache Size -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h3 class="font-medium text-gray-900 dark:text-white">Cache Size</h3>
                <span class="text-sm text-gray-500">{{ preferences().cacheSize }} MB</span>
              </div>
              <input
                type="range"
                class="range-slider w-full"
                min="100"
                max="2000"
                step="100"
                [value]="preferences().cacheSize"
                (input)="onCacheSizeChange($event)">
              <div class="flex justify-between text-xs text-gray-400">
                <span>100 MB</span>
                <span>2 GB</span>
              </div>
            </div>

            <!-- Storage Info -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2">
              <div class="flex justify-between items-center">
                <span class="text-gray-600 dark:text-gray-400">Total Storage</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ storageInfo().totalSize }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-600 dark:text-gray-400">Cache Size</span>
                <span class="font-medium text-gray-900 dark:text-white">{{ storageInfo().cacheSize }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Account Settings -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-4">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Account</h2>
          </div>

          <div class="p-4 space-y-4">
            <!-- User Info -->
            <div class="flex items-center space-x-3">
              <img
                [src]="user()?.photoURL || 'assets/images/default-avatar.svg'"
                [alt]="user()?.displayName"
                class="w-12 h-12 rounded-full object-cover">
              <div>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ user()?.displayName || 'Guest User' }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ user()?.email || 'No email' }}
                </p>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="space-y-2">
              <button (click)="exportData()" class="btn btn-secondary w-full">
                Export Data
              </button>
              <button (click)="logout()" class="btn btn-primary w-full">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsPage implements OnInit {
  private authService = inject(AuthService);
  private databaseService = inject(DatabaseService);
  private audioPlayerService = inject(AudioPlayerService);
  private router = inject(Router);

  user = this.authService.currentUser;
  preferences = signal<UserPreferences>({
    darkMode: false,
    autoPlay: true,
    shuffleMode: false,
    repeatMode: 'none',
    downloadQuality: 'high',
    notifications: true,
    backgroundPlay: true,
    storageLocation: '/storage/music',
    cacheSize: 500
  });

  ngOnInit() {
    this.loadPreferences();
  }

  async loadPreferences() {
    // Load user preferences from database or local storage
    // This would be implemented based on your storage strategy
  }

  toggleDarkMode() {
    const current = this.preferences();
    this.preferences.set({
      ...current,
      darkMode: !current.darkMode
    });
    this.savePreferences();
  }

  onAutoPlayChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const current = this.preferences();
    this.preferences.set({
      ...current,
      autoPlay: target.checked
    });
    this.savePreferences();
  }

  onShuffleModeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const current = this.preferences();
    this.preferences.set({
      ...current,
      shuffleMode: target.checked
    });
    this.savePreferences();
  }

  onRepeatModeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const current = this.preferences();
    this.preferences.set({
      ...current,
      repeatMode: target.value as 'none' | 'one' | 'all'
    });
    this.savePreferences();
  }

  onDownloadQualityChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const current = this.preferences();
    this.preferences.set({
      ...current,
      downloadQuality: target.value as 'high' | 'medium' | 'low'
    });
    this.savePreferences();
  }

  onCacheSizeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const current = this.preferences();
    this.preferences.set({
      ...current,
      cacheSize: parseInt(target.value)
    });
    this.savePreferences();
  }

  async savePreferences() {
    // Save preferences to database or local storage
    // This would be implemented based on your storage strategy
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
