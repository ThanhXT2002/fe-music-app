import { Injectable } from '@angular/core';
import { Song, SearchHistoryItem, Playlist } from '../interfaces/song.interface';

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private dbName = 'xtmusic_db';
  private dbVersion = 3; // STABLE VERSION - DO NOT CHANGE unless absolutely necessary
  private static initPromise: Promise<boolean> | null = null; // Static shared promise
  private static isInitializing = false; // Static shared flag

  constructor() {
    // NO automatic initialization here
  }

  isReady(): boolean {
    return this.db !== null && !IndexedDBService.isInitializing;
  }  async initDB(): Promise<boolean> {
    // Prevent multiple initialization attempts with static shared state
    if (this.db) {
      return true;
    }

    if (IndexedDBService.isInitializing && IndexedDBService.initPromise) {
      return IndexedDBService.initPromise;
    }

    IndexedDBService.isInitializing = true;
    IndexedDBService.initPromise = this.performInitialization();

    try {
      const result = await IndexedDBService.initPromise;
      return result;
    } finally {
      IndexedDBService.isInitializing = false;
    }
  }

  private async performInitialization(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Add timeout for initialization
      const timeout = setTimeout(() => {
        console.error('IndexedDB initialization timeout');
        reject(new Error('Database initialization timeout'));
      }, 10000); // 10 second timeout

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        clearTimeout(timeout);
        console.error('Error opening IndexedDB:', request.error);
        reject(new Error(`Failed to open database: ${request.error}`));
      };

      request.onsuccess = () => {
        clearTimeout(timeout);
        this.db = request.result;

        // Add error handler for database
        this.db.onerror = (event) => {
          console.error('Database error:', event);
        };

        // Add close handler
        this.db.onclose = () => {
          console.warn('Database connection closed unexpectedly');
          this.db = null;
        };

        console.log('✅ IndexedDB initialized successfully');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        try {
          this.createObjectStores(db);
          console.log('✅ Database schema upgraded successfully');
        } catch (error) {
          console.error('❌ Error creating object stores:', error);
          clearTimeout(timeout);
          reject(error);
        }
      };

      request.onblocked = () => {
        console.warn('⚠️ Database upgrade blocked by another tab');
      };
    });
  }
  private createObjectStores(db: IDBDatabase) {
    try {
      if (!db.objectStoreNames.contains('songs')) {
        const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
        songsStore.createIndex('title', 'title', { unique: false });
        songsStore.createIndex('artist', 'artist', { unique: false });
        songsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('search_history')) {
        const historyStore = db.createObjectStore('search_history', { keyPath: 'songId' });
        historyStore.createIndex('searchedAt', 'searchedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('playlists')) {
        const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
        playlistStore.createIndex('name', 'name', { unique: false });
        playlistStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('thumbnailFiles')) {
        const thumbnailStore = db.createObjectStore('thumbnailFiles', { keyPath: 'songId' });
        thumbnailStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('audioFiles')) {
        const audioStore = db.createObjectStore('audioFiles', { keyPath: 'songId' });
        audioStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    } catch (error) {
      console.error('❌ Error creating object stores:', error);
      throw error;
    }
  }
  async put(storeName: string, data: any): Promise<boolean> {
    await this.ensureDBReady();
    if (!this.db) return false;

    // Validate store name
    if (!this.db.objectStoreNames.contains(storeName)) {
      console.error(`Store '${storeName}' does not exist`);
      return false;
    }

    // Validate data
    if (!data || typeof data !== 'object') {
      console.error('Invalid data provided to put method');
      return false;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');

        // Add transaction timeout
        const timeout = setTimeout(() => {
          transaction.abort();
          console.error(`Transaction timeout for store: ${storeName}`);
          reject(new Error('Transaction timeout'));
        }, 5000);

        transaction.oncomplete = () => {
          clearTimeout(timeout);
          resolve(true);
        };

        transaction.onerror = () => {
          clearTimeout(timeout);
          console.error(`Transaction error for ${storeName}:`, transaction.error);
          reject(new Error(`Transaction failed: ${transaction.error}`));
        };

        transaction.onabort = () => {
          clearTimeout(timeout);
          console.error(`Transaction aborted for ${storeName}`);
          reject(new Error('Transaction aborted'));
        };

        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onerror = () => {
          console.error(`Error putting data to ${storeName}:`, request.error);
        };
      } catch (error) {
        console.error(`Exception in put method for ${storeName}:`, error);
        reject(error);
      }
    });
  }

  private async ensureDBReady(): Promise<void> {
    if (!this.db) {
      const success = await this.initDB();
      if (!success) {
        throw new Error('Failed to initialize database');
      }
    }
  }
  async get(storeName: string, key: string): Promise<any | null> {
    await this.ensureDBReady();
    if (!this.db) return null;

    // Validate parameters
    if (!storeName || !key) {
      console.error('Store name and key are required for get operation');
      return null;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        const timeout = setTimeout(() => {
          console.error(`Get operation timeout for ${storeName}:${key}`);
          resolve(null);
        }, 3000);

        request.onsuccess = () => {
          clearTimeout(timeout);
          resolve(request.result || null);
        };

        request.onerror = () => {
          clearTimeout(timeout);
          console.error(`Error getting data from ${storeName}:`, request.error);
          resolve(null);
        };

        transaction.onerror = () => {
          clearTimeout(timeout);
          console.error(`Transaction error for get from ${storeName}:`, transaction.error);
          resolve(null);
        };
      } catch (error) {
        console.error(`Exception in get method for ${storeName}:`, error);
        resolve(null);
      }
    });
  }

  async getAll(storeName: string): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.error(`Error getting all data from ${storeName}:`, request.error);
        reject([]);
      };
    });
  }

  async delete(storeName: string, key: string): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error(`Error deleting data from ${storeName}:`, request.error);
        reject(false);
      };
    });
  }

  async clear(storeName: string): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error(`Error clearing store ${storeName}:`, request.error);
        reject(false);
      };
    });
  }

  async search(storeName: string, indexName: string, query: string): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        const filteredResults = results.filter(item => {
          const value = item[indexName];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query.toLowerCase());
          }
          return false;
        });
        resolve(filteredResults);
      };

      request.onerror = () => {
        console.error(`Error searching data in ${storeName}:`, request.error);
        reject([]);
      };
    });
  }

  async saveThumbnailFile(songId: string, blob: Blob, mimeType: string): Promise<boolean> {
    if (!this.db) return false;

    const thumbnailFile = {
      songId: songId,
      blob: blob,
      mimeType: mimeType,
      size: blob.size,
      createdAt: new Date()
    };

    return await this.put('thumbnailFiles', thumbnailFile);
  }

  async getThumbnailFile(songId: string): Promise<Blob | null> {
    if (!this.db) return null;

    const thumbnailFile = await this.get('thumbnailFiles', songId);
    return thumbnailFile ? thumbnailFile.blob : null;
  }

  async deleteThumbnailFile(songId: string): Promise<boolean> {
    if (!this.db) return false;
    return await this.delete('thumbnailFiles', songId);
  }

  async saveAudioFile(songId: string, blob: Blob, mimeType: string): Promise<boolean> {
    if (!this.db) return false;

    const audioFile = {
      songId: songId,
      blob: blob,
      mimeType: mimeType,
      size: blob.size,
      createdAt: new Date()
    };

    return await this.put('audioFiles', audioFile);
  }

  async getAudioFile(songId: string): Promise<Blob | null> {
    if (!this.db) return null;

    const audioFile = await this.get('audioFiles', songId);
    return audioFile ? audioFile.blob : null;
  }
  async deleteAudioFile(songId: string): Promise<boolean> {
    if (!this.db) return false;
    return await this.delete('audioFiles', songId);
  }

  async checkOfflineFiles(songId: string): Promise<any> {
    if (!this.db) return null;

    try {
      const audioFile = await this.get('audioFiles', songId);
      const thumbnailFile = await this.get('thumbnailFiles', songId);

      return {
        hasAudio: !!audioFile,
        hasThumbnail: !!thumbnailFile,
        audioSize: audioFile ? audioFile.size : 0,
        thumbnailSize: thumbnailFile ? thumbnailFile.size : 0
      };
    } catch (error) {
      console.error('Error checking offline files:', error);
      return null;
    }
  }

  async getStorageUsage(): Promise<any> {
    if (!this.db) return { totalSize: 0, breakdown: {} };

    try {
      const songs = await this.getAll('songs');
      const audioFiles = await this.getAll('audioFiles');
      const thumbnailFiles = await this.getAll('thumbnailFiles');

      const audioSize = audioFiles.reduce((total: number, file: any) => total + (file.size || 0), 0);
      const thumbnailSize = thumbnailFiles.reduce((total: number, file: any) => total + (file.size || 0), 0);

      return {
        totalSize: audioSize + thumbnailSize,
        breakdown: {
          songs: songs.length,
          audioFiles: audioFiles.length,
          thumbnailFiles: thumbnailFiles.length,
          audioSize: audioSize,
          thumbnailSize: thumbnailSize
        }
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { totalSize: 0, breakdown: {} };
    }
  }

  async getAllThumbnails(): Promise<any[]> {
    if (!this.db) return [];

    try {
      return await this.getAll('thumbnailFiles');
    } catch (error) {
      console.error('Error getting all thumbnails:', error);
      return [];
    }
  }

  /**
   * Check if IndexedDB is supported
   */
  static isSupported(): boolean {
    return 'indexedDB' in window && indexedDB !== null;
  }

  /**
   * Get database connection status
   */  getConnectionStatus(): {
    isConnected: boolean;
    isInitializing: boolean;
    dbName: string;
    version: number;
  } {
    return {
      isConnected: this.db !== null,
      isInitializing: IndexedDBService.isInitializing,
      dbName: this.dbName,
      version: this.dbVersion
    };
  }

  /**
   * Close database connection
   */
  closeConnection(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('📎 IndexedDB connection closed');
    }
  }
  /**
   * Cleanup and reset service
   */
  async cleanup(): Promise<void> {
    this.closeConnection();
    IndexedDBService.initPromise = null;
    IndexedDBService.isInitializing = false;
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'error';
    details: any;
  }> {
    try {
      if (!IndexedDBService.isSupported()) {
        return {
          status: 'error',
          details: { error: 'IndexedDB not supported' }
        };
      }

      await this.ensureDBReady();

      if (!this.db) {
        return {
          status: 'error',
          details: { error: 'Database not initialized' }
        };
      }

      // Test basic operations
      const testKey = 'health_check_test';
      const testData = { id: testKey, timestamp: Date.now() };

      // Try to write and read
      await this.put('songs', testData);
      const retrieved = await this.get('songs', testKey);
      await this.delete('songs', testKey);

      const usage = await this.getStorageUsage();

      return {
        status: 'healthy',
        details: {
          connection: this.getConnectionStatus(),
          storageUsage: usage,
          testPassed: retrieved && retrieved.id === testKey
        }
      };    } catch (error) {
      return {
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}
