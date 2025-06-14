import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { AnalyticsService, AnalyticsReport } from '../../services/analytics.service';
import { PerformanceMonitoringService, PerformanceAlert, SystemHealth } from '../../services/performance-monitoring.service';

@Component({
  selector: 'app-analytics-dashboard',
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class AnalyticsDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  analyticsReport: AnalyticsReport | null = null;
  systemHealth: SystemHealth | null = null;
  activeAlerts: PerformanceAlert[] = [];
  isLoading = true;

  // Chart data for download success rate
  successRateData: any;
  speedChart: any;
  storageChart: any;

  constructor(
    private analyticsService: AnalyticsService,
    private performanceMonitoringService: PerformanceMonitoringService
  ) {}

  async ngOnInit() {
    await this.loadDashboardData();
    this.setupRealtimeUpdates();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private async loadDashboardData() {
    try {
      this.isLoading = true;

      // Load analytics report
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days

      this.analyticsReport = await this.analyticsService.generateReport(startDate, endDate);

      // Load system health - subscribe to observable
      this.performanceMonitoringService.getSystemHealth().subscribe(health => {
        this.systemHealth = health;
      });

      // Load active alerts - subscribe to observable
      this.performanceMonitoringService.getAlerts().subscribe(alerts => {
        this.activeAlerts = alerts.filter(alert => !alert.acknowledged);
      });

      this.prepareChartData();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      this.isLoading = false;
    }
  }
  private setupRealtimeUpdates() {
    // Update system health every 30 seconds
    this.performanceMonitoringService.getSystemHealth()
      .pipe(takeUntil(this.destroy$))
      .subscribe(health => {
        this.systemHealth = health;
      });

    // Update alerts in real-time
    this.performanceMonitoringService.getAlerts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(alerts => {
        this.activeAlerts = alerts.filter(alert => !alert.acknowledged);
      });
  }
  private prepareChartData() {
    if (!this.analyticsReport) return;

    // Prepare success rate chart data
    this.successRateData = {
      labels: ['Successful', 'Failed'],
      datasets: [{
        data: [
          this.analyticsReport.downloads.successful,
          this.analyticsReport.downloads.failed
        ],
        backgroundColor: ['#4CAF50', '#F44336']
      }]
    };

    // Prepare download speed chart data
    this.speedChart = {
      labels: ['Average Speed'],
      datasets: [{
        label: 'KB/s',
        data: [this.analyticsReport.downloads.avgDownloadSpeed / 1024], // Convert to KB/s
        backgroundColor: '#2196F3'
      }]
    };

    // Prepare storage usage chart
    this.storageChart = {
      labels: ['Used', 'Available'],
      datasets: [{
        data: [
          this.analyticsReport.storage.currentUsage,
          this.analyticsReport.storage.peakUsage - this.analyticsReport.storage.currentUsage
        ],
        backgroundColor: ['#FF9800', '#E0E0E0']
      }]
    };
  }

  async refreshData() {
    await this.loadDashboardData();
  }

  async acknowledgeAlert(alertId: string) {
    await this.performanceMonitoringService.acknowledgeAlert(alertId);
  }
  async clearAlert(alertId: string) {
    await this.performanceMonitoringService.acknowledgeAlert(alertId);
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatSpeed(bytesPerSecond: number): string {
    const kbps = bytesPerSecond / 1024;
    if (kbps < 1024) {
      return `${kbps.toFixed(1)} KB/s`;
    }
    return `${(kbps / 1024).toFixed(1)} MB/s`;
  }

  getHealthColor(score: number): string {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
  }
  getAlertColor(severity: PerformanceAlert['severity']): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'medium';
      default: return 'medium';
    }
  }
  async exportReport() {
    try {
      const reportData = await this.analyticsService.exportMetrics();

      // Create download link
      const blob = new Blob([reportData], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-report-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  }
}
