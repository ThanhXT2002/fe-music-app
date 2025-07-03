import { Injectable } from '@angular/core';
import {
  Song,
  Album,
  Artist,
  Playlist,
  SearchHistoryItem,
  DataSong,
  SongConverter,
} from '../interfaces/song.interface';
import { IndexedDBService } from './indexeddb.service';
import { RefreshService } from './refresh.service';

/**
 * Service quản lý cơ sở dữ liệu IndexedDB cho ứng dụng nhạc
 * Sử dụng IndexedDB cho tất cả platforms (web và native)
 */
@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  // IndexedDB service cho tất cả platforms
  private indexedDB: IndexedDBService;
  // Trạng thái sẵn sàng của database
  private isDbReady = false;
  // Flag để track initialization process
  private isInitializing = false;

  // Cache cho playlists
  private playlistsCache: Playlist[] | null = null;
  private playlistsCacheTime = 0;

  // Cache cho songs
  private songsCache: Song[] | null = null;
  private songsCacheTime = 0;

  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(
    indexedDBService: IndexedDBService,
    private refreshService: RefreshService
  ) {
    this.indexedDB = indexedDBService;
    // Khởi tạo database khi service được tạo
    this.initializeDatabase().catch((error) => {
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
      console.log('🔄 DatabaseService: Starting IndexedDB initialization...'); // Initialize IndexedDB for all platforms
      let success = await this.indexedDB.initDB();

      // If initialization fails, try again with a small delay
      if (!success) {
        console.log('⚠️ Initial database initialization failed, retrying...');
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        success = await this.indexedDB.initDB();
      }
      if (success) {
        this.isDbReady = true;

        // Simple data check
        const songs = await this.indexedDB.getAll('songs');
        if (songs.length === 0) {
          console.log('ℹ️ Empty database - no songs found');
        }

        // Initialize system playlists (will be handled by PlaylistManagerService)
        setTimeout(() => {
          this.initializeSystemPlaylists();
        }, 1000);
      } else {
        throw new Error(
          'Failed to initialize IndexedDB even after reset attempt'
        );
      }
    } catch (error) {
      console.error('❌ DatabaseService: Initialization failed:', error);
      this.isDbReady = false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Initialize system playlists (will be implemented by PlaylistManagerService)
   */
  private async initializeSystemPlaylists(): Promise<void> {
    // This will be called by PlaylistManagerService
    console.log(
      '🎵 System playlists initialization deferred to PlaylistManagerService'
    );
  }

  /**
   * Thêm bài hát mới vào database
   */ async addSong(song: Song): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const success = await this.indexedDB.put('songs', song);
      if (success) {
        this.songsCache = null; // Clear songs cache
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

    // Check cache first
    const now = Date.now();
    if (this.songsCache && now - this.songsCacheTime < this.CACHE_DURATION) {
      return this.songsCache;
    }
    try {
      const allSong = await this.indexedDB.getAll('songs');

      // Sort and cache the results
      const sortedSongs = allSong.sort(
        (a, b) => +new Date(b.addedDate) - +new Date(a.addedDate)
      );
      this.songsCache = sortedSongs;
      this.songsCacheTime = now;

      return sortedSongs;
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
   */ async updateSong(song: Song): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const success = await this.indexedDB.put('songs', song);
      if (success) {
        this.songsCache = null; // Clear songs cache
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
   */ async deleteSong(id: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const success = await this.indexedDB.deleteRecord('songs', id);
      if (success) {
        this.songsCache = null; // Clear songs cache
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
  async saveAudioFile(
    songId: string,
    file: File | Blob,
    mimeType: string
  ): Promise<boolean> {
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
  async saveThumbnailFile(
    songId: string,
    file: File | Blob,
    mimeType: string
  ): Promise<boolean> {
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
   * Lấy bài hát đã download (offline) - check bằng URL pattern
   */
  async getDownloadedSongs(): Promise<Song[]> {
    const allSongs = await this.getAllSongs();
    return allSongs.filter((song) => SongConverter.isDownloaded(song));
  }
  // Playlist operations
  async addPlaylist(playlist: Playlist): Promise<boolean> {
    if (!this.isDbReady) return false;

    const success = await this.indexedDB.put('playlists', playlist);
    if (success) {
      this.playlistsCache = null; // Clear cache
    }
    return success;
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    if (!this.isDbReady) return [];

    // Check cache first
    const now = Date.now();
    if (
      this.playlistsCache &&
      now - this.playlistsCacheTime < this.CACHE_DURATION
    ) {
      return this.playlistsCache;
    }

    try {
      const playlists = await this.indexedDB.getAll('playlists');

      // Cache the results
      this.playlistsCache = playlists;
      this.playlistsCacheTime = now;

      return playlists;
    } catch (error) {
      console.error('Error getting all playlists:', error);
      return [];
    }
  }

  async updatePlaylist(playlist: Playlist): Promise<boolean> {
    if (!this.isDbReady) return false;

    const success = await this.indexedDB.put('playlists', playlist);
    if (success) {
      this.playlistsCache = null; // Clear cache
    }
    return success;
  }

  async deletePlaylist(id: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    const success = await this.indexedDB.deleteRecord('playlists', id);
    if (success) {
      this.playlistsCache = null; // Clear cache
    }
    return success;
  }

  async getPlaylistById(id: string): Promise<Playlist | null> {
    if (!this.isDbReady) return null;

    try {
      return await this.indexedDB.get('playlists', id);
    } catch (error) {
      console.error('Error getting playlist by id:', error);
      return null;
    }
  }

  // Search history operations
  async addSearchHistory(item: SearchHistoryItem): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.put('search_history', item);
  }
  /**
   * Lấy lịch sử tìm kiếm được sắp xếp theo thời gian gần nhất
   */
  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    if (!this.isDbReady) return [];

    try {
      // Lấy tất cả items từ IndexedDB
      const allHistory = await this.indexedDB.getAll('search_history');
      return allHistory.sort(
        (a, b) => +new Date(b.searchedAt) - +new Date(a.searchedAt)
      );
    } catch (error) {
      console.error('Error getting search history:', error);
      return [];
    }
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

      // Clear all caches khi clear all data
      this.songsCache = null;
      this.playlistsCache = null;

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
  async getDatabaseStats(): Promise<{ total: number; downloaded: number }> {
    const songs = await this.getAllSongs();
    return {
      total: songs.length,
      downloaded: songs.filter((s) => SongConverter.isDownloaded(s)).length,
    };
  }

  // DEBUG METHODS - Remove in production
  async debugAddTestSong(): Promise<boolean> {
    console.log('🧪 Adding debug test song...');
    const testSong: Song = {
      id: 'debug-test-' + Date.now(),
      title: 'Debug Test Song',
      artist: 'Debug Artist',
      duration: 180,
      duration_formatted: '03:00',
      audio_url: 'https://example.com/debug-test.mp3', // Use a dummy URL
      thumbnail_url: 'https://example.com/debug-test.jpg',
      keywords: ['debug', 'test'],
      addedDate: new Date(),
      isFavorite: false,
    };

    const success = await this.addSong(testSong);
    if (success) {
      console.log('✅ Debug test song added successfully');
      // Test song added successfully
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

    const downloadedSongs = songs.filter((s) => SongConverter.isDownloaded(s));
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
    const testSongs = songs.filter(
      (s) => s.id.includes('debug-test') || s.id.includes('test-')
    );

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
    return songs.filter((song) => song.isFavorite);
  }

  async getRecentlyPlayedSongs(limit: number = 50): Promise<Song[]> {
    // For now, return all songs sorted by addedDate (newest first)
    const songs = await this.getAllSongs();
    return songs
      .sort(
        (a, b) =>
          new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()
      )
      .slice(0, limit);
  }

  async addToSearchHistory(song: Song): Promise<boolean>;
  async addToSearchHistory(song: DataSong): Promise<boolean>;
  async addToSearchHistory(song: Song | DataSong): Promise<boolean> {
    // Use SongConverter for proper conversion
    const searchItem: SearchHistoryItem = 'thumbnail_url' in song
      ? SongConverter.apiDataToSearchHistory(song as DataSong)
      : SongConverter.toSearchHistory(song as Song);

    return await this.addSearchHistory(searchItem);
  }

  async getSearchHistoryStats(): Promise<any> {
    const history = await this.getSearchHistory();
    return {
      totalSearches: history.length,
      uniqueSongs: new Set(history.map((h) => h.songId)).size,
    };
  }

  async markAsDownloaded(songId: string, audioBlobUrl: string, thumbnailBlobUrl: string): Promise<boolean> {
    const song = await this.getSongById(songId);
    if (!song) return false;

    // Update Song với offline URLs
    const downloadedSong = SongConverter.markAsDownloaded(song, audioBlobUrl, thumbnailBlobUrl);
    return await this.updateSong(downloadedSong);
  }

  async closeDatabase(): Promise<void> {
    // IndexedDB doesn't need explicit close
    console.log('🔄 IndexedDB cleanup completed');
  }
}
