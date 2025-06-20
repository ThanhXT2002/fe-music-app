import { Injectable } from '@angular/core';

/**
 * Service wrapper cho IndexedDB để sử dụng trên web platform
 * Cung cấp các phương thức tương tự SQLite cho web browser
 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private dbName = 'xtmusic_db';
  private dbVersion = 34; // Fixed version conflict - current DB is at 33

  constructor() {}  /**
   * Khởi tạo IndexedDB
   */
  async initDB(): Promise<boolean> {
    if (this.db) {
      console.log('✅ IndexedDB already initialized');
      return true;
    }

    try {
      // First, check what version the database currently has
      const currentVersion = await this.getCurrentDBVersion();
      console.log(`📊 Current database version: ${currentVersion}, Target version: ${this.dbVersion}`);

      // If current version is higher than our target, update our target
      if (currentVersion > this.dbVersion) {
        this.dbVersion = currentVersion + 1;
        console.log(`🔄 Adjusting target version to: ${this.dbVersion}`);
      }

      return new Promise((resolve) => {
        console.log(`🔄 Initializing IndexedDB with version ${this.dbVersion}...`);

        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = () => {
          console.error('❌ Error opening IndexedDB:', request.error);
          resolve(false);
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log('✅ IndexedDB opened successfully, version:', this.db.version);

          // Kiểm tra xem tất cả object stores cần thiết đã tồn tại chưa
          const requiredStores = ['songs', 'search_history', 'recently_played', 'playlists', 'user_preferences', 'audioFiles', 'thumbnailFiles', 'downloads'];
          const existingStores = Array.from(this.db.objectStoreNames);
          const missingStores = requiredStores.filter(store => !existingStores.includes(store));

          console.log('📋 Existing stores:', existingStores);

          if (missingStores.length > 0) {
            console.error('❌ Missing object stores:', missingStores);
            console.error('❌ Database schema is incomplete. This should not happen after upgrade.');
            this.db.close();
            this.db = null;
            resolve(false);
            return;
          }

          console.log('✅ All required object stores are present');
          resolve(true);
        };

        request.onupgradeneeded = (event) => {
          console.log('🔄 IndexedDB upgrade needed, creating object stores...');
          console.log('📊 Old version:', event.oldVersion, 'New version:', event.newVersion);

          const db = (event.target as IDBOpenDBRequest).result;

          // Tạo object stores (tương đương với tables trong SQLite)
          this.createObjectStores(db);
          console.log('✅ Object stores created successfully');
        };

        request.onblocked = () => {
          console.warn('⚠️ IndexedDB upgrade blocked - please close other tabs/windows');
          resolve(false);
        };
      });
    } catch (error) {
      console.error('❌ Error in initDB:', error);
      return false;
    }
  }

  /**
   * Tạo các object stores (tables)
   */
  private createObjectStores(db: IDBDatabase) {
    // Songs store
    if (!db.objectStoreNames.contains('songs')) {
      const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
      songsStore.createIndex('title', 'title', { unique: false });
      songsStore.createIndex('artist', 'artist', { unique: false });
      songsStore.createIndex('addedDate', 'addedDate', { unique: false });
      songsStore.createIndex('isDownloaded', 'isDownloaded', { unique: false });
    } else {
      // Store đã tồn tại, có thể cần thêm index mới
      const transaction = db.transaction(['songs'], 'versionchange');
      const songsStore = transaction.objectStore('songs');

      // Thêm index isDownloaded nếu chưa có
      if (!songsStore.indexNames.contains('isDownloaded')) {
        songsStore.createIndex('isDownloaded', 'isDownloaded', { unique: false });
      }
    }

    // Search history store
    if (!db.objectStoreNames.contains('search_history')) {
      const historyStore = db.createObjectStore('search_history', { keyPath: 'songId' });
      historyStore.createIndex('searchedAt', 'searchedAt', { unique: false });
      historyStore.createIndex('title', 'title', { unique: false });
      historyStore.createIndex('artist', 'artist', { unique: false });
      historyStore.createIndex('isDownloaded', 'isDownloaded', { unique: false });
    }

    // Recently played store
    if (!db.objectStoreNames.contains('recently_played')) {
      const recentStore = db.createObjectStore('recently_played', { keyPath: 'id', autoIncrement: true });
      recentStore.createIndex('songId', 'songId', { unique: false });
      recentStore.createIndex('playedAt', 'playedAt', { unique: false });
    }

    // Playlists store
    if (!db.objectStoreNames.contains('playlists')) {
      const playlistsStore = db.createObjectStore('playlists', { keyPath: 'id' });
      playlistsStore.createIndex('name', 'name', { unique: false });
    }

    // User preferences store
    if (!db.objectStoreNames.contains('user_preferences')) {
      db.createObjectStore('user_preferences', { keyPath: 'key' });
    }

    // Audio files store for offline audio blobs
    if (!db.objectStoreNames.contains('audioFiles')) {
      const audioStore = db.createObjectStore('audioFiles', { keyPath: 'songId' });
      audioStore.createIndex('mimeType', 'mimeType', { unique: false });
      audioStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Thumbnail files store for offline thumbnail blobs
    if (!db.objectStoreNames.contains('thumbnailFiles')) {
      const thumbStore = db.createObjectStore('thumbnailFiles', { keyPath: 'songId' });
      thumbStore.createIndex('mimeType', 'mimeType', { unique: false });
      thumbStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Downloads store for download task persistence
    if (!db.objectStoreNames.contains('downloads')) {
      db.createObjectStore('downloads', { keyPath: 'id' });
    }
  }

  /**
   * Kiểm tra tình trạng database và đảm bảo sẵn sàng sử dụng
   */
  async ensureDatabaseReady(): Promise<boolean> {
    if (!this.db) {
      console.log('🔄 Database not initialized, initializing...');
      return await this.initDB();
    }

    // Kiểm tra xem database có còn kết nối không
    try {
      const requiredStores = ['songs', 'search_history', 'recently_played', 'playlists', 'user_preferences', 'audioFiles', 'thumbnailFiles', 'downloads'];
      const existingStores = Array.from(this.db.objectStoreNames);
      const missingStores = requiredStores.filter(store => !existingStores.includes(store));

      if (missingStores.length > 0) {
        console.warn('⚠️ Database missing stores:', missingStores, 'Reinitializing...');
        this.db.close();
        this.db = null;
        return await this.initDB();
      }      // Thử một transaction đơn giản để kiểm tra kết nối
      const testTransaction = this.db.transaction(['songs'], 'readonly');
      await new Promise((resolve, reject) => {
        testTransaction.oncomplete = () => resolve(true);
        testTransaction.onerror = () => reject(testTransaction.error);
        testTransaction.onabort = () => reject(new Error('Transaction aborted'));

        // No timeout for mobile - let it complete naturally
      });

      console.log('✅ Database is healthy and ready');
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);

      // Try to reinitialize
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      return await this.initDB();
    }
  }
  /**
   * Thêm hoặc cập nhật record
   */
  async put(storeName: string, data: any): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for put operation');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => {
          console.log(`✅ Successfully saved to ${storeName}:`, data.id || data.key || 'record');
          resolve(true);
        };

        request.onerror = () => {
          console.error(`❌ Error putting data to ${storeName}:`, request.error);
          resolve(false);
        };

        transaction.onerror = () => {
          console.error(`❌ Transaction error for ${storeName}:`, transaction.error);
          resolve(false);
        };

        transaction.onabort = () => {
          console.error(`❌ Transaction aborted for ${storeName}`);
          resolve(false);
        };

        transaction.oncomplete = () => {
          // Transaction completed successfully
        };

        // Increased timeout for mobile compatibility - no timeout for critical operations
        // Mobile browsers can be very slow with IndexedDB

      } catch (error) {
        console.error(`❌ Exception in put operation for ${storeName}:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Lấy record theo key
   */
  async get(storeName: string, key: string): Promise<any | null> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for get operation');
      return null;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => {
          console.error(`❌ Error getting data from ${storeName}:`, request.error);
          resolve(null);
        };

        // No timeout - let it complete naturally on mobile

      } catch (error) {
        console.error(`❌ Exception in get operation for ${storeName}:`, error);
        resolve(null);
      }
    });
  }

  /**
   * Lấy tất cả records từ store
   */
  async getAll(storeName: string, indexName?: string, query?: IDBValidKey | IDBKeyRange): Promise<any[]> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for getAll operation');
      return [];
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        let request: IDBRequest;
        if (indexName && query) {
          const index = store.index(indexName);
          request = index.getAll(query);
        } else if (indexName) {
          const index = store.index(indexName);
          request = index.getAll();
        } else {
          request = store.getAll();
        }

        request.onsuccess = () => resolve(request.result || []);        request.onerror = () => {
          console.error(`❌ Error getting all data from ${storeName}:`, request.error);
          resolve([]);
        };

        // No timeout - let mobile complete naturally

      } catch (error) {
        console.error(`❌ Exception in getAll operation for ${storeName}:`, error);
        resolve([]);
      }
    });
  }

  /**
   * Xóa record theo key
   */
  async delete(storeName: string, key: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for delete operation');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);        request.onerror = () => {
          console.error(`❌ Error deleting data from ${storeName}:`, request.error);
          resolve(false);
        };

        // No timeout for mobile compatibility

      } catch (error) {
        console.error(`❌ Exception in delete operation for ${storeName}:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Delete record by key (alias for delete method)
   */
  async deleteRecord(storeName: string, key: string): Promise<boolean> {
    return await this.delete(storeName, key);
  }

  /**
   * Tìm kiếm records
   */
  async search(storeName: string, indexName: string, query: string): Promise<any[]> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for search operation');
      return [];
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll();

        request.onsuccess = () => {
          const results = request.result || [];
          // Filter results that contain the query string (case insensitive)
          const filteredResults = results.filter(item => {
            const value = item[indexName];
            if (typeof value === 'string') {
              return value.toLowerCase().includes(query.toLowerCase());
            }
            return false;
          });
          resolve(filteredResults);
        };        request.onerror = () => {
          console.error(`❌ Error searching data in ${storeName}:`, request.error);
          resolve([]);
        };

        // No timeout for mobile compatibility

      } catch (error) {
        console.error(`❌ Exception in search operation for ${storeName}:`, error);
        resolve([]);
      }
    });
  }

  /**
   * Xóa tất cả dữ liệu trong store
   */
  async clear(storeName: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for clear operation');
      return false;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error(`❌ Error clearing ${storeName}:`, request.error);
          resolve(false);
        };

        // No timeout for mobile compatibility

      } catch (error) {
        console.error(`❌ Exception in clear operation for ${storeName}:`, error);
        resolve(false);
      }
    });
  }

  /**
   * Đóng kết nối database
   */
  closeDB(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Lấy số lượng records trong store
   */
  async count(storeName: string): Promise<number> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for count operation');
      return 0;
    }

    return new Promise((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);        request.onerror = () => {
          console.error(`❌ Error counting data in ${storeName}:`, request.error);
          resolve(0);
        };

        // No timeout for mobile compatibility

      } catch (error) {
        console.error(`❌ Exception in count operation for ${storeName}:`, error);
        resolve(0);
      }
    });
  }

  // === OFFLINE FILE MANAGEMENT METHODS ===
  /**
   * Lưu audio file blob vào IndexedDB
   * @param songId - ID của bài hát
   * @param file - Audio file hoặc blob
   * @param mimeType - MIME type của file
   * @returns Promise<boolean>
   */  async saveAudioFile(songId: string, file: File | Blob, mimeType: string): Promise<boolean> {
    console.log(`🎵 Saving audio file for song: ${songId}, size: ${file.size} bytes`);

    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for saveAudioFile operation');
      return false;
    }

    try {
      // Convert File to Blob if needed
      const blob = file instanceof File ? file : file;

      const audioFile = {
        songId: songId,
        blob: blob,
        mimeType: mimeType,
        size: blob.size,
        createdAt: new Date()
      };

      // Use retry logic for mobile compatibility
      const result = await this.retryOperation(async () => {
        const success = await this.put('audioFiles', audioFile);
        if (!success) {
          throw new Error('Put operation failed');
        }
        return success;
      }, 3, 2000); // 3 retries, starting with 2 second delay

      if (result) {
        console.log(`✅ Audio file saved successfully for song: ${songId}`);
        return true;
      } else {
        console.error(`❌ Failed to save audio file for song: ${songId} after retries`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Exception saving audio file for song ${songId}:`, error);
      return false;
    }
  }

  /**
   * Lưu thumbnail file blob vào IndexedDB
   * @param songId - ID của bài hát
   * @param file - Thumbnail file hoặc blob
   * @param mimeType - MIME type của file
   * @returns Promise<boolean>
   */  async saveThumbnailFile(songId: string, file: File | Blob, mimeType: string): Promise<boolean> {
    console.log(`🖼️ Saving thumbnail file for song: ${songId}, size: ${file.size} bytes`);

    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for saveThumbnailFile operation');
      return false;
    }

    try {
      // Convert File to Blob if needed
      const blob = file instanceof File ? file : file;

      const thumbnailFile = {
        songId: songId,
        blob: blob,
        mimeType: mimeType,
        size: blob.size,
        createdAt: new Date()
      };

      // Use retry logic for mobile compatibility
      const result = await this.retryOperation(async () => {
        const success = await this.put('thumbnailFiles', thumbnailFile);
        if (!success) {
          throw new Error('Put operation failed');
        }
        return success;
      }, 3, 2000); // 3 retries, starting with 2 second delay

      if (result) {
        console.log(`✅ Thumbnail file saved successfully for song: ${songId}`);
        return true;
      } else {
        console.error(`❌ Failed to save thumbnail file for song: ${songId} after retries`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Exception saving thumbnail file for song ${songId}:`, error);
      return false;
    }
  }

  /**
   * Lấy audio file blob theo songId
   * @param songId - ID của bài hát
   * @returns Promise<Blob | null>
   */
  async getAudioFile(songId: string): Promise<Blob | null> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for getAudioFile operation');
      return null;
    }

    try {
      const audioFile = await this.get('audioFiles', songId);
      return audioFile ? audioFile.blob : null;
    } catch (error) {
      console.error(`❌ Error getting audio file for song ${songId}:`, error);
      return null;
    }
  }

  /**
   * Lấy thumbnail file blob theo songId
   * @param songId - ID của bài hát
   * @returns Promise<Blob | null>
   */
  async getThumbnailFile(songId: string): Promise<Blob | null> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for getThumbnailFile operation');
      return null;
    }

    try {
      const thumbnailFile = await this.get('thumbnailFiles', songId);
      return thumbnailFile ? thumbnailFile.blob : null;
    } catch (error) {
      console.error(`❌ Error getting thumbnail file for song ${songId}:`, error);
      return null;
    }
  }

  /**
   * Xóa audio file blob theo songId
   * @param songId - ID của bài hát
   * @returns Promise<boolean>
   */
  async deleteAudioFile(songId: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for deleteAudioFile operation');
      return false;
    }

    try {
      const result = await this.delete('audioFiles', songId);
      if (result) {
        console.log(`✅ Audio file deleted successfully for song: ${songId}`);
      } else {
        console.error(`❌ Failed to delete audio file for song: ${songId}`);
      }
      return result;
    } catch (error) {
      console.error(`❌ Exception deleting audio file for song ${songId}:`, error);
      return false;
    }
  }

  /**
   * Xóa thumbnail file blob theo songId
   * @param songId - ID của bài hát
   * @returns Promise<boolean>
   */
  async deleteThumbnailFile(songId: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for deleteThumbnailFile operation');
      return false;
    }

    try {
      const result = await this.delete('thumbnailFiles', songId);
      if (result) {
        console.log(`✅ Thumbnail file deleted successfully for song: ${songId}`);
      } else {
        console.error(`❌ Failed to delete thumbnail file for song: ${songId}`);
      }
      return result;
    } catch (error) {
      console.error(`❌ Exception deleting thumbnail file for song ${songId}:`, error);
      return false;
    }
  }

  /**
   * Kiểm tra xem file blob có tồn tại không
   * @param storeName - Tên của object store
   * @param songId - ID của bài hát
   * @returns Promise<boolean>
   */
  async hasFile(storeName: string, songId: string): Promise<boolean> {
    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for hasFile operation');
      return false;
    }

    try {
      const file = await this.get(storeName, songId);
      return file !== null;
    } catch (error) {
      console.error(`❌ Error checking file existence in ${storeName} for song ${songId}:`, error);
      return false;
    }
  }

  /**
   * Lưu download tasks vào IndexedDB
   */
  async saveDownloadsToIndexedDB(downloads: any[]): Promise<boolean> {
    console.log('💾 Saving download tasks to IndexedDB:', downloads.length);

    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for saveDownloadsToIndexedDB operation');
      return false;
    }

    try {
      const downloadsData = {
        id: 'download_tasks',
        downloads: downloads,
        savedAt: new Date()
      };

      const result = await this.put('downloads', downloadsData);
      if (result) {
        console.log('✅ Download tasks saved to IndexedDB successfully');
      } else {
        console.error('❌ Failed to save download tasks to IndexedDB');
      }
      return result;
    } catch (error) {
      console.error('❌ Exception saving download tasks to IndexedDB:', error);
      return false;
    }
  }

  /**
   * Tải download tasks từ IndexedDB
   */
  async loadDownloadsFromIndexedDB(): Promise<any[]> {
    console.log('📥 Loading download tasks from IndexedDB...');

    const isReady = await this.ensureDatabaseReady();
    if (!isReady) {
      console.error('❌ Database not ready for loadDownloadsFromIndexedDB operation');
      return [];
    }

    try {
      const downloadsData = await this.get('downloads', 'download_tasks');
      if (downloadsData && downloadsData.downloads) {
        console.log('✅ Download tasks loaded from IndexedDB:', downloadsData.downloads.length);
        return downloadsData.downloads;
      } else {
        console.log('ℹ️ No download tasks found in IndexedDB');
        return [];
      }
    } catch (error) {
      console.error('❌ Exception loading download tasks from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.db !== null;
  }

  /**
   * Retry function with exponential backoff for mobile compatibility
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error(`❌ Operation failed after ${maxRetries} attempts:`, error);
          return null;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`⚠️ Operation failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return null;
  }

  /**
   * Get current database version without opening it
   */
  private async getCurrentDBVersion(): Promise<number> {
    return new Promise((resolve) => {
      // Open with version 1 to check existing version
      const request = indexedDB.open(this.dbName);

      request.onsuccess = () => {
        const db = request.result;
        const currentVersion = db.version;
        db.close();
        resolve(currentVersion);
      };

      request.onerror = () => {
        // Database doesn't exist
        resolve(0);
      };
    });
  }

  /**
   * Clear browser cache and reset for testing (development only)
   */
  async clearBrowserCacheForTesting(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('✅ Browser caches cleared');
      }

      console.log('🔄 Please manually clear IndexedDB in browser dev tools for complete reset');
    } catch (error) {
      console.error('❌ Error clearing browser cache:', error);
    }
  }
}
