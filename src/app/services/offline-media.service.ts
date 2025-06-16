import { Injectable } from '@angular/core';
import { IndexedDBService } from './indexeddb.service';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class OfflineMediaService {
  private thumbnailCache = new Map<string, string>(); // Cache cho thumbnail URLs

  constructor(private indexedDBService: IndexedDBService) {}

  /**
   * Lấy thumbnail URL - offline first nếu có, fallback to online URL
   * @param songId - ID của bài hát
   * @param onlineUrl - URL online của thumbnail
   * @param isDownloaded - Có phải bài hát đã download không
   * @returns Promise<string> - URL của thumbnail để sử dụng
   */
  async getThumbnailUrl(songId: string, onlineUrl: string, isDownloaded: boolean = false): Promise<string> {
    // Kiểm tra cache trước
    const cacheKey = `thumb_${songId}`;
    if (this.thumbnailCache.has(cacheKey)) {
      return this.thumbnailCache.get(cacheKey)!;
    }

    // Chỉ tìm offline thumbnail trên web platform và nếu bài hát đã download
    if (Capacitor.getPlatform() === 'web' && isDownloaded) {
      try {
        const thumbnailBlob = await this.indexedDBService.getThumbnailFile(songId);
        if (thumbnailBlob) {
          const thumbnailUrl = URL.createObjectURL(thumbnailBlob);
          this.thumbnailCache.set(cacheKey, thumbnailUrl);
          return thumbnailUrl;
        }
      } catch (error) {
        console.warn('Failed to load offline thumbnail, using online URL:', error);
      }
    }

    // Fallback: sử dụng URL online
    this.thumbnailCache.set(cacheKey, onlineUrl);
    return onlineUrl;
  }

  /**
   * Xóa thumbnail khỏi cache (khi component destroy)
   * @param songId - ID của bài hát
   */
  clearThumbnailCache(songId: string): void {
    const cacheKey = `thumb_${songId}`;
    if (this.thumbnailCache.has(cacheKey)) {
      const url = this.thumbnailCache.get(cacheKey)!;
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      this.thumbnailCache.delete(cacheKey);
    }
  }

  /**
   * Xóa toàn bộ thumbnail cache
   */
  clearAllThumbnailCache(): void {
    this.thumbnailCache.forEach((url) => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.thumbnailCache.clear();
  }

  /**
   * Kiểm tra xem bài hát có files offline không
   * @param songId - ID của bài hát
   * @returns Promise<{hasAudio: boolean, hasThumbnail: boolean}>
   */
  async checkOfflineFiles(songId: string): Promise<{hasAudio: boolean, hasThumbnail: boolean}> {
    if (Capacitor.getPlatform() !== 'web') {
      return { hasAudio: false, hasThumbnail: false };
    }

    return await this.indexedDBService.checkOfflineFiles(songId);
  }

  /**
   * Lấy thông tin storage usage
   * @returns Promise<{audioSize: number, thumbnailSize: number, totalSize: number}>
   */
  async getStorageUsage(): Promise<{audioSize: number, thumbnailSize: number, totalSize: number}> {
    if (Capacitor.getPlatform() !== 'web') {
      return { audioSize: 0, thumbnailSize: 0, totalSize: 0 };
    }

    return await this.indexedDBService.getStorageUsage();
  }
}
