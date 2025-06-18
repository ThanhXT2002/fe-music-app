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
    private permissionService: PermissionService
  ) {    // Only expose essential debug methods for persistence testing
    (window as any).checkStorageInfo = async () => {
      const info = await this.storageManager.getStorageInfo();
      console.log('📊 Storage Info:', info);
      return info;
    };
    (window as any).testPersistence = () => this.testPersistence();
    (window as any).requestPersistentStorage = async () => {
      console.log('🚀 Manually requesting persistent storage...');
      const granted = await this.storageManager.requestPersistentStorageAggressively();
      if (granted) {
        console.log('✅ Persistent storage granted!');
        await this.notificationService.showToast({
          message: '✅ Persistent storage granted! Your data will now be saved permanently.',
          color: 'success',
          duration: 5000
        });
      } else {
        console.warn('⚠️ Persistent storage denied');
        await this.notificationService.showPersistentStorageWarning();
      }
      return granted;
    };
  }  ngOnInit() {
    this.initializeApp();

    // Initialize PWA service
    this.pwaService.onNetworkStatusChange();

    // Check for updates periodically (every 30 minutes)
    setInterval(() => {
      this.pwaService.checkForUpdates();
    }, 30 * 60 * 1000);

    // Test storage persistence - minimal and clear
    this.testPersistence();
  }  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  async initializeApp() {
    await this.platform.ready();

    // First priority: Request persistent storage as early as possible
    await this.setupPersistentStorage();

    // Initialize database right after platform ready
    await this.initializeDatabaseWithRetry();

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
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
        } else {
          console.error('❌ All database initialization attempts failed');
          // App can still run without database, but with limited functionality
        }
      }
    }
  }

  /**
   * MINIMAL persistence test - focus on the core issue
   */
  private async testPersistence() {
    try {
      console.log('🧪 PERSISTENCE TEST: Checking if data survives reload...');

      // 1. Check storage status
      const storageInfo = await this.storageManager.getStorageInfo();
      console.log('📊 Storage Status:', {
        isPersistent: storageInfo.isPersistent,
        isIncognito: storageInfo.isIncognito,
        quota: `${Math.round(storageInfo.quota / 1024 / 1024)}MB`,
        usage: `${Math.round(storageInfo.usage / 1024 / 1024)}MB`
      });

      // 2. Check for persistence marker from previous session
      const markerCount = await this.dbService.checkPersistenceMarkers();
      console.log(`🔍 Found ${markerCount} persistence markers from previous sessions`);

      // 3. Add new marker for next reload test
      await this.dbService.addPersistenceMarker();
      console.log('�️ Added new persistence marker');      // 4. Show user-facing warnings and notifications
      if (storageInfo.isIncognito) {
        console.error('🚨 INCOGNITO MODE - Data WILL be lost when browser closes!');
        await this.notificationService.showIncognitoWarning();
      } else if (!storageInfo.isPersistent) {
        console.warn('⚠️ PERSISTENT STORAGE NOT GRANTED - Browser may clear data automatically!');
        console.warn('💡 To fix: Allow site to store data permanently in browser settings');
        await this.notificationService.showPersistentStorageWarning();
      } else if (markerCount > 0) {
        console.log(`✅ Data persisted! Found ${markerCount} markers from previous sessions`);
        await this.notificationService.showPersistenceSuccess(markerCount);
      }

      if (markerCount === 0) {
        console.log('🆕 First run or data was cleared - no persistence markers found');
        await this.notificationService.showPersistenceFirstRun();
      }

    } catch (error) {
      console.error('❌ Persistence test failed:', error);
    }
  }

  /**
   * Setup persistent storage as early as possible
   */
  private async setupPersistentStorage(): Promise<void> {
    try {
      console.log('🔧 Setting up persistent storage...');

      // Request persistent storage aggressively
      const granted = await this.storageManager.requestPersistentStorageAggressively();

      if (!granted) {
        console.warn('⚠️ Persistent storage not granted - will show user warning');
      }

    } catch (error) {
      console.error('❌ Error setting up persistent storage:', error);
    }
  }
}
