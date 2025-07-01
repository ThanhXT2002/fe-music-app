import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Song } from '../../interfaces/song.interface';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { ListPageStateService } from '../../services/list-page-state.service';
import { SongItemComponent } from '../../components/song-item/song-item.component';
import { ModalController } from '@ionic/angular/standalone';
import { RefreshService } from 'src/app/services/refresh.service';
import { Subject, takeUntil } from 'rxjs';
import { GlobalPlaylistModalService } from 'src/app/services/global-playlist-modal.service';
import { routeAnimation } from 'src/app/shared/route-animation';
import { BtnCustomComponent } from "../../components/btn-custom/btn-custom.component";

@Component({
  selector: 'app-list',
  templateUrl: './list.page.html',
  styleUrls: ['./list.page.scss'],
  standalone: true,
  imports: [CommonModule, SongItemComponent, BtnCustomComponent],
  providers: [ModalController],
  animations: [routeAnimation]
})
export class ListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('scrollContainer', { static: true }) scrollContainer!: ElementRef;

  tabs = [
    {
      id: 'all',
      icon: 'fas fa-music',
      title: 'Tất cả bài hát',
      label: 'Tất cả',
    },
    {
      id: 'recent',
      icon: 'fas fa-clock',
      title: 'Bài hát gần đây',
      label: 'Gần đây',
    },
    {
      id: 'artists',
      icon: 'fas fa-user-music',
      title: 'Danh sách nghệ sĩ',
      label: 'Nghệ sĩ',
    },
    {
      id: 'favorites',
      icon: 'fas fa-heart',
      title: 'Bài hát yêu thích',
      label: 'Yêu thích',
    },
  ];

  tabTitle: string = 'Tất cả bài hát';

  activeArtist = signal<string | null>(null);
  private lastArtistsCacheKey: string = '';
  private lastArtistsResult: any[] = [];
  constructor(
    private databaseService: DatabaseService,
    private audioPlayerService: AudioPlayerService,
    private stateService: ListPageStateService,
    private refreshService: RefreshService,
    private modalCtrl: ModalController,
    private playlistModalService: GlobalPlaylistModalService
  ) {
    // Setup effect in constructor (injection context)
    this.setupCurrentSongWatcher();
  }

  // Use getters to access state reactively
  get activeTab() {
    return this.stateService.activeTab;
  }

  set activeTab(value: string) {
    this.stateService.setActiveTab(value);
  }

  get allSongs() {
    return this.stateService.allSongs;
  }

  get recentSongs() {
    return this.stateService.recentSongs;
  }

  get favoriteSongs() {
    return this.stateService.favoriteSongs;
  }

  get artists() {
    return this.stateService.artists;
  }

  async ngOnInit() {
    // Restore scroll position if available
    setTimeout(() => {
      if (this.scrollContainer && this.stateService.scrollPosition > 0) {
        this.scrollContainer.nativeElement.scrollTop =
          this.stateService.scrollPosition;
      }
    }, 100);

    // Load data only if not already loaded
    if (!this.stateService.isDataLoaded) {
      await this.loadData();
    }
    this.refreshService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadData();
      });

    // this.activeTab = "artists"; // Set default active tab to artists
  }

  ngOnDestroy() {
    // Save scroll position when leaving the page
    if (this.scrollContainer) {
      this.stateService.setScrollPosition(
        this.scrollContainer.nativeElement.scrollTop
      );
    }

    this.lastArtistsCacheKey = '';
    this.lastArtistsResult = [];

    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(tab: any) {
    this.activeTab = tab.id;
    this.tabTitle = tab.title;

    // Optionally, you can load data for the new tab if needed
    if (!this.stateService.isDataLoaded) {
      this.loadData();
    }
  }

  async loadData() {
    try {
      // Load all songs
      const allSongs = await this.databaseService.getAllSongs();

      // Load recent songs
      const recentSongs = await this.databaseService.getRecentlyPlayedSongs(50);

      // Load favorite songs
      const favoriteSongs = await this.databaseService.getFavoriteSongs();

      // Group songs by artists
      const artists = this.groupSongsByArtists(allSongs);

      // Update state service with all data
      this.stateService.updateAllData({
        allSongs,
        recentSongs,
        favoriteSongs,
        artists,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  // Public method to refresh data (can be called from parent components or other services)
  async refreshData() {
    await this.loadData();
  }

  // Method to clear state and reload (useful for login/logout scenarios)
  async resetAndReload() {
    this.stateService.resetState();
    await this.loadData();
  }

  private groupSongsByArtists(songs: Song[]) {
    // Simple memoization based on songs length and last song ID
    const cacheKey = `${songs.length}_${songs[0]?.id || ''}`;

    if (this.lastArtistsCacheKey === cacheKey) {
      return this.lastArtistsResult;
    }

    const artistMap = new Map();

    // ✅ Sort songs by addedDate DESC first (newest first)
    const sortedSongs = songs.sort(
      (a, b) =>
        new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()
    );

    sortedSongs.forEach((song) => {
      if (!artistMap.has(song.artist)) {
        artistMap.set(song.artist, {
          name: song.artist,
          songCount: 0,
          thumbnail: song.thumbnail,
          totalDuration: 0,
        });
      }

      const artistData = artistMap.get(song.artist);
      artistData.songCount++;
      artistData.totalDuration += song.duration || 0;
    });

    const result = Array.from(artistMap.values())
      .map((artist) => ({
        name: artist.name,
        songCount: artist.songCount,
        thumbnail: artist.thumbnail,
        totalDuration: artist.totalDuration,
        totalDurationFormatted: this.formatDuration(artist.totalDuration),
      }))
      .sort((a, b) => b.songCount - a.songCount);

    // Cache result
    this.lastArtistsCacheKey = cacheKey;
    this.lastArtistsResult = result;

    return result;
  }

  private formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} phút`;
  }

  getTabClass(tabId: string): string {
    const baseClasses =
      ' flex-shrink-0 px-2 py-1.5 text-sm font-medium transition-colors whitespace-nowrap text-white';

    if (this.activeTab === tabId) {
      return (
        baseClasses +
        ' bg-pink-500/30 bg-purple-500/50'
      );
    }

    return (
      baseClasses +
      ' bg-white bg-opacity-20 text-black text-white border-transparent'
    );
  }

  async playSong(event: { song: Song; playlist: Song[]; index: number }) {
    // Use the playlist and index from the event, or fallback to current tab's playlist
    let playlist = event.playlist.length > 0 ? event.playlist : [];
    let index = event.index;

    if (playlist.length === 0) {
      // Fallback to tab-based playlist if none provided
      switch (this.activeTab) {
        case 'all':
          playlist = this.allSongs;
          break;
        case 'recent':
          playlist = this.recentSongs;
          break;
        case 'favorites':
          playlist = this.favoriteSongs;
          break;
        default:
          playlist = [event.song];
      }
      index = playlist.findIndex((s) => s.id === event.song.id);
    }

    await this.audioPlayerService.setPlaylist(playlist, index);
  }

  async toggleFavorite(song: Song) {
    const newStatus = await this.databaseService.toggleFavorite(song.id);

    // Update the song in state service
    this.stateService.updateSong(song.id, { isFavorite: newStatus });

    // If we're on favorites tab and song is no longer favorite, remove it from the list
    if (this.activeTab === 'favorites' && !newStatus) {
      this.stateService.removeSongFromFavorites(song.id);
    }

    // If song became favorite and we're on favorites tab, refresh the list
    if (this.activeTab === 'favorites' && newStatus) {
      const favoriteSongs = await this.databaseService.getFavoriteSongs();
      this.stateService.setFavoriteSongs(favoriteSongs);
    }
  }

  showSongMenu(song: Song) {
    // TODO: Implement song menu
  }

  onOpenPlayer() {
    // Method này được gọi khi click vào song đang active
    // Không cần làm gì thêm vì Router.navigate đã được gọi trong component
  }

  onPlayArtist(artist: any) {
    try {
      // ✅ Kiểm tra nếu artist này đang được phát
      if (this.isArtistActive(artist.name)) {
        this.openPlaylist();
        console.log('đang phát rồi');
        return;
      }

      // ✅ Lọc tất cả bài hát của artist này
      const artistSongs = this.allSongs.filter(
        (song) => song.artist === artist.name
      );

      if (artistSongs.length === 0) {
        return;
      }

      // ✅ Sắp xếp theo thứ tự mới nhất
      const sortedSongs = artistSongs.sort(
        (a, b) =>
          new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime()
      );

      // ✅ Phát bài hát đầu tiên và set playlist
      this.playSong({
        song: sortedSongs[0],
        playlist: sortedSongs,
        index: 0,
      });
    } catch (error) {
      console.error('Error playing artist songs:', error);
    }
  }

  openPlaylist() {
    // Check if we have modal context (when opened as modal from other pages)
    this.modalCtrl
      .getTop()
      .then((modal) => {
        if (modal) {
          // We're in a modal context, use the global modal service
          this.playlistModalService.open();
        } else {
          // We're in direct navigation, create and present modal manually
          this.presentPlaylistModal();
        }
      })
      .catch(() => {
        // Fallback: try direct modal creation
        this.presentPlaylistModal();
      });
  }

  private async presentPlaylistModal() {
    try {
      const { CurrentPlaylistComponent } = await import(
        '../../components/current-playlist/current-playlist.component'
      );
      const modal = await this.modalCtrl.create({
        component: CurrentPlaylistComponent,
        presentingElement: undefined, // Allow full-screen modal
        breakpoints: [0, 0.7, 1],
        initialBreakpoint: 0.7,
        handle: true,
        backdropDismiss: true,
      });

      await modal.present();
    } catch (error) {
      console.error('Error opening playlist modal:', error);
    }
  }

  trackBySongId(index: number, song: Song): string {
    return song.id;
  } // ✅ Setup effect to watch current song changes (called in constructor)
  private setupCurrentSongWatcher() {
    effect(() => {
      const currentSong = this.audioPlayerService.currentSong();
      if (currentSong) {
        this.activeArtist.set(currentSong.artist);
      } else {
        this.activeArtist.set(null);
      }
    });
  }

  /**
   * Check if artist is currently playing
   */
  isArtistActive(artistName: string): boolean {
    return this.activeArtist() === artistName;
  }
}
