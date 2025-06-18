import { Injectable } from '@angular/core';
import {
  Song,
  Album,
  Artist,
  Playlist,
  SearchHistoryItem,
  DataSong,
} from '../interfaces/song.interface';

/**
 * Service wrapper cho IndexedDB để sử dụng trên web platform
 * Cung cấp các phương thức tương tự SQLite cho web browser
 */
@Injectable({
  providedIn: 'root',
})
export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private dbName = 'xtmusic_db';
  private dbVersion = 3; // Tăng version để trigger upgrade và tạo thumbnailFiles store
  private initPromise: Promise<boolean> | null = null; // Track initialization promise

  constructor() {}

  /**
   * Kiểm tra xem IndexedDB đã sẵn sàng chưa
   */
  isReady(): boolean {
    return this.db !== null;
  }

  /**
   * Lấy danh sách object stores hiện có
   */
  getObjectStoreNames(): string[] {
    if (!this.db) return [];
    return Array.from(this.db.objectStoreNames);
  }  /**
   * Khởi tạo IndexedDB
   */
  async initDB(): Promise<boolean> {
    // Nếu đã có promise initialization đang chờ, return promise đó
    if (this.initPromise) {
      return this.initPromise;
    }

    // Nếu database đã được khởi tạo, return true
    if (this.db) {
      console.log('✅ IndexedDB already initialized');
      return true;
    }

    console.log('🔄 Initializing IndexedDB...');

    // Tạo promise mới và lưu lại
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ Error opening IndexedDB:', request.error);
        this.initPromise = null; // Reset promise on error
        reject(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB opened successfully');
        console.log(
          '📊 Available object stores:',
          Array.from(this.db.objectStoreNames)
        );

        // Add error handler for database
        this.db.onerror = (event) => {
          console.error('❌ IndexedDB error:', event);
        };

        this.db.onclose = () => {
          console.warn('⚠️ IndexedDB connection closed');
          this.db = null;
          this.initPromise = null;
        };        // Check if we have data
        this.debugExistingData();

        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        console.log('🔧 IndexedDB upgrade needed, creating object stores...');
        const db = (event.target as IDBOpenDBRequest).result;

        // Tạo object stores (tương đương với tables trong SQLite)
        this.createObjectStores(db);
      };
    });

    return this.initPromise;
  }
  /**
   * Tạo các object stores (tables)
   */
  private createObjectStores(db: IDBDatabase) {
    console.log('🔧 Creating object stores...');

    // Songs store
    if (!db.objectStoreNames.contains('songs')) {
      console.log('📦 Creating songs store...');
      const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
      songsStore.createIndex('title', 'title', { unique: false });
      songsStore.createIndex('artist', 'artist', { unique: false });
      songsStore.createIndex('addedDate', 'addedDate', { unique: false });
    }

    // Search history store
    if (!db.objectStoreNames.contains('search_history')) {
      console.log('📦 Creating search_history store...');
      const historyStore = db.createObjectStore('search_history', {
        keyPath: 'songId',
      });
      historyStore.createIndex('searchedAt', 'searchedAt', { unique: false });
      historyStore.createIndex('title', 'title', { unique: false });
      historyStore.createIndex('artist', 'artist', { unique: false });
    }

    // Recently played store
    if (!db.objectStoreNames.contains('recently_played')) {
      console.log('📦 Creating recently_played store...');
      const recentStore = db.createObjectStore('recently_played', {
        keyPath: 'id',
        autoIncrement: true,
      });
      recentStore.createIndex('songId', 'songId', { unique: false });
      recentStore.createIndex('playedAt', 'playedAt', { unique: false });
    }

    // Playlists store
    if (!db.objectStoreNames.contains('playlists')) {
      console.log('📦 Creating playlists store...');
      const playlistsStore = db.createObjectStore('playlists', {
        keyPath: 'id',
      });
      playlistsStore.createIndex('name', 'name', { unique: false });
    }

    // User preferences store
    if (!db.objectStoreNames.contains('user_preferences')) {
      console.log('📦 Creating user_preferences store...');
      db.createObjectStore('user_preferences', { keyPath: 'key' });
    }    // Audio files store for offline audio blobs
    if (!db.objectStoreNames.contains('audioFiles')) {
      console.log('📦 Creating audioFiles store...');
      const audioStore = db.createObjectStore('audioFiles', { keyPath: 'songId' });
      audioStore.createIndex('mimeType', 'mimeType', { unique: false });
      audioStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // Thumbnail files store for offline thumbnail blobs
    if (!db.objectStoreNames.contains('thumbnailFiles')) {
      console.log('📦 Creating thumbnailFiles store...');
      const thumbStore = db.createObjectStore('thumbnailFiles', { keyPath: 'songId' });
      thumbStore.createIndex('mimeType', 'mimeType', { unique: false });
      thumbStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    console.log('✅ All object stores created successfully');
  }
  /**
   * Đảm bảo database đã sẵn sàng trước khi thực hiện operations
   */
  private async ensureReady(): Promise<boolean> {
    if (this.db) {
      return true;
    }

    console.log('🔄 Database not ready, initializing...');
    return await this.initDB();
  }
  /**
   * Thêm hoặc cập nhật record
   */
  async put(storeName: string, data: any): Promise<boolean> {
    // Đảm bảo database đã sẵn sàng
    const isReady = await this.ensureReady();
    if (!isReady || !this.db) {
      console.error('❌ IndexedDB is not ready for write operations');
      return false;
    }

    console.log(`📝 Writing to store "${storeName}":`, data);

    return new Promise((resolve, reject) => {
      try {
        // Check if object store exists
        if (!this.db!.objectStoreNames.contains(storeName)) {
          console.error(`❌ Object store "${storeName}" does not exist`);
          console.log('📊 Available stores:', Array.from(this.db!.objectStoreNames));
          reject(new Error(`Object store "${storeName}" does not exist`));
          return;
        }

        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error(`Error putting data to ${storeName}:`, request.error);
          reject(
            new Error(`Error putting data to ${storeName}: ${request.error}`)
          );
        };

        transaction.onerror = () => {
          console.error(
            `Transaction error for ${storeName}:`,
            transaction.error
          );
          reject(
            new Error(
              `Transaction error for ${storeName}: ${transaction.error}`
            )
          );
        };
      } catch (error) {
        console.error(`Exception in put method for ${storeName}:`, error);
        reject(error);
      }
    });
  }
  /**
   * Lấy record theo key
   */
  async get(storeName: string, key: string): Promise<any | null> {
    // Đảm bảo database đã sẵn sàng
    const isReady = await this.ensureReady();
    if (!isReady || !this.db) {
      console.error('❌ IndexedDB is not ready for read operations');
      return null;
    }

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
  async getAll(
    storeName: string,
    indexName?: string,
    query?: IDBValidKey | IDBKeyRange
  ): Promise<any[]> {
    // Đảm bảo database đã sẵn sàng
    const isReady = await this.ensureReady();
    if (!isReady || !this.db) {
      console.error('❌ IndexedDB is not ready for read operations');
      return [];
    }

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
        console.error(
          `Error getting all data from ${storeName}:`,
          request.error
        );
        reject([]);
      };
    });
  }
  /**
   * Xóa record theo key
   */
  async delete(storeName: string, key: string): Promise<boolean> {
    // Đảm bảo database đã sẵn sàng
    const isReady = await this.ensureReady();
    if (!isReady || !this.db) {
      console.error('❌ IndexedDB is not ready for delete operations');
      return false;
    }

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
  async search(
    storeName: string,
    indexName: string,
    query: string
  ): Promise<any[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        // Filter results that contain the query string (case insensitive)
        const filteredResults = results.filter((item) => {
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
   * @param blob - Audio blob
   * @param mimeType - MIME type của file
   * @returns Promise<boolean>
   */
  async saveAudioFile(
    songId: string,
    blob: Blob,
    mimeType: string
  ): Promise<boolean> {
    if (!this.db) return false;

    const audioFile = {
      songId: songId,
      blob: blob,
      mimeType: mimeType,
      size: blob.size,
      createdAt: new Date(),
    };

    return await this.put('audioFiles', audioFile);
  }
  /**
   * Lưu thumbnail file blob vào IndexedDB
   * @param songId - ID của bài hát
   * @param blob - Thumbnail blob
   * @param mimeType - MIME type của file
   * @returns Promise<boolean>
   */
  async saveThumbnailFile(
    songId: string,
    blob: Blob,
    mimeType: string
  ): Promise<boolean> {
    if (!this.db) {
      console.error('IndexedDB is not initialized for thumbnail save');
      return false;
    }

    console.log('💾 Saving thumbnail to IndexedDB:', {
      songId,
      blobSize: blob.size,
      mimeType,
      hasDB: !!this.db,
      objectStores: this.getObjectStoreNames(),
    });

    const thumbnailFile = {
      songId: songId,
      blob: blob,
      mimeType: mimeType,
      size: blob.size,
      createdAt: new Date(),
    };

    const success = await this.put('thumbnailFiles', thumbnailFile);
    console.log('💾 Thumbnail save result:', success);
    return success;
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
    if (!this.db) {
      console.error('IndexedDB is not initialized for thumbnail get');
      return null;
    }

    console.log('🔍 Getting thumbnail from IndexedDB:', songId);
    const thumbnailFile = await this.get('thumbnailFiles', songId);

    if (thumbnailFile) {
      console.log('✅ Found thumbnail in IndexedDB:', {
        songId,
        blobSize: thumbnailFile.blob.size,
        mimeType: thumbnailFile.mimeType,
      });
      return thumbnailFile.blob;
    } else {
      console.log('❌ No thumbnail found in IndexedDB for:', songId);
      return null;
    }
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
  async checkOfflineFiles(
    songId: string
  ): Promise<{ hasAudio: boolean; hasThumbnail: boolean }> {
    if (!this.db) return { hasAudio: false, hasThumbnail: false };

    try {
      const audioFile = await this.get('audioFiles', songId);
      const thumbnailFile = await this.get('thumbnailFiles', songId);

      return {
        hasAudio: !!audioFile,
        hasThumbnail: !!thumbnailFile,
      };
    } catch (error) {
      console.error('Error checking offline files:', error);
      return { hasAudio: false, hasThumbnail: false };
    }
  }

  /**
   * Lấy tổng dung lượng storage đã sử dụng
   * @returns Promise<{audioSize: number, thumbnailSize: number, totalSize: number}>
   */
  async getStorageUsage(): Promise<{
    audioSize: number;
    thumbnailSize: number;
    totalSize: number;
  }> {
    if (!this.db) return { audioSize: 0, thumbnailSize: 0, totalSize: 0 };

    try {
      const audioFiles = await this.getAll('audioFiles');
      const thumbnailFiles = await this.getAll('thumbnailFiles');

      const audioSize = audioFiles.reduce(
        (total, file) => total + (file.size || 0),
        0
      );
      const thumbnailSize = thumbnailFiles.reduce(
        (total, file) => total + (file.size || 0),
        0
      );

      return {
        audioSize,
        thumbnailSize,
        totalSize: audioSize + thumbnailSize,
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return { audioSize: 0, thumbnailSize: 0, totalSize: 0 };
    }
  }

  /**
   * Debug: Lấy tất cả thumbnails từ IndexedDB
   */
  async getAllThumbnails(): Promise<any[]> {
    try {
      const transaction = this.db!.transaction(['thumbnailFiles'], 'readonly');
      const store = transaction.objectStore('thumbnailFiles');
      const request = store.getAll();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('📊 All thumbnails in IndexedDB:', request.result);
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('❌ Error getting all thumbnails:', error);
      return [];
    }
  }

  // ===== SONG SPECIFIC METHODS =====

  /**
   * Add a song to the database
   */
  async addSong(song: Song): Promise<boolean> {
    return await this.put('songs', song);
  }

  /**
   * Get all songs from database
   */
  async getAllSongs(): Promise<Song[]> {
    const songs = await this.getAll('songs');
    return songs as Song[];
  }

  /**
   * Get song by ID
   */
  async getSongById(id: string): Promise<Song | null> {
    const song = await this.get('songs', id);
    return (song as Song) || null;
  }

  /**
   * Update song information
   */
  async updateSong(song: Song): Promise<boolean> {
    return await this.put('songs', song);
  }

  /**
   * Delete song from database
   */
  async deleteSong(songId: string): Promise<boolean> {
    return await this.delete('songs', songId);
  }

  /**
   * Search songs by title or artist
   */
  async searchSongs(query: string): Promise<Song[]> {
    const allSongs = await this.getAllSongs();
    const searchQuery = query.toLowerCase();

    return allSongs.filter(
      (song) =>
        song.title.toLowerCase().includes(searchQuery) ||
        song.artist.toLowerCase().includes(searchQuery)
    );
  }

  // ===== SEARCH HISTORY METHODS =====
  /**
   * Add search history item
   */
  async addSearchHistory(item: SearchHistoryItem): Promise<boolean> {
    // Set searchedAt if not provided
    if (!item.searchedAt) {
      item.searchedAt = new Date();
    }
    return await this.put('search_history', item);
  }

  /**
   * Get search history (sorted by date, newest first)
   */
  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    const history = await this.getAll('search_history');
    return (history as SearchHistoryItem[]).sort(
      (a, b) =>
        new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime()
    );
  }

  /**
   * Clear all search history
   */
  async clearSearchHistory(): Promise<boolean> {
    return await this.clear('search_history');
  }

  /**
   * Delete specific search history item
   */
  async deleteSearchHistoryItem(songId: string): Promise<boolean> {
    return await this.delete('search_history', songId);
  }

  // ===== RECENTLY PLAYED METHODS =====

  /**
   * Add song to recently played
   */
  async addRecentlyPlayed(songId: string): Promise<boolean> {
    const recentItem = {
      id: Date.now(), // Use timestamp as ID
      songId: songId,
      playedAt: new Date().toISOString(),
    };
    return await this.put('recently_played', recentItem);
  }

  /**
   * Get recently played songs
   */
  async getRecentlyPlayed(limit: number = 50): Promise<Song[]> {
    const recentItems = await this.getAll('recently_played');

    // Sort by played date (newest first) and limit
    const sortedItems = recentItems
      .sort(
        (a: any, b: any) =>
          new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
      )
      .slice(0, limit);

    // Get actual song data
    const songs: Song[] = [];
    for (const item of sortedItems) {
      const song = await this.getSongById(item.songId);
      if (song) {
        songs.push(song);
      }
    }

    return songs;
  }

  /**
   * Clear recently played history
   */
  async clearRecentlyPlayed(): Promise<boolean> {
    return await this.clear('recently_played');
  }

  // ===== PLAYLIST METHODS =====
  /**
   * Create a new playlist
   */
  async createPlaylist(playlist: Playlist): Promise<boolean> {
    // Set dates if not provided
    const now = new Date();
    if (!playlist.createdDate) playlist.createdDate = now;
    if (!playlist.updatedDate) playlist.updatedDate = now;

    return await this.put('playlists', playlist);
  }

  /**
   * Get all playlists
   */
  async getAllPlaylists(): Promise<Playlist[]> {
    const playlists = await this.getAll('playlists');
    return playlists as Playlist[];
  }

  /**
   * Get playlist by ID
   */
  async getPlaylistById(id: string): Promise<Playlist | null> {
    const playlist = await this.get('playlists', id);
    return (playlist as Playlist) || null;
  }
  /**
   * Update playlist
   */
  async updatePlaylist(playlist: Playlist): Promise<boolean> {
    playlist.updatedDate = new Date();
    return await this.put('playlists', playlist);
  }

  /**
   * Delete playlist
   */
  async deletePlaylist(playlistId: string): Promise<boolean> {
    return await this.delete('playlists', playlistId);
  }

  // ===== THUMBNAIL BLOB METHODS =====

  /**
   * Save thumbnail blob for a song
   */
  async saveThumbnailBlob(songId: string, blob: Blob): Promise<boolean> {
    const thumbnailData = {
      songId: songId,
      blob: blob,
      mimeType: blob.type,
      size: blob.size,
      createdAt: new Date().toISOString(),
    };
    return await this.put('thumbnailFiles', thumbnailData);
  }

  /**
   * Get thumbnail blob for a song
   */
  async getThumbnailBlob(songId: string): Promise<Blob | null> {
    const thumbnailData = await this.get('thumbnailFiles', songId);
    return thumbnailData ? thumbnailData.blob : null;
  }

  /**
   * Delete thumbnail blob for a song
   */
  async deleteThumbnailBlob(songId: string): Promise<boolean> {
    return await this.delete('thumbnailFiles', songId);
  }

  // ===== DATABASE UTILITY METHODS =====

  /**
   * Clear entire database
   */
  async clearDatabase(): Promise<boolean> {
    try {
      const storeNames = [
        'songs',
        'search_history',
        'recently_played',
        'playlists',
        'thumbnailFiles',
        'audioFiles',
      ];

      for (const storeName of storeNames) {
        await this.clear(storeName);
      }

      return true;
    } catch (error) {
      console.error('Error clearing database:', error);
      return false;
    }
  }

  /**
   * Get database status info for debugging
   */
  getDBStatus(): any {
    return {
      isReady: this.isReady(),
      dbName: this.dbName,
      dbVersion: this.dbVersion,
      db: this.db,
      objectStores: this.getObjectStoreNames(),
    };
  }

  /**
   * Reset IndexedDB - for debugging purposes
   */
  async resetDB(): Promise<boolean> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      // Delete the database
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);

      return new Promise((resolve, reject) => {
        deleteRequest.onsuccess = () => {
          console.log('IndexedDB deleted successfully');
          resolve(true);
        };

        deleteRequest.onerror = () => {
          console.error('Error deleting IndexedDB:', deleteRequest.error);
          reject(false);
        };
      });
    } catch (error) {
      console.error('Error resetting IndexedDB:', error);
      return false;
    }
  }

  /**
   * Debug method - check existing data in database
   */
  private async debugExistingData() {
    if (!this.db) return;

    try {
      // Check songs
      const songsTransaction = this.db.transaction(['songs'], 'readonly');
      const songsStore = songsTransaction.objectStore('songs');
      const songsRequest = songsStore.count();

      songsRequest.onsuccess = () => {
        console.log(`🎵 Found ${songsRequest.result} songs in database`);
      };

      // Check search history
      if (this.db.objectStoreNames.contains('search_history')) {
        const historyTransaction = this.db.transaction(
          ['search_history'],
          'readonly'
        );
        const historyStore = historyTransaction.objectStore('search_history');
        const historyRequest = historyStore.count();

        historyRequest.onsuccess = () => {
          console.log(`📚 Found ${historyRequest.result} search history items`);
        };
      }
    } catch (error) {
      console.error('❌ Error checking existing data:', error);
    }
  }

  /**
   * Check storage quota and persistent storage
   */
  async checkStorageInfo(): Promise<any> {
    try {
      const storageInfo: any = {};

      // Check if storage API is available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        storageInfo.quota = estimate.quota;
        storageInfo.usage = estimate.usage;
        storageInfo.available = estimate.quota
          ? estimate.quota - (estimate.usage || 0)
          : 'Unknown';
      }

      // Check persistent storage
      if ('storage' in navigator && 'persist' in navigator.storage) {
        storageInfo.persistent = await navigator.storage.persist();
      }

      console.log('💾 Storage Info:', storageInfo);
      return storageInfo;
    } catch (error) {
      console.error('❌ Error checking storage info:', error);
      return null;
    }
  }

  /**
   * Request persistent storage
   */
  async requestPersistentStorage(): Promise<boolean> {
    try {
      if ('storage' in navigator && 'persist' in navigator.storage) {
        const granted = await navigator.storage.persist();
        console.log(
          granted
            ? '✅ Persistent storage granted'
            : '⚠️ Persistent storage denied'
        );
        return granted;
      }
      return false;
    } catch (error) {
      console.error('❌ Error requesting persistent storage:', error);
      return false;
    }
  }
}
