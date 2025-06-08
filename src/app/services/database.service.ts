import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { Song, Album, Artist, Playlist } from '../interfaces/song.interface';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private isDbReady = false;

  constructor() {
    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      if (Capacitor.getPlatform() === 'web') {
        await this.sqlite.initWebStore();
      }

      this.db = await this.sqlite.createConnection(
        'xtmusic_db',
        false,
        'no-encryption',
        1,
        false
      );

      await this.db.open();
      await this.createTables();
      this.isDbReady = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  private async createTables() {
    if (!this.db) return;

    const queries = [
      // Songs table
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
        playCount INTEGER DEFAULT 0,
        isFavorite INTEGER DEFAULT 0,
        genre TEXT
      );`,

      // Albums table
      `CREATE TABLE IF NOT EXISTS albums (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        artist TEXT NOT NULL,
        thumbnail TEXT,
        year INTEGER,
        genre TEXT,
        totalDuration INTEGER DEFAULT 0
      );`,

      // Artists table
      `CREATE TABLE IF NOT EXISTS artists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        thumbnail TEXT,
        totalSongs INTEGER DEFAULT 0,
        bio TEXT
      );`,

      // Playlists table
      `CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        thumbnail TEXT,
        isSystemPlaylist INTEGER DEFAULT 0,
        createdDate TEXT NOT NULL,
        updatedDate TEXT NOT NULL
      );`,

      // Playlist songs junction table
      `CREATE TABLE IF NOT EXISTS playlist_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlistId TEXT NOT NULL,
        songId TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
      );`,

      // User preferences table
      `CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,

      // Recently played table
      `CREATE TABLE IF NOT EXISTS recently_played (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        songId TEXT NOT NULL,
        playedAt TEXT NOT NULL,
        FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
      );`
    ];

    for (const query of queries) {
      await this.db.execute(query);
    }

    // Create default system playlists
    await this.createSystemPlaylists();
  }

  private async createSystemPlaylists() {
    if (!this.db) return;

    const systemPlaylists = [
      { id: 'favorites', name: 'Yêu thích', description: 'Các bài hát yêu thích' },
      { id: 'recent', name: 'Nghe gần đây', description: 'Bài hát đã nghe gần đây' }
    ];

    for (const playlist of systemPlaylists) {
      const exists = await this.db.query(
        'SELECT id FROM playlists WHERE id = ?',
        [playlist.id]
      );

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

  // Song operations
  async addSong(song: Song): Promise<boolean> {
    if (!this.db || !this.isDbReady) return false;

    try {
      await this.db.run(
        `INSERT OR REPLACE INTO songs
         (id, title, artist, album, duration,duration_formatted, thumbnail, audioUrl, filePath,
          addedDate, playCount, isFavorite, genre)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`,
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
          song.playCount,
          song.isFavorite ? 1 : 0,
          song.genre || null,
        ]
      );
      return true;
    } catch (error) {
      console.error('Error adding song:', error);
      return false;
    }
  }

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

  async searchSongs(query: string): Promise<Song[]> {
    if (!this.db || !this.isDbReady) return [];

    try {
      const result = await this.db.query(
        `SELECT * FROM songs
         WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
         ORDER BY playCount DESC`,
        [`%${query}%`, `%${query}%`, `%${query}%`]
      );
      return this.mapRowsToSongs(result.values || []);
    } catch (error) {
      console.error('Error searching songs:', error);
      return [];
    }
  }

  async updateSongPlayCount(songId: string): Promise<void> {
    if (!this.db || !this.isDbReady) return;

    try {
      await this.db.run(
        'UPDATE songs SET playCount = playCount + 1 WHERE id = ?',
        [songId]
      );

      // Add to recently played
      await this.db.run(
        'INSERT INTO recently_played (songId, playedAt) VALUES (?, ?)',
        [songId, new Date().toISOString()]
      );
    } catch (error) {
      console.error('Error updating play count:', error);
    }
  }

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

  private mapRowsToSongs(rows: any[]): Song[] {
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      thumbnail: row.thumbnail,
      audioUrl: row.audioUrl,
      filePath: row.filePath,
      addedDate: new Date(row.addedDate),
      playCount: row.playCount,
      isFavorite: row.isFavorite === 1,
      genre: row.genre,
    }));
  }

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

  async clearAllData(): Promise<boolean> {
    if (!this.db || !this.isDbReady) return false;

    try {
      // Clear all tables
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
  private mapRowsToPlaylists(rows: any[]): Playlist[] {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      thumbnail: row.thumbnail,
      isSystemPlaylist: row.isSystemPlaylist === 1,
      createdDate: new Date(row.createdDate),
      updatedDate: new Date(row.updatedDate),
      songs: [] // Songs will be loaded separately if needed
    }));
  }

  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isDbReady = false;
    }
  }
}
