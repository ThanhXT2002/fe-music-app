import { Injectable } from '@angular/core';
import { Song, Album, Artist, Playlist, SearchHistoryItem, DataSong } from '../interfaces/song.interface';
import { IndexedDBService } from './indexeddb.service';
import { RefreshService } from './refresh.service';
import { StorageManagerService } from './storage-manager.service';

/**
 * Service quản lý cơ sở dữ liệu IndexedDB cho ứng dụng nhạc (Unified for Web & Native)
 * Xử lý tất cả các thao tác CRUD với bài hát, album, nghệ sĩ và playlist
 * Migration: Chuyển từ dual storage (SQLite/IndexedDB) sang chỉ sử dụng IndexedDB
 */
@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  // IndexedDB service - unified for all platforms
  private indexedDB: IndexedDBService;
  // Trạng thái sẵn sàng của database
  private isDbReady = false;
  // Flag để track initialization process
  private isInitializing = false;
  constructor(
    indexedDBService: IndexedDBService,
    private refreshService: RefreshService,
    private storageManager: StorageManagerService
  ) {
    this.indexedDB = indexedDBService;
    // Khởi tạo database khi service được tạo
    this.initializeDatabase().catch(error => {
      console.error('❌ Failed to initialize database in constructor:', error);
    });
  }  /**
   * Khởi tạo cơ sở dữ liệu IndexedDB cho cả web và native
   */
  async initializeDatabase() {
    // Tránh duplicate initialization
    if (this.isInitializing || this.isDbReady) {
      console.log('🔄 Database already initializing or ready, skipping...');
      return;
    }

    this.isInitializing = true;

    try {
      console.log('🔧 Initializing database with persistent storage...');

      // CRITICAL: Setup persistent storage FIRST
      const persistentGranted = await this.storageManager.setupPersistentStorage();

      // Get detailed storage info for debugging
      const storageInfo = await this.storageManager.getStorageInfo();
      console.log('📊 Storage Info:', storageInfo);

      // Warn if incognito mode
      if (storageInfo.isIncognito) {
        console.warn('⚠️ INCOGNITO MODE DETECTED - Data will be lost when browser closes!');
      }

      // Warn if persistent storage not granted
      if (!persistentGranted) {
        console.warn('⚠️ PERSISTENT STORAGE NOT GRANTED - Data may be cleared by browser!');
      }

      // Initialize IndexedDB
      await this.indexedDB.initDB();
      this.isDbReady = true;
      console.log('✅ Database initialized successfully with storage persistence');

    } catch (error) {
      console.error('❌ Error initializing database:', error);
      this.isDbReady = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Ensure database is ready before operations
   */
  private async ensureReady(): Promise<void> {
    if (!this.isDbReady) {
      await this.initializeDatabase();
    }
  }

  // ===== SONG METHODS =====

  /**
   * Thêm một bài hát vào cơ sở dữ liệu
   */
  async addSong(song: Song): Promise<boolean> {
    await this.ensureReady();
    try {
      const success = await this.indexedDB.addSong(song);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('❌ Error adding song:', error);
      return false;
    }
  }

  /**
   * Lấy tất cả bài hát từ database
   */
  async getAllSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAllSongs();
    } catch (error) {
      console.error('❌ Error getting all songs:', error);
      return [];
    }
  }

  /**
   * Lấy bài hát theo ID
   */
  async getSongById(id: string): Promise<Song | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getSongById(id);
    } catch (error) {
      console.error('❌ Error getting song by ID:', error);
      return null;
    }
  }

  /**
   * Tìm kiếm bài hát theo từ khóa
   */
  async searchSongs(query: string): Promise<Song[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.searchSongs(query);
    } catch (error) {
      console.error('❌ Error searching songs:', error);
      return [];
    }
  }

  /**
   * Cập nhật thông tin bài hát
   */
  async updateSong(song: Song): Promise<boolean> {
    await this.ensureReady();
    try {
      const success = await this.indexedDB.updateSong(song);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('❌ Error updating song:', error);
      return false;
    }
  }

  /**
   * Xóa bài hát khỏi database
   */
  async deleteSong(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      const success = await this.indexedDB.deleteSong(songId);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('❌ Error deleting song:', error);
      return false;
    }
  }

  /**
   * Đánh dấu/bỏ đánh dấu bài hát yêu thích
   */
  async toggleFavorite(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      const song = await this.getSongById(songId);
      if (song) {
        song.isFavorite = !song.isFavorite;
        return await this.updateSong(song);
      }
      return false;
    } catch (error) {
      console.error('❌ Error toggling favorite:', error);
      return false;
    }
  }

  /**
   * Lấy danh sách bài hát yêu thích
   */
  async getFavoriteSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      const allSongs = await this.getAllSongs();
      return allSongs.filter(song => song.isFavorite);
    } catch (error) {
      console.error('❌ Error getting favorite songs:', error);
      return [];
    }
  }

  /**
   * Mark song as downloaded (set filePath)
   */
  async markAsDownloaded(songId: string, filePath?: string): Promise<boolean> {
    await this.ensureReady();
    try {
      const song = await this.getSongById(songId);
      if (song) {
        song.filePath = filePath || 'downloaded';
        return await this.updateSong(song);
      }
      return false;
    } catch (error) {
      console.error('❌ Error marking song as downloaded:', error);
      return false;
    }
  }

  /**
   * Get downloaded songs (songs with filePath)
   */
  async getDownloadedSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      const allSongs = await this.getAllSongs();
      return allSongs.filter(song => song.filePath);
    } catch (error) {
      console.error('❌ Error getting downloaded songs:', error);
      return [];
    }
  }

  // ===== SEARCH HISTORY METHODS =====

  /**
   * Thêm item vào lịch sử tìm kiếm
   */
  async addSearchHistory(item: SearchHistoryItem): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.addSearchHistory(item);
    } catch (error) {
      console.error('❌ Error adding search history:', error);
      return false;
    }
  }

  /**
   * Lấy lịch sử tìm kiếm
   */
  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getSearchHistory();
    } catch (error) {
      console.error('❌ Error getting search history:', error);
      return [];
    }
  }

  /**
   * Xóa lịch sử tìm kiếm
   */
  async clearSearchHistory(): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.clearSearchHistory();
    } catch (error) {
      console.error('❌ Error clearing search history:', error);
      return false;
    }
  }

  /**
   * Xóa một item khỏi lịch sử tìm kiếm
   */
  async deleteSearchHistoryItem(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.deleteSearchHistoryItem(songId);
    } catch (error) {
      console.error('❌ Error deleting search history item:', error);
      return false;
    }
  }

  // ===== RECENTLY PLAYED METHODS =====

  /**
   * Thêm bài hát vào danh sách vừa phát
   */
  async addRecentlyPlayed(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.addRecentlyPlayed(songId);
    } catch (error) {
      console.error('❌ Error adding recently played:', error);
      return false;
    }
  }

  /**
   * Lấy danh sách bài hát vừa phát
   */
  async getRecentlyPlayed(limit: number = 50): Promise<Song[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getRecentlyPlayed(limit);
    } catch (error) {
      console.error('❌ Error getting recently played:', error);
      return [];
    }
  }

  /**
   * Xóa lịch sử phát
   */
  async clearRecentlyPlayed(): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.clearRecentlyPlayed();
    } catch (error) {
      console.error('❌ Error clearing recently played:', error);
      return false;
    }
  }

  // ===== PLAYLIST METHODS =====

  /**
   * Tạo playlist mới
   */
  async createPlaylist(playlist: Playlist): Promise<boolean> {
    await this.ensureReady();
    try {
      const success = await this.indexedDB.createPlaylist(playlist);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('❌ Error creating playlist:', error);
      return false;
    }
  }

  /**
   * Lấy tất cả playlist
   */
  async getAllPlaylists(): Promise<Playlist[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAllPlaylists();
    } catch (error) {
      console.error('❌ Error getting all playlists:', error);
      return [];
    }
  }

  /**
   * Lấy playlist theo ID
   */
  async getPlaylistById(id: string): Promise<Playlist | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getPlaylistById(id);
    } catch (error) {
      console.error('❌ Error getting playlist by ID:', error);
      return null;
    }
  }

  /**
   * Cập nhật playlist
   */
  async updatePlaylist(playlist: Playlist): Promise<boolean> {
    await this.ensureReady();
    try {
      const success = await this.indexedDB.updatePlaylist(playlist);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('❌ Error updating playlist:', error);
      return false;
    }
  }

  /**
   * Xóa playlist
   */
  async deletePlaylist(playlistId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      const success = await this.indexedDB.deletePlaylist(playlistId);
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('❌ Error deleting playlist:', error);
      return false;
    }
  }

  // ===== THUMBNAIL METHODS =====

  /**
   * Lưu thumbnail blob vào database
   */
  async saveThumbnailBlob(songId: string, blob: Blob): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.saveThumbnailBlob(songId, blob);
    } catch (error) {
      console.error('❌ Error saving thumbnail blob:', error);
      return false;
    }
  }

  /**
   * Lấy thumbnail blob từ database
   */
  async getThumbnailBlob(songId: string): Promise<Blob | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getThumbnailBlob(songId);
    } catch (error) {
      console.error('❌ Error getting thumbnail blob:', error);
      return null;
    }
  }

  /**
   * Xóa thumbnail blob
   */
  async deleteThumbnailBlob(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.deleteThumbnailBlob(songId);
    } catch (error) {
      console.error('❌ Error deleting thumbnail blob:', error);
      return false;
    }
  }

  /**
   * Get all thumbnails for debugging
   */
  async getAllThumbnails(): Promise<any[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAllThumbnails();
    } catch (error) {
      console.error('❌ Error getting all thumbnails:', error);
      return [];
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Xóa toàn bộ database (reset)
   */
  async clearDatabase(): Promise<boolean> {
    await this.ensureReady();
    try {
      const success = await this.indexedDB.clearDatabase();
      if (success) {
        this.refreshService.triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error('❌ Error clearing database:', error);
      return false;
    }
  }

  /**
   * Lấy thống kê database
   */
  async getDatabaseStats(): Promise<{songsCount: number, playlistsCount: number, historyCount: number}> {
    await this.ensureReady();
    try {
      const songs = await this.getAllSongs();
      const playlists = await this.getAllPlaylists();
      const history = await this.getSearchHistory();

      return {
        songsCount: songs.length,
        playlistsCount: playlists.length,
        historyCount: history.length
      };
    } catch (error) {
      console.error('❌ Error getting database stats:', error);
      return { songsCount: 0, playlistsCount: 0, historyCount: 0 };
    }
  }

  /**
   * Kiểm tra trạng thái database
   */
  isReady(): boolean {
    return this.isDbReady && this.indexedDB.isReady();
  }

  /**
   * Export database data (for backup)
   */
  async exportData(): Promise<{songs: Song[], playlists: Playlist[], searchHistory: SearchHistoryItem[]} | null> {
    await this.ensureReady();
    try {
      const songs = await this.getAllSongs();
      const playlists = await this.getAllPlaylists();
      const searchHistory = await this.getSearchHistory();

      return { songs, playlists, searchHistory };
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      return null;
    }
  }

  /**
   * Import database data (for restore)
   */
  async importData(data: {songs: Song[], playlists: Playlist[], searchHistory: SearchHistoryItem[]}): Promise<boolean> {
    await this.ensureReady();
    try {
      // Clear existing data
      await this.clearDatabase();

      // Import songs
      for (const song of data.songs) {
        await this.addSong(song);
      }

      // Import playlists
      for (const playlist of data.playlists) {
        await this.createPlaylist(playlist);
      }

      // Import search history
      for (const item of data.searchHistory) {
        await this.addSearchHistory(item);
      }

      console.log('✅ Data imported successfully');
      this.refreshService.triggerRefresh();
      return true;
    } catch (error) {
      console.error('❌ Error importing data:', error);
      return false;
    }
  }

  /**
   * Get comprehensive database and storage status for debugging
   */
  async getDebugInfo(): Promise<any> {
    try {
      const debugInfo: any = {
        database: {
          isReady: this.isDbReady,
          isInitializing: this.isInitializing,
          indexedDBStatus: this.indexedDB.getDBStatus()
        }
      };

      // Storage manager info
      debugInfo.storage = await this.storageManager.getStorageInfo();

      // Data counts
      try {
        debugInfo.data = {
          songsCount: (await this.getAllSongs()).length,
          searchHistoryCount: (await this.getSearchHistory()).length,
          // playlistsCount: (await this.getAllPlaylists()).length
        };
      } catch (error) {
        debugInfo.data = { error: 'Could not load data counts' };
      }

      return debugInfo;
    } catch (error: any) {
      return { error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Add a persistence marker to IndexedDB to test if data survives reload
   */
  async addPersistenceMarker() {
    try {
      const now = new Date();
      const marker: SearchHistoryItem = {
        songId: 'persistence_marker_' + now.getTime(),
        title: '🔄 Persistence Test Marker',
        artist: 'System Test',
        thumbnail_url: '',
        audio_url: '',
        duration: 0,
        duration_formatted: '0:00',
        keywords: ['persistence', 'test', 'marker'],
        searchedAt: now
      };

      console.log('🏷️ Adding persistence marker to IndexedDB:', marker.songId);
      const success = await this.addSearchHistory(marker);

      if (success) {
        console.log('✅ Persistence marker added successfully');

        // Store marker info in localStorage for comparison
        localStorage.setItem('last_persistence_marker', JSON.stringify({
          songId: marker.songId,
          timestamp: now.getTime(),
          date: now.toISOString()
        }));

      } else {
        console.error('❌ Failed to add persistence marker');
      }

      return success;
    } catch (error) {
      console.error('❌ Error adding persistence marker:', error);
      return false;
    }
  }

  /**
   * Check if persistence markers from previous sessions exist
   */
  async checkPersistenceMarkers() {
    try {
      console.log('🔍 Checking for persistence markers from previous sessions...');

      // Get all search history
      const history = await this.getSearchHistory();

      // Find persistence markers
      const markers = history.filter(item => item.songId.startsWith('persistence_marker_'));

      console.log(`📋 Found ${markers.length} persistence markers in IndexedDB`);

      if (markers.length > 0) {
        // Show details of found markers
        markers.forEach((marker, index) => {
          const age = new Date().getTime() - new Date(marker.searchedAt).getTime();
          const ageMinutes = Math.round(age / (1000 * 60));
          console.log(`  ${index + 1}. ${marker.songId} - ${ageMinutes} minutes old`);
        });

        // Check localStorage marker
        const lastMarker = localStorage.getItem('last_persistence_marker');
        if (lastMarker) {
          const markerData = JSON.parse(lastMarker);
          const foundInDB = markers.find(m => m.songId === markerData.songId);

          if (foundInDB) {
            console.log('✅ Persistence test PASSED - marker found in both localStorage and IndexedDB');
          } else {
            console.error('❌ Persistence test FAILED - marker in localStorage but NOT in IndexedDB');
          }
        }

        // Clean up old markers (keep only last 3)
        if (markers.length > 3) {
          console.log('🧹 Cleaning up old persistence markers...');
          // Sort by timestamp and keep only the newest 3
          const sorted = markers.sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());
          const toDelete = sorted.slice(3);

          for (const marker of toDelete) {
            try {
              await this.deleteSearchHistoryItem(marker.songId);
              console.log(`🗑️ Deleted old marker: ${marker.songId}`);
            } catch (e) {
              console.log(`⚠️ Could not delete marker ${marker.songId}:`, e);
            }
          }
        }

      } else {
        console.log('📝 No persistence markers found (first run or data was cleared)');
      }

      return markers.length;

    } catch (error) {
      console.error('❌ Error checking persistence markers:', error);
      return 0;
    }
  }

  /**
   * Verify what data actually exists in IndexedDB on app startup
   */
  async verifyDataPersistence() {
    try {
      console.log('🔍 Verifying IndexedDB data persistence...');

      // Check all stores for data
      const songs = await this.indexedDB.getAll('songs');
      const history = await this.indexedDB.getAll('search_history');
      const playlists = await this.indexedDB.getAll('playlists');
      const recentlyPlayed = await this.indexedDB.getAll('recently_played');
      const userPrefs = await this.indexedDB.getAll('user_preferences');

      console.log('📊 IndexedDB Data Count:');
      console.log(`  - Songs: ${songs.length}`);
      console.log(`  - Search History: ${history.length}`);
      console.log(`  - Playlists: ${playlists.length}`);
      console.log(`  - Recently Played: ${recentlyPlayed.length}`);
      console.log(`  - User Preferences: ${userPrefs.length}`);

      // Show recent history items if any
      if (history.length > 0) {
        console.log('📝 Recent search history items:');
        history.slice(-3).forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.title} by ${item.artist} (${new Date(item.searchedAt).toLocaleString()})`);
        });
      }

      // Calculate total data size estimate
      const totalItems = songs.length + history.length + playlists.length + recentlyPlayed.length + userPrefs.length;
      console.log(`📈 Total items in IndexedDB: ${totalItems}`);

      return {
        songs: songs.length,
        history: history.length,
        playlists: playlists.length,
        recentlyPlayed: recentlyPlayed.length,
        userPrefs: userPrefs.length,
        total: totalItems
      };

    } catch (error) {
      console.error('❌ Error verifying data persistence:', error);
      return null;
    }
  }

  /**
   * Test write operation - FOR DEBUGGING ONLY
   */
  async testWriteOperation() {
    console.log('🧪 Testing immediate write operation...');    const testData: SearchHistoryItem = {
      songId: 'test_write_' + Date.now(),
      title: 'Test Write Operation',
      artist: 'Test Artist',
      thumbnail_url: 'test_thumb_url',
      audio_url: 'test_audio_url',
      duration: 180,
      duration_formatted: '3:00',
      keywords: ['test', 'write'],
      searchedAt: new Date()
    };

    try {
      await this.addSearchHistory(testData);
      console.log('✅ Test write operation successful');

      // Verify by reading back
      const history = await this.getSearchHistory();
      console.log('📚 Current search history count:', history.length);

      return true;
    } catch (error) {
      console.error('❌ Test write operation failed:', error);
      return false;
    }
  }
}
