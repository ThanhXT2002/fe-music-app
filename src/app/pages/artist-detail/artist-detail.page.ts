import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Artist, Album, Song } from '../../interfaces/song.interface';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { SongItemComponent } from '../../components/song-item/song-item.component';

@Component({
  selector: 'app-artist-detail',
  template: `
    <div class="artist-detail-page h-full flex flex-col bg-black">
      <!-- Header -->
      <div class="bg-gray-800 border-b border-gray-700 p-4">
        <div class="flex items-center space-x-3">
          <button
            (click)="goBack()"
            class="btn-icon text-gray-400 hover:text-gray-200">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h1 class="text-xl font-bold  text-white">{{ artist?.name || 'Artist' }}</h1>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading State -->
        <div *ngIf="loading" class="flex items-center justify-center h-64">
          <div class="spinner"></div>
        </div>

        <!-- Artist Content -->
        <div *ngIf="!loading && artist" class="p-4">
          <!-- Artist Header -->
          <div class="flex flex-col md:flex-row gap-6 mb-6">
            <!-- Artist Avatar -->
            <div class="flex-shrink-0">
              <div class="w-48 h-48 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center mx-auto md:mx-0 shadow-lg">
                <svg class="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            </div>

            <!-- Artist Info -->
            <div class="flex-1 text-center md:text-left">
              <h1 class="text-3xl font-bold text-gray-900 text-white mb-2">{{ artist.name }}</h1>
              <p class="text-lg text-gray-300 mb-4">{{ artist.bio }}</p>

              <!-- Action Buttons -->
              <div class="flex gap-3 justify-center md:justify-start">
                <button
                  (click)="playAllSongs()"
                  class="btn btn-primary min-w-24">
                  <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Play All
                </button>

                <button
                  (click)="shuffleAllSongs()"
                  class="btn btn-secondary min-w-24">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h5l2 5l1 2l5.5-5.5L19 7l-7 5H9l-5-5V4zM4 20v-8l5 5l7-7"/>
                  </svg>
                  Shuffle
                </button>
              </div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="bg-gray-800 rounded-lg shadow-sm mb-4">
            <div class="flex border-b border-gray-700">
              <button
                (click)="setTab('songs')"
                [class]="selectedTab === 'songs' ? 'tab-button active' : 'tab-button'"
                class="flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors">
                Songs ({{ songs.length }})
              </button>
              <button
                (click)="setTab('albums')"
                [class]="selectedTab === 'albums' ? 'tab-button active' : 'tab-button'"
                class="flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors">
                Albums ({{ albums.length }})
              </button>
            </div>
          </div>

          <!-- Songs Tab -->
          <div *ngIf="selectedTab === 'songs'">
            <div *ngIf="songs.length === 0" class="p-8 text-center bg-gray-800 rounded-lg">
              <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
              </svg>
              <p class="text-gray-400">No songs found for this artist</p>
            </div>

            <div class="bg-gray-800 rounded-lg shadow-sm">
              <div *ngFor="let song of songs; let i = index" class="border-b border-gray-700 last:border-b-0">                <app-song-item
                  [song]="song"
                  [showArtist]="false"
                  [playlist]="songs"
                  [index]="i"
                  (play)="onSongPlay($event)"
                  (openPlayer)="onOpenPlayer()">
                </app-song-item>
              </div>
            </div>
          </div>

          <!-- Albums Tab -->
          <div *ngIf="selectedTab === 'albums'">
            <div *ngIf="albums.length === 0" class="p-8 text-center bg-gray-800 rounded-lg">
              <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM21 17a2 2 0 11-4 0 2 2 0 014 0z M7 17h3m0 0a3 3 0 006 0m0 0h3"></path>
              </svg>
              <p class="text-gray-400">No albums found for this artist</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                *ngFor="let album of albums"
                (click)="goToAlbum(album)"
                class="bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer">

                <!-- Album Cover -->
                <div class="relative mb-3">
                  <img
                    [src]="album.thumbnail || 'assets/images/musical-note.webp'"
                    [alt]="album.name"
                    class="w-full aspect-square rounded-lg object-cover">

                  <!-- Play Button Overlay -->
                  <div class="absolute inset-0 bg-black bg-opacity-30 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      (click)="playAlbum(album); $event.stopPropagation()"
                      class="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-purple-600 transition-colors">
                      <svg class="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Album Info -->
                <div class="text-center">
                  <h3 class="font-medium text-gray-900 text-white truncate mb-1">{{ album.name }}</h3>
                  <div class="flex items-center justify-center space-x-2 text-xs text-gray-500">
                    <span>{{ album.songs.length }} songs</span>
                    <span>•</span>
                    <span>{{ formatDuration(album.totalDuration) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!loading && !artist" class="flex flex-col items-center justify-center h-64">
          <svg class="w-24 h-24 text-gray-400 mb-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <h2 class="text-xl font-semibold text-gray-300 mb-2">Artist Not Found</h2>
          <p class="text-gray-400 text-center px-4">
            The artist you're looking for doesn't exist or has been removed.
          </p>
          <button (click)="goBack()" class="btn btn-secondary mt-4">
            Go Back
          </button>
        </div>
      </div>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, SongItemComponent]
})
export class ArtistDetailPage implements OnInit {
  artist: Artist | null = null;
  songs: Song[] = [];
  albums: Album[] = [];
  loading = true;
  selectedTab = 'songs';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private databaseService: DatabaseService,
    private audioPlayerService: AudioPlayerService
  ) {}

  async ngOnInit() {
    const artistName = this.route.snapshot.paramMap.get('name');
    if (artistName) {
      await this.loadArtist(decodeURIComponent(artistName));
    }
  }

  async loadArtist(artistName: string) {
    try {
      this.loading = true;

      // Get all songs by this artist
      const allSongs = await this.databaseService.getAllSongs();
      this.songs = allSongs.filter(song =>
        song.artist.toLowerCase() === artistName.toLowerCase()
      );

      if (this.songs.length > 0) {
        // Group songs by album
        const albumMap = new Map<string, Song[]>();
        this.songs.forEach(song => {
          const albumName = 'Songs by ' + song.artist; // Default album name since album field is removed
          if (!albumMap.has(albumName)) {
            albumMap.set(albumName, []);
          }
          albumMap.get(albumName)!.push(song);
        });

        // Create album objects
        this.albums = Array.from(albumMap.entries()).map(([albumName, albumSongs]) => {
          const firstSong = albumSongs[0];
          return {
            id: albumName,
            name: albumName,
            artist: artistName,
            thumbnail: firstSong.thumbnail_url,
            songs: albumSongs,
            genre: 'Music', // Default genre since genre field is removed
            totalDuration: albumSongs.reduce((total, song) => total + song.duration, 0)
          };
        });

        // Create artist object
        this.artist = {
          id: artistName,
          name: artistName,
          thumbnail: this.songs[0].thumbnail_url,
          albums: this.albums,
          totalSongs: this.songs.length,
          bio: `${this.albums.length} albums • ${this.songs.length} songs`
        };
      }
    } catch (error) {
      console.error('Error loading artist:', error);
    } finally {
      this.loading = false;
    }
  }

  async playAllSongs() {
    if (this.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(this.songs, 0);
    }
  }

  async shuffleAllSongs() {
    if (this.songs.length > 0) {
      const shuffledSongs = [...this.songs].sort(() => Math.random() - 0.5);
      await this.audioPlayerService.setPlaylist(shuffledSongs, 0);
    }
  }

  async playAlbum(album: Album) {
    if (album.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(album.songs, 0);
    }
  }
  goBack() {
    this.router.navigate(['/tabs/list']);
  }

  async onSongPlay(event: { song: Song; playlist: Song[]; index: number }) {
    await this.audioPlayerService.setPlaylist(event.playlist, event.index);
  }

  onOpenPlayer() {
    // Method này được gọi khi click vào song đang active
  }

  setTab(tab: string) {
    this.selectedTab = tab;
  }

  goToAlbum(album: Album) {
    this.router.navigate(['/album', album.id]);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
