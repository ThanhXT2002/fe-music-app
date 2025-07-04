import { Injectable } from '@angular/core';
import {
  Playlist,
  SystemPlaylist,
  CreatePlaylistRequest,
  PlaylistStats,
  PlaylistExport
} from '../interfaces/playlist.interface';
import { Song } from '../interfaces/song.interface';
import { DatabaseService } from './database.service';

/**
 * Service quản lý playlist operations
 * Handles CRUD operations for playlists
 */
@Injectable({
  providedIn: 'root'
})
export class PlaylistService {

  constructor(private databaseService: DatabaseService) {}

  /**
   * Tạo playlist mới
   */
  async createPlaylist(request: CreatePlaylistRequest): Promise<Playlist | null> {
    try {
      const playlist: Playlist = {
        id: this.generatePlaylistId(),
        name: request.name,
        description: request.description || '',
        thumbnail: request.thumbnail,
        songs: [],
        isSystemPlaylist: request.type === 'system',
        createdDate: new Date(),
        updatedDate: new Date()
      };

      const success = await this.databaseService.addPlaylist(playlist);
      return success ? playlist : null;
    } catch (error) {
      console.error('Error creating playlist:', error);
      return null;
    }
  }

  /**
   * Lấy playlist theo ID
   */
  async getPlaylistById(id: string): Promise<Playlist | null> {
    try {
      return await this.databaseService.getPlaylistById(id);
    } catch (error) {
      console.error('Error getting playlist by id:', error);
      return null;
    }
  }

  /**
   * Lấy tất cả playlists
   */
  async getAllPlaylists(): Promise<Playlist[]> {
    try {
      return await this.databaseService.getAllPlaylists();
    } catch (error) {
      console.error('Error getting all playlists:', error);
      return [];
    }
  }

  /**
   * Lấy playlists theo type
   */
  async getPlaylistsByType(type: 'system' | 'user' | 'dynamic'): Promise<Playlist[]> {
    try {
      const allPlaylists = await this.getAllPlaylists();

      if (type === 'system') {
        return allPlaylists.filter(p => p.isSystemPlaylist);
      } else {
        return allPlaylists.filter(p => !p.isSystemPlaylist);
      }
    } catch (error) {
      console.error('Error getting playlists by type:', error);
      return [];
    }
  }

  /**
   * Thêm bài hát vào playlist
   */
  async addSongToPlaylist(playlistId: string, songId: string): Promise<boolean> {
    try {
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) return false;

      const song = await this.databaseService.getSongById(songId);
      if (!song) return false;

      // Kiểm tra xem bài hát đã có trong playlist chưa
      const existingSong = playlist.songs.find(s => s.id === songId);
      if (existingSong) {
        console.log('Song already exists in playlist');
        return false;
      }

      // Thêm bài hát vào playlist
      playlist.songs.push(song);
      playlist.updatedDate = new Date();

      return await this.databaseService.updatePlaylist(playlist);
    } catch (error) {
      console.error('Error adding song to playlist:', error);
      return false;
    }
  }

  /**
   * Thêm nhiều bài hát vào playlist
   */
  async addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<boolean> {
    try {
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) return false;

      const existingSongIds = new Set(playlist.songs.map(s => s.id));
      const newSongIds = songIds.filter(id => !existingSongIds.has(id));

      if (newSongIds.length === 0) return true;

      // Lấy thông tin các bài hát mới
      const newSongs: Song[] = [];
      for (const songId of newSongIds) {
        const song = await this.databaseService.getSongById(songId);
        if (song) {
          newSongs.push(song);
        }
      }

      // Thêm vào playlist
      playlist.songs.push(...newSongs);
      playlist.updatedDate = new Date();

      return await this.databaseService.updatePlaylist(playlist);
    } catch (error) {
      console.error('Error adding songs to playlist:', error);
      return false;
    }
  }

  /**
   * Xóa bài hát khỏi playlist
   */
  async removeSongFromPlaylist(playlistId: string, songId: string): Promise<boolean> {
    try {
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) return false;

      const initialLength = playlist.songs.length;
      playlist.songs = playlist.songs.filter(song => song.id !== songId);

      if (playlist.songs.length === initialLength) {
        console.log('Song not found in playlist');
        return false;
      }

      playlist.updatedDate = new Date();
      return await this.databaseService.updatePlaylist(playlist);
    } catch (error) {
      console.error('Error removing song from playlist:', error);
      return false;
    }
  }

  /**
   * Cập nhật thông tin playlist
   */
  async updatePlaylistInfo(
    playlistId: string,
    updates: Partial<Pick<Playlist, 'name' | 'description' | 'thumbnail'>>
  ): Promise<boolean> {
    try {
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) return false;

      // Cập nhật thông tin
      if (updates.name !== undefined) playlist.name = updates.name;
      if (updates.description !== undefined) playlist.description = updates.description;
      if (updates.thumbnail !== undefined) playlist.thumbnail = updates.thumbnail;

      playlist.updatedDate = new Date();

      return await this.databaseService.updatePlaylist(playlist);
    } catch (error) {
      console.error('Error updating playlist info:', error);
      return false;
    }
  }

  /**
   * Xóa playlist
   */
  async deletePlaylist(playlistId: string): Promise<boolean> {
    try {
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) return false;

      // Không cho phép xóa system playlists
      if (playlist.isSystemPlaylist) {
        console.error('Cannot delete system playlist');
        return false;
      }

      return await this.databaseService.deletePlaylist(playlistId);
    } catch (error) {
      console.error('Error deleting playlist:', error);
      return false;
    }
  }

  /**
   * Sắp xếp lại thứ tự bài hát trong playlist
   */
  async reorderSongs(playlistId: string, fromIndex: number, toIndex: number): Promise<boolean> {
    try {
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) return false;

      if (fromIndex < 0 || fromIndex >= playlist.songs.length ||
          toIndex < 0 || toIndex >= playlist.songs.length) {
        return false;
      }

      // Di chuyển bài hát
      const [movedSong] = playlist.songs.splice(fromIndex, 1);
      playlist.songs.splice(toIndex, 0, movedSong);

      playlist.updatedDate = new Date();

      return await this.databaseService.updatePlaylist(playlist);
    } catch (error) {
      console.error('Error reordering songs in playlist:', error);
      return false;
    }
  }

  /**
   * Duplicate playlist
   */
  async duplicatePlaylist(playlistId: string, newName?: string): Promise<Playlist | null> {
    try {
      const originalPlaylist = await this.getPlaylistById(playlistId);
      if (!originalPlaylist) return null;

      const duplicatedPlaylist: Playlist = {
        id: this.generatePlaylistId(),
        name: newName || `${originalPlaylist.name} (Copy)`,
        description: originalPlaylist.description,
        thumbnail: originalPlaylist.thumbnail,
        songs: [...originalPlaylist.songs], // Deep copy songs array
        isSystemPlaylist: false, // Duplicated playlists are always user playlists
        createdDate: new Date(),
        updatedDate: new Date()
      };

      const success = await this.databaseService.addPlaylist(duplicatedPlaylist);
      return success ? duplicatedPlaylist : null;
    } catch (error) {
      console.error('Error duplicating playlist:', error);
      return null;
    }
  }

  /**
   * Lấy thống kê playlist
   */
  async getPlaylistStats(): Promise<PlaylistStats> {
    try {
      const allPlaylists = await this.getAllPlaylists();
      const systemPlaylists = allPlaylists.filter(p => p.isSystemPlaylist);
      const userPlaylists = allPlaylists.filter(p => !p.isSystemPlaylist);

      const totalSongs = allPlaylists.reduce((sum, p) => sum + p.songs.length, 0);
      const averageSongsPerPlaylist = allPlaylists.length > 0 ?
        Math.round(totalSongs / allPlaylists.length * 10) / 10 : 0;

      // Tìm playlist phổ biến nhất
      let mostPopularPlaylist = null;
      if (allPlaylists.length > 0) {
        const sortedBySize = [...allPlaylists].sort((a, b) => b.songs.length - a.songs.length);
        const popular = sortedBySize[0];
        mostPopularPlaylist = {
          id: popular.id,
          name: popular.name,
          songCount: popular.songs.length
        };
      }

      return {
        totalPlaylists: allPlaylists.length,
        systemPlaylists: systemPlaylists.length,
        userPlaylists: userPlaylists.length,
        totalSongs,
        averageSongsPerPlaylist,
        mostPopularPlaylist
      };
    } catch (error) {
      console.error('Error getting playlist stats:', error);
      return {
        totalPlaylists: 0,
        systemPlaylists: 0,
        userPlaylists: 0,
        totalSongs: 0,
        averageSongsPerPlaylist: 0,
        mostPopularPlaylist: null
      };
    }
  }

  /**
   * Export playlist
   */
  async exportPlaylist(playlistId: string): Promise<PlaylistExport | null> {
    try {
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) return null;

      return {
        playlist,
        songs: playlist.songs,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };
    } catch (error) {
      console.error('Error exporting playlist:', error);
      return null;
    }
  }

  /**
   * Import playlist
   */
  async importPlaylist(exportData: PlaylistExport): Promise<Playlist | null> {
    try {
      // Tạo playlist mới với ID mới
      const importedPlaylist: Playlist = {
        ...exportData.playlist,
        id: this.generatePlaylistId(),
        isSystemPlaylist: false, // Imported playlists are always user playlists
        createdDate: new Date(),
        updatedDate: new Date()
      };

      const success = await this.databaseService.addPlaylist(importedPlaylist);
      return success ? importedPlaylist : null;
    } catch (error) {
      console.error('Error importing playlist:', error);
      return null;
    }
  }

  /**
   * Tìm kiếm playlists
   */
  async searchPlaylists(query: string): Promise<Playlist[]> {
    try {
      const allPlaylists = await this.getAllPlaylists();
      const searchTerm = query.toLowerCase();

      return allPlaylists.filter(playlist =>
        playlist.name.toLowerCase().includes(searchTerm) ||
        (playlist.description && playlist.description.toLowerCase().includes(searchTerm))
      );
    } catch (error) {
      console.error('Error searching playlists:', error);
      return [];
    }
  }

  /**
   * Generate unique playlist ID
   */
  private generatePlaylistId(): string {
    return `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
