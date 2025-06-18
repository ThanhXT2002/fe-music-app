import { Injectable } from '@angular/core';

/**
 * Service để quản lý storage persistence và đảm bảo data không bị mất
 * Đặc biệt quan trọng cho PWA offline functionality
 */
@Injectable({
  providedIn: 'root'
})
export class StorageManagerService {

  constructor() {}

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

      // Try to request it
      console.log('📋 Requesting persistent storage permission...');
      const granted = await navigator.storage.persist();

      if (granted) {
        console.log('✅ Persistent storage GRANTED on first try!');
        return true;
      }

      console.warn('⚠️ Persistent storage DENIED - browser requires user interaction');
      return false;

    } catch (error) {
      console.error('❌ Error requesting persistent storage:', error);
      return false;
    }
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
}
