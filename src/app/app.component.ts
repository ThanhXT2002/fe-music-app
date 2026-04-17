import { UiStateService } from '@core/ui/ui-state.service';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PWAService } from '@core/platform/pwa.service';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from '@core/data/database.service';
import { PermissionService } from '@core/platform/permission.service';
import { LoadingComponent } from './components/loading/loading.component';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HealthCheckService } from '@core/api/health-check.service';
import { PWAInstallationModalComponent } from "./components/pwa-installation-modal/pwa-installation-modal.component";
import { Title } from '@angular/platform-browser';

import { filter, map, Subject, takeUntil, tap } from 'rxjs';

/**
 * Component gốc (Root Component) của ứng dụng XTMusic.
 * 
 * Chức năng:
 * - Khởi tạo ứng dụng và kết nối cơ sở dữ liệu IndexedDB cục bộ.
 * - Kiểm tra internet, đồng bộ trạng thái PWA và tự động lấy title.
 * - Quản lý quyền truy cập khi ứng dụng chạy trên Native App (Capacitor).
 */
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    IonRouterOutlet,
    IonApp,
    CommonModule,
    LoadingComponent,
    FormsModule,
    PWAInstallationModalComponent
  ],
  standalone: true,
})
export class AppComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Injected dependencies
  // ─────────────────────────────────────────────────────────
  private healthCheckService = inject(HealthCheckService);
  private pwaService = inject(PWAService);
  private platform = inject(Platform);
  private dbService = inject(DatabaseService);
  private permissionService = inject(PermissionService);
  private router = inject(Router);
  private titleService = inject(Title);
  private UiStateService = inject(UiStateService);

  constructor() {
    this.actionHealthCheck();
  }

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────
  /**
   * Khởi tạo ứng dụng và thiết lập các dịch vụ nền.
   * 
   * - Lắng nghe kết nối mạng và cập nhật PWA phiên bản mới.
   * - Theo dõi sự kiện Angular Router để đồng bộ Document Title theo cấu hình.
   */
  ngOnInit() {
    this.initializeApp();
    this.pwaService.onNetworkStatusChange();

    // Hẹn giờ kiểm tra cài đặt bản cập nhật PWA mỗi 30 phút
    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);

    this.UiStateService.title$.subscribe(title => {
      if (title) {
        this.titleService.setTitle(title);
      }
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.getDeepestRoute(this.router.routerState.root)),
      tap(route => {
        const title = route.snapshot.data['title'];
        if (title) {
          this.UiStateService.setTitle(`${title} - XTMusic`);
        }
      })
    ).subscribe();
  }

  // ─────────────────────────────────────────────────────────
  // App Initialization & Setup
  // ─────────────────────────────────────────────────────────
  /**
   * Khởi tạo môi trường nền cho thiết bị Native Capacitor lẫn Web.
   * 
   * - Kết nối IndexedDB đảm bảo bộ đệm luôn sẵn sàng.
   * - Cấu hình giao diện tràn viền (fullscreen) và status bar hệ thống.
   */
  async initializeApp() {
    await this.platform.ready();
    await this.initializeDatabaseWithRetry();

    if (Capacitor.isNativePlatform()) {
      await this.requestNativePermissions();
      // NOTE: Ẩn nền của thanh trạng thái (status bar) để tạo cảm giác UI tràn màn hình chân thực
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#00000000' });
    }
  }

  /**
   * Xem xét hệ thống Backend và kết nối wifi còn hoạt động không.
   * 
   * Nếu người dùng mất kết nối hoặc server gặp sự cố thì redirect về màn hình Phát nhạc offline (list).
   */
  actionHealthCheck() {
    if (!this.healthCheckService.isHealthy() || !navigator.onLine) {
      this.router.navigate(['/list']);
    }
  }

  /**
   * Yêu cầu cấp quyển ứng dụng (Bộ nhớ/Bộ sưu tập, Thông báo push) từ Capacitor.
   */
  private async requestNativePermissions(): Promise<void> {
    try {
      const success = await this.permissionService.requestAllPermissions();
      if (!success) {
        console.warn(
          'Some permissions were denied - app may have limited functionality'
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  }

  /**
   * Cố gắng khởi tạo kết nối IndexedDB qua nhiều lần thử lại (retry logic).
   * 
   * Đề phòng trường hợp database mất khả năng kết nối trên máy cấu hình yếu.
   * 
   * @param maxRetries - Số lần tải thử nghiệm IndexedDB tối đa (mặc định bằng 3)
   */
  private async initializeDatabaseWithRetry(
    maxRetries: number = 3
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.dbService.initializeDatabase();
        return;
      } catch (error) {
        console.error(
          `Database initialization attempt ${i + 1} failed:`,
          error
        );

        if (i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, (i + 1) * 1000));
        } else {
          console.error('All database initialization attempts failed');
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────
  /**
   * Trích xuất route cấp con sâu nhất hiện tại.
   * 
   * Giúp tự động thu gom cấu hình thông tin Title trong route.
   * 
   * @param route - Route bắt đầu để duyệt
   * @returns Route con sâu nhất đang active (leaf route)
   */
  private getDeepestRoute(route: ActivatedRoute): ActivatedRoute {
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }
}
