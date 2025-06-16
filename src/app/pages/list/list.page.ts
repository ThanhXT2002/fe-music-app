import { Component, OnInit, OnDestroy, ElementRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Song } from '../../interfaces/song.interface';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { ListPageStateService } from '../../services/list-page-state.service';
import { SongItemComponent } from '../../components/shared/song-item.component';
import { IonContent, IonHeader, IonToolbar, IonTitle } from "@ionic/angular/standalone";
import { RefreshService } from 'src/app/services/refresh.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-list',
  templateUrl: './list.page.html',
  styleUrls: ['./list.page.scss'],
  standalone: true,
  imports: [ CommonModule, SongItemComponent]
})
export class ListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('scrollContainer', { static: true }) scrollContainer!: ElementRef;

  tabs = [
    { id: 'all', icon: 'fas fa-music', title: 'Tất cả bài hát', label: 'Tất cả' },
    { id: 'recent', icon: 'fas fa-clock', title: 'Bài hát gần đây', label: 'Gần đây' },
    { id: 'artists', icon: 'fas fa-user-music', title: 'Danh sách nghệ sĩ', label: 'Nghệ sĩ' },
    { id: 'favorites', icon: 'fas fa-heart', title: 'Bài hát yêu thích', label: 'Yêu thích' }
  ];

  tabTitle:string = 'Tất cả bài hát';
  // Loading state - Start with loading true so UI shows loading immediately
  isLoading = signal(true);
  loadError = signal<string | null>(null);

  constructor(
    private databaseService: DatabaseService,
    private audioPlayerService: AudioPlayerService,
    private stateService: ListPageStateService,
    private refreshService: RefreshService
  ) {
    console.log('🔄 ListPage constructor - Setting initial loading state');
  }
  // Use computed signals to access state reactively
  get activeTab() {
    return this.stateService.activeTab;
  }

  set activeTab(value: string) {
    this.stateService.setActiveTab(value);
  }

  // Convert to signal getters for reactive updates
  allSongs = this.stateService.allSongsSignal;
  recentSongs = this.stateService.recentSongsSignal;
  favoriteSongs = this.stateService.favoriteSongsSignal;
  artists = this.stateService.artistsSignal;

  async ngOnInit() {
    console.log('🔄 ListPage ngOnInit started');

    // Always load data on init (don't depend on isDataLoaded flag for initial load)
    await this.loadData();

    // Restore scroll position after data is loaded
    setTimeout(() => {
      if (this.scrollContainer && this.stateService.scrollPosition > 0) {
        this.scrollContainer.nativeElement.scrollTop = this.stateService.scrollPosition;
        console.log('📜 Scroll position restored:', this.stateService.scrollPosition);
      }
    }, 200);

    // Subscribe to refresh events for subsequent updates
    this.refreshService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Refresh triggered');
        this.loadData();
      });

    console.log('✅ ListPage ngOnInit completed');
  }

  ngOnDestroy() {
    // Save scroll position when leaving the page
    if (this.scrollContainer) {
      this.stateService.setScrollPosition(this.scrollContainer.nativeElement.scrollTop);
    }

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
    console.log('📊 Loading list data...');
    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      // Load all songs
      console.log('🎵 Loading all songs...');
      const allSongs = await this.databaseService.getAllSongs();
      console.log(`✅ Loaded ${allSongs.length} songs`);

      // Load recent songs
      console.log('🕐 Loading recent songs...');
      const recentSongs = await this.databaseService.getRecentlyPlayedSongs(50);
      console.log(`✅ Loaded ${recentSongs.length} recent songs`);

      // Load favorite songs
      console.log('❤️ Loading favorite songs...');
      const favoriteSongs = await this.databaseService.getFavoriteSongs();
      console.log(`✅ Loaded ${favoriteSongs.length} favorite songs`);

      // Group songs by artists
      console.log('👨‍🎤 Grouping songs by artists...');
      const artists = this.groupSongsByArtists(allSongs);
      console.log(`✅ Grouped into ${artists.length} artists`);

      // Update state service with all data
      this.stateService.updateAllData({
        allSongs,
        recentSongs,
        favoriteSongs,
        artists
      });

      console.log('✅ All list data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading list data:', error);
      this.loadError.set('Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại sau.');

      // Try to show some data even if there's an error
      try {
        const basicSongs = await this.databaseService.getAllSongs();
        this.stateService.updateAllData({
          allSongs: basicSongs,
          recentSongs: [],
          favoriteSongs: [],
          artists: this.groupSongsByArtists(basicSongs)
        });
        console.log('⚠️ Loaded basic data as fallback');
      } catch (fallbackError) {
        console.error('❌ Fallback data loading also failed:', fallbackError);
      }
    } finally {
      this.isLoading.set(false);
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
    const artistMap = new Map();

    songs.forEach(song => {
      if (!artistMap.has(song.artist)) {
        artistMap.set(song.artist, {
          name: song.artist,
          songCount: 0,
          thumbnail: song.thumbnail
        });
      }
      artistMap.get(song.artist).songCount++;
    });

    return Array.from(artistMap.values())
      .sort((a, b) => b.songCount - a.songCount);
  }
  getTabClass(tabId: string): string {
    const baseClasses = 'flex-shrink-0 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap';

    if (this.activeTab === tabId) {
      return baseClasses + ' text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400';
    }

    return baseClasses + ' text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300';
  }
  async playSong(event: { song: Song; playlist: Song[]; index: number }) {
    console.log('🎵 ListPage playSong triggered for:', event.song.title);

    // Use the playlist and index from the event, or fallback to current tab's playlist
    let playlist = event.playlist.length > 0 ? event.playlist : [];
    let index = event.index;

    if (playlist.length === 0) {
      // Fallback to tab-based playlist if none provided
      switch (this.activeTab) {
        case 'all':
          playlist = this.allSongs();
          break;
        case 'recent':
          playlist = this.recentSongs();
          break;
        case 'favorites':
          playlist = this.favoriteSongs();
          break;
        default:
          playlist = [event.song];
      }
      index = playlist.findIndex(s => s.id === event.song.id);
    }    // Update signals immediately before starting playback
    console.log('🔄 Updating signals immediately for currentSong:', event.song.title);
    this.audioPlayerService.updateCurrentSong(event.song);

    // Then set playlist and start playing
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

  viewArtist(artist: any) {
    // TODO: Navigate to artist detail page
  }

  trackBySongId(index: number, song: Song): string {
    return song.id;
  }
}

