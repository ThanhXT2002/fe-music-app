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
  ) {}  /**
   * Lấy thumbnail URL - offline first nếu có, fallback về placeholder
   * @param songId - ID của bài hát
   * @param onlineUrl - URL online của thumbnail (không sử dụng, chỉ để backward compatibility)
   * @returns Promise<string> - URL của thumbnail để sử dụng
   */  async getThumbnailUrl(songId: string, onlineUrl: string): Promise<string> {
    // Kiểm tra cache trước
    const cacheKey = `thumb_${songId}`;
    if (this.thumbnailCache.has(cacheKey)) {
      console.log('📷 Thumbnail found in cache for:', songId);
      return this.thumbnailCache.get(cacheKey)!;
    }    console.log('🔍 Loading thumbnail for song:', songId);

    // Kiểm tra bài hát có được download chưa
    const song = await this.databaseService.getSongById(songId);

    let isSongDownloaded = false;
    if (Capacitor.getPlatform() === 'web') {
      // Web platform: Chỉ cần song tồn tại trong database (file được lưu trong IndexedDB)
      isSongDownloaded = !!song;
    } else {
      // Native platform: Cần song tồn tại và có filePath
      isSongDownloaded = !!(song && song.filePath);
    }

    if (isSongDownloaded) {
      console.log('💾 Song is downloaded, loading offline thumbnail...');
      try {
        let thumbnailUrl: string | null = null;        if (Capacitor.isNativePlatform()) {
          // Native platform: Lấy từ SQLite database
          console.log('📱 Native: Loading thumbnail from SQLite database. Platform:', Capacitor.getPlatform());
          const thumbnailBlob = await this.databaseService.getThumbnailBlob(songId);
          if (thumbnailBlob) {
            thumbnailUrl = URL.createObjectURL(thumbnailBlob);
            console.log('✅ Native: Thumbnail loaded from database:', thumbnailBlob.size, 'bytes');
          } else {
            console.warn('⚠️ Native: No thumbnail found in database');
          }
        } else {
          // Web platform: Lấy từ IndexedDB
          console.log('🌐 Web: Loading thumbnail from IndexedDB');
          const thumbnailBlob = await this.indexedDBService.getThumbnailFile(songId);
          if (thumbnailBlob) {
            thumbnailUrl = URL.createObjectURL(thumbnailBlob);
            console.log('✅ Web: Thumbnail loaded from IndexedDB:', thumbnailBlob.size, 'bytes');
          } else {
            console.warn('⚠️ Web: No thumbnail found in IndexedDB');
          }
        }        if (thumbnailUrl) {
          this.thumbnailCache.set(cacheKey, thumbnailUrl);
          return thumbnailUrl;
        }
      } catch (error) {
        console.warn('❌ Failed to load offline thumbnail:', error);
      }
    } else {
      console.log('📡 Song not downloaded, no offline thumbnail available');
    }

    // 🚫 KHÔNG fallback về server - chỉ dùng placeholder
    console.warn('❌ No offline thumbnail available, using placeholder');
    const placeholderUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
    this.thumbnailCache.set(cacheKey, placeholderUrl);
    return placeholderUrl;
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
  }  /**
   * Kiểm tra xem bài hát có files offline không
   * @param songId - ID của bài hát
   * @returns Promise<{hasAudio: boolean, hasThumbnail: boolean}>
   */  async checkOfflineFiles(songId: string): Promise<{hasAudio: boolean, hasThumbnail: boolean}> {
    try {
      if (Capacitor.getPlatform() === 'web') {
        // Web platform: Check IndexedDB
        return await this.indexedDBService.checkOfflineFiles(songId);
      } else {
        // Native platform: Check SQLite
        const song = await this.databaseService.getSongById(songId);
        const thumbnailBlob = await this.databaseService.getThumbnailBlob(songId);

        return {
          hasAudio: !!(song && song.filePath),
          hasThumbnail: !!thumbnailBlob
        };
      }
    } catch (error) {
      console.error('Error checking offline files:', error);
      return { hasAudio: false, hasThumbnail: false };
    }
  }

  /**
   * Debug method: List all stored thumbnails
   */
  async debugListThumbnails(): Promise<void> {
    console.log('🔍 Debugging thumbnails storage...');

    try {
      if (Capacitor.getPlatform() === 'web') {
        // Web: Check IndexedDB
        const thumbnails = await this.indexedDBService.getAll('thumbnailFiles');
        console.log('🌐 Web IndexedDB thumbnails:', thumbnails.length);
        thumbnails.forEach(thumb => {
          console.log(`- ${thumb.songId}: ${thumb.mimeType}, ${thumb.size} bytes`);
        });
      } else {
        // Native: Check SQLite (thông qua database service methods)
        console.log('📱 Native: Checking thumbnail storage via database service...');

        // Kiểm tra một vài bài hát có trong database
        const songs = await this.databaseService.getAllSongs();
        let thumbnailCount = 0;

        for (const song of songs.slice(0, 5)) { // Check first 5 songs
          const thumbnail = await this.databaseService.getThumbnailBlob(song.id);
          if (thumbnail) {
            thumbnailCount++;
            console.log(`- ${song.id}: Found thumbnail (${thumbnail.size} bytes)`);
          }
        }

        console.log(`📱 Native SQLite: Found ${thumbnailCount} thumbnails out of ${songs.length} songs`);
      }
    } catch (error) {
      console.error('❌ Error debugging thumbnails:', error);
    }
  }

  /**
   * Test method: Tạo một blob test và thử save/load
   */
  async debugTestThumbnailStorage(): Promise<void> {
    const testSongId = 'test-thumbnail-' + Date.now();
    console.log('🧪 Testing thumbnail storage with ID:', testSongId);

    try {
      // Tạo test blob (1x1 pixel PNG)
      const testBlob = new Blob([
        new Uint8Array([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
          0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
          0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41,
          0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
          0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
          0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
          0x42, 0x60, 0x82
        ])
      ], { type: 'image/png' });

      console.log('💾 Saving test thumbnail...');
      let saveSuccess = false;

      if (Capacitor.getPlatform() === 'web') {
        saveSuccess = await this.indexedDBService.saveThumbnailFile(testSongId, testBlob, 'image/png');
      } else {
        saveSuccess = await this.databaseService.saveThumbnailFile(testSongId, testBlob, 'image/png');
      }

      console.log('💾 Save result:', saveSuccess);

      if (saveSuccess) {
        console.log('🔍 Loading test thumbnail...');
        const loadedUrl = await this.getThumbnailUrl(testSongId, '');
        console.log('🔍 Load result:', loadedUrl.startsWith('blob:') ? 'SUCCESS (blob URL)' : 'FAILED');

        // Clean up
        setTimeout(() => {
          this.clearThumbnailCache(testSongId);
        }, 5000);
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
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
        let thumbnailSize = 0;        try {          // Lấy tất cả bài hát và filter những bài có filePath (đã download)
          const allSongs = await this.databaseService.getAllSongs();
          const downloadedSongs = allSongs.filter(song => song.filePath); // Chỉ kiểm tra filePath

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

  /**
   * Debug: Lấy danh sách tất cả bài hát đã download
   */
  async getDownloadedSongs(): Promise<any[]> {
    return await this.databaseService.getDownloadedSongs();
  }

  /**
   * Debug: Lấy danh sách tất cả thumbnail đã lưu
   */
  async getAllThumbnails(): Promise<any> {
    if (Capacitor.isNativePlatform()) {
      // Native: Lấy từ SQLite
      return await this.databaseService.getAllThumbnails();
    } else {
      // Web: Lấy từ IndexedDB
      return await this.indexedDBService.getAllThumbnails();
    }
  }
}
