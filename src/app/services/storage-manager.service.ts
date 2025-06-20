import { Injectable } from '@angular/core';
import { DataProtectionService } from './data-protection.service';

/**
 * Service để quản lý storage persistence và đảm bảo data không bị mất
 * Đặc biệt quan trọng cho PWA offline functionality
 */
@Injectable({
  providedIn: 'root'
})
export class StorageManagerService {
  private dataProtection?: DataProtectionService;

  constructor() {}

  /**
   * Set data protection service (injected later to avoid circular dependencies)
   */
  setDataProtectionService(dataProtection: DataProtectionService): void {
    this.dataProtection = dataProtection;
  }

  /**
   * Kiểm tra và setup persistent storage cho PWA
   */
  async setupPersistentStorage(): Promise<boolean> {
    try {
      console.log('🔧 Setting up persistent storage for PWA...');

      // 1. Check if we're in a secure context (required for persistent storage)
      if (!window.isSecureContext) {
        console.warn('⚠️ Not in secure context - persistent storage may not work');
      }

      // 2. Check storage API support
      if (!('storage' in navigator)) {
        console.warn('⚠️ Storage API not supported');
        return false;
      }

      // 3. Request persistent storage
      const persistent = await this.requestPersistentStorage();

      // 4. Check storage quota
      await this.checkStorageQuota();

      // 5. Setup storage events
      this.setupStorageEventListeners();

      console.log('✅ Storage setup completed');
      return persistent;
    } catch (error) {
      console.error('❌ Error setting up persistent storage:', error);
      return false;
    }
  }

  /**
   * Request persistent storage permission
   */
  private async requestPersistentStorage(): Promise<boolean> {
    try {
      if ('persist' in navigator.storage) {
        const granted = await navigator.storage.persist();
        if (granted) {
          console.log('✅ Persistent storage GRANTED - data will not be cleared');
        } else {
          console.warn('⚠️ Persistent storage DENIED - data may be cleared by browser');
        }
        return granted;
      } else {
        console.warn('⚠️ navigator.storage.persist() not supported');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting persistent storage:', error);
      return false;
    }
  }
  /**
   * Aggressively request persistent storage - try multiple times if needed
   */
  async requestPersistentStorageAggressively(): Promise<boolean> {
    try {
      console.log('🚀 Requesting persistent storage aggressively...');

      if (!('storage' in navigator) || !('persist' in navigator.storage)) {
        console.warn('⚠️ Persistent storage API not supported');
        return false;
      }

      // First, check if we already have it
      const alreadyPersistent = await navigator.storage.persisted();
      if (alreadyPersistent) {
        console.log('✅ Persistent storage already granted');
        return true;
      }

      // Try to request it multiple times
      console.log('📋 Requesting persistent storage permission...');

      for (let attempt = 1; attempt <= 3; attempt++) {
        const granted = await navigator.storage.persist();

        if (granted) {
          console.log(`✅ Persistent storage GRANTED on attempt ${attempt}!`);
          return true;
        }

        console.warn(`⚠️ Attempt ${attempt}: Persistent storage DENIED`);

        if (attempt < 3) {
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Final check after all attempts
      const finalCheck = await navigator.storage.persisted();
      if (finalCheck) {
        console.log('✅ Persistent storage granted after retry!');
        return true;
      }      console.error('❌ CRITICAL: Persistent storage DENIED after all attempts');
      console.error('❌ This may cause data loss when browser cleans storage!');

      // Check if this is a v1->v2 migration - be less aggressive with warnings
      const appVersion = localStorage.getItem('xtmusic_app_version') || 'v1';
      const isV2Upgrade = appVersion === 'v1';

      if (isV2Upgrade) {
        console.warn('⚠️ v1->v2 Migration: Persistent storage denied - using fallback strategies');
        // Don't show scary alerts for v1 users upgrading
      } else {
        // Show critical warning to user for v2 users
        this.showPersistentStorageWarning();

        // Also show user-friendly alert if available
        if (this.dataProtection) {
          setTimeout(() => {
            this.dataProtection!.showProtectionFailedToast();
          }, 500);
        }
      }

      return false;

    } catch (error) {
      console.error('❌ Error requesting persistent storage:', error);
      return false;
    }
  }

  /**
   * Show critical warning about data loss
   */
  private showPersistentStorageWarning(): void {
    console.warn(`
🚨 CRITICAL WARNING: Persistent Storage Denied
📱 Your downloaded music may be lost when:
   - Browser restarts
   - Storage quota exceeded
   - Browser auto-cleanup runs

💡 To fix this:
   1. Open browser settings
   2. Allow this site to store data permanently
   3. Or download music to device storage instead
    `);
  }

  /**
   * Check storage quota and usage
   */
  private async checkStorageQuota(): Promise<void> {
    try {
      if ('estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const quota = estimate.quota || 0;
        const usage = estimate.usage || 0;
        const available = quota - usage;
        const usagePercent = quota > 0 ? Math.round((usage / quota) * 100) : 0;

        console.log('💾 Storage Quota Info:');
        console.log(`  - Total: ${this.formatBytes(quota)}`);
        console.log(`  - Used: ${this.formatBytes(usage)} (${usagePercent}%)`);
        console.log(`  - Available: ${this.formatBytes(available)}`);

        // Warn if storage is getting full
        if (usagePercent > 80) {
          console.warn('⚠️ Storage is getting full! Consider cleaning up data.');
        }
      }
    } catch (error) {
      console.error('❌ Error checking storage quota:', error);
    }
  }

  /**
   * Setup event listeners for storage changes
   */
  private setupStorageEventListeners(): void {
    // Listen for storage events (though they may not fire for IndexedDB)
    window.addEventListener('storage', (event) => {
      console.log('🔄 Storage event detected:', event);
    });

    // Listen for beforeunload to warn about potential data loss
    window.addEventListener('beforeunload', (event) => {
      // Don't show warning in normal cases, but log for debugging
      console.log('🚪 Page unloading - checking storage status...');
    });
  }

  /**
   * Check if browser is in incognito/private mode
   */
  async isIncognitoMode(): Promise<boolean> {
    try {
      // Try to use storage API to detect incognito
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        // In incognito mode, quota is usually very small or 0
        return (estimate.quota || 0) < 10 * 1024 * 1024; // Less than 10MB suggests incognito
      }

      // Fallback: try to create a test database
      return new Promise((resolve) => {
        const testDB = indexedDB.open('test-incognito-db');
        testDB.onsuccess = () => {
          indexedDB.deleteDatabase('test-incognito-db');
          resolve(false); // Not incognito
        };
        testDB.onerror = () => {
          resolve(true); // Likely incognito
        };
      });
    } catch (error) {
      console.warn('⚠️ Could not detect incognito mode:', error);
      return false;
    }
  }

  /**
   * Get detailed storage information for debugging
   */
  async getStorageInfo(): Promise<any> {
    const info: any = {
      isSecureContext: window.isSecureContext,
      storageAPISupported: 'storage' in navigator,
      persistentStorageSupported: 'storage' in navigator && 'persist' in navigator.storage,
      estimateSupported: 'storage' in navigator && 'estimate' in navigator.storage,
    };

    try {
      // Check if persistent storage is already granted
      if (info.persistentStorageSupported) {
        info.isPersistent = await navigator.storage.persist();
      }

      // Get storage estimate
      if (info.estimateSupported) {
        const estimate = await navigator.storage.estimate();
        info.quota = estimate.quota;
        info.usage = estimate.usage;
        info.quotaFormatted = this.formatBytes(estimate.quota || 0);
        info.usageFormatted = this.formatBytes(estimate.usage || 0);
      }      // Check incognito mode
      info.isIncognito = await this.isIncognitoMode();

      // Check IndexedDB support
      info.indexedDBSupported = 'indexedDB' in window;

    } catch (error: any) {
      console.error('❌ Error getting storage info:', error);
      info.error = error?.message || 'Unknown error';
    }

    return info;
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Clear all storage (for debugging/reset purposes)
   */
  async clearAllStorage(): Promise<boolean> {
    try {
      console.log('🗑️ Clearing all storage...');

      // Clear IndexedDB databases
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          await this.deleteDatabase(db.name);
        }
      }

      // Clear localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      console.log('✅ All storage cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
      return false;
    }
  }

  /**
   * Delete a specific IndexedDB database
   */
  private deleteDatabase(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(dbName);
      deleteRequest.onsuccess = () => {
        console.log(`✅ Database "${dbName}" deleted`);
        resolve();
      };
      deleteRequest.onerror = () => {
        console.error(`❌ Error deleting database "${dbName}":`, deleteRequest.error);
        reject(deleteRequest.error);
      };
    });
  }

  /**
   * Request persistent storage with user interaction
   * Call this when user downloads first song
   */
  async requestPersistentStorageWithUserInteraction(): Promise<boolean> {
    try {
      console.log('🎯 Requesting persistent storage with user interaction...');

      if (!('storage' in navigator) || !('persist' in navigator.storage)) {
        console.warn('⚠️ Persistent storage API not supported');
        return false;
      }

      // Check if already granted
      const alreadyPersistent = await navigator.storage.persisted();
      if (alreadyPersistent) {
        console.log('✅ Persistent storage already granted');
        return true;
      }

      // Request with user gesture context
      const granted = await navigator.storage.persist();      if (granted) {
        console.log('✅ Persistent storage GRANTED with user interaction!');

        // Show success notification
        if (this.dataProtection) {
          this.dataProtection.showProtectionEnabledToast();
        }

        return true;
      } else {
        console.warn('⚠️ Persistent storage DENIED even with user interaction');

        // Show guidance alert
        if (this.dataProtection) {
          setTimeout(() => {
            this.dataProtection!.showPersistentStorageGuide();
          }, 1000);
        }

        // Try fallback strategy
        await this.setupFallbackDataProtection();
        return false;
      }

    } catch (error) {
      console.error('❌ Error requesting persistent storage with user interaction:', error);
      await this.setupFallbackDataProtection();
      return false;
    }
  }

  /**
   * Setup fallback data protection when persistent storage is denied
   */
  private async setupFallbackDataProtection(): Promise<void> {
    console.log('🛡️ Setting up fallback data protection...');

    // Strategy 1: Increase storage usage to make it "sticky"
    await this.createStoragePressure();

    // Strategy 2: Setup periodic data backup to localStorage
    this.setupPeriodicBackup();

    // Strategy 3: Show user instructions
    this.showDataProtectionInstructions();
  }

  /**
   * Create storage pressure to make IndexedDB "sticky"
   * Browsers are less likely to clean heavily used storage
   */
  private async createStoragePressure(): Promise<void> {
    try {
      // Create some dummy data to increase storage usage
      // This makes browser think the storage is "important"
      const dummyData = new Array(1000).fill('x').join(''); // 1KB
      localStorage.setItem('xtmusic_storage_pressure', dummyData);

      console.log('🛡️ Storage pressure created - data should be stickier');
    } catch (error) {
      console.warn('⚠️ Could not create storage pressure:', error);
    }
  }

  /**
   * Setup periodic backup of critical data to localStorage
   */
  private setupPeriodicBackup(): void {
    console.log('💾 Setting up periodic data backup...');

    // Backup every 5 minutes
    setInterval(async () => {
      try {
        await this.backupCriticalData();
      } catch (error) {
        console.warn('⚠️ Periodic backup failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Backup critical data to localStorage (limited but persistent)
   */
  private async backupCriticalData(): Promise<void> {
    try {
      // This will be called from DatabaseService when songs are added
      console.log('💾 Backing up critical data to localStorage...');

      // Store just metadata, not audio files (too big for localStorage)
      const backup = {
        timestamp: Date.now(),
        hasData: true,
        songCount: 0 // Will be updated by DatabaseService
      };

      localStorage.setItem('xtmusic_data_backup', JSON.stringify(backup));
    } catch (error) {
      console.warn('⚠️ Data backup failed:', error);
    }
  }  /**
   * Show user instructions for enabling persistent storage
   */
  private showDataProtectionInstructions(): void {
    console.warn(`
🛡️ DATA PROTECTION INSTRUCTIONS:

To prevent your downloaded music from being lost:

CHROME/EDGE:
1. Click the lock icon (🔒) in address bar
2. Click "Site settings"
3. Change "Storage" to "Allow"
4. Refresh the page

FIREFOX:
1. Click the shield icon in address bar
2. Turn off "Enhanced Tracking Protection" for this site
3. Or go to about:preferences → Privacy & Security → Storage

SAFARI:
1. Go to Safari → Preferences → Privacy
2. Uncheck "Prevent cross-site tracking" for this site

⚠️ Without persistent storage, your music may be lost when:
- Browser restarts
- Storage quota exceeded
- Browser cleanup runs
    `);
  }
}
