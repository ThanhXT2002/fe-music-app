import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonProgressBar,
  IonItem,
  IonLabel,
  IonList,
  IonBadge,
  IonAlert,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  saveOutline,
  downloadOutline,
  trashOutline,
  refreshOutline,
  cloudDownloadOutline,
  checkmarkCircleOutline,
  alertCircleOutline
} from 'ionicons/icons';

import { DatabaseService } from '../../services/database.service';
import { IndexedDBService } from '../../services/indexeddb.service';
import { DownloadService } from '../../services/download.service';
import { AnalyticsService } from '../../services/analytics.service';
import { Platform } from '@ionic/angular';

interface StorageStats {
  used: number;
  available: number;
  usedPercentage: number;
  usedFormatted: string;
  availableFormatted: string;
}

interface DownloadStats {
  totalDownloaded: number;
  totalSize: number;
  downloading: number;
  failed: number;
  totalSizeFormatted: string;
}

@Component({
  selector: 'app-storage-management',
  template: `
    <div class="storage-management-container p-4">
      <!-- Storage Usage Card -->
      <ion-card class="storage-card">
        <ion-card-header>
          <ion-card-title class="flex items-center">
            <ion-icon name="save-outline" class="mr-2"></ion-icon>
            Storage Usage
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <div class="storage-info">
            <!-- Storage Progress Bar -->
            <ion-progress-bar
              [value]="storageStats.usedPercentage / 100"
              [color]="getStorageColor()"
              class="mb-4">
            </ion-progress-bar>

            <!-- Storage Details -->
            <div class="storage-details grid grid-cols-2 gap-4 text-sm">
              <div class="text-center">
                <div class="font-semibold text-lg">{{ storageStats.usedFormatted }}</div>
                <div class="text-gray-600 dark:text-gray-400">Used</div>
              </div>
              <div class="text-center">
                <div class="font-semibold text-lg">{{ storageStats.availableFormatted }}</div>
                <div class="text-gray-600 dark:text-gray-400">Available</div>
              </div>
            </div>

            <!-- Usage Percentage -->
            <div class="text-center mt-2">
              <span class="text-lg font-bold" [class]="getStorageTextColor()">
                {{ storageStats.usedPercentage.toFixed(1) }}% Used
              </span>
            </div>
          </div>
        </ion-card-content>
      </ion-card>

      <!-- Download Statistics Card -->
      <ion-card class="downloads-card">
        <ion-card-header>
          <ion-card-title class="flex items-center">
            <ion-icon name="download-outline" class="mr-2"></ion-icon>
            Download Statistics
          </ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <ion-list class="download-stats-list">
            <!-- Total Downloaded -->
            <ion-item>
              <ion-icon name="checkmark-circle-outline" slot="start" color="success"></ion-icon>
              <ion-label>
                <h3>Downloaded Songs</h3>
                <p>{{ downloadStats.totalSizeFormatted }}</p>
              </ion-label>
              <ion-badge color="success" slot="end">{{ downloadStats.totalDownloaded }}</ion-badge>
            </ion-item>

            <!-- Currently Downloading -->
            <ion-item>
              <ion-icon name="cloud-download-outline" slot="start" color="primary"></ion-icon>
              <ion-label>
                <h3>Downloading</h3>
                <p>In progress</p>
              </ion-label>
              <ion-badge color="primary" slot="end">{{ downloadStats.downloading }}</ion-badge>
            </ion-item>

            <!-- Failed Downloads -->
            <ion-item>
              <ion-icon name="alert-circle-outline" slot="start" color="danger"></ion-icon>
              <ion-label>
                <h3>Failed Downloads</h3>
                <p>Need retry</p>
              </ion-label>
              <ion-badge color="danger" slot="end">{{ downloadStats.failed }}</ion-badge>
            </ion-item>
          </ion-list>
        </ion-card-content>
      </ion-card>

      <!-- Storage Management Actions -->
      <ion-card class="actions-card">
        <ion-card-header>
          <ion-card-title>Storage Management</ion-card-title>
        </ion-card-header>

        <ion-card-content>
          <div class="actions-grid grid grid-cols-1 gap-3">
            <!-- Refresh Stats -->
            <ion-button
              fill="outline"
              (click)="refreshStats()"
              [disabled]="isLoading">
              <ion-icon name="refresh-outline" slot="start"></ion-icon>
              Refresh Statistics
            </ion-button>

            <!-- Clear Failed Downloads -->
            <ion-button
              fill="outline"
              color="warning"
              (click)="clearFailedDownloads()"
              [disabled]="isLoading || downloadStats.failed === 0">
              <ion-icon name="alert-circle-outline" slot="start"></ion-icon>
              Clear Failed Downloads ({{ downloadStats.failed }})
            </ion-button>

            <!-- Clear Old Downloads -->
            <ion-button
              fill="outline"
              color="medium"
              (click)="clearOldDownloads()"
              [disabled]="isLoading">
              <ion-icon name="trash-outline" slot="start"></ion-icon>
              Clear Downloads Older Than 30 Days
            </ion-button>

            <!-- Clear All Downloads -->
            <ion-button
              fill="solid"
              color="danger"
              (click)="clearAllDownloads()"
              [disabled]="isLoading || downloadStats.totalDownloaded === 0">
              <ion-icon name="trash-outline" slot="start"></ion-icon>
              Clear All Downloads ({{ downloadStats.totalDownloaded }})
            </ion-button>
          </div>
        </ion-card-content>
      </ion-card>
    </div>
  `,
  styles: [`
    .storage-management-container {
      max-width: 600px;
      margin: 0 auto;
    }

    .storage-card {
      margin-bottom: 1rem;
    }

    .downloads-card {
      margin-bottom: 1rem;
    }

    .actions-card {
      margin-bottom: 1rem;
    }

    .storage-info {
      padding: 1rem 0;
    }

    .download-stats-list {
      padding: 0;
    }

    .actions-grid {
      padding: 0.5rem 0;
    }

    ion-progress-bar {
      height: 8px;
      border-radius: 4px;
    }

    .storage-details {
      margin-top: 1rem;
    }

    .text-success {
      color: var(--ion-color-success);
    }

    .text-warning {
      color: var(--ion-color-warning);
    }

    .text-danger {
      color: var(--ion-color-danger);
    }
  `],
  imports: [
    CommonModule,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonButton,
    IonIcon,
    IonProgressBar,
    IonItem,
    IonLabel,
    IonList,
    IonBadge
  ],
  standalone: true
})
export class StorageManagementComponent implements OnInit {
  storageStats: StorageStats = {
    used: 0,
    available: 0,
    usedPercentage: 0,
    usedFormatted: '0 MB',
    availableFormatted: '0 MB'
  };

  downloadStats: DownloadStats = {
    totalDownloaded: 0,
    totalSize: 0,
    downloading: 0,
    failed: 0,
    totalSizeFormatted: '0 MB'
  };

  isLoading = false;
  platform: string;
  constructor(
    private databaseService: DatabaseService,
    private indexedDBService: IndexedDBService,
    private downloadService: DownloadService,
    private analyticsService: AnalyticsService,
    private platformService: Platform,
    private alertController: AlertController,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef
  ) {
    this.platform = this.platformService.is('hybrid') ? 'native' : 'web';addIcons({
      saveOutline,
      downloadOutline,
      trashOutline,
      refreshOutline,
      cloudDownloadOutline,
      checkmarkCircleOutline,
      alertCircleOutline
    });
  }

  ngOnInit() {
    this.loadStorageStats();
    this.loadDownloadStats();
  }

  async refreshStats() {
    this.isLoading = true;
    await Promise.all([
      this.loadStorageStats(),
      this.loadDownloadStats()
    ]);
    this.isLoading = false;
    this.showToast('Statistics refreshed successfully', 'success');
  }

  private async loadStorageStats() {
    try {
      if (this.platform === 'web') {
        const usage = await this.indexedDBService.getStorageUsage();
        this.storageStats = {
          used: usage.used,
          available: usage.available,
          usedPercentage: usage.available > 0 ? (usage.used / usage.available) * 100 : 0,
          usedFormatted: this.formatBytes(usage.used),
          availableFormatted: this.formatBytes(usage.available)
        };
      } else {
        // For native, we could use Capacitor Filesystem to get storage info
        // For now, use mock data
        this.storageStats = {
          used: 0,
          available: 1024 * 1024 * 1024, // 1GB
          usedPercentage: 0,
          usedFormatted: '0 MB',
          availableFormatted: '1 GB'
        };
      }
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  }

  private async loadDownloadStats() {
    try {
      const stats = await this.databaseService.getDownloadStats();
      this.downloadStats = {
        ...stats,
        totalSizeFormatted: this.formatBytes(stats.totalSize)
      };
    } catch (error) {
      console.error('Error loading download stats:', error);
    }
  }

  async clearFailedDownloads() {
    const alert = await this.alertController.create({
      header: 'Clear Failed Downloads',
      message: `Are you sure you want to clear ${this.downloadStats.failed} failed downloads?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear',
          role: 'confirm',
          handler: async () => {
            await this.performClearFailedDownloads();
          }
        }
      ]
    });

    await alert.present();
  }

  async clearOldDownloads() {
    const alert = await this.alertController.create({
      header: 'Clear Old Downloads',
      message: 'This will remove downloads older than 30 days. Are you sure?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear',
          role: 'confirm',
          handler: async () => {
            await this.performClearOldDownloads();
          }
        }
      ]
    });

    await alert.present();
  }

  async clearAllDownloads() {
    const alert = await this.alertController.create({
      header: 'Clear All Downloads',
      message: `This will permanently delete all ${this.downloadStats.totalDownloaded} downloaded songs. This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete All',
          role: 'confirm',
          handler: async () => {
            await this.performClearAllDownloads();
          }
        }
      ]
    });

    await alert.present();
  }

  private async performClearFailedDownloads() {
    try {
      this.isLoading = true;

      // Get failed downloads and clear them
      const failedSongs = await this.databaseService.getSongsByDownloadStatus('failed');

      for (const song of failedSongs) {
        await this.databaseService.updateSongDownloadStatus(song.id, 'none', 0);
      }

      await this.loadDownloadStats();
      this.showToast(`Cleared ${failedSongs.length} failed downloads`, 'success');
    } catch (error) {
      console.error('Error clearing failed downloads:', error);
      this.showToast('Error clearing failed downloads', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private async performClearOldDownloads() {
    try {
      this.isLoading = true;

      if (this.platform === 'web') {
        const cleared = await this.indexedDBService.clearOldBlobs(30);
        this.showToast(`Cleared ${cleared} old downloads`, 'success');
      } else {
        // For native, we would need to implement file system cleanup
        this.showToast('Old downloads cleanup not implemented for native', 'warning');
      }

      await this.loadStorageStats();
      await this.loadDownloadStats();
    } catch (error) {
      console.error('Error clearing old downloads:', error);
      this.showToast('Error clearing old downloads', 'danger');
    } finally {
      this.isLoading = false;
    }
  }
  private async performClearAllDownloads() {
    try {
      this.isLoading = true;
      const startTime = Date.now();

      // Clear all downloaded songs
      const downloadedSongs = await this.databaseService.getSongsByDownloadStatus('completed');
      let totalClearedSize = 0;

      for (const song of downloadedSongs) {
        // Clear blob data if web platform
        if (this.platform === 'web' && song.audioBlobId) {
          await this.indexedDBService.deleteBlobFromIndexedDB(song.audioBlobId);
        }
        if (this.platform === 'web' && song.thumbnailBlobId) {
          await this.indexedDBService.deleteBlobFromIndexedDB(song.thumbnailBlobId);
        }

        // Reset download status
        await this.databaseService.updateSongDownloadStatus(song.id, 'none', 0);
        await this.databaseService.updateSongBlobIds(song.id, undefined, undefined);
      }      // Track storage cleanup
      await this.analyticsService.trackStorageUsage(
        true,
        'manual_cleanup',
        totalClearedSize
      );

      await this.loadStorageStats();
      await this.loadDownloadStats();
      this.showToast(`Cleared all ${downloadedSongs.length} downloads`, 'success');
    } catch (error) {
      console.error('Error clearing all downloads:', error);
      this.showToast('Error clearing all downloads', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  getStorageColor(): string {
    if (this.storageStats.usedPercentage > 90) return 'danger';
    if (this.storageStats.usedPercentage > 75) return 'warning';
    return 'success';
  }

  getStorageTextColor(): string {
    if (this.storageStats.usedPercentage > 90) return 'text-danger';
    if (this.storageStats.usedPercentage > 75) return 'text-warning';
    return 'text-success';
  }
}
