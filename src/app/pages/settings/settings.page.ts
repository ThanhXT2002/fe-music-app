import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlaylistService } from '../../services/playlist.service';
import { AlertController } from '@ionic/angular';
import { InstallPromptComponent } from '../../components/install-prompt/install-prompt.component';
import { routeAnimation } from 'src/app/shared/route-animation';
import { Capacitor } from '@capacitor/core';
import { AudioPlayerService } from '../../services/audio-player.service';
import { DownloadService } from '../../services/download.service';
import { AccountPanelComponent } from "src/app/components/account-panel/account-panel.component";

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, InstallPromptComponent, AccountPanelComponent],
  templateUrl: './settings.page.html',
  animations: [routeAnimation],
})
export class SettingsPage implements OnInit {
  private playlistService = inject(PlaylistService);
  private alertController = inject(AlertController);
  private audioPlayerService = inject(AudioPlayerService);
  private downloadService = inject(DownloadService);
  currentSong = this.audioPlayerService.currentSong;
  isNative = Capacitor.isNativePlatform();


  ngOnInit() {

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
              // Also clear download notification caches
              this.downloadService.resetNotificationState();

              const alert = await this.alertController.create({
                mode: 'ios',
                header: 'Success',
                message: 'Database and notification cache cleared successfully!',
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
      message: 'TXT Music Player v1.0.1\nA modern music player for your favorite songs.',
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
      message: 'This will clear notification caches and reset download states. Continue?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear Cache',
          handler: async () => {
            this.downloadService.resetNotificationState();

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
