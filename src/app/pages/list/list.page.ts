import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Song } from '../../interfaces/song.interface';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { ListPageStateService } from '../../services/list-page-state.service';
import { SongItemComponent } from '../../components/shared/song-item.component';

@Component({
  selector: 'app-list',
  template: `
    <div class="list-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Sub-tabs Header -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="flex overflow-x-auto scrollbar-hide">
          <button
            *ngFor="let tab of tabs"
            (click)="activeTab = tab.id"
            [class]="getTabClass(tab.id)"
            class="flex-shrink-0 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap">
            {{ tab.label }}
          </button>
        </div>
      </div>      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4" #scrollContainer>
        <!-- All Songs -->
        <div *ngIf="activeTab === 'all'">
          <div class="mb-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Tất cả bài hát ({{ allSongs.length }})
            </h2>
          </div>          <div class="space-y-2">            <app-song-item
              *ngFor="let song of allSongs; let i = index; trackBy: trackBySongId"
              [song]="song"
              [playlist]="allSongs"
              [index]="i"
              (play)="playSong($event)"
              (showMenu)="showSongMenu($event)"
              (toggleFavorite)="toggleFavorite($event)">
            </app-song-item>
          </div>
        </div>

        <!-- Recently Played -->
        <div *ngIf="activeTab === 'recent'">
          <div class="mb-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nghe gần đây
            </h2>
          </div>          <div class="space-y-2">
            <app-song-item
              *ngFor="let song of recentSongs; let i = index; trackBy: trackBySongId"
              [song]="song"
              [playlist]="recentSongs"
              [index]="i"
              (play)="playSong($event)"
              (showMenu)="showSongMenu($event)"
              (toggleFavorite)="toggleFavorite($event)">
            </app-song-item>
          </div>
          <div *ngIf="recentSongs.length === 0" class="text-center py-12">
            <i class="fas fa-history text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
            <p class="text-gray-500 dark:text-gray-400">Chưa có bài hát nào được nghe gần đây</p>
          </div>
        </div>

        <!-- Artists -->
        <div *ngIf="activeTab === 'artists'">
          <div class="mb-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nghệ sĩ
            </h2>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div
              *ngFor="let artist of artists"
              (click)="viewArtist(artist)"
              class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <i class="fas fa-user-music text-white text-xl"></i>
              </div>
              <h3 class="font-medium text-gray-900 dark:text-white text-center truncate">{{ artist.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 text-center">{{ artist.songCount }} bài hát</p>
            </div>
          </div>
          <div *ngIf="artists.length === 0" class="text-center py-12">
            <i class="fas fa-microphone text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
            <p class="text-gray-500 dark:text-gray-400">Chưa có nghệ sĩ nào</p>
          </div>
        </div>

        <!-- Favorites -->
        <div *ngIf="activeTab === 'favorites'">
          <div class="mb-4">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Yêu thích
            </h2>
          </div>          <div class="space-y-2">
            <app-song-item
              *ngFor="let song of favoriteSongs; let i = index; trackBy: trackBySongId"
              [song]="song"
              [playlist]="favoriteSongs"
              [index]="i"
              (play)="playSong($event)"
              (showMenu)="showSongMenu($event)"
              (toggleFavorite)="toggleFavorite($event)">
            </app-song-item>
          </div>
          <div *ngIf="favoriteSongs.length === 0" class="text-center py-12">
            <i class="fas fa-heart text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
            <p class="text-gray-500 dark:text-gray-400">Chưa có bài hát yêu thích nào</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `],
  imports: [CommonModule, SongItemComponent],
  standalone: true
})
export class ListPage implements OnInit, OnDestroy {
  @ViewChild('scrollContainer', { static: true }) scrollContainer!: ElementRef;

  tabs = [
    { id: 'all', label: 'Tất cả' },
    { id: 'recent', label: 'Gần đây' },
    { id: 'artists', label: 'Nghệ sĩ' },
    { id: 'favorites', label: 'Yêu thích' }
  ];

  constructor(
    private databaseService: DatabaseService,
    private audioPlayerService: AudioPlayerService,
    private stateService: ListPageStateService
  ) {}

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
        this.scrollContainer.nativeElement.scrollTop = this.stateService.scrollPosition;
      }
    }, 100);

    // Load data only if not already loaded
    if (!this.stateService.isDataLoaded) {
      await this.loadData();
    }
  }

  ngOnDestroy() {
    // Save scroll position when leaving the page
    if (this.scrollContainer) {
      this.stateService.setScrollPosition(this.scrollContainer.nativeElement.scrollTop);
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
        artists
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
      index = playlist.findIndex(s => s.id === event.song.id);
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
    console.log('Show menu for:', song.title);
  }

  viewArtist(artist: any) {
    // TODO: Navigate to artist detail page
    console.log('View artist:', artist.name);
  }

  trackBySongId(index: number, song: Song): string {
    return song.id;
  }
}
