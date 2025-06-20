import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { Subject } from 'rxjs';
import { PWAService } from './services/pwa.service';
import { ThemeService } from 'src/app/services/theme.service';
import { IonApp, IonRouterOutlet } from "@ionic/angular/standalone";
import { Platform } from '@ionic/angular';
import { SafeAreaService } from './services/safe-area.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { DatabaseService } from './services/database.service';
import { AppLifecycleService } from './services/app-lifecycle.service';
import { PlaybackRestoreService } from './services/playback-restore.service';
import { PermissionService } from './services/permission.service';
import { DebugService } from './services/debug.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonRouterOutlet, IonApp, CommonModule, FormsModule],
  standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();  constructor(
    private pwaService: PWAService,
    private themeService: ThemeService,
    private safeAreaService: SafeAreaService,
    private platform: Platform,
    private dbService: DatabaseService,
    private appLifecycleService: AppLifecycleService,
    private playbackRestoreService: PlaybackRestoreService,
    private permissionService: PermissionService,
    private debugService: DebugService
  ) {
    this.debugService.initEruda();
  }


  ngOnInit() {
    this.initializeApp();
    // Khởi tạo PWA service
    this.pwaService.onNetworkStatusChange();

    // Kiểm tra updates định kỳ (mỗi 30 phút)
    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);

    // TEMP: Expose database service to window.dbService for console testing
    if (typeof window !== 'undefined') {
      (window as any).dbService = this.dbService;
      console.log('🧪 Database service exposed to window.dbService for testing');
    }
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Đóng database connection khi app destroy
    this.cleanupDatabase();
  }
  /**
   * Cleanup database khi app destroy
   */
  private async cleanupDatabase() {
    try {
      // IndexedDB doesn't need explicit close
      console.log('🧹 App cleanup: IndexedDB cleanup completed');
    } catch (error) {
      console.error('❌ App cleanup: Error during cleanup:', error);
    }
  }async initializeApp() {
    await this.platform.ready();

    // Khởi tạo database ngay sau khi platform ready
    await this.initializeDatabaseWithRetry();

    // Request permissions for native platforms
    if (Capacitor.isNativePlatform()) {
      await this.requestNativePermissions();
    }

    if (Capacitor.isNativePlatform()) {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#00000000' });

    // No need to manage splash screen here anymore - SplashActivity handles it
    }
    this.safeAreaService.applyToContent();

    // Check for saved playback state and show restore prompt if available
    // await this.checkForPlaybackRestore();
  }

  /**
   * Request native permissions
   */
  private async requestNativePermissions(): Promise<void> {
    try {
      console.log('🔐 Requesting native permissions...');
      const success = await this.permissionService.requestAllPermissions();

      if (success) {
        console.log('✅ All critical permissions granted');
      } else {
        console.warn('⚠️ Some permissions were denied - app may have limited functionality');
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
    }
  }

  /**
   * Khởi tạo database với retry mechanism
   */
  private async initializeDatabaseWithRetry(maxRetries: number = 3): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🔄 Database initialization attempt ${i + 1}/${maxRetries}`);
        await this.dbService.initializeDatabase();
        console.log('✅ Database initialized successfully');
        return;
      } catch (error) {
        console.error(`❌ Database initialization attempt ${i + 1} failed:`, error);

        if (i < maxRetries - 1) {
          // Đợi trước khi retry
          await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
        } else {
          console.error('❌ All database initialization attempts failed');
          // App vẫn có thể chạy mà không có database, nhưng với functionality hạn chế
        }
      }
    }
  }

  // private async checkForPlaybackRestore(): Promise<void> {
  //   try {
  //     // Wait a bit for the UI to be ready
  //     await new Promise(resolve => setTimeout(resolve, 1000));

  //     const hasSavedState = await this.playbackRestoreService.checkForSavedState();
  //     if (hasSavedState) {
  //       await this.playbackRestoreService.showRestoreToast();
  //     }
  //   } catch (error) {
  //     console.error('Error checking for playback restore:', error);
  //   }
  // }


}
