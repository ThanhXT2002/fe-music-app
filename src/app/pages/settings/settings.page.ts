import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PlaylistService } from '../../services/playlist.service';
import { AlertController } from '@ionic/angular';
import { InstallPromptComponent } from '../../components/install-prompt/install-prompt.component';
import { User } from '@angular/fire/auth';
import { routeAnimation } from 'src/app/shared/route-animation';
import { IonContent } from "@ionic/angular/standalone";
import { Capacitor } from '@capacitor/core';
import { AudioPlayerService } from '../../services/audio-player.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, InstallPromptComponent],
  templateUrl: './settings.page.html',
  animations: [routeAnimation],
})
export class SettingsPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private playlistService = inject(PlaylistService);
  private alertController = inject(AlertController);
  private audioPlayerService = inject(AudioPlayerService);
  currentSong = this.audioPlayerService.currentSong;
  isNative = Capacitor.isNativePlatform();

  // Sử dụng signal để track user state
  user = signal<User | null>(null);

  ngOnInit() {
    // Subscribe to user changes
    this.authService.user$.subscribe((user) => {
      console.log('User updated in settings:', user);
      this.user.set(user);
    });
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

  // Database Management
  async clearDatabase() {
    const confirm = await this.alertController.create({
      mode: 'ios',
      header: 'Clear Database',
      message: 'This will delete ALL data including songs and playlists. Are you sure?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: async () => {
            const success = await this.playlistService.clearAllDatabase();
            if (success) {
              const alert = await this.alertController.create({
                mode: 'ios',
                header: 'Success',
                message: 'Database cleared successfully!',
                buttons: ['OK']
              });
              await alert.present();
            }
          }
        }
      ]
    });

    await confirm.present();
  }

  // Import/Export functions (placeholders)
  async exportData() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Export Data',
      message: 'This feature will be available soon.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async importData() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Import Data',
      message: 'This feature will be available soon.',
      buttons: ['OK']
    });
    await alert.present();
  }

  // Settings functions (placeholders)
  async showAppInfo() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'App Information',
      message: 'TXT Music Player v1.0.0\nA modern music player for your favorite songs.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async showPrivacyPolicy() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Privacy Policy',
      message: 'Privacy policy details will be available soon.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async showTermsOfService() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Terms of Service',
      message: 'Terms of service details will be available soon.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async showHelp() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Help & Support',
      message: 'For help and support, please contact us at support@txtmusic.com',
      buttons: ['OK']
    });
    await alert.present();
  }

  async clearCache() {
    const confirm = await this.alertController.create({
      mode: 'ios',
      header: 'Clear Cache',
      message: 'This will clear app cache but keep your data. Continue?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear Cache',
          handler: async () => {
            await this.playlistService.clearAllCache();
            const alert = await this.alertController.create({
              mode: 'ios',
              header: 'Success',
              message: 'Cache cleared successfully!',
              buttons: ['OK']
            });
            await alert.present();
          }
        }
      ]
    });

    await confirm.present();
  }
}
