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
  private dbVersion = 1;

  constructor() {}

  /**
   * Khởi tạo IndexedDB
   */
  async initDB(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized successfully');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
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
    }    // Search history store
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
}
