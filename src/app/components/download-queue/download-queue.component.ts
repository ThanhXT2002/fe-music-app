import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { BackgroundDownloadService, DownloadSchedule } from '../../services/background-download.service';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';
import { DataSong } from '../../interfaces/song.interface';

@Component({
  selector: 'app-download-queue',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="download" slot="start"></ion-icon>
          Download Queue
          <ion-badge color="primary" slot="end" *ngIf="queueItems.length > 0">
            {{ queueItems.length }}
          </ion-badge>
        </ion-card-title>
        <ion-card-subtitle>
          Manage and monitor your download queue
        </ion-card-subtitle>
      </ion-card-header>

      <ion-card-content>
        <div class="queue-controls mb-4">
          <ion-button
            fill="outline"
            size="small"
            (click)="startQueue()"
            [disabled]="isProcessing || queueItems.length === 0">
            <ion-icon name="play" slot="start"></ion-icon>
            Start Queue
          </ion-button>

          <ion-button
            fill="outline"
            size="small"
            color="medium"
            (click)="pauseQueue()"
            [disabled]="!isProcessing">
            <ion-icon name="pause" slot="start"></ion-icon>
            Pause Queue
          </ion-button>

          <ion-button
            fill="clear"
            size="small"
            color="danger"
            (click)="clearQueue()"
            [disabled]="queueItems.length === 0">
            <ion-icon name="trash" slot="start"></ion-icon>
            Clear All
          </ion-button>
        </div>

        <!-- Queue Empty State -->
        <div *ngIf="queueItems.length === 0" class="empty-state text-center py-8">
          <ion-icon name="download-outline" size="large" color="medium"></ion-icon>
          <p class="text-gray-500 mt-2">No downloads in queue</p>
          <ion-button fill="outline" size="small" (click)="openScheduler()">
            <ion-icon name="time" slot="start"></ion-icon>
            Schedule Downloads
          </ion-button>
        </div>

        <!-- Queue Items -->
        <div *ngFor="let item of queueItems; trackBy: trackByItemId" class="queue-item">
          <ion-item>
            <ion-thumbnail slot="start">
              <img [src]="item.songData.thumbnails?.medium?.url || 'assets/icons/music-note.svg'"
                   [alt]="item.songData.title">
            </ion-thumbnail>

            <ion-label>
              <h3>{{ item.songData.title }}</h3>
              <p>{{ item.songData.channelTitle }}</p>
              <div class="status-info">
                <ion-badge
                  [color]="getStatusColor(item.status)"
                  class="status-badge">
                  {{ getStatusText(item.status) }}
                </ion-badge>
                <span class="priority" *ngIf="item.priority > 5">
                  <ion-icon name="flash" color="warning"></ion-icon>
                  Priority: {{ item.priority }}
                </span>
                <span class="retry-info" *ngIf="item.retryCount > 0">
                  <ion-icon name="refresh" color="medium"></ion-icon>
                  Retry: {{ item.retryCount }}/{{ item.maxRetries }}
                </span>
              </div>
            </ion-label>

            <div slot="end" class="item-actions">
              <ion-button
                fill="clear"
                size="small"
                (click)="changePriority(item, item.priority + 1)"
                [disabled]="item.priority >= 10">
                <ion-icon name="arrow-up"></ion-icon>
              </ion-button>

              <ion-button
                fill="clear"
                size="small"
                (click)="changePriority(item, item.priority - 1)"
                [disabled]="item.priority <= 1">
                <ion-icon name="arrow-down"></ion-icon>
              </ion-button>

              <ion-button
                fill="clear"
                size="small"
                color="danger"
                (click)="removeFromQueue(item.id)">
                <ion-icon name="close"></ion-icon>
              </ion-button>
            </div>
          </ion-item>

          <!-- Progress for active downloads -->
          <ion-progress-bar
            *ngIf="item.status === 'downloading'"
            [value]="getDownloadProgress(item.id)">
          </ion-progress-bar>

          <!-- Scheduled time info -->
          <div *ngIf="item.scheduledTime && item.status === 'pending'" class="scheduled-info">
            <ion-icon name="time" color="medium"></ion-icon>
            <span>Scheduled for {{ formatScheduledTime(item.scheduledTime) }}</span>
          </div>
        </div>

        <!-- Network Status -->
        <div class="network-status mt-4" *ngIf="networkCondition">
          <ion-item lines="none">
            <ion-icon
              [name]="networkCondition.isOnline ? 'wifi' : 'wifi-outline'"
              [color]="networkCondition.isOnline ? 'success' : 'danger'"
              slot="start">
            </ion-icon>
            <ion-label>
              <h3>Network Status</h3>
              <p>
                {{ networkCondition.isOnline ? 'Online' : 'Offline' }} -
                {{ networkCondition.connectionType }}
                <span *ngIf="networkCondition.isWifi"> (WiFi)</span>
              </p>
            </ion-label>
          </ion-item>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .queue-controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .queue-item {
      border-bottom: 1px solid var(--ion-color-light);
      margin-bottom: 8px;
    }

    .queue-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }

    .status-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .status-badge {
      font-size: 0.7rem;
    }

    .priority, .retry-info {
      font-size: 0.7rem;
      color: var(--ion-color-medium);
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .item-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .scheduled-info {
      padding: 8px 16px;
      font-size: 0.8rem;
      color: var(--ion-color-medium);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .network-status {
      border-top: 1px solid var(--ion-color-light);
      padding-top: 16px;
    }

    .empty-state {
      min-height: 200px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
  `]
})
export class DownloadQueueComponent implements OnInit, OnDestroy {
  private backgroundDownloadService = inject(BackgroundDownloadService);
  private notificationService = inject(NotificationService);
  private subscriptions = new Subscription();

  queueItems: DownloadSchedule[] = [];
  isProcessing = false;
  networkCondition: any = null;

  ngOnInit() {    this.subscriptions.add(
      this.backgroundDownloadService.getDownloadQueue().subscribe(queue => {
        this.queueItems = queue.sort((a, b) => b.priority - a.priority);
        this.isProcessing = this.backgroundDownloadService.isQueueProcessing();
      })
    );

    this.subscriptions.add(
      this.backgroundDownloadService.getNetworkCondition().subscribe(condition => {
        this.networkCondition = condition;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  trackByItemId(index: number, item: DownloadSchedule): string {
    return item.id;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'medium';
      case 'queued': return 'warning';
      case 'downloading': return 'primary';
      case 'completed': return 'success';
      case 'failed': return 'danger';
      default: return 'medium';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'queued': return 'Queued';
      case 'downloading': return 'Downloading';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  }

  getDownloadProgress(itemId: string): number {
    // TODO: Get actual progress from download service
    return 0.5; // Placeholder
  }

  formatScheduledTime(scheduledTime: Date): string {
    const now = new Date();
    const scheduled = new Date(scheduledTime);

    if (scheduled.toDateString() === now.toDateString()) {
      return `Today at ${scheduled.toLocaleTimeString()}`;
    } else {
      return scheduled.toLocaleDateString() + ' at ' + scheduled.toLocaleTimeString();
    }
  }

  async startQueue() {
    try {
      await this.backgroundDownloadService.startQueueProcessing();
      this.notificationService.showNotification({
        type: 'info',
        title: 'Download Queue Started',
        message: 'Processing downloads in background',
        persistent: false
      });
    } catch (error) {
      console.error('Failed to start queue:', error);
    }
  }

  async pauseQueue() {
    try {
      await this.backgroundDownloadService.pauseQueueProcessing();
      this.notificationService.showNotification({
        type: 'info',
        title: 'Download Queue Paused',
        message: 'Background downloads have been paused',
        persistent: false
      });
    } catch (error) {
      console.error('Failed to pause queue:', error);
    }
  }

  async clearQueue() {
    try {
      await this.backgroundDownloadService.clearQueue();
      this.notificationService.showNotification({
        type: 'info',
        title: 'Queue Cleared',
        message: 'All pending downloads have been removed',
        persistent: false
      });
    } catch (error) {
      console.error('Failed to clear queue:', error);
    }
  }

  async removeFromQueue(itemId: string) {
    try {
      await this.backgroundDownloadService.removeFromQueue(itemId);
    } catch (error) {
      console.error('Failed to remove from queue:', error);
    }
  }

  async changePriority(item: DownloadSchedule, newPriority: number) {
    if (newPriority < 1 || newPriority > 10) return;

    try {
      await this.backgroundDownloadService.updateSchedule(item.id, {
        ...item,
        priority: newPriority
      });
    } catch (error) {
      console.error('Failed to change priority:', error);
    }
  }

  openScheduler() {
    // TODO: Open download scheduler modal
    console.log('Open download scheduler');
  }
}
