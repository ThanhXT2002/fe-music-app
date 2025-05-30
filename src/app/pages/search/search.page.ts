import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YoutubeService } from '../../services/youtube.service';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { Song } from '../../interfaces/song.interface';

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  url: string;
  isDownloading?: boolean;
  downloadProgress?: number;
}

@Component({
  selector: 'app-search',
  template: `
    <div class="search-page h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">Search & Download</h1>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto">
        <!-- Search Section -->
        <div class="p-4">
          <!-- Search Input -->
          <div class="relative mb-4">
            <input
              type="text"
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              placeholder="Search YouTube for music..."
              class="input w-full pl-10 pr-10">
            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <button
              *ngIf="searchQuery().length > 0"
              (click)="clearSearch()"
              class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Loading State -->
          <div *ngIf="isSearching()" class="text-center py-8">
            <div class="spinner mx-auto"></div>
            <p class="text-gray-600 dark:text-gray-400 mt-2">Searching...</p>
          </div>

          <!-- Search Results -->
          <div *ngIf="searchResults().length > 0 && !isSearching()" class="space-y-3">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Search Results
            </h3>

            <div *ngFor="let result of searchResults()"
                 class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
              <div class="flex items-center space-x-3">
                <!-- Thumbnail -->
                <img [src]="result.thumbnail"
                     [alt]="result.title"
                     class="w-16 h-12 rounded object-cover flex-shrink-0">

                <!-- Song Info -->
                <div class="flex-1 min-w-0">
                  <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {{ result.title }}
                  </h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {{ result.artist }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-500">
                    {{ result.duration }}
                  </p>
                </div>

                <!-- Download Button -->
                <div class="flex-shrink-0">
                  <button
                    *ngIf="!result.isDownloading"
                    (click)="downloadSong(result)"
                    class="btn-icon text-purple-600 hover:text-purple-700">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                  </button>

                  <!-- Download Progress -->
                  <div *ngIf="result.isDownloading" class="text-center">
                    <div class="spinner mx-auto w-6 h-6"></div>
                    <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {{ result.downloadProgress }}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- No Results -->
          <div *ngIf="searchQuery().length >= 3 && searchResults().length === 0 && !isSearching()"
               class="text-center py-8">
            <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <p class="text-gray-600 dark:text-gray-400">No results found</p>
            <p class="text-sm text-gray-500 dark:text-gray-500">Try different keywords</p>
          </div>
        </div>

        <!-- Download History Section -->
        <div *ngIf="downloadHistory().length > 0" class="px-4 pb-4">
          <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Downloaded Songs
            </h3>

            <div class="space-y-2">
              <div *ngFor="let song of downloadHistory()"
                   class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700">
                <div class="flex items-center space-x-3">
                  <!-- Thumbnail -->
                  <img [src]="song.thumbnail || 'assets/images/default-album.png'"
                       [alt]="song.title"
                       class="w-12 h-12 rounded object-cover flex-shrink-0">

                  <!-- Song Info -->
                  <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {{ song.title }}
                    </h4>
                    <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {{ song.artist }}
                    </p>
                    <p class="text-xs text-gray-500 dark:text-gray-500">
                      {{ formatDuration(song.duration) }}
                    </p>
                  </div>

                  <!-- Action Buttons -->
                  <div class="flex items-center space-x-2">
                    <!-- Favorite Button -->
                    <button
                      (click)="toggleFavorite(song)"
                      [class]="song.isFavorite ? 'text-red-500 hover:text-red-600' : 'text-gray-400 hover:text-gray-600'"
                      class="btn-icon">
                      <svg class="w-5 h-5" [attr.fill]="song.isFavorite ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                      </svg>
                    </button>

                    <!-- Play Button -->
                    <button
                      (click)="playDownloadedSong(song)"
                      class="btn-icon text-purple-600 hover:text-purple-700">
                      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="searchQuery().length < 3 && downloadHistory().length === 0"
             class="flex flex-col items-center justify-center h-64 text-center px-4">
          <svg class="w-24 h-24 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"></path>
          </svg>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Search & Download Music
          </h3>
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            Search for your favorite songs on YouTube and download them to your device
          </p>
        </div>
      </div>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class SearchPage implements OnInit {
  private youtubeService = inject(YoutubeService);
  private databaseService = inject(DatabaseService);
  private audioPlayerService = inject(AudioPlayerService);

  searchQuery = signal('');
  searchResults = signal<SearchResult[]>([]);
  isSearching = signal(false);
  downloadHistory = signal<Song[]>([]);

  ngOnInit() {
    this.loadDownloadHistory();
  }

  async onSearchInput(event: any) {
    const query = event.target.value;
    this.searchQuery.set(query);

    if (query.trim().length < 3) {
      this.searchResults.set([]);
      return;
    }

    await this.searchYouTube(query);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  async searchYouTube(query: string) {
    try {
      this.isSearching.set(true);

      // Simulate YouTube search results (in real implementation, use YouTube API)
      const mockResults: SearchResult[] = [
        {
          id: '1',
          title: 'Sample Song 1',
          artist: 'Artist Name',
          duration: '3:45',
          thumbnail: 'https://via.placeholder.com/120x90',
          url: 'https://youtube.com/watch?v=sample1'
        },
        {
          id: '2',
          title: 'Another Great Track',
          artist: 'Different Artist',
          duration: '4:12',
          thumbnail: 'https://via.placeholder.com/120x90',
          url: 'https://youtube.com/watch?v=sample2'
        }
      ];

      // Filter results based on query
      const filteredResults = mockResults.filter(result =>
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.artist.toLowerCase().includes(query.toLowerCase())
      );

      this.searchResults.set(filteredResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      this.isSearching.set(false);
    }
  }

  async downloadSong(result: SearchResult) {
    try {
      // Update UI to show downloading state
      const updatedResults = this.searchResults().map(r =>
        r.id === result.id ? { ...r, isDownloading: true, downloadProgress: 0 } : r
      );
      this.searchResults.set(updatedResults);

      // Simulate download progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const progressResults = this.searchResults().map(r =>
          r.id === result.id ? { ...r, downloadProgress: progress } : r
        );
        this.searchResults.set(progressResults);
      }      // Create song object
      const song: Song = {
        id: `yt_${result.id}_${Date.now()}`,
        title: result.title,
        artist: result.artist,
        album: 'Downloaded',
        duration: this.parseDuration(result.duration),
        audioUrl: `/data/music/${result.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
        filePath: `/data/music/${result.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
        thumbnail: result.thumbnail,
        youtubeUrl: result.url,
        addedDate: new Date(),
        playCount: 0,
        isFavorite: false
      };

      // Save to database
      await this.databaseService.addSong(song);

      // Update UI
      const finalResults = this.searchResults().map(r =>
        r.id === result.id ? { ...r, isDownloading: false, downloadProgress: 100 } : r
      );
      this.searchResults.set(finalResults);

      // Refresh download history
      await this.loadDownloadHistory();

      console.log('Song downloaded successfully:', song.title);
    } catch (error) {
      console.error('Download error:', error);
      // Reset downloading state on error
      const errorResults = this.searchResults().map(r =>
        r.id === result.id ? { ...r, isDownloading: false, downloadProgress: 0 } : r
      );
      this.searchResults.set(errorResults);
    }
  }

  async playDownloadedSong(song: Song) {
    await this.audioPlayerService.playSong(song);
  }

  async toggleFavorite(song: Song) {
    await this.databaseService.toggleFavorite(song.id);
    await this.loadDownloadHistory();
  }

  private async loadDownloadHistory() {
    try {
      const songs = await this.databaseService.getAllSongs();
      // Filter only downloaded songs (those with youtubeUrl)
      const downloaded = songs.filter(song => song.youtubeUrl);
      this.downloadHistory.set(downloaded);
    } catch (error) {
      console.error('Error loading download history:', error);
    }
  }

  private parseDuration(durationStr: string): number {
    const parts = durationStr.split(':');
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return (minutes * 60) + seconds;
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
