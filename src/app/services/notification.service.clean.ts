import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { DataSong } from '../interfaces/song.interface';

export interface NotificationSettings {
  downloadComplete: boolean;
  downloadFailed: boolean;
  queueComplete: boolean;
  storageWarning: boolean;
  offlineMode: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;
}

export interface AppNotification {
  id: string;
  type: 'download-complete' | 'download-failed' | 'queue-complete' | 'storage-warning' | 'offline-mode' | 'info';
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  read: boolean;
  persistent: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private isNative = Capacitor.isNativePlatform();
  private isSupported = 'Notification' in window;

  // State management
  private notifications$ = new BehaviorSubject<AppNotification[]>([]);
  private unreadCount$ = new BehaviorSubject<number>(0);

  private settings$ = new BehaviorSubject<NotificationSettings>({
    downloadComplete: true,
    downloadFailed: true,
    queueComplete: true,
    storageWarning: true,
    offlineMode: true,
    soundEnabled: true,
    vibrationEnabled: true,
    badgeEnabled: true
  });

  private permissionStatus$ = new BehaviorSubject<NotificationPermission>('default');

  constructor() {
    this.initializeService();
  }

  // === PUBLIC API ===

  async showNotification(notification: Partial<AppNotification>): Promise<void> {
    const fullNotification: AppNotification = {
      id: notification.id || `notification-${Date.now()}`,
      type: notification.type || 'info',
      title: notification.title || 'Notification',
      message: notification.message || '',
      data: notification.data,
      timestamp: new Date(),
      read: false,
      persistent: notification.persistent || false,
      actions: notification.actions
    };

    await this.sendNotification(fullNotification);
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.notifications$.asObservable();
  }

  getUnreadCount(): Observable<number> {
    return this.unreadCount$.asObservable();
  }

  getSettings(): Observable<NotificationSettings> {
    return this.settings$.asObservable();
  }

  async updateSettings(settings: Partial<NotificationSettings>): Promise<void> {
    const currentSettings = this.settings$.value;
    const updatedSettings = { ...currentSettings, ...settings };
    this.settings$.next(updatedSettings);
    await this.persistSettings();
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notifications = this.notifications$.value;
    const updatedNotifications = notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount();
    await this.persistNotifications();
  }

  async clearNotification(notificationId: string): Promise<void> {
    const notifications = this.notifications$.value;
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount();
    await this.persistNotifications();
  }

  async clearAllNotifications(): Promise<void> {
    this.notifications$.next([]);
    this.unreadCount$.next(0);
    await this.persistNotifications();
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (this.isNative) {
      return await this.requestNativePermission();
    } else if (this.isSupported) {
      return await this.requestWebPermission();
    }
    return 'denied';
  }

  // === SPECIFIC NOTIFICATION TYPES ===

  async sendDownloadCompleteNotification(songData: DataSong): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.downloadComplete) return;

    await this.showNotification({
      type: 'download-complete',
      title: 'Download Complete',
      message: `${songData.title} by ${songData.artist}`,
      data: { songData },
      persistent: false,
      actions: [
        { id: 'play', title: 'Play Now', icon: 'play' },
        { id: 'view', title: 'View in Library', icon: 'library' }
      ]
    });
  }

  async sendDownloadFailedNotification(songData: DataSong, error: string): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.downloadFailed) return;

    await this.showNotification({
      type: 'download-failed',
      title: 'Download Failed',
      message: `Failed to download ${songData.title}: ${error}`,
      data: { songData, error },
      persistent: true,
      actions: [
        { id: 'retry', title: 'Retry', icon: 'refresh' },
        { id: 'dismiss', title: 'Dismiss', icon: 'close' }
      ]
    });
  }

  async sendQueueCompleteNotification(completedCount: number): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.queueComplete) return;

    await this.showNotification({
      type: 'queue-complete',
      title: 'All Downloads Complete',
      message: `${completedCount} songs have been downloaded successfully`,
      data: { completedCount },
      persistent: false,
      actions: [
        { id: 'view-library', title: 'View Library', icon: 'library' }
      ]
    });
  }

  async sendStorageWarningNotification(usagePercent: number): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.storageWarning) return;

    await this.showNotification({
      type: 'storage-warning',
      title: 'Storage Almost Full',
      message: `${usagePercent}% of storage is used. Consider cleaning up old downloads.`,
      data: { usagePercent },
      persistent: true,
      actions: [
        { id: 'manage-storage', title: 'Manage Storage', icon: 'settings' },
        { id: 'dismiss', title: 'Dismiss', icon: 'close' }
      ]
    });
  }

  // === PRIVATE IMPLEMENTATION ===

  private async initializeService() {
    if (this.isNative) {
      await this.initializeNativeNotifications();
    } else if (this.isSupported) {
      await this.initializeWebNotifications();
    }

    await this.loadSettings();
    await this.loadNotifications();
  }

  private async initializeNativeNotifications() {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      const permission = await LocalNotifications.requestPermissions();
      this.permissionStatus$.next(permission.display === 'granted' ? 'granted' : 'denied');

      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        this.handleNotificationAction(notification);
      });
    } catch (error) {
      console.error('Failed to initialize native notifications:', error);
    }
  }

  private async initializeWebNotifications() {
    this.permissionStatus$.next(Notification.permission);
  }

  private async requestNativePermission(): Promise<NotificationPermission> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const permission = await LocalNotifications.requestPermissions();
      const status = permission.display === 'granted' ? 'granted' : 'denied';
      this.permissionStatus$.next(status);
      return status;
    } catch (error) {
      return 'denied';
    }
  }

  private async requestWebPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) return 'denied';

    const permission = await Notification.requestPermission();
    this.permissionStatus$.next(permission);
    return permission;
  }

  private async sendNotification(notification: AppNotification): Promise<void> {
    this.addNotificationToQueue(notification);

    if (this.permissionStatus$.value === 'granted') {
      if (this.isNative) {
        await this.sendNativeNotification(notification);
      } else if (this.isSupported) {
        await this.sendWebNotification(notification);
      }
    }

    await this.handleNotificationFeedback(notification);
  }

  private addNotificationToQueue(notification: AppNotification) {
    const notifications = this.notifications$.value;
    notifications.unshift(notification);

    // Keep only last 100 notifications
    if (notifications.length > 100) {
      notifications.splice(100);
    }

    this.notifications$.next(notifications);
    this.updateUnreadCount();
    this.persistNotifications();
  }

  private updateUnreadCount() {
    const notifications = this.notifications$.value;
    const unreadCount = notifications.filter(n => !n.read).length;
    this.unreadCount$.next(unreadCount);
  }

  private async sendNativeNotification(notification: AppNotification) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      await LocalNotifications.schedule({
        notifications: [{
          id: parseInt(notification.id.replace(/\D/g, '')) || Date.now(),
          title: notification.title,
          body: notification.message,
          extra: notification.data,
          actionTypeId: notification.actions?.length ? 'action_group' : undefined
        }]
      });
    } catch (error) {
      console.error('Failed to send native notification:', error);
    }
  }

  private async sendWebNotification(notification: AppNotification) {
    try {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/assets/icon/icon.png',
        badge: '/assets/icon/badge.png',
        tag: notification.id,
        requireInteraction: notification.persistent,
        data: notification.data
      });
    } catch (error) {
      console.error('Failed to send web notification:', error);
    }
  }

  private async handleNotificationFeedback(notification: AppNotification) {
    const settings = this.settings$.value;

    if (settings.vibrationEnabled && this.isNative) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.error('Haptics not available:', error);
      }
    }

    if (settings.soundEnabled) {
      // Play notification sound (could be implemented)
    }
  }

  private handleNotificationAction(notification: any) {
    // Handle notification actions
    console.log('Notification action:', notification);
  }

  private async persistSettings() {
    try {
      const settings = this.settings$.value;
      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({
          key: 'notificationSettings',
          value: JSON.stringify(settings)
        });
      } else {
        localStorage.setItem('notificationSettings', JSON.stringify(settings));
      }
    } catch (error) {
      console.error('Failed to persist notification settings:', error);
    }
  }

  private async loadSettings() {
    try {
      let settingsJson: string | null = null;

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        const result = await Preferences.get({ key: 'notificationSettings' });
        settingsJson = result.value;
      } else {
        settingsJson = localStorage.getItem('notificationSettings');
      }

      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        this.settings$.next({ ...this.settings$.value, ...settings });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  private async persistNotifications() {
    try {
      const notifications = this.notifications$.value;
      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({
          key: 'appNotifications',
          value: JSON.stringify(notifications)
        });
      } else {
        localStorage.setItem('appNotifications', JSON.stringify(notifications));
      }
    } catch (error) {
      console.error('Failed to persist notifications:', error);
    }
  }

  private async loadNotifications() {
    try {
      let notificationsJson: string | null = null;

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        const result = await Preferences.get({ key: 'appNotifications' });
        notificationsJson = result.value;
      } else {
        notificationsJson = localStorage.getItem('appNotifications');
      }

      if (notificationsJson) {
        const notifications = JSON.parse(notificationsJson);
        this.notifications$.next(notifications);
        this.updateUnreadCount();
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }
}
