import { Injectable, signal, computed, inject } from '@angular/core';
import { Song } from '@core/interfaces/song.interface';
import { DatabaseService } from '@core/data/database.service';
import { formatDuration } from '@core/utils/format-time.util';

/**
 * Artist group for library display.
 */
export interface ArtistGroup {
  name: string;
  songCount: number;
  thumbnail: string;
  totalDuration: number;
  totalDurationFormatted: string;
}

/**
 * Quản lý trạng thái nội bộ của Thư Viện Cá Nhân (Local Library).
 *
 * Nhiệm vụ:
 * - Thay thế việc sử dụng rời rạc `DatabaseService`, `ListPageStateService`, `RefreshService`.
 * - Tự động đồng bộ và map dữ liệu DB lên UI qua Angular Signals.
 * - Cung cấp tập dữ liệu (Songs, Favorites, Recents, Artists) real-time cho các components.
 * 
 * Flow: Component -> LibraryStore -> DatabaseService -> IndexedDB
 */
@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private db = inject(DatabaseService);

  // ─────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────

  /** Toàn bộ danh sách bài hát đang lưu trữ offline */
  readonly allSongs = signal<Song[]>([]);

  /** Lịch sử các bài hát vừa được phát gần đây */
  readonly recentSongs = signal<Song[]>([]);

  /** Danh sách các bài hát được đánh dấu yêu thích */
  readonly favoriteSongs = signal<Song[]>([]);

  /** Nhóm Array theo Artist */
  readonly artists = signal<ArtistGroup[]>([]);

  /** Cờ cho biết Initial Data từ Storage đã được nạp xong */
  readonly isLoaded = signal(false);

  /** Cờ hệ thống loading */
  readonly isLoading = signal(false);

  /** Trạng thái lưu tab đang bật trong view Library (All, Recent, Fav, Artist) */
  readonly activeTab = signal<'all' | 'recent' | 'favorites' | 'artists'>('all');

  /** Saved scroll position for restoration */
  scrollPosition = 0;

  // ─────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────

  /** Đếm số lượng tổng số tập tin bài hát đã down */
  readonly totalSongs = computed(() => this.allSongs().length);

  /** Hash Set chứa IDs các bài nhạc ưu thích (O(1) logic mapping) */
  readonly favoriteIds = computed(() =>
    new Set(this.favoriteSongs().map(s => s.id))
  );

  /** Switch chọn nguồn Map mảng Track tương ứng theo loại Tab kích hoạt */
  readonly currentTabSongs = computed(() => {
    switch (this.activeTab()) {
      case 'all': return this.allSongs();
      case 'recent': return this.recentSongs();
      case 'favorites': return this.favoriteSongs();
      default: return this.allSongs();
    }
  });

  // ─────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Load tất tần tật kho Data Offline từ Local IndexedDB lên Memory RAM của App.
   * Logic kích duy nhất một lần ở vòng đời sinh Init App.
   */
  async loadAll(): Promise<void> {
    if (this.isLoading()) return;

    this.isLoading.set(true);
    try {
      const [allSongs, recentSongs, favoriteSongs] = await Promise.all([
        this.db.getDownloadedSongs(),
        this.db.getRecentlyPlayedSongs(50),
        this.db.getFavoriteSongs(),
      ]);

      const artists = this.groupSongsByArtists(allSongs);

      this.allSongs.set(allSongs);
      this.recentSongs.set(recentSongs);
      this.favoriteSongs.set(favoriteSongs);
      this.artists.set(artists);
      this.isLoaded.set(true);
    } catch (error) {
      console.error('LibraryStore: Error loading data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Force refresh all data (replaces RefreshService.triggerRefresh()).
   */
  async refresh(): Promise<void> {
    this.isLoaded.set(false);
    await this.loadAll();
  }

  /**
   * Load only if not already loaded.
   */
  async ensureLoaded(): Promise<void> {
    if (!this.isLoaded()) {
      await this.loadAll();
    }
  }

  /**
   * Set the active tab.
   */
  setActiveTab(tab: 'all' | 'recent' | 'favorites' | 'artists'): void {
    this.activeTab.set(tab);
  }

  /**
   * Toggle favorite for a song and update all relevant lists.
   */
  async toggleFavorite(songId: string): Promise<boolean> {
    const newStatus = await this.db.toggleFavorite(songId);

    // Update allSongs
    this.allSongs.update(songs =>
      songs.map(s => s.id === songId ? { ...s, isFavorite: newStatus } : s)
    );

    // Update recentSongs
    this.recentSongs.update(songs =>
      songs.map(s => s.id === songId ? { ...s, isFavorite: newStatus } : s)
    );

    // Update favoriteSongs
    if (newStatus) {
      // Song became favorite — reload favorites to get the full list
      const favoriteSongs = await this.db.getFavoriteSongs();
      this.favoriteSongs.set(favoriteSongs);
    } else {
      // Song removed from favorites
      this.favoriteSongs.update(songs =>
        songs.filter(s => s.id !== songId)
      );
    }

    return newStatus;
  }

  /**
   * Delete a song from the library.
   */
  async deleteSong(songId: string): Promise<void> {
    await this.db.deleteSong(songId);

    // Update all lists
    this.allSongs.update(songs => songs.filter(s => s.id !== songId));
    this.recentSongs.update(songs => songs.filter(s => s.id !== songId));
    this.favoriteSongs.update(songs => songs.filter(s => s.id !== songId));
    this.artists.set(this.groupSongsByArtists(this.allSongs()));
  }

  /**
   * Add a newly downloaded song to the library.
   */
  addSong(song: Song): void {
    this.allSongs.update(songs => [song, ...songs]);
    this.artists.set(this.groupSongsByArtists(this.allSongs()));
  }

  /**
   * Get all favorite song IDs (used by HomePage for sync).
   */
  async getAllFavoriteSongIds(): Promise<string[]> {
    return this.db.getAllFavoriteSongIds();
  }

  /**
   * Sync favorite status for a list of songs (used by HomePage).
   */
  async syncFavorites(songs: Song[]): Promise<Song[]> {
    const favoriteIds = await this.db.getAllFavoriteSongIds();
    return songs.map(song => ({
      ...song,
      isFavorite: favoriteIds.includes(song.id),
    }));
  }

  /**
   * Get songs by artist name.
   */
  getSongsByArtist(artistName: string): Song[] {
    return this.allSongs()
      .filter(s => s.artist === artistName)
      .sort((a, b) =>
        new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()
      );
  }

  /**
   * Reset state (useful for logout scenarios).
   */
  resetState(): void {
    this.allSongs.set([]);
    this.recentSongs.set([]);
    this.favoriteSongs.set([]);
    this.artists.set([]);
    this.isLoaded.set(false);
    this.activeTab.set('all');
    this.scrollPosition = 0;
  }

  // ══════════════════════════════════════════
  // PRIVATE
  // ══════════════════════════════════════════

  /**
   * Group songs by artist, sorted by song count descending.
   * Moved from ListPage where it was inline business logic.
   */
  private groupSongsByArtists(songs: Song[]): ArtistGroup[] {
    const artistMap = new Map<string, {
      name: string;
      songCount: number;
      thumbnail: string;
      totalDuration: number;
    }>();

    // Sort by addedDate DESC (newest first)
    const sortedSongs = [...songs].sort((a, b) =>
      new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()
    );

    for (const song of sortedSongs) {
      if (!artistMap.has(song.artist)) {
        artistMap.set(song.artist, {
          name: song.artist,
          songCount: 0,
          thumbnail: song.thumbnail_url,
          totalDuration: 0,
        });
      }

      const data = artistMap.get(song.artist)!;
      data.songCount++;
      data.totalDuration += song.duration || 0;
    }

    return Array.from(artistMap.values())
      .map(artist => ({
        ...artist,
        totalDurationFormatted: formatDuration(artist.totalDuration),
      }))
      .sort((a, b) => b.songCount - a.songCount);
  }
}
