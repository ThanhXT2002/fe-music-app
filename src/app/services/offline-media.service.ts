import { Injectable } from '@angular/core';
import { IndexedDBService } from './indexeddb.service';
import { DatabaseService } from './database.service';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

@Injectable({
  providedIn: 'root'
})
export class OfflineMediaService {
  private thumbnailCache = new Map<string, string>(); // Cache cho thumbnail URLs

  constructor(
    private indexedDBService: IndexedDBService,
    private databaseService: DatabaseService
  ) {}
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

    // Nếu bài hát đã download, tìm thumbnail offline
    if (isDownloaded) {
      try {
        let thumbnailUrl: string | null = null;        if (Capacitor.isNativePlatform()) {
          // Native platform: Lấy từ SQLite database
          console.log('📱 Native: Loading thumbnail from SQLite database');
          const thumbnailBlob = await this.databaseService.getThumbnailBlob(songId);
          if (thumbnailBlob) {
            thumbnailUrl = URL.createObjectURL(thumbnailBlob);
            console.log('✅ Native: Thumbnail loaded from database');
          }
        } else {
          // Web platform: Lấy từ IndexedDB
          console.log('🌐 Web: Loading thumbnail from IndexedDB');
          const thumbnailBlob = await this.indexedDBService.getThumbnailFile(songId);
          if (thumbnailBlob) {
            thumbnailUrl = URL.createObjectURL(thumbnailBlob);
            console.log('✅ Web: Thumbnail loaded from IndexedDB');
          }
        }

        if (thumbnailUrl) {
          this.thumbnailCache.set(cacheKey, thumbnailUrl);
          return thumbnailUrl;
        }
      } catch (error) {
        console.warn('❌ Failed to load offline thumbnail, using online URL:', error);
      }
    }    // Fallback: sử dụng URL online (chỉ cho web platform)
    if (Capacitor.isNativePlatform()) {
      // Native platform: Không fallback về server URL khi offline
      console.warn('❌ Native: No offline thumbnail available, using placeholder');
      // Return placeholder hoặc empty image thay vì server URL
      const placeholderUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
      this.thumbnailCache.set(cacheKey, placeholderUrl);
      return placeholderUrl;
    } else {
      // Web platform: có thể fallback về server URL
      console.log('🌐 Web: Using online thumbnail URL');
      this.thumbnailCache.set(cacheKey, onlineUrl);
      return onlineUrl;
    }
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
    try {
      if (Capacitor.getPlatform() === 'web') {
        // Web platform: Check IndexedDB
        return await this.indexedDBService.checkOfflineFiles(songId);
      } else {
        // Native platform: Check database and filesystem
        const song = await this.databaseService.getSongById(songId);

        const hasAudio = !!(song?.filePath && song.isDownloaded);

        // Check thumbnail trong database
        const thumbnailBlob = await this.databaseService.getThumbnailBlob(songId);
        const hasThumbnail = !!thumbnailBlob;

        return { hasAudio, hasThumbnail };
      }
    } catch (error) {
      console.warn('❌ Failed to check offline files:', error);
      return { hasAudio: false, hasThumbnail: false };
    }
  }
  /**
   * Lấy thông tin storage usage
   * @returns Promise<{audioSize: number, thumbnailSize: number, totalSize: number}>
   */
  async getStorageUsage(): Promise<{audioSize: number, thumbnailSize: number, totalSize: number}> {
    try {
      if (Capacitor.getPlatform() === 'web') {
        // Web platform: IndexedDB usage
        return await this.indexedDBService.getStorageUsage();
      } else {
        // Native platform: Filesystem + Database usage
        let audioSize = 0;
        let thumbnailSize = 0;

        try {          // Lấy tất cả bài hát và filter những bài đã download
          const allSongs = await this.databaseService.getAllSongs();
          const downloadedSongs = allSongs.filter(song => song.isDownloaded && song.filePath);

          for (const song of downloadedSongs) {
            // Kiểm tra file audio
            if (song.filePath) {
              try {
                const stats = await Filesystem.stat({
                  path: song.filePath
                });
                audioSize += stats.size;
              } catch (error) {
                console.warn('❌ Failed to get file size for:', song.filePath);
              }
            }

            // Kiểm tra thumbnail size trong database
            const thumbnailBlob = await this.databaseService.getThumbnailBlob(song.id);
            if (thumbnailBlob) {
              thumbnailSize += thumbnailBlob.size;
            }
          }
        } catch (error) {
          console.warn('❌ Failed to calculate storage usage:', error);
        }

        return {
          audioSize,
          thumbnailSize,
          totalSize: audioSize + thumbnailSize
        };
      }
    } catch (error) {
      console.warn('❌ Failed to get storage usage:', error);
      return { audioSize: 0, thumbnailSize: 0, totalSize: 0 };
    }
  }

  /**
   * Xóa file audio offline trên native platform
   * @param filePath - Đường dẫn file cần xóa
   * @returns Promise<boolean>
   */
  async deleteOfflineAudioFile(filePath: string): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') {
      return false; // Web platform không hỗ trợ delete file path
    }

    try {
      await Filesystem.deleteFile({
        path: filePath
      });
      console.log('✅ Deleted offline audio file:', filePath);
      return true;
    } catch (error) {
      console.warn('❌ Failed to delete offline audio file:', error);
      return false;
    }
  }

  /**
   * Kiểm tra file audio có tồn tại không trên native platform
   * @param filePath - Đường dẫn file
   * @returns Promise<boolean>
   */
  async checkAudioFileExists(filePath: string): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') {
      return false;
    }

    try {
      const stat = await Filesystem.stat({
        path: filePath
      });
      return stat.type === 'file';
    } catch (error) {
      return false;
    }
  }

  /**
   * Lấy kích thước của file audio
   * @param filePath - Đường dẫn file
   * @returns Promise<number> - Size in bytes
   */
  async getAudioFileSize(filePath: string): Promise<number> {
    if (Capacitor.getPlatform() === 'web') {
      return 0;
    }

    try {
      const stat = await Filesystem.stat({
        path: filePath
      });
      return stat.size;
    } catch (error) {
      console.warn('❌ Failed to get file size:', error);
      return 0;
    }
  }

  /**
   * Cleanup tất cả các resources khi app bị destroy
   */
  async cleanup(): Promise<void> {
    this.clearAllThumbnailCache();
    console.log('✅ OfflineMediaService cleanup completed');
  }
}
