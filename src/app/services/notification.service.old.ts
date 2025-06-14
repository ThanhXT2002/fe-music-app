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

  // Notification queue
  private notifications$ = new BehaviorSubject<AppNotification[]>([]);
  private unreadCount$ = new BehaviorSubject<number>(0);

  // Settings
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

  // Permission status
  private permissionStatus$ = new BehaviorSubject<NotificationPermission>('default');

  constructor() {
    this.initializeService();
    this.loadSettings();
    this.loadNotifications();
  }

  // === INITIALIZATION ===

  private async initializeService() {
    if (this.isNative) {
      await this.initializeNativeNotifications();
    } else if (this.isSupported) {
      await this.initializeWebNotifications();
    }

    this.updatePermissionStatus();
  }

  private async initializeNativeNotifications() {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      // Request permission
      const permission = await LocalNotifications.requestPermissions();
      this.permissionStatus$.next(permission.display === 'granted' ? 'granted' : 'denied');

      // Listen for notification actions
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        this.handleNotificationAction(notification);
      });

      // Listen for notification received
      LocalNotifications.addListener('localNotificationReceived', (notification) => {
        this.handleNotificationReceived(notification);
      });

    } catch (error) {
      console.error('Failed to initialize native notifications:', error);
    }
  }

  private async initializeWebNotifications() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'NOTIFICATION_CLICK') {
            this.handleNotificationClick(event.data.notification);
          }
        });

      } catch (error) {
        console.error('Failed to initialize web notifications:', error);
      }
    }
  }

  // === PERMISSION MANAGEMENT ===

  async requestPermission(): Promise<boolean> {
    if (this.isNative) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';
        this.permissionStatus$.next(granted ? 'granted' : 'denied');
        return granted;
      } catch (error) {
        console.error('Failed to request native notification permission:', error);
        return false;
      }
    } else if (this.isSupported) {
      try {
        const permission = await Notification.requestPermission();
        this.permissionStatus$.next(permission);
        return permission === 'granted';
      } catch (error) {
        console.error('Failed to request web notification permission:', error);
        return false;
      }
    }

    return false;
  }

  getPermissionStatus(): Observable<NotificationPermission> {
    return this.permissionStatus$.asObservable();
  }

  private updatePermissionStatus() {
    if (this.isSupported && !this.isNative) {
      this.permissionStatus$.next(Notification.permission);
    }
  }

  // === NOTIFICATION SENDING ===

  async sendDownloadCompleteNotification(songData: DataSong): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.downloadComplete) return;

    const notification: AppNotification = {
      id: `download-complete-${songData.id}-${Date.now()}`,
      type: 'download-complete',
      title: 'Download Complete',
      message: `${songData.title} by ${songData.artist}`,
      data: { songData },
      timestamp: new Date(),
      read: false,
      persistent: false,
      actions: [
        { id: 'play', title: 'Play Now', icon: 'play' },
        { id: 'view', title: 'View in Library', icon: 'library' }
      ]
    };

    await this.sendNotification(notification);
  }

  async sendDownloadFailedNotification(songData: DataSong, error: string): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.downloadFailed) return;

    const notification: AppNotification = {
      id: `download-failed-${songData.id}-${Date.now()}`,
      type: 'download-failed',
      title: 'Download Failed',
      message: `Failed to download ${songData.title}: ${error}`,
      data: { songData, error },
      timestamp: new Date(),
      read: false,
      persistent: true,
      actions: [
        { id: 'retry', title: 'Retry', icon: 'refresh' },
        { id: 'dismiss', title: 'Dismiss', icon: 'close' }
      ]
    };

    await this.sendNotification(notification);
  }

  async sendQueueCompleteNotification(completedCount: number): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.queueComplete) return;

    const notification: AppNotification = {
      id: `queue-complete-${Date.now()}`,
      type: 'queue-complete',
      title: 'All Downloads Complete',
      message: `${completedCount} songs have been downloaded successfully`,
      data: { completedCount },
      timestamp: new Date(),
      read: false,
      persistent: false,
      actions: [
        { id: 'view-library', title: 'View Library', icon: 'library' }
      ]
    };

    await this.sendNotification(notification);
  }

  async sendStorageWarningNotification(usagePercent: number): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.storageWarning) return;

    const notification: AppNotification = {
      id: `storage-warning-${Date.now()}`,
      type: 'storage-warning',
      title: 'Storage Almost Full',
      message: `${usagePercent}% of storage is used. Consider cleaning up old downloads.`,
      data: { usagePercent },
      timestamp: new Date(),
      read: false,
      persistent: true,
      actions: [
        { id: 'manage-storage', title: 'Manage Storage', icon: 'settings' },
        { id: 'dismiss', title: 'Dismiss', icon: 'close' }
      ]
    };

    await this.sendNotification(notification);
  }

  async sendOfflineModeNotification(isOffline: boolean): Promise<void> {
    const settings = this.settings$.value;
    if (!settings.offlineMode) return;

    const notification: AppNotification = {
      id: `offline-mode-${Date.now()}`,
      type: 'offline-mode',
      title: isOffline ? 'You\'re Offline' : 'Back Online',
      message: isOffline
        ? 'You can still play downloaded songs'
        : 'Connection restored. You can download new songs.',
      data: { isOffline },
      timestamp: new Date(),
      read: false,
      persistent: false
    };

    await this.sendNotification(notification);
  }

  async sendCustomNotification(notification: Partial<AppNotification>): Promise<void> {
    const fullNotification: AppNotification = {
      id: notification.id || `custom-${Date.now()}`,
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

  // === CORE NOTIFICATION LOGIC ===

  private async sendNotification(notification: AppNotification): Promise<void> {
    // Add to notification queue
    this.addNotificationToQueue(notification);

    // Send platform-specific notification
    if (this.permissionStatus$.value === 'granted') {
      if (this.isNative) {
        await this.sendNativeNotification(notification);
      } else if (this.isSupported) {
        await this.sendWebNotification(notification);
      }
    }

    // Handle sound and vibration
    await this.handleNotificationFeedback(notification);
  }

  private async sendNativeNotification(notification: AppNotification): Promise<void> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      await LocalNotifications.schedule({
        notifications: [{
          id: parseInt(notification.id.replace(/\D/g, '').slice(-9)) || Date.now(),
          title: notification.title,
          body: notification.message,
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#3880ff',
          sound: this.settings$.value.soundEnabled ? 'default' : undefined,
          schedule: { at: new Date() },
          extra: {
            notificationId: notification.id,
            data: notification.data
          },
          actionTypeId: notification.actions?.length ? 'DOWNLOAD_ACTIONS' : undefined
        }]
      });

    } catch (error) {
      console.error('Failed to send native notification:', error);
    }
  }

  private async sendWebNotification(notification: AppNotification): Promise<void> {
    try {
      const webNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/assets/icon/icon.png',
        badge: '/assets/icon/badge.png',
        tag: notification.id,
        requireInteraction: notification.persistent,
        silent: !this.settings$.value.soundEnabled,
        data: {
          notificationId: notification.id,
          data: notification.data,
          actions: notification.actions
        }
      });

      webNotification.onclick = () => {
        this.handleNotificationClick(notification);
        webNotification.close();
      };

      // Auto-close non-persistent notifications
      if (!notification.persistent) {
        setTimeout(() => webNotification.close(), 5000);
      }

    } catch (error) {
      console.error('Failed to send web notification:', error);
    }
  }

  private async handleNotificationFeedback(notification: AppNotification): Promise<void> {
    const settings = this.settings$.value;

    // Handle vibration
    if (settings.vibrationEnabled && 'vibrate' in navigator) {
      const pattern = notification.type === 'download-failed' ? [200, 100, 200] : [100];
      navigator.vibrate(pattern);
    }

    // Handle native vibration
    if (this.isNative && settings.vibrationEnabled) {
      try {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch (error) {
        console.error('Failed to trigger haptic feedback:', error);
      }
    }
  }

  // === NOTIFICATION QUEUE MANAGEMENT ===

  private addNotificationToQueue(notification: AppNotification): void {
    const currentNotifications = this.notifications$.value;
    const updatedNotifications = [notification, ...currentNotifications].slice(0, 50); // Keep last 50

    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount();
    this.persistNotifications();
  }

  markAsRead(notificationId: string): void {
    const notifications = this.notifications$.value;
    const updatedNotifications = notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );

    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount();
    this.persistNotifications();
  }

  markAllAsRead(): void {
    const notifications = this.notifications$.value;
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));

    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount();
    this.persistNotifications();
  }

  removeNotification(notificationId: string): void {
    const notifications = this.notifications$.value;
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);

    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount();
    this.persistNotifications();
  }

  clearAllNotifications(): void {
    this.notifications$.next([]);
    this.updateUnreadCount();
    this.persistNotifications();
  }

  private updateUnreadCount(): void {
    const notifications = this.notifications$.value;
    const unreadCount = notifications.filter(n => !n.read).length;
    this.unreadCount$.next(unreadCount);
  }

  // === EVENT HANDLERS ===

  private handleNotificationAction(notification: any): void {
    const actionId = notification.actionId;
    const notificationData = notification.notification.extra;

    // Handle specific actions
    switch (actionId) {
      case 'play':
        this.handlePlayAction(notificationData);
        break;
      case 'retry':
        this.handleRetryAction(notificationData);
        break;
      case 'view-library':
        this.handleViewLibraryAction();
        break;
      case 'manage-storage':
        this.handleManageStorageAction();
        break;
    }
  }

  private handleNotificationReceived(notification: any): void {
    // Handle when notification is received (can be used for analytics)
    console.log('Notification received:', notification);
  }

  private handleNotificationClick(notification: AppNotification): void {
    // Mark as read
    this.markAsRead(notification.id);

    // Handle default click action based on type
    switch (notification.type) {
      case 'download-complete':
        // Navigate to library or player
        break;
      case 'download-failed':
        // Navigate to downloads page
        break;
      case 'storage-warning':
        // Navigate to storage management
        break;
    }
  }

  private handlePlayAction(data: any): void {
    // Emit event to play the song
    console.log('Play action triggered:', data);
  }

  private handleRetryAction(data: any): void {
    // Emit event to retry download
    console.log('Retry action triggered:', data);
  }

  private handleViewLibraryAction(): void {
    // Navigate to library
    console.log('View library action triggered');
  }

  private handleManageStorageAction(): void {
    // Navigate to storage management
    console.log('Manage storage action triggered');
  }

  // === SETTINGS MANAGEMENT ===

  updateSettings(newSettings: Partial<NotificationSettings>): void {
    const currentSettings = this.settings$.value;
    const updatedSettings = { ...currentSettings, ...newSettings };

    this.settings$.next(updatedSettings);
    this.persistSettings();
  }

  getSettings(): Observable<NotificationSettings> {
    return this.settings$.asObservable();
  }

  // === PUBLIC API ===

  showNotification(notification: Partial<AppNotification>): Promise<void> {
    return this.sendCustomNotification(notification);
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
    await this.saveSettings();
  }

  async markAsRead(notificationId: string): Promise<void> {
    const notifications = this.notifications$.value;
    const updatedNotifications = notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount();
    await this.saveNotifications();
  }

  async clearNotification(notificationId: string): Promise<void> {
    const notifications = this.notifications$.value;
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    this.notifications$.next(updatedNotifications);
    this.updateUnreadCount();
    await this.saveNotifications();
  }

  async clearAllNotifications(): Promise<void> {
    this.notifications$.next([]);
    this.unreadCount$.next(0);
    await this.saveNotifications();
  }

  // === PRIVATE IMPLEMENTATION ===

  private async persistSettings(): Promise<void> {
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

  private async loadSettings(): Promise<void> {
    try {
      let settingsData: string | null = null;

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        const result = await Preferences.get({ key: 'notificationSettings' });
        settingsData = result.value;
      } else {
        settingsData = localStorage.getItem('notificationSettings');
      }

      if (settingsData) {
        const settings: NotificationSettings = JSON.parse(settingsData);
        this.settings$.next(settings);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }

  private async persistNotifications(): Promise<void> {
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

  private async loadNotifications(): Promise<void> {
    try {
      let notificationsData: string | null = null;

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        const result = await Preferences.get({ key: 'appNotifications' });
        notificationsData = result.value;
      } else {
        notificationsData = localStorage.getItem('appNotifications');
      }

      if (notificationsData) {
        const notifications: AppNotification[] = JSON.parse(notificationsData);
        this.notifications$.next(notifications);
        this.updateUnreadCount();
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }
}
