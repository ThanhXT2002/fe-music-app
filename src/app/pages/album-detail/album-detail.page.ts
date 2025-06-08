import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Album, Song } from '../../interfaces/song.interface';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { SongItemComponent } from '../../components/shared/song-item.component';

@Component({
  selector: 'app-album-detail',
  template: `
    <div class="album-detail-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center space-x-3">
          <button
            (click)="goBack()"
            class="btn-icon text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ album?.name || 'Album' }}</h1>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading State -->
        <div *ngIf="loading" class="flex items-center justify-center h-64">
          <div class="spinner"></div>
        </div>

        <!-- Album Content -->
        <div *ngIf="!loading && album" class="p-4">
          <!-- Album Header -->
          <div class="flex flex-col md:flex-row gap-6 mb-6">
            <!-- Album Artwork -->
            <div class="flex-shrink-0">
              <img
                [src]="album.thumbnail || 'assets/images/default-album.png'"
                [alt]="album.name"
                class="w-48 h-48 rounded-lg shadow-lg object-cover mx-auto md:mx-0">
            </div>

            <!-- Album Info -->
            <div class="flex-1 text-center md:text-left">
              <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ album.name }}</h1>
              <p class="text-xl text-gray-600 dark:text-gray-300 mb-2">{{ album.artist }}</p>

              <div class="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span *ngIf="album.year">{{ album.year }}</span>
                <span *ngIf="album.genre">{{ album.genre }}</span>
                <span>{{ songs.length }} songs</span>
                <span>{{ getTotalDurationText() }}</span>
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-3 justify-center md:justify-start">
                <button
                  (click)="playAlbum()"
                  class="btn btn-primary min-w-24">
                  <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Play
                </button>

                <button
                  (click)="shuffleAlbum()"
                  class="btn btn-secondary min-w-24">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4h5l2 5l1 2l5.5-5.5L19 7l-7 5H9l-5-5V4zM4 20v-8l5 5l7-7"/>
                  </svg>
                  Shuffle
                </button>
              </div>
            </div>
          </div>

          <!-- Songs List -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Songs</h2>
            </div>

            <div *ngIf="songs.length === 0" class="p-8 text-center">
              <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
              </svg>
              <p class="text-gray-500 dark:text-gray-400">No songs found in this album</p>
            </div>

            <div *ngFor="let song of songs; let i = index" class="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
              <app-song-item
                [song]="song"
                [showAlbum]="false"
                [playlist]="songs"
                [index]="i"
                (play)="onSongPlay($event)">
              </app-song-item>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="!loading && !album" class="flex flex-col items-center justify-center h-64">
          <svg class="w-24 h-24 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
          </svg>
          <h2 class="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">Album Not Found</h2>
          <p class="text-gray-500 dark:text-gray-400 text-center px-4">
            The album you're looking for doesn't exist or has been removed.
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
export class AlbumDetailPage implements OnInit {
  album: Album | null = null;
  songs: Song[] = [];
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private databaseService: DatabaseService,
    private audioPlayerService: AudioPlayerService
  ) {}

  async ngOnInit() {
    const albumId = this.route.snapshot.paramMap.get('id');
    if (albumId) {
      await this.loadAlbum(albumId);
    }
  }

  async loadAlbum(albumId: string) {
    try {
      this.loading = true;
      // Get all songs and filter by album
      const allSongs = await this.databaseService.getAllSongs();
      this.songs = allSongs.filter(song => song.album === albumId);

      if (this.songs.length > 0) {
        // Create album object from songs
        const firstSong = this.songs[0];
        this.album = {
          id: albumId,
          name: firstSong.album || 'Unknown Album',
          artist: firstSong.artist,
          thumbnail: firstSong.thumbnail,
          songs: this.songs,
          genre: firstSong.genre,
          totalDuration: this.songs.reduce((total, song) => total + song.duration, 0)
        };
      }
    } catch (error) {
      console.error('Error loading album:', error);
    } finally {
      this.loading = false;
    }
  }

  async playAlbum() {
    if (this.songs.length > 0) {
      await this.audioPlayerService.setPlaylist(this.songs, 0);
    }
  }

  async shuffleAlbum() {
    if (this.songs.length > 0) {
      const shuffledSongs = [...this.songs].sort(() => Math.random() - 0.5);
      await this.audioPlayerService.setPlaylist(shuffledSongs, 0);
    }
  }
  goBack() {
    this.router.navigate(['/tabs/albums']);
  }

  async onSongPlay(event: { song: Song; playlist: Song[]; index: number }) {
    await this.audioPlayerService.setPlaylist(event.playlist, event.index);
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

  getTotalDurationText(): string {
    if (!this.album) return '';
    const total = this.album.totalDuration;
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}
