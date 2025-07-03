import { Injectable } from '@angular/core';
import {
  SystemPlaylist,
  SYSTEM_PLAYLISTS,
  DYNAMIC_PLAYLISTS,
  DynamicPlaylistConfig
} from '../interfaces/playlist.interface';
import { Song } from '../interfaces/song.interface';
import { DatabaseService } from './database.service';
import { PlaylistService } from './playlist.service';

/**
 * Service quản lý auto-generated playlists và dynamic playlists
 * Handles system playlists that update automatically
 */
@Injectable({
  providedIn: 'root'
})
export class PlaylistManagerService {

  constructor(
    private databaseService: DatabaseService,
    private playlistService: PlaylistService
  ) {}

  /**
   * Khởi tạo tất cả system playlists khi app start
   */
  async initializeSystemPlaylists(): Promise<void> {
    try {
      console.log('🎵 Initializing system playlists...');

      // Tạo các system playlists cơ bản
      await this.createSystemPlaylistIfNotExists(SYSTEM_PLAYLISTS.FAVORITES);
      await this.createSystemPlaylistIfNotExists(SYSTEM_PLAYLISTS.DOWNLOADED);
      await this.createSystemPlaylistIfNotExists(SYSTEM_PLAYLISTS.RECENT);
      await this.createSystemPlaylistIfNotExists(SYSTEM_PLAYLISTS.POPULAR);
      await this.createSystemPlaylistIfNotExists(SYSTEM_PLAYLISTS.ALL_SONGS);

      console.log('✅ System playlists initialized');
    } catch (error) {
      console.error('❌ Error initializing system playlists:', error);
    }
  }

  /**
   * Cập nhật tất cả dynamic playlists
   */
  async updateAllSystemPlaylists(): Promise<void> {
    try {
      console.log('🔄 Updating system playlists...');

      await Promise.all([
        this.updateFavoritesPlaylist(),
        this.updateDownloadedPlaylist(),
        this.updateRecentPlaylist(),
        this.updatePopularPlaylist(),
        this.updateAllSongsPlaylist()
      ]);

      console.log('✅ System playlists updated');
    } catch (error) {
      console.error('❌ Error updating system playlists:', error);
    }
  }

  /**
   * Lấy playlist "Yêu thích" với data mới nhất
   */
  async getFavoritesPlaylist(): Promise<SystemPlaylist | null> {
    try {
      await this.updateFavoritesPlaylist();
      const playlist = await this.playlistService.getPlaylistById(SYSTEM_PLAYLISTS.FAVORITES.id);

      if (!playlist) return null;

      return {
        ...playlist,
        type: 'system',
        autoUpdate: true,
        icon: SYSTEM_PLAYLISTS.FAVORITES.icon,
        color: SYSTEM_PLAYLISTS.FAVORITES.color,
        systemId: SYSTEM_PLAYLISTS.FAVORITES.id
      };
    } catch (error) {
      console.error('Error getting favorites playlist:', error);
      return null;
    }
  }

  /**
   * Lấy playlist "Đã tải xuống" với data mới nhất
   */
  async getDownloadedPlaylist(): Promise<SystemPlaylist | null> {
    try {
      await this.updateDownloadedPlaylist();
      const playlist = await this.playlistService.getPlaylistById(SYSTEM_PLAYLISTS.DOWNLOADED.id);

      if (!playlist) return null;

      return {
        ...playlist,
        type: 'system',
        autoUpdate: true,
        icon: SYSTEM_PLAYLISTS.DOWNLOADED.icon,
        color: SYSTEM_PLAYLISTS.DOWNLOADED.color,
        systemId: SYSTEM_PLAYLISTS.DOWNLOADED.id
      };
    } catch (error) {
      console.error('Error getting downloaded playlist:', error);
      return null;
    }
  }

  /**
   * Lấy playlist "Nghe gần đây" với data mới nhất
   */
  async getRecentPlaylist(): Promise<SystemPlaylist | null> {
    try {
      await this.updateRecentPlaylist();
      const playlist = await this.playlistService.getPlaylistById(SYSTEM_PLAYLISTS.RECENT.id);

      if (!playlist) return null;

      return {
        ...playlist,
        type: 'system',
        autoUpdate: true,
        icon: SYSTEM_PLAYLISTS.RECENT.icon,
        color: SYSTEM_PLAYLISTS.RECENT.color,
        systemId: SYSTEM_PLAYLISTS.RECENT.id
      };
    } catch (error) {
      console.error('Error getting recent playlist:', error);
      return null;
    }
  }

  /**
   * Lấy tất cả system playlists
   */
  async getAllSystemPlaylists(): Promise<SystemPlaylist[]> {
    try {
      const systemPlaylists: SystemPlaylist[] = [];

      const favorites = await this.getFavoritesPlaylist();
      const downloaded = await this.getDownloadedPlaylist();
      const recent = await this.getRecentPlaylist();
      const popular = await this.getPopularPlaylist();
      const allSongs = await this.getAllSongsPlaylist();

      if (favorites) systemPlaylists.push(favorites);
      if (downloaded) systemPlaylists.push(downloaded);
      if (recent) systemPlaylists.push(recent);
      if (popular) systemPlaylists.push(popular);
      if (allSongs) systemPlaylists.push(allSongs);

      return systemPlaylists;
    } catch (error) {
      console.error('Error getting all system playlists:', error);
      return [];
    }
  }

  /**
   * Tạo dynamic playlists theo artists
   */
  async createArtistPlaylists(): Promise<SystemPlaylist[]> {
    try {
      const allSongs = await this.databaseService.getAllSongs();
      const artistGroups = this.groupSongsByArtist(allSongs);
      const artistPlaylists: SystemPlaylist[] = [];

      for (const [artistName, songs] of artistGroups) {
        if (songs.length >= 2) { // Chỉ tạo playlist cho artist có >= 2 bài
          const playlistId = `dynamic_artist_${this.sanitizeId(artistName)}`;

          const existingPlaylist = await this.playlistService.getPlaylistById(playlistId);

          if (!existingPlaylist) {
            const playlist = await this.playlistService.createPlaylist({
              name: `👨‍🎤 ${artistName}`,
              description: `Các bài hát của ${artistName}`,
              type: 'dynamic'
            });

            if (playlist) {
              playlist.id = playlistId;
              playlist.songs = songs;
              playlist.isSystemPlaylist = true;
              await this.databaseService.updatePlaylist(playlist);

              artistPlaylists.push({
                ...playlist,
                type: 'dynamic',
                autoUpdate: true,
                systemId: playlistId
              });
            }
          } else {
            // Update existing playlist
            existingPlaylist.songs = songs;
            existingPlaylist.updatedDate = new Date();
            await this.databaseService.updatePlaylist(existingPlaylist);

            artistPlaylists.push({
              ...existingPlaylist,
              type: 'dynamic',
              autoUpdate: true,
              systemId: playlistId
            });
          }
        }
      }

      return artistPlaylists;
    } catch (error) {
      console.error('Error creating artist playlists:', error);
      return [];
    }
  }

  /**
   * Tạo dynamic playlists theo albums
   */
  async createAlbumPlaylists(): Promise<SystemPlaylist[]> {
    try {
      const allSongs = await this.databaseService.getAllSongs();
      const albumGroups = this.groupSongsByAlbum(allSongs);
      const albumPlaylists: SystemPlaylist[] = [];

      for (const [albumName, songs] of albumGroups) {
        if (songs.length >= 2 && albumName && albumName.trim()) {
          const playlistId = `dynamic_album_${this.sanitizeId(albumName)}`;

          const existingPlaylist = await this.playlistService.getPlaylistById(playlistId);

          if (!existingPlaylist) {
            const playlist = await this.playlistService.createPlaylist({
              name: `💿 ${albumName}`,
              description: `Album: ${albumName}`,
              type: 'dynamic',
              thumbnail: songs[0].thumbnail_url // Use first song's thumbnail
            });

            if (playlist) {
              playlist.id = playlistId;
              playlist.songs = songs;
              playlist.isSystemPlaylist = true;
              await this.databaseService.updatePlaylist(playlist);

              albumPlaylists.push({
                ...playlist,
                type: 'dynamic',
                autoUpdate: true,
                systemId: playlistId
              });
            }
          } else {
            // Update existing playlist
            existingPlaylist.songs = songs;
            existingPlaylist.updatedDate = new Date();
            if (!existingPlaylist.thumbnail && songs[0]?.thumbnail_url) {
              existingPlaylist.thumbnail = songs[0].thumbnail_url;
            }
            await this.databaseService.updatePlaylist(existingPlaylist);

            albumPlaylists.push({
              ...existingPlaylist,
              type: 'dynamic',
              autoUpdate: true,
              systemId: playlistId
            });
          }
        }
      }

      return albumPlaylists;
    } catch (error) {
      console.error('Error creating album playlists:', error);
      return [];
    }
  }

  /**
   * Method được gọi khi có thay đổi trong music library
   */
  async onLibraryChanged(): Promise<void> {
    try {
      // Update system playlists
      await this.updateAllSystemPlaylists();

      // Update dynamic playlists
      await this.createArtistPlaylists();
      await this.createAlbumPlaylists();
    } catch (error) {
      console.error('Error handling library change:', error);
    }
  }

  // ================== PRIVATE METHODS ==================

  /**
   * Tạo system playlist nếu chưa tồn tại
   */
  private async createSystemPlaylistIfNotExists(config: any): Promise<void> {
    const existingPlaylist = await this.playlistService.getPlaylistById(config.id);

    if (!existingPlaylist) {
      await this.playlistService.createPlaylist({
        name: config.name,
        description: config.description,
        type: 'system'
      });
    }
  }

  /**
   * Cập nhật playlist "Yêu thích"
   */
  private async updateFavoritesPlaylist(): Promise<void> {
    const favoriteSongs = await this.databaseService.getFavoriteSongs();
    await this.updateSystemPlaylist(SYSTEM_PLAYLISTS.FAVORITES.id, favoriteSongs);
  }

  /**
   * Cập nhật playlist "Đã tải xuống"
   */
  private async updateDownloadedPlaylist(): Promise<void> {
    const downloadedSongs = await this.databaseService.getDownloadedSongs();
    await this.updateSystemPlaylist(SYSTEM_PLAYLISTS.DOWNLOADED.id, downloadedSongs);
  }

  /**
   * Cập nhật playlist "Nghe gần đây"
   */
  private async updateRecentPlaylist(): Promise<void> {
    const recentSongs = await this.databaseService.getRecentlyPlayedSongs(50);
    await this.updateSystemPlaylist(SYSTEM_PLAYLISTS.RECENT.id, recentSongs);
  }

  /**
   * Cập nhật playlist "Phổ biến nhất"
   */
  private async updatePopularPlaylist(): Promise<void> {
    // TODO: Implement play count tracking
    const allSongs = await this.databaseService.getAllSongs();
    // For now, use most recently added songs as "popular"
    const popularSongs = allSongs.slice(0, 30);
    await this.updateSystemPlaylist(SYSTEM_PLAYLISTS.POPULAR.id, popularSongs);
  }

  /**
   * Cập nhật playlist "Tất cả bài hát"
   */
  private async updateAllSongsPlaylist(): Promise<void> {
    const allSongs = await this.databaseService.getAllSongs();
    await this.updateSystemPlaylist(SYSTEM_PLAYLISTS.ALL_SONGS.id, allSongs);
  }

  /**
   * Helper method để cập nhật system playlist
   */
  private async updateSystemPlaylist(playlistId: string, songs: Song[]): Promise<void> {
    const playlist = await this.playlistService.getPlaylistById(playlistId);
    if (playlist) {
      playlist.songs = songs;
      playlist.updatedDate = new Date();
      await this.databaseService.updatePlaylist(playlist);
    }
  }

  /**
   * Lấy playlist "Phổ biến nhất"
   */
  private async getPopularPlaylist(): Promise<SystemPlaylist | null> {
    try {
      await this.updatePopularPlaylist();
      const playlist = await this.playlistService.getPlaylistById(SYSTEM_PLAYLISTS.POPULAR.id);

      if (!playlist) return null;

      return {
        ...playlist,
        type: 'system',
        autoUpdate: true,
        icon: SYSTEM_PLAYLISTS.POPULAR.icon,
        color: SYSTEM_PLAYLISTS.POPULAR.color,
        systemId: SYSTEM_PLAYLISTS.POPULAR.id
      };
    } catch (error) {
      console.error('Error getting popular playlist:', error);
      return null;
    }
  }

  /**
   * Lấy playlist "Tất cả bài hát"
   */
  private async getAllSongsPlaylist(): Promise<SystemPlaylist | null> {
    try {
      await this.updateAllSongsPlaylist();
      const playlist = await this.playlistService.getPlaylistById(SYSTEM_PLAYLISTS.ALL_SONGS.id);

      if (!playlist) return null;

      return {
        ...playlist,
        type: 'system',
        autoUpdate: true,
        icon: SYSTEM_PLAYLISTS.ALL_SONGS.icon,
        color: SYSTEM_PLAYLISTS.ALL_SONGS.color,
        systemId: SYSTEM_PLAYLISTS.ALL_SONGS.id
      };
    } catch (error) {
      console.error('Error getting all songs playlist:', error);
      return null;
    }
  }

  /**
   * Group songs by artist
   */
  private groupSongsByArtist(songs: Song[]): Map<string, Song[]> {
    const groups = new Map<string, Song[]>();

    songs.forEach(song => {
      const artist = song.artist || 'Unknown Artist';
      if (!groups.has(artist)) {
        groups.set(artist, []);
      }
      groups.get(artist)!.push(song);
    });

    return groups;
  }

  /**
   * Group songs by album
   */
  private groupSongsByAlbum(songs: Song[]): Map<string, Song[]> {
    const groups = new Map<string, Song[]>();

    songs.forEach(song => {
      const album = song.artist || 'Unknown Album';
      if (!groups.has(album)) {
        groups.set(album, []);
      }
      groups.get(album)!.push(song);
    });

    return groups;
  }

  /**
   * Sanitize string for use as ID
   */
  private sanitizeId(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
