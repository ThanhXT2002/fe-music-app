import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, interval, switchMap, filter } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { DownloadService, DownloadTask } from './download.service';
import { DatabaseService } from './database.service';
import { AnalyticsService } from './analytics.service';
import { PerformanceMonitoringService } from './performance-monitoring.service';
import { DataSong } from '../interfaces/song.interface';

export interface DownloadSchedule {
  id: string;
  songData: DataSong;
  scheduledTime: Date;
  conditions: {
    wifiOnly: boolean;
    batteryLevel?: number;
    timeWindow?: { start: string; end: string };
  };
  status: 'pending' | 'queued' | 'downloading' | 'completed' | 'failed';
  priority: number; // 1-10, 10 being highest
  retryCount: number;
  maxRetries: number;
}

export interface NetworkCondition {
  isOnline: boolean;
  isWifi: boolean;
  connectionType: string;
  downlinkSpeed?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BackgroundDownloadService {
  private downloadService = inject(DownloadService);
  private databaseService = inject(DatabaseService);
  private analyticsService = inject(AnalyticsService);
  private performanceMonitoringService = inject(PerformanceMonitoringService);

  private isNative = Capacitor.isNativePlatform();
  private serviceWorkerRegistration?: ServiceWorkerRegistration;

  // Queue management
  private downloadQueue$ = new BehaviorSubject<DownloadSchedule[]>([]);
  private isProcessingQueue = false;

  // Network monitoring
  private networkCondition$ = new BehaviorSubject<NetworkCondition>({
    isOnline: navigator.onLine,
    isWifi: false,
    connectionType: 'unknown'
  });

  // Background processing settings
  private settings = {
    maxConcurrentDownloads: 3,
    retryDelay: 30000, // 30 seconds
    queueCheckInterval: 10000, // 10 seconds
    wifiOnlyDefault: true,
    minimumBatteryLevel: 20
  };

  constructor() {
    this.initializeService();
    this.startQueueProcessor();
    this.monitorNetworkConditions();
  }

  // === INITIALIZATION ===

  private async initializeService() {
    if (!this.isNative && 'serviceWorker' in navigator) {
      try {
        // Register service worker for PWA background downloads
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered for background downloads');

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Load persisted queue from storage
    await this.loadPersistedQueue();
  }

  // === QUEUE MANAGEMENT ===

  scheduleDownload(
    songData: DataSong,
    conditions: DownloadSchedule['conditions'] = { wifiOnly: true },
    priority: number = 5,
    scheduledTime?: Date
  ): string {
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const schedule: DownloadSchedule = {
      id: scheduleId,
      songData,
      scheduledTime: scheduledTime || new Date(),
      conditions,
      status: 'pending',
      priority,
      retryCount: 0,
      maxRetries: 3
    };

    const currentQueue = this.downloadQueue$.value;
    const updatedQueue = [...currentQueue, schedule].sort((a, b) => b.priority - a.priority);

    this.downloadQueue$.next(updatedQueue);
    this.persistQueue();

    console.log(`Download scheduled: ${songData.title} (Priority: ${priority})`);
    return scheduleId;
  }

  cancelScheduledDownload(scheduleId: string): boolean {
    const currentQueue = this.downloadQueue$.value;
    const updatedQueue = currentQueue.filter(item => item.id !== scheduleId);

    if (updatedQueue.length !== currentQueue.length) {
      this.downloadQueue$.next(updatedQueue);
      this.persistQueue();
      return true;    }
    return false;
  }

  // === BACKGROUND PROCESSING ===

  private startQueueProcessor() {
    // Check queue every 10 seconds
    interval(this.settings.queueCheckInterval)
      .pipe(
        filter(() => !this.isProcessingQueue),
        switchMap(() => this.processQueue())
      )
      .subscribe();
  }
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    try {      // Track queue processing start
      await this.analyticsService.trackPerformanceEvent(
        'queue_process',
        undefined,
        undefined,
        undefined,
        { queueSize: this.downloadQueue$.value.length }
      );

      const queue = this.downloadQueue$.value;
      const pendingDownloads = queue.filter(item =>
        item.status === 'pending' &&
        new Date() >= item.scheduledTime
      );

      // Check current network/device conditions
      const canDownload = await this.checkDownloadConditions();
      if (!canDownload) {
        console.log('Background download conditions not met');
        return;
      }// Get currently active downloads
      const activeDownloads = await this.downloadService.getDownloadsByStatusAsync('downloading');
      const availableSlots = this.settings.maxConcurrentDownloads - activeDownloads.length;

      if (availableSlots <= 0) {
        console.log('Maximum concurrent downloads reached');
        return;
      }

      // Process pending downloads
      const downloadsToProcess = pendingDownloads
        .slice(0, availableSlots)
        .filter(schedule => this.meetsConditions(schedule));

      for (const schedule of downloadsToProcess) {
        await this.processScheduledDownload(schedule);
      }

    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async processScheduledDownload(schedule: DownloadSchedule): Promise<void> {
    try {
      // Update status to downloading
      this.updateScheduleStatus(schedule.id, 'downloading');

      // Start the actual download
      const success = await this.downloadService.downloadSong(schedule.songData);      if (success) {
        this.updateScheduleStatus(schedule.id, 'completed');
        this.removeFromQueueInternal(schedule.id);

        // Send notification if supported
        await this.sendDownloadCompleteNotification(schedule.songData);
      } else {
        await this.handleDownloadFailure(schedule);
      }

    } catch (error) {
      console.error('Error processing scheduled download:', error);
      await this.handleDownloadFailure(schedule);
    }
  }

  // === CONDITION CHECKING ===

  private async checkDownloadConditions(): Promise<boolean> {
    const networkCondition = this.networkCondition$.value;

    // Check online status
    if (!networkCondition.isOnline) {
      return false;
    }

    // Check battery level (native only)
    if (this.isNative) {
      const batteryLevel = await this.getBatteryLevel();
      if (batteryLevel < this.settings.minimumBatteryLevel) {
        console.log(`Battery level too low: ${batteryLevel}%`);
        return false;
      }
    }

    return true;
  }

  private meetsConditions(schedule: DownloadSchedule): boolean {
    const networkCondition = this.networkCondition$.value;

    // Check WiFi requirement
    if (schedule.conditions.wifiOnly && !networkCondition.isWifi) {
      return false;
    }

    // Check time window
    if (schedule.conditions.timeWindow) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const [startHour, startMin] = schedule.conditions.timeWindow.start.split(':').map(Number);
      const [endHour, endMin] = schedule.conditions.timeWindow.end.split(':').map(Number);

      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      if (currentTime < startTime || currentTime > endTime) {
        return false;
      }
    }

    return true;
  }

  // === NETWORK MONITORING ===

  private monitorNetworkConditions() {
    // Monitor online/offline status
    window.addEventListener('online', () => this.updateNetworkCondition({ isOnline: true }));
    window.addEventListener('offline', () => this.updateNetworkCondition({ isOnline: false }));

    // Monitor connection type (if available)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;

      const updateConnectionInfo = () => {
        this.updateNetworkCondition({
          isOnline: navigator.onLine,
          isWifi: connection.type === 'wifi',
          connectionType: connection.type || 'unknown',
          downlinkSpeed: connection.downlink
        });
      };

      connection.addEventListener('change', updateConnectionInfo);
      updateConnectionInfo(); // Initial update
    }
  }

  private updateNetworkCondition(update: Partial<NetworkCondition>) {
    const current = this.networkCondition$.value;
    this.networkCondition$.next({ ...current, ...update });
  }

  // === UTILITY METHODS ===

  private async getBatteryLevel(): Promise<number> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return Math.round(battery.level * 100);
      } catch (error) {
        console.warn('Could not get battery level:', error);
      }
    }
    return 100; // Assume full battery if unable to check
  }

  private updateScheduleStatus(scheduleId: string, status: DownloadSchedule['status']) {
    const queue = this.downloadQueue$.value;
    const updatedQueue = queue.map(item =>
      item.id === scheduleId ? { ...item, status } : item
    );
    this.downloadQueue$.next(updatedQueue);
    this.persistQueue();
  }
  private removeFromQueueInternal(scheduleId: string) {
    const queue = this.downloadQueue$.value;
    const updatedQueue = queue.filter(item => item.id !== scheduleId);
    this.downloadQueue$.next(updatedQueue);
    this.persistQueue();
  }

  private async handleDownloadFailure(schedule: DownloadSchedule) {
    schedule.retryCount++;

    if (schedule.retryCount >= schedule.maxRetries) {
      this.updateScheduleStatus(schedule.id, 'failed');
      await this.sendDownloadFailedNotification(schedule.songData);
    } else {
      // Reschedule for retry
      const retryTime = new Date(Date.now() + this.settings.retryDelay);
      const queue = this.downloadQueue$.value;
      const updatedQueue = queue.map(item =>
        item.id === schedule.id
          ? { ...item, status: 'pending' as const, scheduledTime: retryTime }
          : item
      );
      this.downloadQueue$.next(updatedQueue);
      this.persistQueue();
    }
  }

  // === PERSISTENCE ===
  private async persistQueue() {
    try {
      const queue = this.downloadQueue$.value;
      if (this.isNative) {
        // Use Capacitor Preferences for native
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({
          key: 'backgroundDownloadQueue',
          value: JSON.stringify(queue)
        });
      } else {
        // Use localStorage for web
        localStorage.setItem('backgroundDownloadQueue', JSON.stringify(queue));
      }
    } catch (error) {
      console.error('Failed to persist download queue:', error);
    }
  }

  private async loadPersistedQueue() {
    try {
      let queueData: string | null = null;

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        const result = await Preferences.get({ key: 'backgroundDownloadQueue' });
        queueData = result.value;
      } else {
        queueData = localStorage.getItem('backgroundDownloadQueue');
      }

      if (queueData) {
        const queue: DownloadSchedule[] = JSON.parse(queueData);
        // Reset downloading status to pending on app restart
        const cleanedQueue = queue.map(item => ({
          ...item,
          status: item.status === 'downloading' ? 'pending' as const : item.status
        }));
        this.downloadQueue$.next(cleanedQueue);
      }
    } catch (error) {
      console.error('Failed to load persisted download queue:', error);
    }
  }

  // === SERVICE WORKER COMMUNICATION ===

  private handleServiceWorkerMessage(event: MessageEvent) {
    const { type, data } = event.data;

    switch (type) {
      case 'DOWNLOAD_COMPLETE':
        this.updateScheduleStatus(data.scheduleId, 'completed');
        this.removeFromQueue(data.scheduleId);
        break;
      case 'DOWNLOAD_FAILED':
        // Handle failure from service worker
        break;
    }
  }

  // === NOTIFICATIONS ===

  private async sendDownloadCompleteNotification(songData: DataSong) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Download Complete', {
          body: `${songData.title} by ${songData.artist} has been downloaded`,
          icon: songData.thumbnail_url || '/assets/icon/icon.png',
          badge: '/assets/icon/badge.png',
          tag: `download-complete-${songData.id}`,
          requireInteraction: false
        });
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
    }
  }

  private async sendDownloadFailedNotification(songData: DataSong) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('Download Failed', {
          body: `Failed to download ${songData.title}`,
          icon: '/assets/icon/icon.png',
          badge: '/assets/icon/badge.png',
          tag: `download-failed-${songData.id}`,
          requireInteraction: true
        });
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
    }
  }

  // === PUBLIC API ===

  getDownloadQueue(): Observable<DownloadSchedule[]> {
    return this.downloadQueue$.asObservable();
  }

  getNetworkCondition(): Observable<NetworkCondition> {
    return this.networkCondition$.asObservable();
  }

  isQueueProcessing(): boolean {
    return this.isProcessingQueue;
  }

  async startQueueProcessing(): Promise<void> {
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  async pauseQueueProcessing(): Promise<void> {
    this.isProcessingQueue = false;
  }

  async clearQueue(): Promise<void> {
    this.downloadQueue$.next([]);
    await this.persistQueue();
  }

  async removeFromQueue(scheduleId: string): Promise<void> {
    const currentQueue = this.downloadQueue$.value;
    const updatedQueue = currentQueue.filter(item => item.id !== scheduleId);
    this.downloadQueue$.next(updatedQueue);
    await this.persistQueue();
  }

  async updateSchedule(scheduleId: string, updatedSchedule: DownloadSchedule): Promise<void> {
    const currentQueue = this.downloadQueue$.value;
    const scheduleIndex = currentQueue.findIndex(item => item.id === scheduleId);

    if (scheduleIndex !== -1) {
      currentQueue[scheduleIndex] = updatedSchedule;
      this.downloadQueue$.next([...currentQueue]);
      await this.persistQueue();    }
  }
}
