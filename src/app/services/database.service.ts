import { Injectable } from '@angular/core';
import { Song, SearchHistoryItem, Playlist } from '../interfaces/song.interface';
import { IndexedDBService } from './indexeddb.service';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private indexedDB: IndexedDBService;
  private isDbReady = false;
  private isInitializing = false;

  constructor(indexedDBService: IndexedDBService) {
    this.indexedDB = indexedDBService;
  }

  async initializeDatabase() {
    if (this.isInitializing || this.isDbReady) {
      return;
    }

    this.isInitializing = true;

    try {
      await this.indexedDB.initDB();
      this.isDbReady = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      this.isDbReady = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private async ensureReady(): Promise<void> {
    if (!this.isDbReady) {
      await this.initializeDatabase();
    }
  }

  isReady(): boolean {
    return this.isDbReady && this.indexedDB.isReady();
  }

  async addSong(song: Song): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('songs', song);
    } catch (error) {
      console.error('Error adding song:', error);
      return false;
    }
  }

  async getAllSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAll('songs');
    } catch (error) {
      console.error('Error getting all songs:', error);
      return [];
    }
  }

  async getSongById(id: string): Promise<Song | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.get('songs', id);
    } catch (error) {
      console.error('Error getting song by ID:', error);
      return null;
    }
  }

  async updateSong(song: Song): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('songs', song);
    } catch (error) {
      console.error('Error updating song:', error);
      return false;
    }
  }

  async deleteSong(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.delete('songs', songId);
    } catch (error) {
      console.error('Error deleting song:', error);
      return false;
    }
  }

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
      console.error('Error toggling favorite:', error);
      return false;
    }
  }
  async addSearchHistory(item: SearchHistoryItem): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('search_history', item);
    } catch (error) {
      console.error('Error adding to search history:', error);
      return false;
    }
  }

  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAll('search_history');
    } catch (error) {
      console.error('Error getting search history:', error);
      return [];
    }
  }

  async clearSearchHistory(): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.clear('search_history');
    } catch (error) {
      console.error('Error clearing search history:', error);
      return false;
    }
  }

  async addPlaylist(playlist: Playlist): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('playlists', playlist);
    } catch (error) {
      console.error('Error adding playlist:', error);
      return false;
    }
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAll('playlists');
    } catch (error) {
      console.error('Error getting all playlists:', error);
      return [];
    }
  }

  async getPlaylistById(id: string): Promise<Playlist | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.get('playlists', id);
    } catch (error) {
      console.error('Error getting playlist by ID:', error);
      return null;
    }
  }

  async updatePlaylist(playlist: Playlist): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('playlists', playlist);
    } catch (error) {
      console.error('Error updating playlist:', error);
      return false;
    }
  }

  async deletePlaylist(playlistId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.delete('playlists', playlistId);
    } catch (error) {
      console.error('Error deleting playlist:', error);
      return false;
    }
  }  async storeThumbnailFile(songId: string, file: Blob): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.saveThumbnailFile(songId, file, file.type);
    } catch (error) {
      console.error('Error storing thumbnail file:', error);
      return false;
    }
  }

  async saveThumbnailBlob(songId: string, file: Blob): Promise<boolean> {
    return await this.storeThumbnailFile(songId, file);
  }
  async getThumbnailFile(songId: string): Promise<Blob | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getThumbnailFile(songId);
    } catch (error) {
      console.error('Error getting thumbnail file:', error);
      return null;
    }
  }

  async getThumbnailBlob(songId: string): Promise<Blob | null> {
    return await this.getThumbnailFile(songId);
  }
  async storeAudioFile(songId: string, file: Blob): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.saveAudioFile(songId, file, file.type);
    } catch (error) {
      console.error('Error storing audio file:', error);
      return false;
    }
  }

  async getAudioFile(songId: string): Promise<Blob | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAudioFile(songId);
    } catch (error) {
      console.error('Error getting audio file:', error);
      return null;
    }
  }

  async deleteAudioFile(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.deleteAudioFile(songId);
    } catch (error) {
      console.error('Error deleting audio file:', error);
      return false;
    }
  }
  async deleteThumbnailFile(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.deleteThumbnailFile(songId);
    } catch (error) {
      console.error('Error deleting thumbnail file:', error);
      return false;
    }
  }
  async getDownloadedSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      const songs = await this.getAllSongs();
      const downloadedSongs: Song[] = [];

      for (const song of songs) {
        const audioFile = await this.getAudioFile(song.id);
        if (audioFile) {
          downloadedSongs.push(song);
        }
      }

      return downloadedSongs;
    } catch (error) {
      console.error('Error getting downloaded songs:', error);
      return [];
    }
  }

  async getAllThumbnails(): Promise<any[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAll('thumbnailFiles');
    } catch (error) {
      console.error('Error getting all thumbnails:', error);
      return [];
    }
  }

  async searchSongs(query: string): Promise<Song[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.search('songs', 'title', query);
    } catch (error) {
      console.error('Error searching songs:', error);
      return [];
    }
  }

  async getFavoriteSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      const songs = await this.getAllSongs();
      return songs.filter(song => song.isFavorite === true);
    } catch (error) {
      console.error('Error getting favorite songs:', error);
      return [];
    }
  }

  async getRecentlyPlayed(limit: number = 50): Promise<Song[]> {
    await this.ensureReady();
    try {
      const history = await this.getSearchHistory();
      const sortedHistory = history.sort((a, b) =>
        new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime()
      );
      const recentSongIds = sortedHistory.slice(0, limit).map(item => item.songId);
      const songs: Song[] = [];

      for (const songId of recentSongIds) {
        const song = await this.getSongById(songId);
        if (song) {
          songs.push(song);
        }
      }

      return songs;
    } catch (error) {
      console.error('Error getting recently played songs:', error);
      return [];
    }
  }

  async getDatabaseStats(): Promise<any> {
    await this.ensureReady();
    try {
      const songs = await this.getAllSongs();
      const playlists = await this.getAllPlaylists();
      const history = await this.getSearchHistory();
      const thumbnails = await this.getAllThumbnails();

      return {
        totalSongs: songs.length,
        totalPlaylists: playlists.length,
        totalSearchHistory: history.length,
        totalThumbnails: thumbnails.length,
        favoriteSongs: songs.filter(s => s.isFavorite).length
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {};
    }
  }

  async clearDatabase(): Promise<boolean> {
    await this.ensureReady();
    try {
      await this.indexedDB.clear('songs');
      await this.indexedDB.clear('search_history');
      await this.indexedDB.clear('playlists');
      await this.indexedDB.clear('thumbnailFiles');
      await this.indexedDB.clear('audioFiles');
      return true;
    } catch (error) {
      console.error('Error clearing database:', error);
      return false;
    }
  }
}
