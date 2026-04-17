import { Injectable, signal, inject } from '@angular/core';
import { Album, Song } from '@core/interfaces/song.interface';
import { PlaylistService } from '@core/services/playlist.service';
import { DatabaseService } from '@core/data/database.service';

/**
 * Nút cổ chai (Single source of truth) đứng chuyên quản lý cụm danh sách phát Playlist.
 *
 * Nhiệm vụ kiến trúc: Tầng Store (API → **Store** → Component)
 * - Bao bọc lại `PlaylistService` và tập trung hóa trạng thái.
 * - Các component/page chỉ nên Inject Store này thay vì tự gọi rời rạc Service.
 */
@Injectable({ providedIn: 'root' })
export class PlaylistStore {
  private playlistService = inject(PlaylistService);
  private db = inject(DatabaseService);

  // ─────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────

  /** All playlists (artist-based + user-created) */
  readonly playlists = signal<Album[]>([]);

  /** Whether data has been loaded */
  readonly isLoaded = signal(false);

  /** Loading state */
  readonly isLoading = signal(false);

  // ─────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Load all playlists from database.
   */
  async loadAll(): Promise<void> {
    if (this.isLoading()) return;

    this.isLoading.set(true);
    try {
      await this.playlistService.clearAllCache();
      this.db.clearPlaylistsCache();

      const playlists = await this.playlistService.getAllArtistPlaylists();
      this.playlists.set(playlists);
      this.isLoaded.set(true);
    } catch (error) {
      console.error('PlaylistStore: Error loading playlists:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Ensure playlists are loaded.
   */
  async ensureLoaded(): Promise<void> {
    if (!this.isLoaded()) {
      await this.loadAll();
    }
  }

  /**
   * Create a new playlist.
   */
  async create(name: string): Promise<Album | null> {
    try {
      const newPlaylist = await this.playlistService.createArtistPlaylist({ name });
      if (newPlaylist) {
        await this.loadAll();
        return newPlaylist;
      }
      return null;
    } catch (error) {
      console.error('PlaylistStore: Error creating playlist:', error);
      throw error;
    }
  }

  /**
   * Rename a playlist.
   */
  async rename(playlistId: string, newName: string): Promise<boolean> {
    try {
      const success = await this.playlistService.updateArtistPlaylist(
        playlistId,
        { name: newName }
      );

      if (success) {
        await this.playlistService.clearAllCache();
        await this.loadAll();
      }

      return success;
    } catch (error) {
      console.error('PlaylistStore: Error renaming playlist:', error);
      throw error;
    }
  }

  /**
   * Delete a playlist.
   */
  async delete(playlistId: string): Promise<boolean> {
    try {
      const success = await this.playlistService.deleteArtistPlaylist(playlistId);
      if (success) {
        await this.loadAll();
      }
      return success;
    } catch (error) {
      console.error('PlaylistStore: Error deleting playlist:', error);
      throw error;
    }
  }

  /**
   * Find the active playlist for a given song.
   * Used by PlaylistsPage to highlight the currently playing playlist.
   */
  findActivePlaylist(songId: string, lastPlaylistId: string | null): string | null {
    const playlists = this.playlists();

    // 1. Try last played playlist
    if (lastPlaylistId) {
      const lastPlaylist = playlists.find(p => p.id === lastPlaylistId);
      if (lastPlaylist?.songs.some(s => s.id === songId)) {
        return lastPlaylist.id;
      }
    }

    // 2. Try dynamic playlist
    const dynamic = playlists.find(p =>
      (p as any).type === 'dynamic' && p.songs.some(s => s.id === songId)
    );
    if (dynamic) return dynamic.id;

    // 3. Try user playlist
    const user = playlists.find(p =>
      (p as any).type === 'user' && p.songs.some(s => s.id === songId)
    );
    if (user) return user.id;

    // 4. Any playlist containing the song
    const any = playlists.find(p => p.songs.some(s => s.id === songId));
    return any?.id ?? null;
  }
}
