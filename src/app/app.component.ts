import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { PWAService } from './services/pwa.service';
import { ThemeService } from 'src/app/services/theme.service';
import { IonApp, IonRouterOutlet } from "@ionic/angular/standalone";
import { Platform } from '@ionic/angular';
import { SafeAreaService } from './services/safe-area.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from './services/database.service';
import { StorageManagerService } from './services/storage-manager.service';
import { NotificationService } from './services/notification.service';
import { AppLifecycleService } from './services/app-lifecycle.service';
import { PlaybackRestoreService } from './services/playback-restore.service';
import { PermissionService } from './services/permission.service';
import { DataProtectionService } from './services/data-protection.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonRouterOutlet, IonApp, CommonModule, FormsModule],
  standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  constructor(
    private pwaService: PWAService,
    private themeService: ThemeService,
    private safeAreaService: SafeAreaService,
    private platform: Platform,
    private dbService: DatabaseService,
    private storageManager: StorageManagerService,
    private notificationService: NotificationService,
    private appLifecycleService: AppLifecycleService,
    private playbackRestoreService: PlaybackRestoreService,
    private permissionService: PermissionService,
    private dataProtectionService: DataProtectionService
  ) {
  }
  ngOnInit() {
    this.initializeApp();

    // Initialize PWA service
    this.pwaService.onNetworkStatusChange();

    // Check for updates periodically (every 30 minutes)
    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);

  }  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }  async initializeApp() {
    await this.platform.ready();

    // Set up cross-service dependencies
    this.storageManager.setDataProtectionService(this.dataProtectionService);

    // CRITICAL: Initialize database FIRST, before any other services that might use it
    await this.initializeDatabaseWithRetry();

    // Only setup storage AFTER database is initialized (no conflict with data)
    await this.setupPersistentStorage();

    // Request permissions for native platforms
    if (Capacitor.isNativePlatform()) {
      await this.requestNativePermissions();
    }

    if (Capacitor.isNativePlatform()) {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#00000000' });
    }

    this.safeAreaService.applyToContent();
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
   * Initialize database with retry mechanism
   * This is the SINGLE POINT of database initialization
   */
  private async initializeDatabaseWithRetry(maxRetries: number = 3): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🔄 [AppComponent] Database initialization attempt ${i + 1}/${maxRetries}`);
        await this.dbService.initializeDatabase();
        console.log('✅ [AppComponent] Database initialized successfully');
        return;
      } catch (error) {
        console.error(`❌ [AppComponent] Database initialization attempt ${i + 1} failed:`, error);

        if (i < maxRetries - 1) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, i), 5000);
          console.log(`⏳ [AppComponent] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('❌ [AppComponent] All database initialization attempts failed');
          // App can still run without database, but with limited functionality
          throw error; // Re-throw to let caller handle
        }
      }
    }
  }

  /**
   * Setup persistent storage as early as possible
   * v2 improvement: Less aggressive for v1 users
   */
  private async setupPersistentStorage(): Promise<void> {
    try {
      console.log('🔧 Setting up persistent storage...');

      // Check if this is a v1->v2 upgrade
      const appVersion = localStorage.getItem('xtmusic_app_version') || 'v1';
      const isV2Upgrade = appVersion === 'v1';      if (isV2Upgrade) {
        console.log('📱 v1->v2 Migration detected - using gentle storage setup');
        // Just try once, don't be aggressive
        const granted = await this.storageManager.setupPersistentStorage();
        if (!granted) {
          console.warn('⚠️ Persistent storage not granted during v2 migration - will use fallback');
        }
      } else {
        // Request persistent storage aggressively for v2 users
        const granted = await this.storageManager.requestPersistentStorageAggressively();
        if (!granted) {
          console.warn('⚠️ Persistent storage not granted - will show user warning');
        }
      }

    } catch (error) {
      console.error('❌ Error setting up persistent storage:', error);
    }
  }
}
