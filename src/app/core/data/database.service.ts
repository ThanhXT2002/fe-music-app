import { Injectable, signal } from '@angular/core';
import {
  Song,
  Playlist,
  SearchHistoryItem,
  DataSong,
} from '@core/interfaces/song.interface';
import { IndexedDBService } from '@core/data/indexeddb.service';
import { SongConverter } from '@core/utils/song.converter';

// ─────────────────────────────────────────────────────────
// Lớp Trung Gian Quản Trị CSDL (Database Service Wrapper)
// ─────────────────────────────────────────────────────────

/**
 * DatabaseService — Trạm điều phối Database ở tầng logic ứng dụng (Middleware).
 * Wrap lại IndexedDBService để cung cấp API mức mức cao (High-level) giao tiếp trực tiếp 
 * với các Object Song, Playlist và quản lý state đồng bộ Cache.
 */
@Injectable({
  providedIn: 'root',
})
export class DatabaseService {

  // === BIẾN TRẠNG THÁI ===

  /** Con trỏ trạm CSDL nền tảng */
  private indexedDB: IndexedDBService;
  
  /** Cờ cho thấy Database Core đã Init và sẵn sàng chạy lệnh SQL API hay chưa */
  private isDbReady = false;
  
  /** Khóa chặn Re-render Init Database tranh thụ luồng chạy song song */
  private isInitializing = false;

  // === CACHE THỜI GIAN THỰC ===

  private playlistsCache: Playlist[] | null = null;
  private playlistsCacheTime = 0;

  private songsCache: Song[] | null = null;
  private songsCacheTime = 0;

  /** Thời lượng bộ nhớ Cache tính bằng Miliseconds (30s) */
  private readonly CACHE_DURATION = 30000;

  /** Trạm phát Signal báo cáo ra ngoài Store khi một bài có sự kiện Xóa (Báo Effect) */
  deletedSongId = signal<string | null>(null);

  constructor(indexedDBService: IndexedDBService) {
    this.indexedDB = indexedDBService;
    // Khởi tạo database phi đồng bộ khi App được Boot chóp mảng Service này.
    this.initializeDatabase().catch((error) => {
      console.error('Lỗi khi mồi kết nối Database trong constructor:', error);
    });
  }

  // ─────────────────────────────────────────────────────────
  // Cơ Chế Khởi Tạo & Vòng Đời Mạng (Lifecycle)
  // ─────────────────────────────────────────────────────────

  /**
   * Khởi chạy kiểm tra và cấp phát Boot Database.
   * Chống khởi tạo lặp (Singleton Bootstrap).
   */
  async initializeDatabase() {
    if (this.isInitializing || this.isDbReady) {
      return;
    }

    this.isInitializing = true;

    try {
      let success = await this.indexedDB.initDB();

      // Nếu khởi tạo nứt luồng, ngâm chờ 1s rồi gọi lại thử một Lần Cuối (Retry Fallback).
      if (!success) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        success = await this.indexedDB.initDB();
      }

      if (success) {
        this.isDbReady = true;
        // Test Ping CSDL đọc bảng thử xem đã thông luồng Read/Write IO chưa
        await this.indexedDB.getAll('songs');
      } else {
        throw new Error('Sập CSDL IndexedDB ngay cả khi đã thử Re-init lần 2!');
      }
    } catch (error) {
      console.error('DatabaseService: Lỗi khởi động kết xuất DB:', error);
      this.isDbReady = false;
    } finally {
      this.isInitializing = false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Chuyên Biệt Mảng Bài Hát (Songs CRUD)
  // ─────────────────────────────────────────────────────────

  /**
   * Đẩy mới 1 dòng bài hát vào bảng 'songs'.
   */ 
  async addSong(song: Song): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const success = await this.indexedDB.put('songs', song);
      if (success) {
        this.songsCache = null; // Đập bỏ nát Cache bắt cập nhật đợt mới.
      }
      return success;
    } catch (error) {
      console.error('Lỗi Add data Song:', error);
      return false;
    }
  }

  /**
   * Cáo quét GetAll lấy một lượng toàn bộ Object Bài hát.
   * Bọc bằng kỹ thuật RAM Caching để tránh read HDD Disk IndexedDB quá nhiều làm đơ UI.
   */
  async getAllSongs(): Promise<Song[]> {
    if (!this.isDbReady) return [];

    const now = Date.now();
    if (this.songsCache && now - this.songsCacheTime < this.CACHE_DURATION) {
      return this.songsCache;
    }

    try {
      const allSong = await this.indexedDB.getAll('songs');

      // Sort và đè RAM Cache lại
      const sortedSongs = allSong.sort(
        (a, b) => +new Date(b.addedDate) - +new Date(a.addedDate)
      );
      this.songsCache = sortedSongs;
      this.songsCacheTime = now;

      return sortedSongs;
    } catch (error) {
      console.error('Lỗi khi moi ruột All Songs HDD:', error);
      return [];
    }
  }

  /** Lấy bài hát theo cấu trúc đơn ID */
  async getSongById(id: string): Promise<Song | null> {
    if (!this.isDbReady) return null;

    try {
      return await this.indexedDB.get('songs', id);
    } catch (error) {
      console.error('Lỗi get song id:', error);
      return null;
    }
  }

  /**
   * UPSERT thay mã đè thuộc tính 1 bài nhạc.
   */ 
  async updateSong(song: Song): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const success = await this.indexedDB.put('songs', song);
      if (success) {
        this.songsCache = null; // Huỷ Cache
      }
      return success;
    } catch (error) {
      console.error('Lỗi Upsert báo đổi song:', error);
      return false;
    }
  }

  /**
   * Thao Tác Cascade Xóa dây chuyền chóp Bài Hát (Cascade Delete Flow).
   * Cực MẠNH - Quét bay bài hát, bay data âm lượng, móc Playlist cũng văng luôn.
   */
  async deleteSong(id: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      // 1. Quét từ Store Root Songs Table
      const success = await this.indexedDB.deleteRecord('songs', id);

      // 2. Chém xoá file nhị phân Audio Blob File nếu Offline
      const audioDeletePromise = this.deleteAudioFile(id);

      // 3. Chọc vào toàn bộ Playlist rà soát gỡ bài khỏi list. (Clean Reference Orphan ID).
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

      // 4. Quét móc sạch Lịch sử tìm kiếm (Search History Logs)
      const searchHistory = await this.getSearchHistory();
      const toDelete = searchHistory.filter((item) => item.songId === id);
      const searchHistoryDeletePromises = toDelete.map((item) =>
        this.indexedDB.deleteRecord('search_history', String(item.id))
      );

      // Nhấn ga thực hiện batch Async All Wait đồng bộ khối các rẽ nhánh lệnh ngầm
      await Promise.all([
        audioDeletePromise,
        ...playlistUpdatePromises,
        ...searchHistoryDeletePromises,
      ]);

      // 5. Cấp cờ Signal phản hồi Effect tới giao diện UI và dập Cache rũ.
      if (success) {
        this.songsCache = null;
        this.deletedSongId.set(id);
      }
      return success;
    } catch (error) {
      console.error('Lỗi cascade chém bài Every-where:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────
  // Lưu trữ Lõi Nhị Phân (Audio Blob Operations)
  // ─────────────────────────────────────────────────────────

  /** Móc Lưu blob file MP3 Disk */
  async saveAudioFile(
    songId: string,
    file: File | Blob,
    mimeType: string
  ): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.saveAudioFile(songId, file, mimeType);
  }

  /** Gọi đọc Blob ra Buffer vạch nhúng Audio src DOM */
  async getAudioFile(songId: string): Promise<Blob | null> {
    if (!this.isDbReady) return null;
    return await this.indexedDB.getAudioFile(songId);
  }

  /** Thủng file rác Audio disk */
  async deleteAudioFile(songId: string): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.deleteAudioFile(songId);
  }

  /** Wrapper hàm lưu Blob song audio */
  async saveSongAudioBlob(songId: string, audioBlob: Blob): Promise<boolean> {
    try {
      const audioSaved = await this.indexedDB.saveAudioFile(
        songId,
        audioBlob,
        audioBlob.type || 'audio/mpeg'
      );
      return audioSaved;
    } catch (error) {
      console.error('Lỗi Save Blob nhạc:', error);
      return false;
    }
  }

  /** Wrapper lấy Blob ra cho Source HTML Media Element */
  async getAudioBlob(songId: string): Promise<Blob | null> {
    return await this.indexedDB.getAudioFile(songId);
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Xử Lý Playlists & Data Logic
  // ─────────────────────────────────────────────────────────

  /** Móc DB tạo thêm record List nhạc */
  async addPlaylist(playlist: Playlist): Promise<boolean> {
    if (!this.isDbReady) return false;

    const success = await this.indexedDB.put('playlists', playlist);
    if (success) {
      this.playlistsCache = null; 
    }
    return success;
  }

  /** Rút toàn bộ bảng Playlists */
  async getAllPlaylists(): Promise<Playlist[]> {
    if (!this.isDbReady) return [];

    try {
      this.playlistsCache = null; // Tắt cache - Đọc tươi tránh đụng trễ do Playlist sửa quá nhiều
      const playlists = await this.indexedDB.getAll('playlists');
      return playlists;
    } catch (error) {
      console.error('Lỗi khi get Plists GetAll:', error);
      return [];
    }
  }

  /** Cập nhật Data Json List Nhạc */
  async updatePlaylist(playlist: Playlist): Promise<boolean> {
    if (!this.isDbReady) return false;

    const success = await this.indexedDB.put('playlists', playlist);
    if (success) {
      this.playlistsCache = null; 
    }
    return success;
  }

  /** Xoá danh sách Playlist cá nhân */
  async deletePlaylist(id: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    const success = await this.indexedDB.deleteRecord('playlists', id);
    if (success) {
      this.playlistsCache = null; 
    }
    return success;
  }

  /** Trỏ cụ thể vô Id list lấy Info playlist */
  async getPlaylistById(id: string): Promise<Playlist | null> {
    if (!this.isDbReady) return null;

    try {
      return await this.indexedDB.get('playlists', id);
    } catch (error) {
      console.error('Lỗi Find PlyById:', error);
      return null;
    }
  }

  /** Chọc lệnh ép gỡ cache memory Playlist */
  clearPlaylistsCache(): void {
    this.playlistsCache = null;
    this.playlistsCacheTime = 0;
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Lọc Mảng Business Lõi Nhạc
  // ─────────────────────────────────────────────────────────

  /** Like - Filter tìm chuỗi tên tự do */
  async searchSongs(query: string): Promise<Song[]> {
    if (!this.isDbReady) return [];
    return await this.indexedDB.search('songs', 'title', query);
  }

  /** 
   * Trích lục ra riêng mảng nhạc đã "Ngoại tuyến" (Offline Downloaded Mode).
   * Phải trỏ ngầm join thêm sang bảng âm thanh Disk.
   */
  async getDownloadedSongs(): Promise<Song[]> {
    const allSongs = await this.getAllSongs();
    
    // Joint Parallel móc Table âm lượng Blob Disk
    const checks = await Promise.all(
      allSongs.map(async (song) => {
        const hasAudio = await this.indexedDB.hasFile('audioFiles', song.id);
        return hasAudio ? song : null;
      })
    );
    // Cắt gọt ném mảng thừa Null
    return checks.filter((s): s is Song => !!s);
  }

  /** Lấy các Id rỗng list track Yêu thích */
  async getAllFavoriteSongIds(): Promise<string[]> {
    const songs = await this.getAllSongs();
    return songs.filter((song) => song.isFavorite).map((song) => song.id);
  }
  
  /** Trả nguyên object Map Heart Love Mảng Favourite */
  async getFavoriteSongs(): Promise<Song[]> {
    const songs = await this.getAllSongs();
    return songs.filter((song) => song.isFavorite);
  }

  /** Trả mảng nhạc Đã Phát Gần Gây - Dùng Sorted Descending Time Limit Row 50 bài */
  async getRecentlyPlayedSongs(limit: number = 50): Promise<Song[]> {
    const songs = await this.getAllSongs();
    return [...songs] // Deep/Shallow Copy tách tham chiếu để tránh rối mảng Cache
      .sort(
        (a, b) =>
          (b.lastPlayedDate ? new Date(b.lastPlayedDate).getTime() : 0) -
          (a.lastPlayedDate ? new Date(a.lastPlayedDate).getTime() : 0)
      )
      .slice(0, limit);
  }

  /** Toggle nút Tim. Bất biến Đẩy ngược True false cờ Love */
  async toggleFavorite(songId: string): Promise<boolean> {
    const song = await this.getSongById(songId);
    if (!song) return false;

    song.isFavorite = !song.isFavorite;
    return await this.updateSong(song);
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Ghi Search Keywords (Tìm Kiếm Lịch Sử)
  // ─────────────────────────────────────────────────────────

  /** Log lại cú Search text để hiện đề xuất lại */
  async addSearchHistory(item: SearchHistoryItem): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.put('search_history', item);
  }

  /** Hàm Overloading đa thể: Tiếp nhận cả Song Lõi lẫn DTO API DataSong đổ vô */
  async addToSearchHistory(song: Song): Promise<boolean>;
  async addToSearchHistory(song: DataSong): Promise<boolean>;
  async addToSearchHistory(song: Song | DataSong): Promise<boolean> {
    // Ép Converter Mapping Format để nhét DB ko dính Lõi hỏng Typo
    const searchItem: SearchHistoryItem =
      'thumbnail_url' in song
        ? SongConverter.apiDataToSearchHistory(song as DataSong)
        : SongConverter.toSearchHistory(song as Song);

    return await this.addSearchHistory(searchItem);
  }

  /** Gọi List Log Tìm Kiếm */
  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    if (!this.isDbReady) return [];

    try {
      const allHistory = await this.indexedDB.getAll('search_history');
      return allHistory.sort(
        (a, b) => +new Date(b.searchedAt) - +new Date(a.searchedAt)
      );
    } catch (error) {
      console.error('Lỗi Error log rà soát Get History data Search:', error);
      return [];
    }
  }

  /** Clear cục bộ Table Logs */
  async clearSearchHistory(): Promise<boolean> {
    if (!this.isDbReady) return false;
    return await this.indexedDB.clear('search_history');
  }

  /** Lấy Insight số liệu Analytic Search (Trang thống kê admin app) */
  async getSearchHistoryStats(): Promise<any> {
    const history = await this.getSearchHistory();
    return {
      totalSearches: history.length,
      uniqueSongs: new Set(history.map((h) => h.songId)).size,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Gắn Cờ Và Kiểm Duyệt
  // ─────────────────────────────────────────────────────────

  /** Mác cờ Bài hát là Offline (Vừa nạp xong File Disk I/O thành công) */
  async markAsDownloaded(
    songId: string,
    audioBlobUrl: string
  ): Promise<boolean> {
    const song = await this.getSongById(songId);
    if (!song) return false;

    // Mutate Data đè URLs chạy Background Offline
    const downloadedSong = SongConverter.markAsDownloaded(song, audioBlobUrl);
    return await this.updateSong(downloadedSong);
  }

  /** Insight lấy tổng đếm bài All và Tải Offline đính kèm */
  async getDatabaseStats(): Promise<{ total: number; downloaded: number }> {
    const songs = await this.getAllSongs();
    return {
      total: songs.length,
      downloaded: songs.filter((s) => SongConverter.isDownloaded(s)).length,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Thao Tác Phá Hủy Và Giải Phóng Vùng Nhớ Ram/HDD
  // ─────────────────────────────────────────────────────────

  /** Hàm Reset App Database - Kích Văng Trắng DB Toàn Bộ CSDL */
  async clearAllData(): Promise<boolean> {
    if (!this.isDbReady) return false;
    try {
      this.clearAllCache();
      // Drop TRUNCATE Data
      await this.indexedDB.clear('songs');
      await this.indexedDB.clear('playlists');
      await this.indexedDB.clear('search_history');
      await this.indexedDB.clear('audioFiles');
      await this.indexedDB.clear('downloads');
      return true;
    } catch (error) {
      console.error('Lỗi khi rụng Drop Data Clear cục bộ DB:', error);
      return false;
    }
  }

  /** GC Xả RAM */
  clearAllCache(): void {
    this.songsCache = null;
    this.songsCacheTime = 0;
    this.playlistsCache = null;
    this.playlistsCacheTime = 0;
    localStorage.clear();
  }

  /**
   * Helper Develop Test Tool - Xoá rác test mảng
   */
  async debugClearTestData(): Promise<void> {
    const songs = await this.getAllSongs();
    const testSongs = songs.filter(
      (s) => s.id.includes('debug-test') || s.id.includes('test-')
    );

    for (const song of testSongs) {
      await this.deleteSong(song.id);
    }
  }

  isReady(): boolean {
    return this.isDbReady && this.indexedDB.isReady();
  }

  async closeDatabase(): Promise<void> {
    // Web Service Woker IO DOM IndexedDB tự kill khi tab Destroy Session (Không cần ép ngắt TCP Manual)
  }
}
