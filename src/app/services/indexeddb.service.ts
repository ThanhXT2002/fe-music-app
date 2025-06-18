import { Injectable } from '@angular/core';
import { Song, SearchHistoryItem, Playlist } from '../interfaces/song.interface';

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private dbName = 'xtmusic_db';
  private dbVersion = 3;

  constructor() {}

  isReady(): boolean {
    return this.db !== null;
  }

  async initDB(): Promise<boolean> {
    if (this.db) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Error opening IndexedDB:', request.error);
        reject(false);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase) {
    if (!db.objectStoreNames.contains('songs')) {
      const songsStore = db.createObjectStore('songs', { keyPath: 'id' });
      songsStore.createIndex('title', 'title', { unique: false });
      songsStore.createIndex('artist', 'artist', { unique: false });
    }

    if (!db.objectStoreNames.contains('search_history')) {
      const historyStore = db.createObjectStore('search_history', { keyPath: 'songId' });
      historyStore.createIndex('searchedAt', 'searchedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains('playlists')) {
      db.createObjectStore('playlists', { keyPath: 'id' });
    }

    if (!db.objectStoreNames.contains('thumbnailFiles')) {
      db.createObjectStore('thumbnailFiles', { keyPath: 'songId' });
    }

    if (!db.objectStoreNames.contains('audioFiles')) {
      db.createObjectStore('audioFiles', { keyPath: 'songId' });
    }
  }

  async put(storeName: string, data: any): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(true);
        request.onerror = () => {
          console.error(`Error putting data to ${storeName}:`, request.error);
          reject(false);
        };
      } catch (error) {
        console.error(`Exception in put method for ${storeName}:`, error);
        reject(false);
      }
    });
  }

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
}
