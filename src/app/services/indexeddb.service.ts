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
  private dbVersion = 2;

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

    // Media blobs store for PWA offline support
    if (!db.objectStoreNames.contains('media_blobs')) {
      const blobStore = db.createObjectStore('media_blobs', { keyPath: 'id' });
      blobStore.createIndex('type', 'type', { unique: false });
      blobStore.createIndex('songId', 'songId', { unique: false });
      blobStore.createIndex('createdAt', 'createdAt', { unique: false });
      blobStore.createIndex('size', 'size', { unique: false });
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

  // === BLOB MANAGEMENT METHODS ===

  /**
   * Lưu blob vào IndexedDB
   * @param id - Unique ID cho blob
   * @param blob - Blob data (audio/image)
   * @param type - Loại blob: 'audio' | 'thumbnail'
   * @param songId - ID của bài hát liên quan
   * @param mimeType - MIME type của blob
   */
  async saveBlobToIndexedDB(id: string, blob: Blob, type: 'audio' | 'thumbnail', songId: string, mimeType?: string): Promise<boolean> {
    if (!this.db) return false;

    const blobData = {
      id,
      type,
      mimeType: mimeType || blob.type,
      size: blob.size,
      songId,
      createdAt: new Date().toISOString(),
      blobData: blob
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media_blobs'], 'readwrite');
      const store = transaction.objectStore('media_blobs');
      const request = store.put(blobData);

      request.onsuccess = () => {
        console.log(`✅ Blob saved: ${id} (${type})`);
        resolve(true);
      };

      request.onerror = () => {
        console.error(`Error saving blob ${id}:`, request.error);
        reject(false);
      };
    });
  }

  /**
   * Lấy blob từ IndexedDB
   * @param id - ID của blob
   */
  async getBlobFromIndexedDB(id: string): Promise<Blob | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media_blobs'], 'readonly');
      const store = transaction.objectStore('media_blobs');
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.blobData) {
          resolve(result.blobData);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error(`Error getting blob ${id}:`, request.error);
        reject(null);
      };
    });
  }

  /**
   * Xóa blob khỏi IndexedDB
   * @param id - ID của blob cần xóa
   */
  async deleteBlobFromIndexedDB(id: string): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media_blobs'], 'readwrite');
      const store = transaction.objectStore('media_blobs');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`✅ Blob deleted: ${id}`);
        resolve(true);
      };

      request.onerror = () => {
        console.error(`Error deleting blob ${id}:`, request.error);
        reject(false);
      };
    });
  }

  /**
   * Lấy danh sách blobs theo type
   * @param type - Loại blob: 'audio' | 'thumbnail'
   */
  async getBlobsByType(type: 'audio' | 'thumbnail'): Promise<{id: string, size: number, songId: string}[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media_blobs'], 'readonly');
      const store = transaction.objectStore('media_blobs');
      const index = store.index('type');
      const request = index.getAll(type);

      request.onsuccess = () => {
        const blobs = request.result.map(blob => ({
          id: blob.id,
          size: blob.size,
          songId: blob.songId
        }));
        resolve(blobs);
      };

      request.onerror = () => {
        console.error(`Error getting blobs by type ${type}:`, request.error);
        reject([]);
      };
    });
  }

  /**
   * Lấy thông tin sử dụng storage
   */
  async getStorageUsage(): Promise<{used: number, available: number}> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          available: estimate.quota || 0
        };
      } else {
        // Fallback: tính toán từ IndexedDB
        const audioBlobs = await this.getBlobsByType('audio');
        const thumbnailBlobs = await this.getBlobsByType('thumbnail');
        const totalSize = [...audioBlobs, ...thumbnailBlobs]
          .reduce((sum, blob) => sum + blob.size, 0);

        return {
          used: totalSize,
          available: 1024 * 1024 * 1024 // 1GB fallback
        };
      }
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { used: 0, available: 0 };
    }
  }

  /**
   * Xóa các blob cũ hơn số ngày chỉ định
   * @param olderThanDays - Số ngày
   */
  async clearOldBlobs(olderThanDays: number): Promise<number> {
    if (!this.db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media_blobs'], 'readwrite');
      const store = transaction.objectStore('media_blobs');
      const index = store.index('createdAt');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffISO));

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`✅ Deleted ${deletedCount} old blobs`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('Error clearing old blobs:', request.error);
        reject(0);
      };
    });
  }

  /**
   * Lấy size của một blob cụ thể
   * @param id - ID của blob
   */
  async getBlobSize(id: string): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media_blobs'], 'readonly');
      const store = transaction.objectStore('media_blobs');
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.size : 0);
      };

      request.onerror = () => {
        console.error(`Error getting blob size ${id}:`, request.error);
        reject(0);
      };
    });
  }

  /**
   * Lưu nhiều blobs cùng lúc (batch operation)
   * @param blobs - Mảng các blob data
   */
  async saveBlobBatch(blobs: {id: string, blob: Blob, type: 'audio' | 'thumbnail', songId: string}[]): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media_blobs'], 'readwrite');
      const store = transaction.objectStore('media_blobs');

      let completed = 0;
      let hasError = false;

      transaction.oncomplete = () => {
        if (!hasError) {
          console.log(`✅ Batch saved ${blobs.length} blobs`);
          resolve(true);
        }
      };

      transaction.onerror = () => {
        console.error('Batch save transaction error:', transaction.error);
        reject(false);
      };

      blobs.forEach(blobData => {
        const data = {
          id: blobData.id,
          type: blobData.type,
          mimeType: blobData.blob.type,
          size: blobData.blob.size,
          songId: blobData.songId,
          createdAt: new Date().toISOString(),
          blobData: blobData.blob
        };

        const request = store.put(data);

        request.onsuccess = () => {
          completed++;
        };

        request.onerror = () => {
          hasError = true;
          console.error(`Error in batch save for ${blobData.id}:`, request.error);
        };
      });
    });
  }

  /**
   * Xóa nhiều blobs cùng lúc (batch operation)
   * @param ids - Mảng các blob IDs cần xóa
   */
  async deleteBlobBatch(ids: string[]): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['media_blobs'], 'readwrite');
      const store = transaction.objectStore('media_blobs');

      let completed = 0;
      let hasError = false;

      transaction.oncomplete = () => {
        if (!hasError) {
          console.log(`✅ Batch deleted ${ids.length} blobs`);
          resolve(true);
        }
      };

      transaction.onerror = () => {
        console.error('Batch delete transaction error:', transaction.error);
        reject(false);
      };

      ids.forEach(id => {
        const request = store.delete(id);

        request.onsuccess = () => {
          completed++;
        };

        request.onerror = () => {
          hasError = true;
          console.error(`Error in batch delete for ${id}:`, request.error);
        };
      });
    });
  }
}
