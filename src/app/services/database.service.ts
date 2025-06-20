import { Injectable } from '@angular/core';
import { Song, Album, Artist, Playlist, SearchHistoryItem, DataSong } from '../interfaces/song.interface';
import { IndexedDBService } from './indexeddb.service';
import { RefreshService } from './refresh.service';

/**
 * Service quản lý cơ sở dữ liệu IndexedDB cho ứng dụng nhạc
 * Sử dụng IndexedDB cho tất cả platforms (web và native)
 */
@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  // IndexedDB service cho tất cả platforms
  private indexedDB: IndexedDBService;
  // Trạng thái sẵn sàng của database
  private isDbReady = false;
  // Flag để track initialization process
  private isInitializing = false;

  constructor(
    indexedDBService: IndexedDBService,
    private refreshService: RefreshService
  ) {
    this.indexedDB = indexedDBService;
    // Khởi tạo database khi service được tạo
    this.initializeDatabase().catch(error => {
      console.error('❌ Failed to initialize database in constructor:', error);
    });
  }
  /**
   * Khởi tạo cơ sở dữ liệu IndexedDB
   */
  async initializeDatabase() {
    // Tránh duplicate initialization
    if (this.isInitializing || this.isDbReady) {
      console.log('🔄 Database already initializing or ready, skipping...');
      return;
    }

    this.isInitializing = true;

    try {
      console.log('🔄 DatabaseService: Starting IndexedDB initialization...');      // Initialize IndexedDB for all platforms
      let success = await this.indexedDB.initDB();

      // If initialization fails, try again with a small delay
      if (!success) {
        console.log('⚠️ Initial database initialization failed, retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        success = await this.indexedDB.initDB();
      }      if (success) {
        this.isDbReady = true;

        // Fix any existing indexeddb:// URLs
        await this.fixIndexedDBUrls();

        // Simple data check
        const songs = await this.indexedDB.getAll('songs');
        if (songs.length === 0) {
          console.log('ℹ️ Empty database - no songs found');
        }
      } else {
        throw new Error('Failed to initialize IndexedDB even after reset attempt');
      }

    } catch (error) {
      console.error('❌ DatabaseService: Initialization failed:', error);
      this.isDbReady = false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Thêm bài hát mới vào database
   */
  async addSong(song: Song): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const success = await this.indexedDB.put('songs', song);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('Error adding song:', error);
      return false;
    }
  }

  /**
   * Lấy tất cả bài hát
   */
  async getAllSongs(): Promise<Song[]> {
    if (!this.isDbReady) return [];

    try {
      return await this.indexedDB.getAll('songs');
    } catch (error) {
      console.error('Error getting all songs:', error);
      return [];
    }
  }

  /**
   * Lấy bài hát theo ID
   */
  async getSongById(id: string): Promise<Song | null> {
    if (!this.isDbReady) return null;

    try {
      return await this.indexedDB.get('songs', id);
    } catch (error) {
      console.error('Error getting song by id:', error);
      return null;
    }
  }

  /**
   * Cập nhật bài hát
   */
  async updateSong(song: Song): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const success = await this.indexedDB.put('songs', song);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('Error updating song:', error);
      return false;
    }
  }

  /**
   * Xóa bài hát
   */
  async deleteSong(id: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const success = await this.indexedDB.deleteRecord('songs', id);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('Error deleting song:', error);
      return false;
    }
  }
  /**
   * Lưu audio file
   */
  async saveAudioFile(songId: string, file: File | Blob, mimeType: string): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.saveAudioFile(songId, file, mimeType);
  }

  /**
   * Lấy audio file
   */
  async getAudioFile(songId: string): Promise<Blob | null> {
    if (!this.isDbReady) return null;
    return await this.indexedDB.getAudioFile(songId);
  }
  /**
   * Lưu thumbnail file
   */
  async saveThumbnailFile(songId: string, file: File | Blob, mimeType: string): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.saveThumbnailFile(songId, file, mimeType);
  }

  /**
   * Lấy thumbnail file
   */
  async getThumbnailFile(songId: string): Promise<Blob | null> {
    if (!this.isDbReady) return null;
    return await this.indexedDB.getThumbnailFile(songId);
  }

  /**
   * Xóa audio file
   */
  async deleteAudioFile(songId: string): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.deleteAudioFile(songId);
  }

  /**
   * Xóa thumbnail file
   */
  async deleteThumbnailFile(songId: string): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.deleteThumbnailFile(songId);
  }

  /**
   * Tìm kiếm bài hát
   */
  async searchSongs(query: string): Promise<Song[]> {
    if (!this.isDbReady) return [];
    return await this.indexedDB.search('songs', 'title', query);
  }

  /**
   * Lấy bài hát đã download (có filePath)
   */
  async getDownloadedSongs(): Promise<Song[]> {
    const allSongs = await this.getAllSongs();
    return allSongs.filter(song => song.filePath); // Use filePath to check if downloaded
  }

  // Playlist operations
  async addPlaylist(playlist: Playlist): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.put('playlists', playlist);
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    if (!this.isDbReady) return [];
    return await this.indexedDB.getAll('playlists');
  }

  async updatePlaylist(playlist: Playlist): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.put('playlists', playlist);
  }

  async deletePlaylist(id: string): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.deleteRecord('playlists', id);
  }

  // Search history operations
  async addSearchHistory(item: SearchHistoryItem): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.put('search_history', item);
  }

  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    if (!this.isDbReady) return [];
    return await this.indexedDB.getAll('search_history');
  }

  async clearSearchHistory(): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.clear('search_history');
  }

  // Utility methods
  async clearAllData(): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      await this.indexedDB.clear('songs');
      await this.indexedDB.clear('search_history');
      await this.indexedDB.clear('playlists');
      await this.indexedDB.clear('thumbnailFiles');
      await this.indexedDB.clear('audioFiles');
      return true;
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }

  isReady(): boolean {
    return this.isDbReady && this.indexedDB.isReady();
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{total: number, downloaded: number}> {
    const songs = await this.getAllSongs();
    return {
      total: songs.length,
      downloaded: songs.filter(s => s.filePath).length // Use filePath to check if downloaded
    };
  }

  // DEBUG METHODS - Remove in production
  async debugAddTestSong(): Promise<boolean> {
    console.log('🧪 Adding debug test song...');    const testSong: Song = {
      id: 'debug-test-' + Date.now(),
      title: 'Debug Test Song',
      artist: 'Debug Artist',
      duration: 180,
      filePath: `indexeddb://debug-test-${Date.now()}`,
      audioUrl: 'https://example.com/debug-test.mp3', // Use a dummy URL
      addedDate: new Date(),
      isFavorite: false,
      isDownloaded: true // Mark as downloaded since it's stored in IndexedDB
    };

    const success = await this.addSong(testSong);
    if (success) {
      console.log('✅ Debug test song added successfully:', testSong);
    } else {
      console.error('❌ Failed to add debug test song');
    }

    return success;
  }

  async debugCheckDatabase(): Promise<void> {
    console.log('🔍 Database status check...');
    console.log('Database ready:', this.isDbReady);
    console.log('IndexedDB ready:', this.indexedDB.isReady());

    const songs = await this.getAllSongs();
    console.log(`📊 Total songs: ${songs.length}`);

    const downloadedSongs = songs.filter(s => s.filePath);
    console.log(`💾 Downloaded songs: ${downloadedSongs.length}`);

    if (songs.length > 0) {
      console.log('📝 Sample songs:', songs.slice(0, 3));
    }

    // Test IndexedDB directly
    const allFromIndexedDB = await this.indexedDB.getAll('songs');
    console.log(`📊 Songs from IndexedDB: ${allFromIndexedDB.length}`);
  }

  async debugClearTestData(): Promise<void> {
    console.log('🗑️ Clearing test data...');

    const songs = await this.getAllSongs();
    const testSongs = songs.filter(s => s.id.includes('debug-test') || s.id.includes('test-'));

    for (const song of testSongs) {
      await this.deleteSong(song.id);
      console.log('🗑️ Deleted test song:', song.title);
    }

    console.log(`✅ Cleared ${testSongs.length} test songs`);
  }

  // Missing methods for compatibility
  async toggleFavorite(songId: string): Promise<boolean> {
    const song = await this.getSongById(songId);
    if (!song) return false;

    song.isFavorite = !song.isFavorite;
    return await this.updateSong(song);
  }

  async getFavoriteSongs(): Promise<Song[]> {
    const songs = await this.getAllSongs();
    return songs.filter(song => song.isFavorite);
  }

  async getRecentlyPlayedSongs(limit: number = 50): Promise<Song[]> {
    // For now, return all songs sorted by addedDate (newest first)
    const songs = await this.getAllSongs();
    return songs
      .sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime())
      .slice(0, limit);
  }  async addToSearchHistory(song: Song): Promise<boolean>;
  async addToSearchHistory(song: DataSong): Promise<boolean>;
  async addToSearchHistory(song: Song | DataSong): Promise<boolean> {
    // Check if it's DataSong or Song
    const isDataSong = 'thumbnail_url' in song;

    const searchItem: SearchHistoryItem = {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail_url: isDataSong ? (song as DataSong).thumbnail_url : (song as Song).thumbnail || '',
      audio_url: isDataSong ? (song as DataSong).audio_url : (song as Song).audioUrl || '',
      duration: song.duration || 0,
      duration_formatted: song.duration_formatted || '',
      keywords: isDataSong ? (song as DataSong).keywords || [] : [],
      searchedAt: new Date(),
      isDownloaded: isDataSong ? false : !!(song as Song).filePath
    };
    return await this.addSearchHistory(searchItem);
  }

  async getSearchHistoryStats(): Promise<any> {
    const history = await this.getSearchHistory();
    return {
      totalSearches: history.length,
      uniqueSongs: new Set(history.map(h => h.songId)).size
    };
  }
  async markAsDownloaded(songId: string): Promise<boolean> {
    const song = await this.getSongById(songId);
    if (!song) return false;

    // Keep original audioUrl, just mark as downloaded
    song.isDownloaded = true;
    // Use a custom filePath to indicate it's stored in IndexedDB
    song.filePath = `indexeddb://${songId}`;

    return await this.updateSong(song);
  }

  async closeDatabase(): Promise<void> {
    // IndexedDB doesn't need explicit close
    console.log('🔄 IndexedDB cleanup completed');
  }

  /**
   * Fix songs with indexeddb:// URLs to use proper URLs
   */
  async fixIndexedDBUrls(): Promise<void> {
    try {
      console.log('🔧 Fixing indexeddb:// URLs...');

      const songs = await this.getAllSongs();
      let fixedCount = 0;

      for (const song of songs) {
        if (song.audioUrl?.startsWith('indexeddb://')) {
          // If it's an indexeddb URL, try to restore the original URL
          // For now, we'll set a placeholder URL and mark as downloaded
          song.audioUrl = `https://api-music.tranxuanthanhtxt.com/stream/${song.id}`;
          song.isDownloaded = true;

          await this.updateSong(song);
          fixedCount++;
        }
      }

      if (fixedCount > 0) {
        console.log(`✅ Fixed ${fixedCount} songs with indexeddb:// URLs`);
      }
    } catch (error) {
      console.error('❌ Error fixing indexeddb URLs:', error);
    }
  }
}
