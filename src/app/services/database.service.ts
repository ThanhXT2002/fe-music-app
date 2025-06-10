import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { Song, Album, Artist, Playlist, SearchHistoryItem, DataSong } from '../interfaces/song.interface';

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
  // Trạng thái sẵn sàng của database
  private isDbReady = false;

  constructor() {
    // Khởi tạo database khi service được tạo
    this.initializeDatabase();
  }
  /**
   * Khởi tạo cơ sở dữ liệu và tạo các bảng cần thiết
   */
  async initializeDatabase() {
    try {
      console.log('🚀 Starting database initialization...');
      console.log('Platform:', Capacitor.getPlatform());

      // Khởi tạo web store nếu chạy trên web platform
      if (Capacitor.getPlatform() === 'web') {
        console.log('📱 Web platform detected, initializing web store...');
        await this.sqlite.initWebStore();
      }

      console.log('🔗 Creating database connection...');
      // Tạo kết nối database với tên 'xtmusic_db'
      this.db = await this.sqlite.createConnection(
        DB_XTMUSIC,
        false, // không mã hóa
        'no-encryption',
        1, // phiên bản database
        false
      );

      console.log('🔓 Opening database...');
      // Mở kết nối database
      await this.db.open();

      console.log('🏗️ Creating tables...');
      // Tạo các bảng cần thiết
      await this.createTables();
      this.isDbReady = true;
      console.log('✅ Database initialized successfully');
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

    const queries = [
      `CREATE TABLE IF NOT EXISTS songs (
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
        genre TEXT
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
    if (!this.db || !this.isDbReady) return false;

    try {
      await this.db.run(
        `INSERT OR REPLACE INTO songs
         (id, title, artist, album, duration, duration_formatted, thumbnail_url, audioUrl, filePath,
          addedDate, isFavorite, genre)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          song.isFavorite ? 1 : 0, // Chuyển boolean thành integer
          song.genre || null
        ]
      );
      return true;
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
    if (!this.db || !this.isDbReady) return [];

    try {
      const result = await this.db.query('SELECT * FROM songs ORDER BY addedDate DESC');
      return this.mapRowsToSongs(result.values || []);
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
    if (!this.db || !this.isDbReady) return null;

    try {
      const result = await this.db.query('SELECT * FROM songs WHERE id = ?', [id]);
      const songs = this.mapRowsToSongs(result.values || []);
      return songs.length > 0 ? songs[0] : null;
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
    if (!this.db || !this.isDbReady) return [];

    try {
      const result = await this.db.query(
        `SELECT * FROM songs
         WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
         ORDER BY title ASC`,
        [`%${query}%`, `%${query}%`, `%${query}%`]
      );
      return this.mapRowsToSongs(result.values || []);
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
    if (!this.db || !this.isDbReady) return;

    try {
      // Chỉ thêm vào danh sách nghe gần đây
      await this.db.run(
        'INSERT INTO recently_played (songId, playedAt) VALUES (?, ?)',
        [songId, new Date().toISOString()]
      );
    } catch (error) {
      console.error('Error adding to recently played:', error);
    }
  }

  /**
   * Chuyển đổi dữ liệu từ database rows thành đối tượng Song
   * @param rows - Mảng các row từ database
   * @returns Song[] - Mảng các đối tượng Song
   */
  private mapRowsToSongs(rows: any[]): Song[] {
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      duration_formatted: row.duration_formatted,
      thumbnail: row.thumbnail_url, // Sử dụng đúng tên cột trong database
      audioUrl: row.audioUrl,
      filePath: row.filePath,
      addedDate: new Date(row.addedDate),
      isFavorite: row.isFavorite === 1, // Chuyển integer thành boolean
      genre: row.genre,
    }));
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
    if (!this.db || !this.isDbReady) return false;

    try {
      // Xóa dữ liệu từ tất cả các bảng
      await this.db.run('DELETE FROM songs');
      await this.db.run('DELETE FROM albums');
      await this.db.run('DELETE FROM artists');
      await this.db.run('DELETE FROM playlists');
      await this.db.run('DELETE FROM playlist_songs');
      await this.db.run('DELETE FROM recently_played');

      console.log('All data cleared successfully');
      return true;
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
    if (!this.db || !this.isDbReady) return [];

    try {
      const result = await this.db.query('SELECT * FROM playlists ORDER BY name');
      return this.mapRowsToPlaylists(result.values || []);
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
    if (!this.db || !this.isDbReady) return false;

    try {
      const song = await this.getSongById(songId);
      if (!song) return false;

      const newFavoriteStatus = !song.isFavorite;
      await this.db.run(
        'UPDATE songs SET isFavorite = ? WHERE id = ?',
        [newFavoriteStatus ? 1 : 0, songId]
      );

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
    if (!this.db || !this.isDbReady) return [];

    try {
      const result = await this.db.query(
        'SELECT * FROM songs WHERE isFavorite = 1 ORDER BY addedDate DESC'
      );
      return this.mapRowsToSongs(result.values || []);
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
    if (!this.db || !this.isDbReady) return [];

    try {
      const result = await this.db.query(
        `SELECT DISTINCT s.* FROM songs s
         INNER JOIN recently_played rp ON s.id = rp.songId
         ORDER BY rp.playedAt DESC
         LIMIT ?`,
        [limit]
      );
      return this.mapRowsToSongs(result.values || []);
    } catch (error) {
      console.error('Error getting recently played songs:', error);
      return [];
    }
  }

  /**
   * Đóng kết nối database
   */
  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isDbReady = false;
    }
  }

  /**
   * Lưu thông tin bài hát vào lịch sử tìm kiếm (ngay sau khi gọi API thành công)
   * @param youtubeData - Data từ YouTube API response
   */
  async addToSearchHistory(youtubeData: DataSong): Promise<boolean> {
    if (!this.db || !this.isDbReady) return false;

    try {
      console.log('Adding to search history:', youtubeData);
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
    if (!this.db || !this.isDbReady) return [];

    try {
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
    if (!this.db || !this.isDbReady || !query.trim()) return [];

    try {
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
    if (!this.db || !this.isDbReady) return null;

    try {
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
    if (!this.db || !this.isDbReady) return false;

    try {
      await this.db.run(
        'UPDATE search_history SET isDownloaded = 1 WHERE songId = ?',
        [songId]
      );
      return true;
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
    if (!this.db || !this.isDbReady) return [];

    try {
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
    if (!this.db || !this.isDbReady) return false;

    try {
      await this.db.run('DELETE FROM search_history WHERE songId = ?', [songId]);
      return true;
    } catch (error) {
      console.error('Error deleting from search history:', error);
      return false;
    }
  }

  /**
   * Xóa toàn bộ lịch sử tìm kiếm
   */
  async clearSearchHistory(): Promise<boolean> {
    if (!this.db || !this.isDbReady) return false;

    try {
      await this.db.run('DELETE FROM search_history');
      console.log('Search history cleared successfully');
      return true;
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
    if (!this.db || !this.isDbReady) {
      return { totalSongs: 0, downloadedSongs: 0, pendingSongs: 0 };
    }

    try {
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
