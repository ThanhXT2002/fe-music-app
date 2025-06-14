import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';
import { AnalyticsService } from './analytics.service';

export interface PerformanceAlert {
  id: string;
  type: 'slow_download' | 'memory_high' | 'storage_full' | 'error_spike' | 'network_poor';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metadata?: any;
  acknowledged: boolean;
}

export interface SystemHealth {
  overall: 'excellent' | 'good' | 'fair' | 'poor';
  download: {
    status: 'healthy' | 'degraded' | 'critical';
    successRate: number;
    avgSpeed: number;
    activeDownloads: number;
  };
  storage: {
    status: 'healthy' | 'warning' | 'critical';
    usagePercent: number;
    freeSpace: number;
    needsCleanup: boolean;
  };
  performance: {
    status: 'healthy' | 'degraded' | 'critical';
    memoryUsage: number;
    networkLatency: number;
    errorRate: number;
  };
}

export interface PerformanceThreshold {
  downloadSpeedMin: number; // bytes/sec
  downloadTimeoutMax: number; // milliseconds
  memoryUsageMax: number; // bytes
  storageUsageMax: number; // percentage
  errorRateMax: number; // percentage
  networkLatencyMax: number; // milliseconds
}

@Injectable({
  providedIn: 'root'
})
export class PerformanceMonitoringService {
  private analyticsService = inject(AnalyticsService);

  // State
  private alerts$ = new BehaviorSubject<PerformanceAlert[]>([]);
  private systemHealth$ = new BehaviorSubject<SystemHealth | null>(null);
  private monitoring = false;

  // Thresholds
  private thresholds: PerformanceThreshold = {
    downloadSpeedMin: 50 * 1024, // 50KB/s
    downloadTimeoutMax: 5 * 60 * 1000, // 5 minutes
    memoryUsageMax: 100 * 1024 * 1024, // 100MB
    storageUsageMax: 90, // 90%
    errorRateMax: 10, // 10%
    networkLatencyMax: 2000 // 2 seconds
  };

  // Monitoring intervals
  private healthCheckInterval?: number;
  private alertCheckInterval?: number;

  constructor() {
    this.initializeMonitoring();
  }

  // === PUBLIC API ===

  getAlerts(): Observable<PerformanceAlert[]> {
    return this.alerts$.asObservable();
  }

  getSystemHealth(): Observable<SystemHealth | null> {
    return this.systemHealth$.asObservable();
  }

  startMonitoring(): void {
    if (this.monitoring) return;

    this.monitoring = true;

    // Check system health every 30 seconds
    this.healthCheckInterval = window.setInterval(() => {
      this.checkSystemHealth();
    }, 30000);

    // Check for alerts every 10 seconds
    this.alertCheckInterval = window.setInterval(() => {
      this.checkForAlerts();
    }, 10000);

    console.log('🔍 Performance monitoring started');
  }

  stopMonitoring(): void {
    this.monitoring = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
      this.alertCheckInterval = undefined;
    }

    console.log('🔍 Performance monitoring stopped');
  }

  updateThresholds(newThresholds: Partial<PerformanceThreshold>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.saveThresholds();
  }

  getThresholds(): PerformanceThreshold {
    return { ...this.thresholds };
  }

  acknowledgeAlert(alertId: string): void {
    const alerts = this.alerts$.value;
    const alertIndex = alerts.findIndex(a => a.id === alertId);

    if (alertIndex !== -1) {
      alerts[alertIndex].acknowledged = true;
      this.alerts$.next([...alerts]);
      this.persistAlerts();
    }
  }

  clearAcknowledgedAlerts(): void {
    const alerts = this.alerts$.value.filter(a => !a.acknowledged);
    this.alerts$.next(alerts);
    this.persistAlerts();
  }

  async generateHealthReport(): Promise<{
    summary: SystemHealth;
    recommendations: string[];
    issues: PerformanceAlert[];
  }> {
    const health = await this.checkSystemHealth();
    const alerts = this.alerts$.value.filter(a => !a.acknowledged);
    const recommendations = this.generateRecommendations(health, alerts);

    return {
      summary: health,
      recommendations,
      issues: alerts
    };
  }

  // === MONITORING METHODS ===

  async checkSystemHealth(): Promise<SystemHealth> {
    const downloadHealth = await this.assessDownloadHealth();
    const storageHealth = await this.assessStorageHealth();
    const performanceHealth = await this.assessPerformanceHealth();

    const overall = this.calculateOverallHealth(downloadHealth, storageHealth, performanceHealth);

    const health: SystemHealth = {
      overall,
      download: downloadHealth,
      storage: storageHealth,
      performance: performanceHealth
    };

    this.systemHealth$.next(health);
    return health;
  }

  private async assessDownloadHealth(): Promise<SystemHealth['download']> {
    const last24Hours = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date()
    };

    const successRate = this.analyticsService.getSuccessRate(last24Hours);
    const avgSpeed = this.analyticsService.getAverageDownloadSpeed(last24Hours);

    // Get active downloads count (would need to be implemented in analytics)
    const activeDownloads = 0; // Placeholder

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (successRate < 50 || avgSpeed < this.thresholds.downloadSpeedMin / 2) {
      status = 'critical';
    } else if (successRate < 80 || avgSpeed < this.thresholds.downloadSpeedMin) {
      status = 'degraded';
    }

    return {
      status,
      successRate,
      avgSpeed,
      activeDownloads
    };
  }

  private async assessStorageHealth(): Promise<SystemHealth['storage']> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const total = estimate.quota || 1;
        const usagePercent = (used / total) * 100;
        const freeSpace = total - used;

        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (usagePercent > 95) {
          status = 'critical';
        } else if (usagePercent > this.thresholds.storageUsageMax) {
          status = 'warning';
        }

        return {
          status,
          usagePercent,
          freeSpace,
          needsCleanup: usagePercent > 80
        };
      } else {
        // Fallback for unsupported browsers
        return {
          status: 'healthy',
          usagePercent: 0,
          freeSpace: 1024 * 1024 * 1024, // 1GB
          needsCleanup: false
        };
      }
    } catch (error) {
      return {
        status: 'critical',
        usagePercent: 100,
        freeSpace: 0,
        needsCleanup: true
      };
    }
  }

  private async assessPerformanceHealth(): Promise<SystemHealth['performance']> {
    const memoryUsage = await this.getMemoryUsage();
    const networkLatency = await this.measureNetworkLatency();
    const errorRate = await this.calculateRecentErrorRate();

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';

    if (memoryUsage > this.thresholds.memoryUsageMax * 1.5 ||
        networkLatency > this.thresholds.networkLatencyMax * 2 ||
        errorRate > this.thresholds.errorRateMax * 2) {
      status = 'critical';
    } else if (memoryUsage > this.thresholds.memoryUsageMax ||
               networkLatency > this.thresholds.networkLatencyMax ||
               errorRate > this.thresholds.errorRateMax) {
      status = 'degraded';
    }

    return {
      status,
      memoryUsage,
      networkLatency,
      errorRate
    };
  }

  private calculateOverallHealth(
    download: SystemHealth['download'],
    storage: SystemHealth['storage'],
    performance: SystemHealth['performance']
  ): SystemHealth['overall'] {
    const scores = {
      'critical': 0,
      'degraded': 1,
      'warning': 1,
      'healthy': 2
    };

    const downloadScore = scores[download.status] || 0;
    const storageScore = scores[storage.status] || 0;
    const performanceScore = scores[performance.status] || 0;

    const avgScore = (downloadScore + storageScore + performanceScore) / 3;

    if (avgScore >= 1.8) return 'excellent';
    if (avgScore >= 1.3) return 'good';
    if (avgScore >= 0.7) return 'fair';
    return 'poor';
  }

  private async checkForAlerts(): Promise<void> {
    const health = this.systemHealth$.value;
    if (!health) return;

    const newAlerts: PerformanceAlert[] = [];

    // Check download performance
    if (health.download.status === 'critical') {
      newAlerts.push(this.createAlert(
        'slow_download',
        'critical',
        `Download performance is critical. Success rate: ${health.download.successRate.toFixed(1)}%`
      ));
    }

    // Check storage
    if (health.storage.status === 'critical') {
      newAlerts.push(this.createAlert(
        'storage_full',
        'critical',
        `Storage is almost full (${health.storage.usagePercent.toFixed(1)}%)`
      ));
    } else if (health.storage.status === 'warning') {
      newAlerts.push(this.createAlert(
        'storage_full',
        'medium',
        `Storage usage is high (${health.storage.usagePercent.toFixed(1)}%)`
      ));
    }

    // Check memory
    if (health.performance.memoryUsage > this.thresholds.memoryUsageMax) {
      newAlerts.push(this.createAlert(
        'memory_high',
        health.performance.memoryUsage > this.thresholds.memoryUsageMax * 1.5 ? 'critical' : 'medium',
        `High memory usage detected (${(health.performance.memoryUsage / 1024 / 1024).toFixed(1)} MB)`
      ));
    }

    // Check network
    if (health.performance.networkLatency > this.thresholds.networkLatencyMax) {
      newAlerts.push(this.createAlert(
        'network_poor',
        health.performance.networkLatency > this.thresholds.networkLatencyMax * 2 ? 'high' : 'medium',
        `Poor network performance (${health.performance.networkLatency.toFixed(0)}ms latency)`
      ));
    }

    // Check error rate
    if (health.performance.errorRate > this.thresholds.errorRateMax) {
      newAlerts.push(this.createAlert(
        'error_spike',
        health.performance.errorRate > this.thresholds.errorRateMax * 2 ? 'high' : 'medium',
        `High error rate detected (${health.performance.errorRate.toFixed(1)}%)`
      ));
    }

    // Add new alerts
    if (newAlerts.length > 0) {
      const existingAlerts = this.alerts$.value;
      const combinedAlerts = [...existingAlerts, ...newAlerts];

      // Remove duplicates and keep only recent alerts
      const uniqueAlerts = this.deduplicateAlerts(combinedAlerts);
      this.alerts$.next(uniqueAlerts);
      this.persistAlerts();
    }
  }

  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    metadata?: any
  ): PerformanceAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: new Date(),
      metadata,
      acknowledged: false
    };
  }

  private deduplicateAlerts(alerts: PerformanceAlert[]): PerformanceAlert[] {
    // Keep only latest alert of each type within last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAlerts = alerts.filter(a => a.timestamp > oneHourAgo);

    const alertsByType = new Map<string, PerformanceAlert>();
    recentAlerts.forEach(alert => {
      const existing = alertsByType.get(alert.type);
      if (!existing || alert.timestamp > existing.timestamp) {
        alertsByType.set(alert.type, alert);
      }
    });

    return Array.from(alertsByType.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50); // Keep max 50 alerts
  }

  private generateRecommendations(health: SystemHealth, alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = [];

    if (health.storage.needsCleanup) {
      recommendations.push('Clear old downloads to free up storage space');
    }

    if (health.download.successRate < 80) {
      recommendations.push('Check network connection and retry failed downloads');
    }

    if (health.performance.memoryUsage > this.thresholds.memoryUsageMax) {
      recommendations.push('Restart the application to free up memory');
    }

    if (alerts.some(a => a.type === 'slow_download')) {
      recommendations.push('Switch to WiFi for better download performance');
    }

    if (alerts.some(a => a.type === 'error_spike')) {
      recommendations.push('Check server status and network connectivity');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is running optimally');
    }

    return recommendations;
  }

  // === UTILITY METHODS ===

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
      return 9999; // High latency for errors
    }
  }

  private async calculateRecentErrorRate(): Promise<number> {
    const lastHour = {
      start: new Date(Date.now() - 60 * 60 * 1000),
      end: new Date()
    };

    const successRate = this.analyticsService.getSuccessRate(lastHour);
    return 100 - successRate;
  }

  // === PERSISTENCE ===

  private async initializeMonitoring(): Promise<void> {
    await this.loadThresholds();
    await this.loadAlerts();
    this.startMonitoring();
  }

  private async persistAlerts(): Promise<void> {
    try {
      const alerts = this.alerts$.value;
      const alertsJson = JSON.stringify(alerts);

      if (typeof window !== 'undefined') {
        if ('storage' in navigator) {
          localStorage.setItem('performanceAlerts', alertsJson);
        }
      }
    } catch (error) {
      console.error('Failed to persist performance alerts:', error);
    }
  }

  private async loadAlerts(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        const alertsJson = localStorage.getItem('performanceAlerts');
        if (alertsJson) {
          const alerts = JSON.parse(alertsJson);
          // Only keep alerts from last 24 hours
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentAlerts = alerts.filter((a: PerformanceAlert) =>
            new Date(a.timestamp) > oneDayAgo
          );
          this.alerts$.next(recentAlerts);
        }
      }
    } catch (error) {
      console.error('Failed to load performance alerts:', error);
    }
  }

  private async saveThresholds(): Promise<void> {
    try {
      const thresholdsJson = JSON.stringify(this.thresholds);
      if (typeof window !== 'undefined') {
        localStorage.setItem('performanceThresholds', thresholdsJson);
      }
    } catch (error) {
      console.error('Failed to save performance thresholds:', error);
    }
  }

  private async loadThresholds(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        const thresholdsJson = localStorage.getItem('performanceThresholds');
        if (thresholdsJson) {
          const thresholds = JSON.parse(thresholdsJson);
          this.thresholds = { ...this.thresholds, ...thresholds };
        }
      }
    } catch (error) {
      console.error('Failed to load performance thresholds:', error);
    }
  }
}
