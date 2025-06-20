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
  private dbVersion = 31; // Increased to fix version conflict

  constructor() {}
  /**
   * Khởi tạo IndexedDB
   */
  async initDB(): Promise<boolean> {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ Error opening IndexedDB:', request.error);
        resolve(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB opened successfully, version:', this.db.version);
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        console.log('🔄 IndexedDB upgrade needed, creating object stores...');
        const db = (event.target as IDBOpenDBRequest).result;

        // Tạo object stores (tương đương với tables trong SQLite)
        this.createObjectStores(db);
      };
    });
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
    }// Search history store
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
    }    // User preferences store
    if (!db.objectStoreNames.contains('user_preferences')) {
      db.createObjectStore('user_preferences', { keyPath: 'key' });
    }

    // Audio files store for offline audio blobs
    if (!db.objectStoreNames.contains('audioFiles')) {
      const audioStore = db.createObjectStore('audioFiles', { keyPath: 'songId' });
      audioStore.createIndex('mimeType', 'mimeType', { unique: false });
      audioStore.createIndex('createdAt', 'createdAt', { unique: false });
    }    // Thumbnail files store for offline thumbnail blobs
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
   * Thêm hoặc cập nhật record
   */
  async put(storeName: string, data: any): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error(`Error putting data to ${storeName}:`, request.error);
        reject(false);
      };
    });
  }

  /**
   * Lấy record theo key
   */
  async get(storeName: string, key: string): Promise<any | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error(`Error getting data from ${storeName}:`, request.error);
        reject(null);
      };
    });
  }

  /**
   * Lấy tất cả records từ store
   */
  async getAll(storeName: string, indexName?: string, query?: IDBValidKey | IDBKeyRange): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
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

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        console.error(`Error getting all data from ${storeName}:`, request.error);
        reject([]);
      };
    });
  }

  /**
   * Xóa record theo key
   */
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

  /**
   * Tìm kiếm records
   */
  async search(storeName: string, indexName: string, query: string): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
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
      };

      request.onerror = () => {
        console.error(`Error searching data in ${storeName}:`, request.error);
        reject([]);
      };
    });
  }

  /**
   * Xóa tất cả dữ liệu trong store
   */
  async clear(storeName: string): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error(`Error clearing ${storeName}:`, request.error);
        reject(false);
      };
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
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error(`Error counting data in ${storeName}:`, request.error);
        reject(0);
      };
    });
  }

  // === OFFLINE FILE MANAGEMENT METHODS ===
  /**
   * Lưu audio file blob vào IndexedDB
   * @param songId - ID của bài hát
   * @param file - Audio file hoặc blob
   * @param mimeType - MIME type của file
   * @returns Promise<boolean>
   */
  async saveAudioFile(songId: string, file: File | Blob, mimeType: string): Promise<boolean> {
    if (!this.db) return false;

    // Convert File to Blob if needed
    const blob = file instanceof File ? file : file;

    const audioFile = {
      songId: songId,
      blob: blob,
      mimeType: mimeType,
      size: blob.size,
      createdAt: new Date()
    };

    return await this.put('audioFiles', audioFile);
  }
  /**
   * Lưu thumbnail file blob vào IndexedDB
   * @param songId - ID của bài hát
   * @param file - Thumbnail file hoặc blob
   * @param mimeType - MIME type của file
   * @returns Promise<boolean>
   */
  async saveThumbnailFile(songId: string, file: File | Blob, mimeType: string): Promise<boolean> {
    if (!this.db) return false;

    // Convert File to Blob if needed
    const blob = file instanceof File ? file : file;

    const thumbnailFile = {
      songId: songId,
      blob: blob,
      mimeType: mimeType,
      size: blob.size,
      createdAt: new Date()
    };

    return await this.put('thumbnailFiles', thumbnailFile);
  }

  /**
   * Lấy audio file blob theo songId
   * @param songId - ID của bài hát
   * @returns Promise<Blob | null>
   */
  async getAudioFile(songId: string): Promise<Blob | null> {
    if (!this.db) return null;

    const audioFile = await this.get('audioFiles', songId);
    return audioFile ? audioFile.blob : null;
  }

  /**
   * Lấy thumbnail file blob theo songId
   * @param songId - ID của bài hát
   * @returns Promise<Blob | null>
   */
  async getThumbnailFile(songId: string): Promise<Blob | null> {
    if (!this.db) return null;

    const thumbnailFile = await this.get('thumbnailFiles', songId);
    return thumbnailFile ? thumbnailFile.blob : null;
  }

  /**
   * Xóa audio file
   * @param songId - ID của bài hát
   * @returns Promise<boolean>
   */
  async deleteAudioFile(songId: string): Promise<boolean> {
    if (!this.db) return false;
    return await this.delete('audioFiles', songId);
  }

  /**
   * Xóa thumbnail file
   * @param songId - ID của bài hát
   * @returns Promise<boolean>
   */
  async deleteThumbnailFile(songId: string): Promise<boolean> {
    if (!this.db) return false;
    return await this.delete('thumbnailFiles', songId);
  }

  /**
   * Xóa cả audio và thumbnail file của một bài hát
   * @param songId - ID của bài hát
   * @returns Promise<boolean>
   */
  async deleteAllFiles(songId: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      await this.deleteAudioFile(songId);
      await this.deleteThumbnailFile(songId);
      return true;
    } catch (error) {
      console.error('Error deleting files for song:', songId, error);
      return false;
    }
  }

  /**
   * Kiểm tra xem bài hát có files offline không
   * @param songId - ID của bài hát
   * @returns Promise<{hasAudio: boolean, hasThumbnail: boolean}>
   */
  async checkOfflineFiles(songId: string): Promise<{hasAudio: boolean, hasThumbnail: boolean}> {
    if (!this.db) return {hasAudio: false, hasThumbnail: false};

    try {
      const audioFile = await this.get('audioFiles', songId);
      const thumbnailFile = await this.get('thumbnailFiles', songId);

      return {
        hasAudio: !!audioFile,
        hasThumbnail: !!thumbnailFile
      };
    } catch (error) {
      console.error('Error checking offline files:', error);
      return {hasAudio: false, hasThumbnail: false};
    }
  }

  /**
   * Lấy tổng dung lượng storage đã sử dụng
   * @returns Promise<{audioSize: number, thumbnailSize: number, totalSize: number}>
   */
  async getStorageUsage(): Promise<{audioSize: number, thumbnailSize: number, totalSize: number}> {
    if (!this.db) return {audioSize: 0, thumbnailSize: 0, totalSize: 0};

    try {
      const audioFiles = await this.getAll('audioFiles');
      const thumbnailFiles = await this.getAll('thumbnailFiles');

      const audioSize = audioFiles.reduce((total, file) => total + (file.size || 0), 0);
      const thumbnailSize = thumbnailFiles.reduce((total, file) => total + (file.size || 0), 0);

      return {
        audioSize,
        thumbnailSize,
        totalSize: audioSize + thumbnailSize
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return {audioSize: 0, thumbnailSize: 0, totalSize: 0};
    }
  }

  /**
   * Delete record by key
   */
  async deleteRecord(storeName: string, key: string): Promise<boolean> {
    return await this.delete(storeName, key);
  }

  /**
   * Check if database is ready
   */
  isReady(): boolean {
    return this.db !== null;
  }

  /**
   * Reset database - delete and recreate with new version
   */
  async resetDatabase(): Promise<boolean> {
    try {
      console.log('🔄 Resetting IndexedDB database...');

      // Close current connection if exists
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // Delete the existing database
      return new Promise((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase(this.dbName);

        deleteRequest.onsuccess = async () => {
          console.log('✅ Database deleted successfully');
          // Reinitialize the database
          const success = await this.initDB();
          resolve(success);
        };

        deleteRequest.onerror = () => {
          console.error('❌ Error deleting database:', deleteRequest.error);
          resolve(false);
        };

        deleteRequest.onblocked = () => {
          console.log('⚠️ Database deletion blocked, please close all tabs');
          resolve(false);
        };
      });
    } catch (error) {
      console.error('❌ Error resetting database:', error);
      return false;
    }
  }
}
