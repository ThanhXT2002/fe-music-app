import { Injectable } from '@angular/core';
import {
  Playlist,
  CreatePlaylistRequest,
  PlaylistStats,
  PlaylistExport
} from '../interfaces/playlist.interface';
import { Song, Album } from '../interfaces/song.interface';
import { DatabaseService } from './database.service';

/**
 * Service quản lý playlist operations
 * Xử lý các thao tác CRUD cho playlists
 */
@Injectable({
  providedIn: 'root'
})
export class PlaylistService {

  constructor(private databaseService: DatabaseService) {}

  // ============================
  // PLAYLIST METHODS
  // ============================

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
   */  async updatePlaylistInfo(
    playlistId: string,
    updates: Partial<Pick<Playlist, 'name' | 'description' | 'thumbnail'>>
  ): Promise<boolean> {
    try {
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) {
        console.error('[PlaylistService] Playlist not found:', playlistId);
        return false;
      }

      // Cập nhật thông tin
      if (updates.name !== undefined) {
        playlist.name = updates.name;
      }
      if (updates.description !== undefined) playlist.description = updates.description;
      if (updates.thumbnail !== undefined) playlist.thumbnail = updates.thumbnail;

      playlist.updatedDate = new Date();

      const success = await this.databaseService.updatePlaylist(playlist);

      return success;
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
        songs: [...originalPlaylist.songs], // Sao chép mảng songs
        isSystemPlaylist: false, // Playlist sao chép luôn là user playlists
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
        isSystemPlaylist: false, // Playlist import luôn là user playlists
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
   * Clear all cache để force reload fresh data
   */
  async clearAllCache(): Promise<void> {
    this.databaseService.clearPlaylistsCache();

    // Tự động migrate dữ liệu cũ nếu cần
    await this.migrateOldArtistPlaylists();
  }

  /**
   * Clear all database data (for debugging)
   */
  async clearAllDatabase(): Promise<boolean> {
    return await this.databaseService.clearAllData();
  }

  /**
   * ✨ Migrate dữ liệu cũ từ marker description sang field mới
   */
  async migrateOldArtistPlaylists(): Promise<void> {
    try {
      const allPlaylists = await this.getAllPlaylists();
      const playlistsToMigrate = allPlaylists.filter(p =>
        !p.isUserCreatedArtistPlaylist &&
        (p.description?.startsWith('__ALBUM__') || p.description?.startsWith('__PLAYLIST__'))
      );

      for (const playlist of playlistsToMigrate) {
        playlist.isUserCreatedArtistPlaylist = true;

        const parts = playlist.description?.split('__') || [];
        if (parts[1] === 'ALBUM' || parts[1] === 'PLAYLIST') {
          const artistName = parts[2] || playlist.name;
          playlist.name = artistName;

          const realDescription = parts.slice(3).join('__');
          playlist.description = realDescription || undefined;
        }

        await this.databaseService.updatePlaylist(playlist);
      }
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }

  // ============================
  // CÁC PHƯƠNG THỨC ARTIST PLAYLIST
  // ============================

  /**
   * Lấy tất cả artist playlists (tự động tạo + do người dùng tạo)
   */
  async getAllArtistPlaylists(): Promise<Album[]> {
    try {
      // Lấy artist playlists tự động tạo từ bài hát
      const autoGeneratedPlaylists = await this.getAutoGeneratedArtistPlaylists();

      // Lấy artist playlists do người dùng tạo
      const userCreatedPlaylists = await this.getUserCreatedArtistPlaylists();

      // Kết hợp và sắp xếp
      const allPlaylists = [...autoGeneratedPlaylists, ...userCreatedPlaylists];
      return this.sortArtistPlaylists(allPlaylists);
    } catch (error) {
      console.error('Error getting all artist playlists:', error);
      return [];
    }
  }

  /**
   * Tự động tạo artist playlists từ bài hát (chỉ đọc)
   */
  private async getAutoGeneratedArtistPlaylists(): Promise<Album[]> {
    try {
      const songs = await this.databaseService.getAllSongs();
      return this.groupSongsIntoArtistPlaylists(songs);
    } catch (error) {
      console.error('Error getting auto-generated artist playlists:', error);
      return [];
    }
  }

  /**
   * Lấy artist playlists do người dùng tạo (lưu dưới dạng playlists)
   */
  private async getUserCreatedArtistPlaylists(): Promise<Album[]> {
    try {
      // Force clear cache trước khi load
      this.databaseService.clearPlaylistsCache();

      // Lấy tất cả playlists với loại 'artist playlist'
      const playlists = await this.getAllPlaylists();

      // ✨ Lọc theo field mới, nhưng vẫn hỗ trợ cả marker cũ để tương thích
      const artistPlaylistPlaylists = playlists.filter(p => {
        return p.isUserCreatedArtistPlaylist;
      });

      return artistPlaylistPlaylists.map(playlist => this.convertPlaylistToArtistPlaylist(playlist));
    } catch (error) {
      console.error('Error getting user-created artist playlists:', error);
      return [];
    }
  }

  /**
   * Tạo artist playlist mới do người dùng tạo (dựa trên artist)
   */
  async createArtistPlaylist(playlistData: {
    name: string; // Tên artist
    description?: string;
    thumbnail?: string;
    songs?: Song[];
  }): Promise<Album | null> {
    try {
      const playlist = await this.createPlaylist({
        name: playlistData.name, // Sử dụng tên artist làm tên playlist
        description: playlistData.description, // ✨ Loại bỏ marker, chỉ dùng description thông thường
        thumbnail: playlistData.thumbnail,
        type: 'user'
      });

      if (playlist) {
        // ✨ Đánh dấu đây là user-created artist playlist
        playlist.isUserCreatedArtistPlaylist = true;
        await this.databaseService.updatePlaylist(playlist);

        // Thêm bài hát nếu có
        if (playlistData.songs && playlistData.songs.length > 0) {
          const songIds = playlistData.songs.map(song => song.id);
          await this.addSongsToPlaylist(playlist.id, songIds);
        }

        return this.convertPlaylistToArtistPlaylist(playlist);
      }
      return null;
    } catch (error) {
      console.error('Error creating artist playlist:', error);
      return null;
    }
  }

  /**
   * Cập nhật artist playlist hiện có (dựa trên artist)
   */
  async updateArtistPlaylist(playlistId: string, updates: Partial<Album>): Promise<boolean> {
    try {
      // Clear cache trước khi update để đảm bảo consistency
      this.databaseService.clearPlaylistsCache();

      // Tìm playlist trong user-created playlists
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) {
        console.error('Playlist not found:', playlistId);
        return false;
      }

      // ✨ Chỉ cho phép cập nhật user-created artist playlists (dùng field mới)
      if (!playlist.isUserCreatedArtistPlaylist) {
        console.error('Cannot update non-user-created artist playlist');
        return false;
      }

      const playlistUpdates: Partial<Pick<Playlist, 'name' | 'description' | 'thumbnail'>> = {
        name: updates.name,
        description: updates.description,
        thumbnail: updates.thumbnail
      };

      const result = await this.updatePlaylistInfo(playlistId, playlistUpdates);

      // Clear cache sau khi update để đảm bảo lần read tiếp theo sẽ fresh
      this.databaseService.clearPlaylistsCache();

      return result;
    } catch (error) {
      console.error('Error updating artist playlist:', error);
      return false;
    }
  }

  /**
   * Xóa artist playlist do người dùng tạo
   */
  async deleteArtistPlaylist(playlistId: string): Promise<boolean> {
    try {
      const playlist = await this.getArtistPlaylistById(playlistId);
      if (!playlist?.isUserCreated) {
        throw new Error('Cannot delete auto-generated artist playlist');
      }

      return await this.deletePlaylist(playlistId);
    } catch (error) {
      console.error('Error deleting artist playlist:', error);
      return false;
    }
  }

  /**
   * Thêm bài hát vào artist playlist
   */
  async addSongToArtistPlaylist(playlistId: string, song: Song): Promise<boolean> {
    try {
      const playlist = await this.getArtistPlaylistById(playlistId);
      if (!playlist?.isUserCreated) {
        throw new Error('Cannot modify auto-generated artist playlist');
      }

      return await this.addSongToPlaylist(playlistId, song.id);
    } catch (error) {
      console.error('Error adding song to artist playlist:', error);
      return false;
    }
  }

  /**
   * Xóa bài hát khỏi artist playlist
   */
  async removeSongFromArtistPlaylist(playlistId: string, songId: string): Promise<boolean> {
    try {
      const playlist = await this.getArtistPlaylistById(playlistId);
      if (!playlist?.isUserCreated) {
        throw new Error('Cannot modify auto-generated artist playlist');
      }

      return await this.removeSongFromPlaylist(playlistId, songId);
    } catch (error) {
      console.error('Error removing song from artist playlist:', error);
      return false;
    }
  }

  /**
   * Lấy artist playlist theo ID
   */
  async getArtistPlaylistById(playlistId: string): Promise<Album | null> {
    try {
      // Thử tìm trong user-created trước
      const playlist = await this.getPlaylistById(playlistId);
      if (playlist && (
        playlist.isUserCreatedArtistPlaylist || // ✨ Cách mới
        playlist.description?.startsWith('__ALBUM__') || // Tương thích với marker cũ
        playlist.description?.startsWith('__PLAYLIST__')
      )) {
        return this.convertPlaylistToArtistPlaylist(playlist);
      }

      // Quay về tìm trong auto-generated
      const allPlaylists = await this.getAutoGeneratedArtistPlaylists();
      return allPlaylists.find((playlist: Album) => playlist.id === playlistId) || null;
    } catch (error) {
      console.error('Error getting artist playlist by ID:', error);
      return null;
    }
  }

  /**
   * Helper: Nhóm bài hát thành artist playlists tự động tạo (theo artist)
   */
  private groupSongsIntoArtistPlaylists(songs: Song[]): Album[] {
    const playlistMap = new Map<string, Album>();

    songs.forEach((song) => {
      const artistName = song.artist || 'Unknown Artist';
      const playlistKey = artistName; // Sử dụng tên artist làm key

      if (!playlistMap.has(playlistKey)) {
        playlistMap.set(playlistKey, {
          id: `auto_playlist_${this.sanitizeString(artistName)}`,
          name: artistName, // Tên artist trở thành tên playlist
          artist: artistName, // Giống với name để nhất quán
          thumbnail: song.thumbnail_url,
          songs: [],
          totalDuration: 0,
          isUserCreated: false,
          isEditable: false,
          createdDate: new Date(),
          updatedDate: new Date()
        });
      }

      const playlist = playlistMap.get(playlistKey)!;
      playlist.songs.push(song);
      playlist.totalDuration += song.duration;

      if (!playlist.thumbnail && song.thumbnail_url) {
        playlist.thumbnail = song.thumbnail_url;
      }
    });

    return Array.from(playlistMap.values());
  }

  /**
   * Helper: Chuyển đổi Playlist thành Artist Playlist (dựa trên artist)
   */
  private convertPlaylistToArtistPlaylist(playlist: Playlist): Album {
    // ✨ Đơn giản hóa: chỉ cần dùng name, không cần parse description
    let artistName = playlist.name;
    let description = playlist.description || '';

    // Chỉ parse description nếu có marker cũ (để tương thích)
    if (playlist.description?.startsWith('__ALBUM__') || playlist.description?.startsWith('__PLAYLIST__')) {
      const parts = playlist.description.split('__');
      if (parts[1] === 'ALBUM' || parts[1] === 'PLAYLIST') {
        artistName = parts[2] || playlist.name;
        description = parts.slice(3).join('__') || '';
      }
    }

    return {
      id: playlist.id,
      name: artistName,
      artist: artistName,
      thumbnail: playlist.thumbnail,
      songs: playlist.songs,
      totalDuration: playlist.songs.reduce((sum, song) => sum + song.duration, 0),
      description: description || undefined,
      isUserCreated: true,
      isEditable: true,
      createdDate: playlist.createdDate,
      updatedDate: playlist.updatedDate
    };
  }

  /**
   * Helper: Sắp xếp artist playlists
   */
  private sortArtistPlaylists(playlists: Album[]): Album[] {
    return playlists.sort((a, b) => {
      // Playlists do người dùng tạo lên trước
      if (a.isUserCreated !== b.isUserCreated) {
        return (b.isUserCreated ? 1 : 0) - (a.isUserCreated ? 1 : 0);
      }

      // Sau đó theo artist, rồi theo tên
      if (a.artist !== b.artist) {
        return a.artist.localeCompare(b.artist);
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Helper: Làm sạch chuỗi để sử dụng trong IDs
   */
  private sanitizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  // ============================
  // CÁC PHƯƠNG THỨC TƯƠNG THÍCH NGƯỢC
  // ============================

  /**
   * Generate unique playlist ID
   */
  private generatePlaylistId(): string {
    return `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reorder songs in playlist based on new order IDs
   * @param playlistId ID của playlist cần sắp xếp lại
   * @param newOrderIds Mảng các ID bài hát theo thứ tự mới
   */

  async reorderSongsInPlaylist(playlistId: string, newOrderIds: string[]): Promise<boolean> {
  try {
    const playlist = await this.getPlaylistById(playlistId);
    if (!playlist) return false;

    // Tạo map để tra cứu nhanh song theo id
    const songMap = new Map(playlist.songs.map(song => [song.id, song]));

    // Sắp xếp lại mảng songs theo newOrderIds
    const newSongs: Song[] = [];
    for (const id of newOrderIds) {
      const song = songMap.get(id);
      if (song) newSongs.push(song);
    }

    // Nếu số lượng không khớp, không update
    if (newSongs.length !== playlist.songs.length) return false;

    playlist.songs = newSongs;
    playlist.updatedDate = new Date();

    return await this.databaseService.updatePlaylist(playlist);
  } catch (error) {
    console.error('Error reordering songs in playlist:', error);
    return false;
  }
}
}
