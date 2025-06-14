import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton, IonIcon, IonProgressBar, IonSpinner } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { download, cloudDownload, checkmarkCircle, closeCircle, pause, play } from 'ionicons/icons';

import { Song, DataSong } from '../../interfaces/song.interface';
import { DownloadService } from '../../services/download.service';
import { DatabaseService } from '../../services/database.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-download-button',
  template: `
    <div class="download-button-container">
      <!-- Not Downloaded State -->
      <ion-button
        *ngIf="downloadStatus === 'none'"
        fill="outline"
        size="small"
        (click)="onDownloadClick()"
        [disabled]="isLoading"
        class="download-btn">
        <ion-icon name="download" slot="start"></ion-icon>
        Download
      </ion-button>

      <!-- Downloading State -->
      <div
        *ngIf="downloadStatus === 'downloading'"
        class="downloading-container flex items-center space-x-2">
        <ion-button
          fill="outline"
          size="small"
          (click)="onCancelDownload()"
          color="medium"
          class="cancel-btn">
          <ion-icon name="close-circle" slot="start"></ion-icon>
          Cancel
        </ion-button>

        <div class="progress-info flex flex-col items-center">
          <ion-spinner name="circular" class="w-4 h-4"></ion-spinner>
          <span class="text-xs text-gray-600 dark:text-gray-400">{{ downloadProgress }}%</span>
        </div>
      </div>

      <!-- Download Completed State -->
      <ion-button
        *ngIf="downloadStatus === 'completed'"
        fill="solid"
        size="small"
        color="success"
        disabled
        class="completed-btn">
        <ion-icon name="checkmark-circle" slot="start"></ion-icon>
        Downloaded
      </ion-button>

      <!-- Download Failed State -->
      <ion-button
        *ngIf="downloadStatus === 'failed'"
        fill="outline"
        size="small"
        color="danger"
        (click)="onRetryDownload()"
        class="retry-btn">
        <ion-icon name="cloud-download" slot="start"></ion-icon>
        Retry
      </ion-button>
    </div>
  `,
  styles: [`
    .download-button-container {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .downloading-container {
      min-width: 120px;
    }

    .progress-info {
      min-width: 40px;
    }

    .download-btn {
      --color: var(--ion-color-primary);
    }

    .completed-btn {
      --color: var(--ion-color-success);
    }

    .retry-btn {
      --color: var(--ion-color-danger);
    }

    .cancel-btn {
      --color: var(--ion-color-medium);
    }
  `],
  imports: [CommonModule, IonButton, IonIcon, IonSpinner],
  standalone: true
})
export class DownloadButtonComponent implements OnInit, OnDestroy {
  @Input() song?: Song;
  @Input() youtubeData?: DataSong;
  @Input() size: 'small' | 'default' | 'large' = 'small';
  @Input() showProgress = true;

  @Output() downloadStarted = new EventEmitter<void>();
  @Output() downloadCompleted = new EventEmitter<void>();
  @Output() downloadFailed = new EventEmitter<string>();
  @Output() downloadCancelled = new EventEmitter<void>();

  downloadStatus: 'none' | 'downloading' | 'completed' | 'failed' = 'none';
  downloadProgress = 0;
  isLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private downloadService: DownloadService,
    private databaseService: DatabaseService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ download, cloudDownload, checkmarkCircle, closeCircle, pause, play });
  }

  ngOnInit() {
    this.initializeDownloadStatus();
    this.subscribeToDownloadUpdates();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeDownloadStatus() {
    if (this.song) {
      this.downloadStatus = this.song.downloadStatus || 'none';
      this.downloadProgress = this.song.downloadProgress || 0;
    }
  }

  private subscribeToDownloadUpdates() {
    // Subscribe to download progress if needed
    // This could be implemented as an Observable in DownloadService
  }

  async onDownloadClick() {
    if (!this.youtubeData) {
      console.error('No YouTube data provided for download');
      return;
    }

    this.isLoading = true;
    this.downloadStarted.emit();

    try {
      const success = await this.downloadService.downloadSongCrossPlatform(this.youtubeData);

      if (success) {
        this.downloadStatus = 'completed';
        this.downloadProgress = 100;
        this.downloadCompleted.emit();
      } else {
        this.downloadStatus = 'failed';
        this.downloadFailed.emit('Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      this.downloadStatus = 'failed';
      this.downloadFailed.emit(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  onCancelDownload() {
    // Implementation for canceling download
    this.downloadStatus = 'none';
    this.downloadProgress = 0;
    this.downloadCancelled.emit();
    this.cdr.markForCheck();
  }

  async onRetryDownload() {
    this.downloadStatus = 'none';
    this.downloadProgress = 0;
    await this.onDownloadClick();
  }

  /**
   * Get icon name based on download status
   */
  getStatusIcon(): string {
    switch (this.downloadStatus) {
      case 'downloading':
        return 'cloud-download';
      case 'completed':
        return 'checkmark-circle';
      case 'failed':
        return 'close-circle';
      default:
        return 'download';
    }
  }

  /**
   * Get button color based on download status
   */
  getStatusColor(): string {
    switch (this.downloadStatus) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'danger';
      case 'downloading':
        return 'medium';
      default:
        return 'primary';
    }
  }

  /**
   * Check if download is in progress
   */
  get isDownloading(): boolean {
    return this.downloadStatus === 'downloading';
  }

  /**
   * Check if download is completed
   */
  get isCompleted(): boolean {
    return this.downloadStatus === 'completed';
  }

  /**
   * Check if download failed
   */
  get isFailed(): boolean {
    return this.downloadStatus === 'failed';
  }
}
