import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NotificationService, AppNotification } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          <ion-icon name="notifications" slot="start"></ion-icon>
          Notifications
          <ion-badge color="danger" slot="end" *ngIf="unreadCount > 0">
            {{ unreadCount }}
          </ion-badge>
        </ion-card-title>
        <ion-card-subtitle>
          Stay updated on your downloads
        </ion-card-subtitle>
      </ion-card-header>

      <ion-card-content>
        <!-- Actions -->
        <div class="notification-actions mb-4">
          <ion-button
            fill="outline"
            size="small"
            (click)="markAllAsRead()"
            [disabled]="unreadCount === 0">
            <ion-icon name="checkmark-done" slot="start"></ion-icon>
            Mark All Read
          </ion-button>

          <ion-button
            fill="clear"
            size="small"
            color="danger"
            (click)="clearAll()"
            [disabled]="notifications.length === 0">
            <ion-icon name="trash" slot="start"></ion-icon>
            Clear All
          </ion-button>
        </div>

        <!-- Empty State -->
        <div *ngIf="notifications.length === 0" class="empty-state text-center py-8">
          <ion-icon name="notifications-off" size="large" color="medium"></ion-icon>
          <p class="text-gray-500 mt-2">No notifications yet</p>
        </div>

        <!-- Notification List -->
        <div class="notification-list" *ngIf="notifications.length > 0">
          <ion-item
            *ngFor="let notification of notifications; trackBy: trackByNotificationId"
            [class.unread]="!notification.read"
            class="notification-item">

            <ion-icon
              [name]="getNotificationIcon(notification.type)"
              [color]="getNotificationColor(notification.type)"
              slot="start">
            </ion-icon>

            <ion-label (click)="markAsRead(notification.id)">
              <h3>{{ notification.title }}</h3>
              <p>{{ notification.message }}</p>
              <div class="notification-meta">
                <span class="timestamp">{{ formatTimestamp(notification.timestamp) }}</span>
                <ion-badge
                  [color]="getNotificationColor(notification.type)"
                  class="type-badge">
                  {{ getTypeLabel(notification.type) }}
                </ion-badge>
              </div>
            </ion-label>

            <!-- Actions -->
            <div slot="end" class="notification-actions-list">
              <div *ngIf="notification.actions" class="inline-actions">
                <ion-button
                  *ngFor="let action of notification.actions"
                  fill="clear"
                  size="small"
                  (click)="handleAction(notification, action.id)">
                  <ion-icon [name]="action.icon || 'ellipsis-horizontal'"></ion-icon>
                </ion-button>
              </div>

              <ion-button
                fill="clear"
                size="small"
                color="medium"
                (click)="clearNotification(notification.id)">
                <ion-icon name="close"></ion-icon>
              </ion-button>
            </div>
          </ion-item>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .notification-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .notification-item {
      margin-bottom: 8px;
      border-radius: 8px;
      transition: background-color 0.2s ease;
    }

    .notification-item.unread {
      background-color: var(--ion-color-primary-tint);
      border-left: 3px solid var(--ion-color-primary);
    }

    .notification-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .timestamp {
      font-size: 0.75rem;
      color: var(--ion-color-medium);
    }

    .type-badge {
      font-size: 0.7rem;
    }

    .notification-actions-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .inline-actions {
      display: flex;
      gap: 4px;
    }

    .empty-state {
      min-height: 150px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }
  `]
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private subscriptions = new Subscription();

  notifications: AppNotification[] = [];
  unreadCount = 0;

  ngOnInit() {
    this.subscriptions.add(
      this.notificationService.getNotifications().subscribe(notifications => {
        this.notifications = notifications;
      })
    );

    this.subscriptions.add(
      this.notificationService.getUnreadCount().subscribe(count => {
        this.unreadCount = count;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  trackByNotificationId(index: number, notification: AppNotification): string {
    return notification.id;
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'download-complete': return 'checkmark-circle';
      case 'download-failed': return 'alert-circle';
      case 'queue-complete': return 'checkmark-done-circle';
      case 'storage-warning': return 'warning';
      case 'offline-mode': return 'wifi-off';
      default: return 'information-circle';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'download-complete': return 'success';
      case 'download-failed': return 'danger';
      case 'queue-complete': return 'primary';
      case 'storage-warning': return 'warning';
      case 'offline-mode': return 'medium';
      default: return 'primary';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'download-complete': return 'Download';
      case 'download-failed': return 'Error';
      case 'queue-complete': return 'Queue';
      case 'storage-warning': return 'Storage';
      case 'offline-mode': return 'Network';
      default: return 'Info';
    }
  }

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  }

  async markAsRead(notificationId: string) {
    await this.notificationService.markAsRead(notificationId);
  }

  async markAllAsRead() {
    const unreadNotifications = this.notifications.filter(n => !n.read);
    for (const notification of unreadNotifications) {
      await this.notificationService.markAsRead(notification.id);
    }
  }

  async clearNotification(notificationId: string) {
    await this.notificationService.clearNotification(notificationId);
  }

  async clearAll() {
    await this.notificationService.clearAllNotifications();
  }

  async handleAction(notification: AppNotification, actionId: string) {
    // Mark as read when action is taken
    if (!notification.read) {
      await this.markAsRead(notification.id);
    }

    // Handle specific actions
    switch (actionId) {
      case 'play':
        this.handlePlayAction(notification);
        break;
      case 'view':
      case 'view-library':
        this.handleViewLibraryAction();
        break;
      case 'retry':
        this.handleRetryAction(notification);
        break;
      case 'manage-storage':
        this.handleManageStorageAction();
        break;
      case 'dismiss':
        await this.clearNotification(notification.id);
        break;
      default:
        console.log('Unknown action:', actionId);
    }
  }

  private handlePlayAction(notification: AppNotification) {
    const songData = notification.data?.songData;
    if (songData) {
      // Navigate to player or start playing
      console.log('Play song:', songData);
      // TODO: Implement play logic
    }
  }

  private handleViewLibraryAction() {
    // Navigate to library
    console.log('Navigate to library');
    // TODO: Implement navigation
  }

  private handleRetryAction(notification: AppNotification) {
    const songData = notification.data?.songData;
    if (songData) {
      // Retry download
      console.log('Retry download:', songData);
      // TODO: Implement retry logic
    }
  }

  private handleManageStorageAction() {
    // Navigate to storage management
    console.log('Navigate to storage management');
    // TODO: Implement navigation
  }
}
