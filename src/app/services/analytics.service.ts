import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';

export interface DownloadMetrics {
  id: string;
  songId: string;
  songTitle: string;
  songArtist: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // Download duration in ms
  fileSize: number; // Size in bytes
  downloadSpeed?: number; // Bytes per second
  status: 'success' | 'failed' | 'cancelled';
  errorType?: string;
  errorMessage?: string;
  networkType: 'wifi' | 'cellular' | 'unknown';
  retryCount: number;
  userAgent: string;
  platform: 'web' | 'ios' | 'android';
}

export interface PerformanceMetrics {
  id: string;
  timestamp: Date;
  event: 'download_start' | 'download_complete' | 'download_failed' | 'download_retry' | 'queue_process';
  songId?: string;
  duration?: number;
  memoryUsage?: number;
  networkLatency?: number;
  errorDetails?: any;
  metadata?: any;
}

export interface StorageMetrics {
  id: string;
  timestamp: Date;
  totalUsed: number; // Bytes
  totalAvailable: number; // Bytes
  blobCount: number;
  filesCount: number;
  avgFileSize: number;
  largestFile: number;
  cleanupPerformed: boolean;
  cleanupReason?: string;
  cleanedSize?: number;
}

export interface AnalyticsReport {
  timeRange: { start: Date; end: Date };
  downloads: {
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    successRate: number;
    avgDownloadTime: number;
    avgDownloadSpeed: number;
    totalDataDownloaded: number;
  };
  performance: {
    avgStartTime: number;
    slowestDownload: number;
    fastestDownload: number;
    memoryUsageAvg: number;
    errorFrequency: { [key: string]: number };
  };
  storage: {
    currentUsage: number;
    peakUsage: number;
    cleanupFrequency: number;
    wastedSpace: number;
  };
  patterns: {
    popularHours: { [hour: string]: number };
    popularDays: { [day: string]: number };
    retryPatterns: { [retryCount: string]: number };
    networkPreference: { [networkType: string]: number };
  };
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private isNative = Capacitor.isNativePlatform();
  private platform = Capacitor.getPlatform();

  // Metrics storage
  private downloadMetrics$ = new BehaviorSubject<DownloadMetrics[]>([]);
  private performanceMetrics$ = new BehaviorSubject<PerformanceMetrics[]>([]);
  private storageMetrics$ = new BehaviorSubject<StorageMetrics[]>([]);

  // Settings
  private analyticsEnabled = true;
  private maxMetricsAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  private maxMetricsCount = 1000; // Maximum metrics to keep

  constructor() {
    this.initializeAnalytics();
  }

  // === PUBLIC API ===

  getDownloadMetrics(): Observable<DownloadMetrics[]> {
    return this.downloadMetrics$.asObservable();
  }

  getPerformanceMetrics(): Observable<PerformanceMetrics[]> {
    return this.performanceMetrics$.asObservable();
  }

  getStorageMetrics(): Observable<StorageMetrics[]> {
    return this.storageMetrics$.asObservable();
  }

  async generateReport(startDate: Date, endDate: Date): Promise<AnalyticsReport> {
    const downloadMetrics = this.downloadMetrics$.value.filter(
      m => m.startTime >= startDate && m.startTime <= endDate
    );
    const performanceMetrics = this.performanceMetrics$.value.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    );
    const storageMetrics = this.storageMetrics$.value.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    );

    return this.buildAnalyticsReport(downloadMetrics, performanceMetrics, storageMetrics, startDate, endDate);
  }

  // === DOWNLOAD TRACKING ===

  async trackDownloadStart(songId: string, songTitle: string, songArtist: string, fileSize: number): Promise<string> {
    if (!this.analyticsEnabled) return '';

    const metricId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const networkType = await this.getNetworkType();

    const metric: DownloadMetrics = {
      id: metricId,
      songId,
      songTitle,
      songArtist,
      startTime: new Date(),
      fileSize,
      networkType,
      retryCount: 0,
      userAgent: navigator.userAgent,
      platform: this.platform as any,
      status: 'success' // Will be updated on completion
    };

    this.addDownloadMetric(metric);
    await this.trackPerformanceEvent('download_start', songId);

    return metricId;
  }

  async trackDownloadComplete(metricId: string, actualFileSize?: number): Promise<void> {
    if (!this.analyticsEnabled || !metricId) return;

    const metrics = this.downloadMetrics$.value;
    const metricIndex = metrics.findIndex(m => m.id === metricId);

    if (metricIndex !== -1) {
      const metric = metrics[metricIndex];
      const endTime = new Date();
      const duration = endTime.getTime() - metric.startTime.getTime();
      const downloadSpeed = actualFileSize ? (actualFileSize / duration) * 1000 : undefined;

      const updatedMetric: DownloadMetrics = {
        ...metric,
        endTime,
        duration,
        downloadSpeed,
        status: 'success',
        fileSize: actualFileSize || metric.fileSize
      };

      metrics[metricIndex] = updatedMetric;
      this.downloadMetrics$.next([...metrics]);
      await this.persistMetrics();
      await this.trackPerformanceEvent('download_complete', metric.songId, duration);
    }
  }

  async trackDownloadFailed(metricId: string, errorType: string, errorMessage: string): Promise<void> {
    if (!this.analyticsEnabled || !metricId) return;

    const metrics = this.downloadMetrics$.value;
    const metricIndex = metrics.findIndex(m => m.id === metricId);

    if (metricIndex !== -1) {
      const metric = metrics[metricIndex];
      const endTime = new Date();
      const duration = endTime.getTime() - metric.startTime.getTime();

      const updatedMetric: DownloadMetrics = {
        ...metric,
        endTime,
        duration,
        status: 'failed',
        errorType,
        errorMessage
      };

      metrics[metricIndex] = updatedMetric;
      this.downloadMetrics$.next([...metrics]);
      await this.persistMetrics();
      await this.trackPerformanceEvent('download_failed', metric.songId, duration, undefined, { errorType, errorMessage });
    }
  }

  async trackDownloadRetry(songId: string): Promise<void> {
    if (!this.analyticsEnabled) return;

    // Update retry count for existing metric
    const metrics = this.downloadMetrics$.value;
    const latestMetric = metrics
      .filter(m => m.songId === songId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];

    if (latestMetric) {
      latestMetric.retryCount++;
      this.downloadMetrics$.next([...metrics]);
      await this.persistMetrics();
    }

    await this.trackPerformanceEvent('download_retry', songId);
  }

  // === PERFORMANCE TRACKING ===

  async trackPerformanceEvent(
    event: PerformanceMetrics['event'],
    songId?: string,
    duration?: number,
    memoryUsage?: number,
    metadata?: any
  ): Promise<void> {
    if (!this.analyticsEnabled) return;

    const metric: PerformanceMetrics = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      event,
      songId,
      duration,
      memoryUsage: memoryUsage || await this.getMemoryUsage(),
      networkLatency: await this.measureNetworkLatency(),
      metadata
    };

    this.addPerformanceMetric(metric);
  }

  // === STORAGE TRACKING ===

  async trackStorageUsage(cleanupPerformed = false, cleanupReason?: string, cleanedSize?: number): Promise<void> {
    if (!this.analyticsEnabled) return;

    const storageInfo = await this.getStorageInfo();

    const metric: StorageMetrics = {
      id: `storage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      totalUsed: storageInfo.used,
      totalAvailable: storageInfo.available,
      blobCount: storageInfo.blobCount,
      filesCount: storageInfo.filesCount,
      avgFileSize: storageInfo.avgFileSize,
      largestFile: storageInfo.largestFile,
      cleanupPerformed,
      cleanupReason,
      cleanedSize
    };

    this.addStorageMetric(metric);
  }

  // === ANALYTICS QUERIES ===

  getSuccessRate(timeRange?: { start: Date; end: Date }): number {
    const metrics = this.filterMetricsByTime(this.downloadMetrics$.value, timeRange);
    if (metrics.length === 0) return 0;

    const successCount = metrics.filter(m => m.status === 'success').length;
    return (successCount / metrics.length) * 100;
  }

  getAverageDownloadSpeed(timeRange?: { start: Date; end: Date }): number {
    const metrics = this.filterMetricsByTime(this.downloadMetrics$.value, timeRange)
      .filter(m => m.status === 'success' && m.downloadSpeed);

    if (metrics.length === 0) return 0;

    const totalSpeed = metrics.reduce((sum, m) => sum + (m.downloadSpeed || 0), 0);
    return totalSpeed / metrics.length;
  }

  getMostCommonErrors(timeRange?: { start: Date; end: Date }): { [errorType: string]: number } {
    const metrics = this.filterMetricsByTime(this.downloadMetrics$.value, timeRange)
      .filter(m => m.status === 'failed' && m.errorType);

    const errorCounts: { [errorType: string]: number } = {};
    metrics.forEach(m => {
      const errorType = m.errorType!;
      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
    });

    return errorCounts;
  }

  getStorageGrowthTrend(days = 7): { date: string; usage: number }[] {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

    const metrics = this.storageMetrics$.value.filter(
      m => m.timestamp >= startDate && m.timestamp <= endDate
    );

    // Group by day
    const dailyUsage: { [date: string]: number } = {};
    metrics.forEach(m => {
      const dateKey = m.timestamp.toISOString().split('T')[0];
      dailyUsage[dateKey] = Math.max(dailyUsage[dateKey] || 0, m.totalUsed);
    });

    return Object.entries(dailyUsage)
      .map(([date, usage]) => ({ date, usage }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // === SETTINGS ===

  setAnalyticsEnabled(enabled: boolean): void {
    this.analyticsEnabled = enabled;
    this.saveSettings();
  }

  isAnalyticsEnabled(): boolean {
    return this.analyticsEnabled;
  }

  async clearAllMetrics(): Promise<void> {
    this.downloadMetrics$.next([]);
    this.performanceMetrics$.next([]);
    this.storageMetrics$.next([]);
    await this.persistMetrics();
  }

  async exportMetrics(): Promise<string> {
    const data = {
      downloadMetrics: this.downloadMetrics$.value,
      performanceMetrics: this.performanceMetrics$.value,
      storageMetrics: this.storageMetrics$.value,
      exportDate: new Date().toISOString(),
      platform: this.platform
    };

    return JSON.stringify(data, null, 2);
  }

  // === PRIVATE METHODS ===

  private async initializeAnalytics(): Promise<void> {
    await this.loadMetrics();
    await this.loadSettings();
    this.scheduleCleanup();

    // Track initial storage state
    await this.trackStorageUsage();
  }

  private addDownloadMetric(metric: DownloadMetrics): void {
    const metrics = this.downloadMetrics$.value;
    metrics.push(metric);
    this.downloadMetrics$.next([...metrics]);
    this.persistMetrics();
  }

  private addPerformanceMetric(metric: PerformanceMetrics): void {
    const metrics = this.performanceMetrics$.value;
    metrics.push(metric);
    this.performanceMetrics$.next([...metrics]);
    this.persistMetrics();
  }

  private addStorageMetric(metric: StorageMetrics): void {
    const metrics = this.storageMetrics$.value;
    metrics.push(metric);
    this.storageMetrics$.next([...metrics]);
    this.persistMetrics();
  }

  private filterMetricsByTime<T extends { startTime?: Date; timestamp?: Date }>(
    metrics: T[],
    timeRange?: { start: Date; end: Date }
  ): T[] {
    if (!timeRange) return metrics;

    return metrics.filter(m => {
      const time = m.startTime || m.timestamp;
      return time && time >= timeRange.start && time <= timeRange.end;
    });
  }

  private buildAnalyticsReport(
    downloadMetrics: DownloadMetrics[],
    performanceMetrics: PerformanceMetrics[],
    storageMetrics: StorageMetrics[],
    startDate: Date,
    endDate: Date
  ): AnalyticsReport {
    const successfulDownloads = downloadMetrics.filter(m => m.status === 'success');
    const failedDownloads = downloadMetrics.filter(m => m.status === 'failed');

    return {
      timeRange: { start: startDate, end: endDate },
      downloads: {
        total: downloadMetrics.length,
        successful: successfulDownloads.length,
        failed: failedDownloads.length,
        cancelled: downloadMetrics.filter(m => m.status === 'cancelled').length,
        successRate: downloadMetrics.length > 0 ? (successfulDownloads.length / downloadMetrics.length) * 100 : 0,
        avgDownloadTime: this.calculateAverage(successfulDownloads.map(m => m.duration || 0)),
        avgDownloadSpeed: this.calculateAverage(successfulDownloads.map(m => m.downloadSpeed || 0)),
        totalDataDownloaded: successfulDownloads.reduce((sum, m) => sum + m.fileSize, 0)
      },
      performance: {
        avgStartTime: this.calculateAverage(performanceMetrics.filter(m => m.event === 'download_start').map(m => m.duration || 0)),
        slowestDownload: Math.max(...successfulDownloads.map(m => m.duration || 0), 0),
        fastestDownload: Math.min(...successfulDownloads.map(m => m.duration || Infinity)) || 0,
        memoryUsageAvg: this.calculateAverage(performanceMetrics.map(m => m.memoryUsage || 0)),
        errorFrequency: this.getMostCommonErrors({ start: startDate, end: endDate })
      },
      storage: {
        currentUsage: storageMetrics[storageMetrics.length - 1]?.totalUsed || 0,
        peakUsage: Math.max(...storageMetrics.map(m => m.totalUsed), 0),
        cleanupFrequency: storageMetrics.filter(m => m.cleanupPerformed).length,
        wastedSpace: this.calculateWastedSpace(storageMetrics)
      },
      patterns: {
        popularHours: this.getPopularHours(downloadMetrics),
        popularDays: this.getPopularDays(downloadMetrics),
        retryPatterns: this.getRetryPatterns(downloadMetrics),
        networkPreference: this.getNetworkPreference(downloadMetrics)
      }
    };
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  private calculateWastedSpace(storageMetrics: StorageMetrics[]): number {
    // Calculate space that could be reclaimed
    const latest = storageMetrics[storageMetrics.length - 1];
    if (!latest) return 0;

    // Simplified calculation - in real implementation, this would be more sophisticated
    return latest.totalUsed * 0.1; // Assume 10% could be cleaned
  }

  private getPopularHours(downloadMetrics: DownloadMetrics[]): { [hour: string]: number } {
    const hourCounts: { [hour: string]: number } = {};
    downloadMetrics.forEach(m => {
      const hour = m.startTime.getHours().toString();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    return hourCounts;
  }

  private getPopularDays(downloadMetrics: DownloadMetrics[]): { [day: string]: number } {
    const dayCounts: { [day: string]: number } = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    downloadMetrics.forEach(m => {
      const day = dayNames[m.startTime.getDay()];
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    return dayCounts;
  }

  private getRetryPatterns(downloadMetrics: DownloadMetrics[]): { [retryCount: string]: number } {
    const retryCounts: { [retryCount: string]: number } = {};
    downloadMetrics.forEach(m => {
      const retries = m.retryCount.toString();
      retryCounts[retries] = (retryCounts[retries] || 0) + 1;
    });
    return retryCounts;
  }

  private getNetworkPreference(downloadMetrics: DownloadMetrics[]): { [networkType: string]: number } {
    const networkCounts: { [networkType: string]: number } = {};
    downloadMetrics.forEach(m => {
      networkCounts[m.networkType] = (networkCounts[m.networkType] || 0) + 1;
    });
    return networkCounts;
  }

  private async getNetworkType(): Promise<'wifi' | 'cellular' | 'unknown'> {
    try {
      if (this.isNative) {
        const { Network } = await import('@capacitor/network');
        const status = await Network.getStatus();
        return status.connectionType === 'wifi' ? 'wifi' :
               status.connectionType === 'cellular' ? 'cellular' : 'unknown';
      } else {
        // Web: Use Network Information API if available
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        if (connection) {
          return connection.type === 'wifi' ? 'wifi' :
                 connection.type.includes('cellular') ? 'cellular' : 'unknown';
        }
        return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  private async getMemoryUsage(): Promise<number> {
    try {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  private async measureNetworkLatency(): Promise<number> {
    try {
      const start = performance.now();
      await fetch('/favicon.ico', { mode: 'no-cors' });
      return performance.now() - start;
    } catch {
      return 0;
    }
  }

  private async getStorageInfo(): Promise<{
    used: number;
    available: number;
    blobCount: number;
    filesCount: number;
    avgFileSize: number;
    largestFile: number;
  }> {
    try {
      if (this.isNative) {
        // For native, would need to implement filesystem scanning
        return {
          used: 0,
          available: 1024 * 1024 * 1024, // 1GB default
          blobCount: 0,
          filesCount: 0,
          avgFileSize: 0,
          largestFile: 0
        };
      } else {
        // For web, use IndexedDB and storage estimates
        if ('storage' in navigator && 'estimate' in navigator.storage) {
          const estimate = await navigator.storage.estimate();
          return {
            used: estimate.usage || 0,
            available: estimate.quota || 0,
            blobCount: 0, // Would need to count from IndexedDB
            filesCount: 0,
            avgFileSize: 0,
            largestFile: 0
          };
        }
        return {
          used: 0,
          available: 0,
          blobCount: 0,
          filesCount: 0,
          avgFileSize: 0,
          largestFile: 0
        };
      }
    } catch {
      return {
        used: 0,
        available: 0,
        blobCount: 0,
        filesCount: 0,
        avgFileSize: 0,
        largestFile: 0
      };
    }
  }

  private scheduleCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  private cleanupOldMetrics(): void {
    const cutoffDate = new Date(Date.now() - this.maxMetricsAge);

    const downloadMetrics = this.downloadMetrics$.value.filter(
      m => m.startTime > cutoffDate
    ).slice(-this.maxMetricsCount);

    const performanceMetrics = this.performanceMetrics$.value.filter(
      m => m.timestamp > cutoffDate
    ).slice(-this.maxMetricsCount);

    const storageMetrics = this.storageMetrics$.value.filter(
      m => m.timestamp > cutoffDate
    ).slice(-this.maxMetricsCount);

    this.downloadMetrics$.next(downloadMetrics);
    this.performanceMetrics$.next(performanceMetrics);
    this.storageMetrics$.next(storageMetrics);

    this.persistMetrics();
  }

  private async persistMetrics(): Promise<void> {
    try {
      const data = {
        downloadMetrics: this.downloadMetrics$.value,
        performanceMetrics: this.performanceMetrics$.value,
        storageMetrics: this.storageMetrics$.value
      };

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({
          key: 'analyticsMetrics',
          value: JSON.stringify(data)
        });
      } else {
        localStorage.setItem('analyticsMetrics', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Failed to persist analytics metrics:', error);
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      let dataJson: string | null = null;

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        const result = await Preferences.get({ key: 'analyticsMetrics' });
        dataJson = result.value;
      } else {
        dataJson = localStorage.getItem('analyticsMetrics');
      }

      if (dataJson) {
        const data = JSON.parse(dataJson);
        this.downloadMetrics$.next(data.downloadMetrics || []);
        this.performanceMetrics$.next(data.performanceMetrics || []);
        this.storageMetrics$.next(data.storageMetrics || []);
      }
    } catch (error) {
      console.error('Failed to load analytics metrics:', error);
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const settings = {
        analyticsEnabled: this.analyticsEnabled,
        maxMetricsAge: this.maxMetricsAge,
        maxMetricsCount: this.maxMetricsCount
      };

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({
          key: 'analyticsSettings',
          value: JSON.stringify(settings)
        });
      } else {
        localStorage.setItem('analyticsSettings', JSON.stringify(settings));
      }
    } catch (error) {
      console.error('Failed to save analytics settings:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      let settingsJson: string | null = null;

      if (this.isNative) {
        const { Preferences } = await import('@capacitor/preferences');
        const result = await Preferences.get({ key: 'analyticsSettings' });
        settingsJson = result.value;
      } else {
        settingsJson = localStorage.getItem('analyticsSettings');
      }

      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        this.analyticsEnabled = settings.analyticsEnabled !== undefined ? settings.analyticsEnabled : true;
        this.maxMetricsAge = settings.maxMetricsAge || this.maxMetricsAge;
        this.maxMetricsCount = settings.maxMetricsCount || this.maxMetricsCount;
      }
    } catch (error) {
      console.error('Failed to load analytics settings:', error);
    }
  }
}
