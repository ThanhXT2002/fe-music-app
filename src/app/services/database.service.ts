import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { Song, Album, Artist, Playlist, SearchHistoryItem, DataSong } from '../interfaces/song.interface';
import { IndexedDBService } from './indexeddb.service';
import { RefreshService } from './refresh.service';
import { OfflineMediaService } from './offline-media.service';
/**
 * Service quản lý cơ sở dữ liệu SQLite cho ứng dụng nhạc
 * Xử lý tất cả các thao tác CRUD với bài hát, album, nghệ sĩ và playlist
 */
const DB_XTMUSIC = 'xtmusic_db';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  // Kết nối SQLite chính
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  // Instance cơ sở dữ liệu hiện tại
  private db: SQLiteDBConnection | null = null;
  // IndexedDB service cho web platform
  private indexedDB: IndexedDBService;
  // Trạng thái sẵn sàng của database
  private isDbReady = false;
  // Platform hiện tại
  private platform: string;

  constructor(
    indexedDBService: IndexedDBService,
    private refreshService: RefreshService,
    private offlineMediaService: OfflineMediaService
  ) {
    this.indexedDB = indexedDBService;
    this.platform = Capacitor.getPlatform();
    // Khởi tạo database khi service được tạo
    this.initializeDatabase();
  }  /**
   * Khởi tạo cơ sở dữ liệu và tạo các bảng cần thiết
   */
  async initializeDatabase() {
    try {

      if (this.platform === 'web') {
        await this.indexedDB.initDB();
        this.isDbReady = true;
      } else {
        // Sử dụng SQLite cho native platforms
        // Tạo kết nối database với tên 'xtmusic_db'
        this.db = await this.sqlite.createConnection(
          DB_XTMUSIC,
          false, // không mã hóa
          'no-encryption',
          1, // phiên bản database
          false
        );
        // Mở kết nối database
        await this.db.open();
        // Tạo các bảng cần thiết
        await this.createTables();
        this.isDbReady = true;
      }
    } catch (error) {
      console.error('❌ Error initializing database:', error);
      this.isDbReady = false;
      throw error; // Re-throw để caller có thể handle
    }
  }

  /**
   * Tạo tất cả các bảng cần thiết cho ứng dụng
   */
  private async createTables() {
    if (!this.db) return;

    const queries = [      `CREATE TABLE IF NOT EXISTS songs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT,
        duration INTEGER NOT NULL,
        duration_formatted TEXT,
        thumbnail_url TEXT,
        audioUrl TEXT NOT NULL,
        filePath TEXT,
        addedDate TEXT NOT NULL,
        isFavorite INTEGER DEFAULT 0,
        genre TEXT,
        isDownloaded INTEGER DEFAULT 0
      );`,

      // Bảng album - lưu thông tin về các album nhạc
      `CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        artist TEXT NOT NULL,
        thumbnail TEXT,
        year INTEGER,
        genre TEXT,
        totalDuration INTEGER DEFAULT 0
      );`,

      // Bảng nghệ sĩ - lưu thông tin về các ca sĩ/nhóm nhạc
      `CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        thumbnail TEXT,
        totalSongs INTEGER DEFAULT 0,
        bio TEXT
      );`,

      // Bảng playlist - lưu danh sách phát do người dùng tạo
      `CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        thumbnail TEXT,
        isSystemPlaylist INTEGER DEFAULT 0,
        createdDate TEXT NOT NULL,
        updatedDate TEXT NOT NULL
      );`,

      // Bảng liên kết playlist-bài hát (many-to-many relationship)
      `CREATE TABLE IF NOT EXISTS playlist_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlistId TEXT NOT NULL,
        songId TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
      );`,

      // Bảng cài đặt người dùng - lưu các tùy chọn cá nhân
      `CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,

      // Bảng lịch sử phát - theo dõi bài hát đã nghe
      `CREATE TABLE IF NOT EXISTS recently_played (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        songId TEXT NOT NULL,
        playedAt TEXT NOT NULL,
        FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        songId TEXT NOT NULL,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        thumbnail_url TEXT,
        audio_url TEXT NOT NULL,
        duration INTEGER NOT NULL,
        duration_formatted TEXT,
        keywords TEXT, -- JSON string của keywords array
        searchedAt TEXT NOT NULL,
        isDownloaded INTEGER DEFAULT 0,
        UNIQUE(songId) -- Mỗi bài hát chỉ xuất hiện 1 lần trong lịch sử
      );`,

      // Index để tối ưu performance
      `CREATE INDEX IF NOT EXISTS idx_search_history_date ON search_history(searchedAt DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_search_history_song ON search_history(songId);`,
      `CREATE INDEX IF NOT EXISTS idx_search_history_downloaded ON search_history(isDownloaded);`

    ];

    // Thực thi từng câu lệnh tạo bảng
    for (const query of queries) {
      await this.db.execute(query);
    }

    // Tạo các playlist hệ thống mặc định
    await this.createSystemPlaylists();
  }

  /**
   * Tạo các playlist hệ thống mặc định (Yêu thích, Nghe gần đây)
   */
  private async createSystemPlaylists() {
    if (!this.db) return;

    const systemPlaylists = [
      { id: 'favorites', name: 'Yêu thích', description: 'Các bài hát yêu thích' },
      { id: 'recent', name: 'Nghe gần đây', description: 'Bài hát đã nghe gần đây' }
    ];

    for (const playlist of systemPlaylists) {
      // Kiểm tra xem playlist đã tồn tại chưa
      const exists = await this.db.query(
        'SELECT id FROM playlists WHERE id = ?',
        [playlist.id]
      );

      // Chỉ tạo playlist nếu chưa tồn tại
      if (exists.values?.length === 0) {
        await this.db.run(
          `INSERT INTO playlists (id, name, description, isSystemPlaylist, createdDate, updatedDate)
           VALUES (?, ?, ?, 1, ?, ?)`,
          [
            playlist.id,
            playlist.name,
            playlist.description,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
      }
    }
  }

  // === CÁC PHƯƠNG THỨC XỬ LÝ BÀI HÁT ===
  /**
   * Thêm một bài hát mới vào database
   * @param song - Đối tượng bài hát cần thêm
   * @returns Promise<boolean> - true nếu thành công
   */
  async addSong(song: Song): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const songData = {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album || null,
          duration: song.duration,
          duration_formatted: song.duration_formatted || null,
          thumbnail_url: song.thumbnail || null,
          audioUrl: song.audioUrl,
          filePath: song.filePath || null,
          addedDate: song.addedDate.toISOString(),
          isFavorite: song.isFavorite ? 1 : 0,
          genre: song.genre || null,
          isDownloaded: song.isDownloaded ? 1 : 0
        };
        return await this.indexedDB.put('songs', songData);
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return false;        await this.db.run(
          `INSERT OR REPLACE INTO songs
           (id, title, artist, album, duration, duration_formatted, thumbnail_url, audioUrl, filePath,
            addedDate, isFavorite, genre, isDownloaded)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            song.id,
            song.title,
            song.artist,
            song.album || null,
            song.duration,
            song.duration_formatted || null,
            song.thumbnail || null,
            song.audioUrl,
            song.filePath || null,
            song.addedDate.toISOString(),
            song.isFavorite ? 1 : 0,
            song.genre || null,
            song.isDownloaded ? 1 : 0
          ]
        );
        return true;
      }
    } catch (error) {
      console.error('Error adding song:', error);
      return false;
    }
  }
  /**
   * Lấy tất cả bài hát từ database, sắp xếp theo ngày thêm giảm dần
   * @returns Promise<Song[]> - Mảng các bài hát
   */
  async getAllSongs(): Promise<Song[]> {
    if (!this.isDbReady) return [];

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const rows = await this.indexedDB.getAll('songs');
        // Sắp xếp theo addedDate DESC
        rows.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());
        return await this.mapRowsToSongs(rows);
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return [];
        const result = await this.db.query('SELECT * FROM songs ORDER BY addedDate DESC');
        return await this.mapRowsToSongs(result.values || []);
      }
    } catch (error) {
      console.error('Error getting songs:', error);
      return [];
    }
  }
  /**
   * Lấy thông tin bài hát theo ID
   * @param id - ID của bài hát
   * @returns Promise<Song | null> - Bài hát hoặc null nếu không tìm thấy
   */
  async getSongById(id: string): Promise<Song | null> {
    if (!this.isDbReady) return null;

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const row = await this.indexedDB.get('songs', id);
        if (!row) return null;
        const songs = await this.mapRowsToSongs([row]);
        return songs.length > 0 ? songs[0] : null;
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return null;
        const result = await this.db.query('SELECT * FROM songs WHERE id = ?', [id]);
        const songs = await this.mapRowsToSongs(result.values || []);
        return songs.length > 0 ? songs[0] : null;
      }
    } catch (error) {
      console.error('Error getting song by id:', error);
      return null;
    }
  }
  /**
   * Tìm kiếm bài hát theo tên, nghệ sĩ hoặc album
   * @param query - Từ khóa tìm kiếm
   * @returns Promise<Song[]> - Danh sách bài hát phù hợp
   */
  async searchSongs(query: string): Promise<Song[]> {
    if (!this.isDbReady) return [];

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const allSongs = await this.indexedDB.getAll('songs');
        const filtered = allSongs.filter(song =>
          song.title.toLowerCase().includes(query.toLowerCase()) ||
          song.artist.toLowerCase().includes(query.toLowerCase()) ||
          (song.album && song.album.toLowerCase().includes(query.toLowerCase()))
        );
        // Sắp xếp theo title ASC
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        return await this.mapRowsToSongs(filtered);
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return [];
        const result = await this.db.query(
          `SELECT * FROM songs
           WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
           ORDER BY title ASC`,
          [`%${query}%`, `%${query}%`, `%${query}%`]
        );
        return await this.mapRowsToSongs(result.values || []);
      }
    } catch (error) {
      console.error('Error searching songs:', error);
      return [];
    }
  }
  /**
   * Thêm bài hát vào lịch sử nghe gần đây
   * @param songId - ID của bài hát
   */
  async addToRecentlyPlayed(songId: string): Promise<void> {
    if (!this.isDbReady) return;

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const recentData = {
          id: `${songId}_${Date.now()}`, // Tạo unique ID
          songId: songId,
          playedAt: new Date().toISOString()
        };
        await this.indexedDB.put('recently_played', recentData);
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return;
        await this.db.run(
          'INSERT INTO recently_played (songId, playedAt) VALUES (?, ?)',
          [songId, new Date().toISOString()]
        );
      }
    } catch (error) {
      console.error('Error adding to recently played:', error);
    }
  }

  /**
   * Chuyển đổi dữ liệu từ database rows thành đối tượng Song
   * @param rows - Mảng các row từ database
   * @returns Song[] - Mảng các đối tượng Song
   */
  private async mapRowsToSongs(rows: any[]): Promise<Song[]> {
    const songs: Song[] = [];

    for (const row of rows) {
      let thumbnailUrl = row.thumbnail_url; // Default URL

      // Load thumbnail từ blob nếu đã download
      if (row.isDownloaded === 1) {
        if (this.platform === 'web') {
          thumbnailUrl = await this.offlineMediaService.getThumbnailUrl(
            row.id,
            row.thumbnail_url,
            true
          );
        } else {
          // Native: Load từ SQLite blob
          const thumbnailBlob = await this.getThumbnailBlob(row.id);
          if (thumbnailBlob) {
            thumbnailUrl = URL.createObjectURL(thumbnailBlob);
          }
        }
      }

      songs.push({
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        duration: row.duration,
        duration_formatted: row.duration_formatted,
        thumbnail: thumbnailUrl,
        audioUrl: row.audioUrl,
        filePath: row.filePath,
        addedDate: new Date(row.addedDate),
        isFavorite: row.isFavorite === 1,
        genre: row.genre,
        isDownloaded: row.isDownloaded === 1
      });
    }

    return songs;
  }

  /**
   * Lưu thumbnail file vào storage
   * @param songId - ID của bài hát
   * @param blob - Thumbnail blob
   * @param mimeType - MIME type của file
   * @returns Promise<boolean>
   */
  async saveThumbnailFile(songId: string, blob: Blob, mimeType: string): Promise<boolean> {
    try {
      if (this.platform === 'web') {
        return await this.indexedDB.saveThumbnailFile(songId, blob, mimeType);
      } else {
        // Native: Lưu vào SQLite
        if (!this.db) return false;

        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        await this.db.run(
          'INSERT OR REPLACE INTO thumbnail_files (songId, blob, mimeType, createdAt) VALUES (?, ?, ?, ?)',
          [songId, uint8Array, mimeType, new Date().toISOString()]
        );
        return true;
      }
    } catch (error) {
      console.error('Error saving thumbnail file:', error);
      return false;
    }
  }

  /**
   * Lấy thumbnail blob từ storage
   * @param songId - ID của bài hát
   * @returns Promise<Blob | null>
   */
  async getThumbnailBlob(songId: string): Promise<Blob | null> {
    try {
      if (this.platform === 'web') {
        return await this.indexedDB.getThumbnailFile(songId);
      } else {
        // Native: Lấy từ SQLite
        if (!this.db) return null;

        const result = await this.db.query(
          'SELECT blob, mimeType FROM thumbnail_files WHERE songId = ?',
          [songId]
        );

        if (result.values && result.values.length > 0) {
          const row = result.values[0];
          return new Blob([row.blob], { type: row.mimeType });
        }

        return null;
      }
    } catch (error) {
      console.error('Error getting thumbnail blob:', error);
      return null;
    }
  }

  /**
   * Xóa một bài hát khỏi database
   * @param songId - ID của bài hát cần xóa
   * @returns Promise<boolean> - true nếu xóa thành công
   */
  async deleteSong(songId: string): Promise<boolean> {
    if (!this.db || !this.isDbReady) return false;

    try {
      await this.db.run('DELETE FROM songs WHERE id = ?', [songId]);
      return true;
    } catch (error) {
      console.error('Error deleting song:', error);
      return false;
    }
  }
  /**
   * Xóa tất cả dữ liệu trong database (reset ứng dụng)
   * @returns Promise<boolean> - true nếu xóa thành công
   */
  async clearAllData(): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        await this.indexedDB.clear('songs');
        await this.indexedDB.clear('search_history');
        await this.indexedDB.clear('recently_played');
        return true;
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return false;
        await this.db.run('DELETE FROM songs');
        await this.db.run('DELETE FROM albums');
        await this.db.run('DELETE FROM artists');
        await this.db.run('DELETE FROM playlists');
        await this.db.run('DELETE FROM playlist_songs');
        await this.db.run('DELETE FROM recently_played');
        await this.db.run('DELETE FROM search_history');
        return true;
      }
    } catch (error) {
      console.error('Error clearing all data:', error);
      return false;
    }
  }
  /**
   * Lấy tất cả playlist từ database
   * @returns Promise<Playlist[]> - Danh sách tất cả playlist
   */
  async getAllPlaylists(): Promise<Playlist[]> {
    if (!this.isDbReady) return [];

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        // Note: For web platform, we only support basic functionality
        // Playlist features are mainly for native platforms
        return [];
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return [];
        const result = await this.db.query('SELECT * FROM playlists ORDER BY name');
        return this.mapRowsToPlaylists(result.values || []);
      }
    } catch (error) {
      console.error('Error getting playlists:', error);
      return [];
    }
  }

  /**
   * Chuyển đổi dữ liệu từ database rows thành đối tượng Playlist
   * @param rows - Mảng các row từ database
   * @returns Playlist[] - Mảng các đối tượng Playlist
   */
  private mapRowsToPlaylists(rows: any[]): Playlist[] {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      thumbnail: row.thumbnail,
      isSystemPlaylist: row.isSystemPlaylist === 1, // Chuyển integer thành boolean
      createdDate: new Date(row.createdDate),
      updatedDate: new Date(row.updatedDate),
      songs: [] // Danh sách bài hát sẽ được load riêng khi cần
    }));
  }
  /**
   * Chuyển đổi trạng thái yêu thích của bài hát
   * @param songId - ID của bài hát
   * @returns Promise<boolean> - Trạng thái yêu thích mới
   */
  async toggleFavorite(songId: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      const song = await this.getSongById(songId);
      if (!song) return false;

      const newFavoriteStatus = !song.isFavorite;

      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const songData = await this.indexedDB.get('songs', songId);
        if (songData) {
          songData.isFavorite = newFavoriteStatus ? 1 : 0;
          await this.indexedDB.put('songs', songData);
        }
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return false;
        await this.db.run(
          'UPDATE songs SET isFavorite = ? WHERE id = ?',
          [newFavoriteStatus ? 1 : 0, songId]
        );
      }
      this.refreshService.triggerRefresh();
      return newFavoriteStatus;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  }
  /**
   * Lấy danh sách bài hát yêu thích
   * @returns Promise<Song[]> - Danh sách bài hát yêu thích
   */
  async getFavoriteSongs(): Promise<Song[]> {
    if (!this.isDbReady) return [];

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const allSongs = await this.indexedDB.getAll('songs');
        const favorites = allSongs.filter(song => song.isFavorite === 1);
        // Sắp xếp theo addedDate DESC
        favorites.sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime());
        return await this.mapRowsToSongs(favorites);
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return [];
        const result = await this.db.query(
          'SELECT * FROM songs WHERE isFavorite = 1 ORDER BY addedDate DESC'
        );
        return await this.mapRowsToSongs(result.values || []);
      }
    } catch (error) {
      console.error('Error getting favorite songs:', error);
      return [];
    }
  }
  /**
   * Lấy danh sách bài hát nghe gần đây
   * @param limit - Giới hạn số lượng bài hát (mặc định 50)
   * @returns Promise<Song[]> - Danh sách bài hát nghe gần đây
   */
  async getRecentlyPlayedSongs(limit: number = 50): Promise<Song[]> {
    if (!this.isDbReady) return [];

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const recentlyPlayed = await this.indexedDB.getAll('recently_played');
        const allSongs = await this.indexedDB.getAll('songs');

        // Sắp xếp theo playedAt DESC
        recentlyPlayed.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

        // Lấy unique songs và limit
        const uniqueSongIds = new Set<string>();
        const recentSongs: any[] = [];

        for (const playedItem of recentlyPlayed) {
          if (!uniqueSongIds.has(playedItem.songId) && recentSongs.length < limit) {
            const song = allSongs.find(s => s.id === playedItem.songId);
            if (song) {
              uniqueSongIds.add(playedItem.songId);
              recentSongs.push(song);
            }
          }
        }

        return await this.mapRowsToSongs(recentSongs);
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return [];
        const result = await this.db.query(
          `SELECT DISTINCT s.* FROM songs s
           INNER JOIN recently_played rp ON s.id = rp.songId
           ORDER BY rp.playedAt DESC
           LIMIT ?`,
          [limit]
        );
        return await this.mapRowsToSongs(result.values || []);
      }
    } catch (error) {
      console.error('Error getting recently played songs:', error);
      return [];
    }
  }
  /**
   * Đóng kết nối database
   */
  async closeDatabase(): Promise<void> {
    if (this.platform === 'web') {
      // IndexedDB doesn't need explicit closing
      this.isDbReady = false;
    } else {
      // Close SQLite connection for native platforms
      if (this.db) {
        await this.db.close();
        this.db = null;
        this.isDbReady = false;
      }
    }
  }
  /**
   * Lưu thông tin bài hát vào lịch sử tìm kiếm (ngay sau khi gọi API thành công)
   * @param youtubeData - Data từ YouTube API response
   */
  async addToSearchHistory(youtubeData: DataSong): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const historyData = {
          songId: youtubeData.id,
          title: youtubeData.title,
          artist: youtubeData.artist,
          thumbnail_url: youtubeData.thumbnail_url,
          audio_url: youtubeData.audio_url,
          duration: youtubeData.duration || 0,
          duration_formatted: youtubeData.duration_formatted,
          keywords: JSON.stringify(youtubeData.keywords || []),
          searchedAt: new Date().toISOString(),
          isDownloaded: 0
        };        // For IndexedDB, put will update existing record with same songId or create new one
        const success = await this.indexedDB.put('search_history', historyData);

        if (success) {
          // Limit search history to 100 items for web platform
          const allHistory = await this.indexedDB.getAll('search_history');
          if (allHistory.length > 100) {
            // Sort by searchedAt and keep only the newest 100
            allHistory.sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());
            const toRemove = allHistory.slice(100);

            // Remove old items
            for (const item of toRemove) {
              await this.indexedDB.delete('search_history', item.songId);
            }
          }
        }

        return success;
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return false;

        // Kiểm tra xem bài hát đã có trong lịch sử chưa
        const existing = await this.db.query(
          'SELECT id FROM search_history WHERE songId = ?',
          [youtubeData.id]
        );

        if (existing.values && existing.values.length > 0) {
          // Cập nhật thời gian tìm kiếm mới nhất
          await this.db.run(
            'UPDATE search_history SET searchedAt = ? WHERE songId = ?',
            [new Date().toISOString(), youtubeData.id]
          );
        } else {
          // Thêm mới vào lịch sử
          await this.db.run(
            `INSERT INTO search_history
             (songId, title, artist, thumbnail_url, audio_url, duration,
              duration_formatted, keywords, searchedAt, isDownloaded)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              youtubeData.id,
              youtubeData.title,
              youtubeData.artist,
              youtubeData.thumbnail_url,
              youtubeData.audio_url,
              youtubeData.duration || 0,
              youtubeData.duration_formatted,
              JSON.stringify(youtubeData.keywords || []),
              new Date().toISOString()
            ]
          );
        }

        // Giới hạn số lượng lịch sử (giữ lại 100 bài gần nhất)
        await this.db.run(
          `DELETE FROM search_history
           WHERE id NOT IN (
             SELECT id FROM search_history
             ORDER BY searchedAt DESC
             LIMIT 100
           )`
        );
        return true;
      }
    } catch (error) {
      console.error('Error adding to search history:', error);
      return false;
    }
  }
  /**
   * Lấy danh sách lịch sử tìm kiếm (để hiển thị trên UI)
   * @param limit - Giới hạn số lượng (mặc định 50)
   * @returns Promise<SearchHistoryItem[]>
   */
  async getSearchHistory(limit: number = 50): Promise<SearchHistoryItem[]> {
    if (!this.isDbReady) return [];

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const rows = await this.indexedDB.getAll('search_history');
        // Sắp xếp theo searchedAt DESC và giới hạn số lượng
        rows.sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());
        const limitedRows = rows.slice(0, limit);

        return limitedRows.map(row => ({
          id: row.id,
          songId: row.songId,
          title: row.title,
          artist: row.artist,
          thumbnail_url: row.thumbnail_url,
          audio_url: row.audio_url,
          duration: row.duration,
          duration_formatted: row.duration_formatted,
          keywords: JSON.parse(row.keywords || '[]'),
          searchedAt: new Date(row.searchedAt),
          isDownloaded: row.isDownloaded === 1
        }));
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return [];

        const result = await this.db.query(
          'SELECT * FROM search_history ORDER BY searchedAt DESC LIMIT ?',
          [limit]
        );

        return (result.values || []).map(row => ({
          id: row.id,
          songId: row.songId,
          title: row.title,
          artist: row.artist,
          thumbnail_url: row.thumbnail_url,
          audio_url: row.audio_url,
          duration: row.duration,
          duration_formatted: row.duration_formatted,
          keywords: JSON.parse(row.keywords || '[]'),
          searchedAt: new Date(row.searchedAt),
          isDownloaded: row.isDownloaded === 1
        }));
      }
    } catch (error) {
      console.error('Error getting search history:', error);
      return [];
    }
  }
  /**
   * Tìm kiếm trong lịch sử theo tên bài hát hoặc nghệ sĩ
   * @param query - Từ khóa tìm kiếm
   * @returns Promise<SearchHistoryItem[]>
   */
  async searchInHistory(query: string): Promise<SearchHistoryItem[]> {
    if (!this.isDbReady || !query.trim()) return [];

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const allHistory = await this.indexedDB.getAll('search_history');
        const filtered = allHistory.filter(item =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.artist.toLowerCase().includes(query.toLowerCase())
        );
        // Sắp xếp theo searchedAt DESC
        filtered.sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());

        return filtered.map(row => ({
          id: row.id,
          songId: row.songId,
          title: row.title,
          artist: row.artist,
          thumbnail_url: row.thumbnail_url,
          audio_url: row.audio_url,
          duration: row.duration,
          duration_formatted: row.duration_formatted,
          keywords: JSON.parse(row.keywords || '[]'),
          searchedAt: new Date(row.searchedAt),
          isDownloaded: row.isDownloaded === 1
        }));
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return [];
        const result = await this.db.query(
          `SELECT * FROM search_history
           WHERE title LIKE ? OR artist LIKE ?
           ORDER BY searchedAt DESC`,
          [`%${query}%`, `%${query}%`]
        );

        return (result.values || []).map(row => ({
          id: row.id,
          songId: row.songId,
          title: row.title,
          artist: row.artist,
          thumbnail_url: row.thumbnail_url,
          audio_url: row.audio_url,
          duration: row.duration,
          duration_formatted: row.duration_formatted,
          keywords: JSON.parse(row.keywords || '[]'),
          searchedAt: new Date(row.searchedAt),
          isDownloaded: row.isDownloaded === 1
        }));
      }
    } catch (error) {
      console.error('Error searching in history:', error);
      return [];
    }
  }
  /**
   * Lấy bài hát từ lịch sử theo ID
   * @param songId - ID của bài hát
   * @returns Promise<SearchHistoryItem | null>
   */
  async getSearchHistoryItem(songId: string): Promise<SearchHistoryItem | null> {
    if (!this.isDbReady) return null;

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const allHistory = await this.indexedDB.getAll('search_history');
        const item = allHistory.find(h => h.songId === songId);

        if (!item) return null;

        return {
          id: item.id,
          songId: item.songId,
          title: item.title,
          artist: item.artist,
          thumbnail_url: item.thumbnail_url,
          audio_url: item.audio_url,
          duration: item.duration,
          duration_formatted: item.duration_formatted,
          keywords: JSON.parse(item.keywords || '[]'),
          searchedAt: new Date(item.searchedAt),
          isDownloaded: item.isDownloaded === 1
        };
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return null;
        const result = await this.db.query(
          'SELECT * FROM search_history WHERE songId = ?',
          [songId]
        );

        if (!result.values || result.values.length === 0) return null;

        const row = result.values[0];
        return {
          id: row.id,
          songId: row.songId,
          title: row.title,
          artist: row.artist,
          thumbnail_url: row.thumbnail_url,
          audio_url: row.audio_url,
          duration: row.duration,
          duration_formatted: row.duration_formatted,
          keywords: JSON.parse(row.keywords || '[]'),
          searchedAt: new Date(row.searchedAt),
          isDownloaded: row.isDownloaded === 1
        };
      }
    } catch (error) {
      console.error('Error getting search history item:', error);
      return null;
    }
  }
  /**
   * Đánh dấu bài hát đã được download
   * @param songId - ID của bài hát
   */
  async markAsDownloaded(songId: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const allHistory = await this.indexedDB.getAll('search_history');
        const item = allHistory.find(h => h.songId === songId);
        if (item) {
          item.isDownloaded = 1;
          await this.indexedDB.put('search_history', item);
        }
        return true;
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return false;
        await this.db.run(
          'UPDATE search_history SET isDownloaded = 1 WHERE songId = ?',
          [songId]
        );
        return true;
      }
    } catch (error) {
      console.error('Error marking as downloaded:', error);
      return false;
    }
  }
  /**
   * Lấy danh sách bài hát đã download từ lịch sử
   * @returns Promise<SearchHistoryItem[]>
   */
  async getDownloadedFromHistory(): Promise<SearchHistoryItem[]> {
    if (!this.isDbReady) return [];

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const allHistory = await this.indexedDB.getAll('search_history');
        const downloaded = allHistory.filter(item => item.isDownloaded === 1);
        // Sắp xếp theo searchedAt DESC
        downloaded.sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());

        return downloaded.map(row => ({
          id: row.id,
          songId: row.songId,
          title: row.title,
          artist: row.artist,
          thumbnail_url: row.thumbnail_url,
          audio_url: row.audio_url,
          duration: row.duration,
          duration_formatted: row.duration_formatted,
          keywords: JSON.parse(row.keywords || '[]'),
          searchedAt: new Date(row.searchedAt),
          isDownloaded: true
        }));
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return [];
        const result = await this.db.query(
          'SELECT * FROM search_history WHERE isDownloaded = 1 ORDER BY searchedAt DESC'
        );

        return (result.values || []).map(row => ({
          id: row.id,
          songId: row.songId,
          title: row.title,
          artist: row.artist,
          thumbnail_url: row.thumbnail_url,
          audio_url: row.audio_url,
          duration: row.duration,
          duration_formatted: row.duration_formatted,
          keywords: JSON.parse(row.keywords || '[]'),
          searchedAt: new Date(row.searchedAt),
          isDownloaded: true
        }));
      }
    } catch (error) {
      console.error('Error getting downloaded from history:', error);
      return [];
    }
  }
  /**
   * Xóa một bài hát khỏi lịch sử
   * @param songId - ID của bài hát
   */
  async deleteFromSearchHistory(songId: string): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const allHistory = await this.indexedDB.getAll('search_history');
        const filtered = allHistory.filter(item => item.songId !== songId);

        // Clear and re-populate the store
        await this.indexedDB.clear('search_history');
        for (const item of filtered) {
          await this.indexedDB.put('search_history', item);
        }
        return true;
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return false;
        await this.db.run('DELETE FROM search_history WHERE songId = ?', [songId]);
        return true;
      }
    } catch (error) {
      console.error('Error deleting from search history:', error);
      return false;
    }
  }
  /**
   * Xóa toàn bộ lịch sử tìm kiếm
   */
  async clearSearchHistory(): Promise<boolean> {
    if (!this.isDbReady) return false;

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        await this.indexedDB.clear('search_history');
        return true;
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return false;
        await this.db.run('DELETE FROM search_history');
        return true;
      }
    } catch (error) {
      console.error('Error clearing search history:', error);
      return false;
    }
  }
  /**
   * Lấy thống kê lịch sử tìm kiếm
   */
  async getSearchHistoryStats(): Promise<{
    totalSongs: number;
    downloadedSongs: number;
    pendingSongs: number;
  }> {
    if (!this.isDbReady) {
      return { totalSongs: 0, downloadedSongs: 0, pendingSongs: 0 };
    }

    try {
      if (this.platform === 'web') {
        // Sử dụng IndexedDB cho web
        const allHistory = await this.indexedDB.getAll('search_history');
        const totalSongs = allHistory.length;
        const downloadedSongs = allHistory.filter(item => item.isDownloaded === 1).length;
        const pendingSongs = allHistory.filter(item => item.isDownloaded === 0).length;

        return {
          totalSongs,
          downloadedSongs,
          pendingSongs
        };
      } else {
        // Sử dụng SQLite cho native
        if (!this.db) return { totalSongs: 0, downloadedSongs: 0, pendingSongs: 0 };

        const result = await this.db.query(
          `SELECT
             COUNT(*) as totalSongs,
             SUM(CASE WHEN isDownloaded = 1 THEN 1 ELSE 0 END) as downloadedSongs,
             SUM(CASE WHEN isDownloaded = 0 THEN 1 ELSE 0 END) as pendingSongs
           FROM search_history`
        );

        const stats = result.values?.[0];
        return {
          totalSongs: stats?.totalSongs || 0,
          downloadedSongs: stats?.downloadedSongs || 0,
          pendingSongs: stats?.pendingSongs || 0
        };
      }
    } catch (error) {
      console.error('Error getting search history stats:', error);
      return { totalSongs: 0, downloadedSongs: 0, pendingSongs: 0 };
    }
  }

  // === UTILITY METHODS ===

  /**
   * Chuyển đổi SearchHistoryItem thành Song object (để add vào thư viện)
   * @param historyItem - Item từ lịch sử tìm kiếm
   * @returns Song object
   */
  searchHistoryToSong(historyItem: SearchHistoryItem): Song {
    return {
      id: historyItem.songId,
      title: historyItem.title,
      artist: historyItem.artist,
      album: undefined,
      duration: historyItem.duration,
      duration_formatted: historyItem.duration_formatted,
      thumbnail: historyItem.thumbnail_url,
      audioUrl: historyItem.audio_url,
      filePath: undefined, // Sẽ được set sau khi download
      addedDate: new Date(),
      isFavorite: false,
      genre: this.extractGenreFromKeywords(historyItem.keywords) || undefined
    };
  }

  /**
   * Thêm bài hát từ lịch sử vào thư viện chính
   * @param songId - ID của bài hát trong lịch sử
   * @returns Promise<boolean>
   */
  async addSongFromHistory(songId: string): Promise<boolean> {
    try {
      const historyItem = await this.getSearchHistoryItem(songId);
      if (!historyItem) return false;

      const song = this.searchHistoryToSong(historyItem);
      const success = await this.addSong(song);

      if (success) {
        // Đánh dấu đã download trong lịch sử
        await this.markAsDownloaded(songId);
      }

      return success;
    } catch (error) {
      console.error('Error adding song from history:', error);
      return false;
    }
  }

  /**
   * Trích xuất genre từ keywords
   * @param keywords - Mảng từ khóa
   * @returns string hoặc undefined
   */
  private extractGenreFromKeywords(keywords: string[]): string | undefined {
    if (!keywords || keywords.length === 0) return undefined;

    const genreMap: Record<string, string> = {
      'remix': 'Remix',
      'acoustic': 'Acoustic',
      'live': 'Live',
      'cover': 'Cover',
      'piano': 'Piano',
      'guitar': 'Guitar',
      'ballad': 'Ballad',
      'rap': 'Rap',
      'hip hop': 'Hip Hop',
      'pop': 'Pop',
      'rock': 'Rock',
      'jazz': 'Jazz',
      'blues': 'Blues',
      'country': 'Country',
      'classical': 'Classical',
      'electronic': 'Electronic',
      'dance': 'Dance',
      'house': 'House',
      'techno': 'Techno',
      'tiktok': 'TikTok Hit',
      'trending': 'Trending'
    };

    for (const keyword of keywords) {
      const lower = keyword.toLowerCase();
      for (const [key, genre] of Object.entries(genreMap)) {
        if (lower.includes(key)) {
          return genre;
        }
      }
    }

    return undefined;
  }
}
