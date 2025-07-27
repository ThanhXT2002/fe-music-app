import { Injectable, signal } from '@angular/core';
import {
  Song,
  Album,
  Artist,
  Playlist,
  SearchHistoryItem,
  DataSong,
} from '../interfaces/song.interface';
import { IndexedDBService } from './indexeddb.service';
import { RefreshService } from './refresh.service';
import { SongConverter } from '../utils/song.converter';

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

  deletedSongId = signal<string | null>(null);

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
      return;
    }

    this.isInitializing = true;

    try {
      let success = await this.indexedDB.initDB();

      // If initialization fails, try again with a small delay
      if (!success) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
        success = await this.indexedDB.initDB();
      }
      if (success) {
        this.isDbReady = true;

        // Simple data check
        await this.indexedDB.getAll('songs');

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
  private async initializeSystemPlaylists(): Promise<void> {}

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
   */
  async deleteSong(id: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      // 1. Xóa khỏi bảng songs
      const success = await this.indexedDB.deleteRecord('songs', id);

      // 2. Xóa file audio liên quan (nếu có)
      const audioDeletePromise = this.deleteAudioFile(id);

      // 3. Xóa khỏi tất cả playlist (songId có thể là string hoặc object)
      const playlists = await this.getAllPlaylists();
      const playlistUpdatePromises: Promise<any>[] = [];
      let playlistChanged = false;
      for (const playlist of playlists) {
        if (playlist.songs && Array.isArray(playlist.songs)) {
          const originalLength = playlist.songs.length;
          playlist.songs = playlist.songs.filter((songItem) => {
            if (typeof songItem === 'string') {
              return songItem !== id;
            } else if (
              songItem &&
              typeof songItem === 'object' &&
              'id' in songItem
            ) {
              return songItem.id !== id;
            }
            return true;
          });
          if (playlist.songs.length !== originalLength) {
            playlistUpdatePromises.push(this.updatePlaylist(playlist));
            playlistChanged = true;
          }
        }
      }
      if (playlistChanged) {
        this.playlistsCache = null;
      }

      // 4. Xóa khỏi bảng search_history
      const searchHistory = await this.getSearchHistory();
      const toDelete = searchHistory.filter((item) => item.songId === id);
      const searchHistoryDeletePromises = toDelete.map((item) =>
        this.indexedDB.deleteRecord('search_history', String(item.id))
      );

      // Thực hiện song song các thao tác xóa phụ trợ
      await Promise.all([
        audioDeletePromise,
        ...playlistUpdatePromises,
        ...searchHistoryDeletePromises,
      ]);

      // 5. Xóa cache và trigger refresh nếu thành công
      if (success) {
        this.songsCache = null;
        this.refreshService.triggerRefresh();
        this.deletedSongId.set(id);
      }
      return success;
    } catch (error) {
      console.error('Error deleting song everywhere:', error);
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
   * Xóa audio file
   */
  async deleteAudioFile(songId: string): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.deleteAudioFile(songId);
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
    // Kiểm tra tồn tại file audio cho từng bài hát
    const checks = await Promise.all(
      allSongs.map(async (song) => {
        const hasAudio = await this.indexedDB.hasFile('audioFiles', song.id);
        return hasAudio ? song : null;
      })
    );
    // Lọc ra những bài hát thực sự có file audio
    return checks.filter((s): s is Song => !!s);
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

    try {
      // Always clear cache to ensure fresh data
      this.playlistsCache = null;

      const playlists = await this.indexedDB.getAll('playlists');
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
      // Clear cache first
      this.playlistsCache = null;
      this.playlistsCacheTime = 0;
      this.songsCache = null;
      this.songsCacheTime = 0;
      // Clear all tables
      await this.indexedDB.clear('songs');
      await this.indexedDB.clear('playlists');
      await this.indexedDB.clear('search_history');
      await this.indexedDB.clear('audioFiles');
      await this.indexedDB.clear('downloads');
      return true;
    } catch (error) {
      console.error('❌ Error clearing IndexedDB data:', error);
      return false;
    }
  }

  clearAllCache(): void {
    this.songsCache = null;
    this.songsCacheTime = 0;
    this.playlistsCache = null;
    this.playlistsCacheTime = 0;
    localStorage.clear();
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

  async debugClearTestData(): Promise<void> {
    const songs = await this.getAllSongs();
    const testSongs = songs.filter(
      (s) => s.id.includes('debug-test') || s.id.includes('test-')
    );

    for (const song of testSongs) {
      await this.deleteSong(song.id);
    }
  }

  // Missing methods for compatibility
  async toggleFavorite(songId: string): Promise<boolean> {
    const song = await this.getSongById(songId);
    if (!song) return false;

    song.isFavorite = !song.isFavorite;

    console.log('isFavorite:', song.isFavorite);
    return await this.updateSong(song);
  }

  async getFavoriteSongs(): Promise<Song[]> {
    const songs = await this.getAllSongs();
    return songs.filter((song) => song.isFavorite);
  }

  async getRecentlyPlayedSongs(limit: number = 50): Promise<Song[]> {
    const songs = await this.getAllSongs();
    return [...songs] // clone mảng, không ảnh hưởng cache
      .sort(
        (a, b) =>
          (b.lastPlayedDate ? new Date(b.lastPlayedDate).getTime() : 0) -
          (a.lastPlayedDate ? new Date(a.lastPlayedDate).getTime() : 0)
      )
      .slice(0, limit);
  }

  async addToSearchHistory(song: Song): Promise<boolean>;
  async addToSearchHistory(song: DataSong): Promise<boolean>;
  async addToSearchHistory(song: Song | DataSong): Promise<boolean> {
    // Use SongConverter for proper conversion
    const searchItem: SearchHistoryItem =
      'thumbnail_url' in song
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

  async markAsDownloaded(
    songId: string,
    audioBlobUrl: string
  ): Promise<boolean> {
    const song = await this.getSongById(songId);
    if (!song) return false;

    // Update Song với offline URLs
    const downloadedSong = SongConverter.markAsDownloaded(song, audioBlobUrl);
    return await this.updateSong(downloadedSong);
  }

  async closeDatabase(): Promise<void> {
    // IndexedDB doesn't need explicit close
  }

  /**
   * Save audio blob to IndexedDB
   * @param songId - ID của bài hát
   * @param audioBlob - Audio blob data
   * @returns Promise<boolean>
   */
  async saveSongAudioBlob(songId: string, audioBlob: Blob): Promise<boolean> {
    try {
      const audioSaved = await this.indexedDB.saveAudioFile(
        songId,
        audioBlob,
        audioBlob.type || 'audio/mpeg'
      );

      return audioSaved;
    } catch (error) {
      console.error('❌ Error saving audio blob:', error);
      return false;
    }
  }

  /**
   * Get audio blob from IndexedDB
   * @param songId - ID của bài hát
   * @returns Promise<Blob | null>
   */
  async getAudioBlob(songId: string): Promise<Blob | null> {
    return await this.indexedDB.getAudioFile(songId);
  }

  /**
   * Force clear playlists cache
   */
  clearPlaylistsCache(): void {
    this.playlistsCache = null;
    this.playlistsCacheTime = 0;
  }

  async getAllFavoriteSongIds(): Promise<string[]> {
    const songs = await this.getAllSongs();
    return songs.filter((song) => song.isFavorite).map((song) => song.id);
  }
}
