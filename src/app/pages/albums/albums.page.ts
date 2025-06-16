import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Song, Album } from '../../interfaces/song.interface';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { AlbumsPageStateService } from '../../services/albums-page-state.service';
import { Subject, takeUntil } from 'rxjs';
import { RefreshService } from 'src/app/services/refresh.service';

@Component({
  selector: 'app-albums',
  template: `
    <div class="albums-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <!-- <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Albums</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ albums.length }} albums</p>
      </div> -->
      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4" #scrollContainer>
        <!-- Albums Grid -->
        <div
          *ngIf="albumsState.albums.length > 0"
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          <div
            *ngFor="let album of albumsState.albums; trackBy: trackByAlbumId"
            (click)="openAlbum(album)"
            class="album-card bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          >
            <!-- Album Cover -->
            <div class="relative mb-3">
              <img
                [src]="album.thumbnail || 'assets/images/default-album.png'"
                [alt]="album.name"
                class="w-full aspect-square rounded-lg object-cover"
              />

              <!-- Play Button Overlay -->
              <div
                class="absolute inset-0 bg-black bg-opacity-30 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              >
                <button
                  (click)="playAlbum(album, $event)"
                  class="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-purple-600 transition-colors"
                >
                  <i class="fas fa-play ml-1"></i>
                </button>
              </div>
            </div>

            <!-- Album Info -->
            <div class="text-center">
              <h3
                class="font-medium text-gray-900 dark:text-white truncate mb-1"
              >
                {{ album.name }}
              </h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate mb-1">
                {{ album.artist }}
              </p>
              <div
                class="flex items-center justify-center space-x-2 text-xs text-gray-400 dark:text-gray-500"
              >
                <span>{{ album.songs.length }} bài</span>
                <span>•</span>
                <span>{{ formatDuration(album.totalDuration) }}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Empty State -->
        <div *ngIf="albumsState.albums.length === 0" class="text-center py-16">
          <i
            class="fas fa-compact-disc text-6xl text-gray-300 dark:text-gray-600 mb-6"
          ></i>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Chưa có album nào
          </h3>
          <p class="text-gray-500 dark:text-gray-400 mb-6">
            Tải nhạc từ YouTube để tạo albums tự động
          </p>
          <button
            routerLink="/tabs/search"
            class="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            <i class="fas fa-download mr-2"></i>
            Tải nhạc
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .album-card:active {
        transform: scale(0.98);
      }

      .album-card:hover {
        transform: translateY(-2px);
      }
    `,
  ],
  imports: [CommonModule, RouterLink],
  standalone: true,
})
export class AlbumsPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('scrollContainer', { static: false }) scrollContainer!: ElementRef;

  constructor(
    private databaseService: DatabaseService,
    private audioPlayerService: AudioPlayerService,
    public albumsState: AlbumsPageStateService,
    private refreshService: RefreshService
  ) {}
  async ngOnInit() {
    console.log('🔄 AlbumsPage ngOnInit started');

    // Always load data on init (don't depend on isDataLoaded flag for initial load)
    await this.loadAlbums();

    // Restore scroll position after data is loaded
    setTimeout(() => {
      if (this.scrollContainer && this.albumsState.scrollPosition > 0) {
        this.scrollContainer.nativeElement.scrollTop = this.albumsState.scrollPosition;
        console.log('📜 Albums scroll position restored:', this.albumsState.scrollPosition);
      }
    }, 200);

    // Lắng nghe tín hiệu refresh
    this.refreshService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Albums refresh triggered');
        this.loadAlbums();
      });

    console.log('✅ AlbumsPage ngOnInit completed');
  }

  ngOnDestroy() {
    // Save scroll position when leaving the page
    if (this.scrollContainer) {
      this.albumsState.setScrollPosition(
        this.scrollContainer.nativeElement.scrollTop
      );
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadAlbums() {
    try {
      const songs = await this.databaseService.getAllSongs();
      const albums = this.groupSongsIntoAlbums(songs);
      this.albumsState.setAlbums(albums);
    } catch (error) {
      console.error('Error loading albums:', error);
    }
  }

  private groupSongsIntoAlbums(songs: Song[]): Album[] {
    const albumMap = new Map<string, Album>();

    songs.forEach((song) => {
      const albumKey = song.album
        ? `${song.artist}-${song.album}`
        : `${song.artist}-Singles`;
      const albumName = song.album || 'Singles';

      if (!albumMap.has(albumKey)) {
        albumMap.set(albumKey, {
          id: `album_${albumKey}`,
          name: albumName,
          artist: song.artist,
          thumbnail: song.thumbnail,
          songs: [],
          genre: song.genre,
          totalDuration: 0,
        });
      }

      const album = albumMap.get(albumKey)!;
      album.songs.push(song);
      album.totalDuration += song.duration;

      // Use the first song's thumbnail if album doesn't have one
      if (!album.thumbnail && song.thumbnail) {
        album.thumbnail = song.thumbnail;
      }
    });

    // Sort albums by artist name, then album name
    return Array.from(albumMap.values()).sort((a, b) => {
      if (a.artist !== b.artist) {
        return a.artist.localeCompare(b.artist);
      }
      return a.name.localeCompare(b.name);
    });
  }

  async playAlbum(album: Album, event: Event) {
    event.stopPropagation();

    if (album.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(album.songs, 0);
    }
  }

  openAlbum(album: Album) {
    // TODO: Navigate to album detail page
    console.log('Open album:', album.name);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  trackByAlbumId(index: number, album: Album): string {
    return album.id;
  }
}
