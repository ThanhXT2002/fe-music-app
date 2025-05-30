import { Component, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AudioPlayerService } from './services/audio-player.service';
import { SearchService } from './services/search.service';
import { Song } from './interfaces/song.interface';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [CommonModule, FormsModule, RouterOutlet],
  standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  showSearch = false;
  searchQuery = '';
  searchResults: Song[] = [];

  currentSong: Song | null = null;
  isPlaying = false;
  progressPercentage = 0;

  constructor(
    private audioPlayerService: AudioPlayerService,
    private searchService: SearchService,
    private router: Router
  ) {}

  ngOnInit() {
    // Use effect to watch playback state changes
    effect(() => {
      const state = this.audioPlayerService.playbackState();
      this.currentSong = state.currentSong;
      this.isPlaying = state.isPlaying;

      if (state.duration > 0) {
        this.progressPercentage = (state.currentTime / state.duration) * 100;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSearch() {
    this.showSearch = !this.showSearch;
    if (!this.showSearch) {
      this.clearSearch();
    }
  }

  async onSearchInput() {
    if (this.searchQuery.trim().length < 2) {
      this.searchResults = [];
      return;
    }

    const results = await this.searchService.searchAll(this.searchQuery);
    this.searchResults = results.songs.slice(0, 5); // Show top 5 results
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
  }

  async selectSearchResult(song: Song) {
    await this.audioPlayerService.playSong(song);
    this.clearSearch();
    this.showSearch = false;
  }

  async togglePlayPause() {
    await this.audioPlayerService.togglePlayPause();
  }

  async previousSong() {
    await this.audioPlayerService.playPrevious();
  }

  async nextSong() {
    await this.audioPlayerService.playNext();
  }

  openFullPlayer() {
    this.router.navigate(['/player']);
  }
}
