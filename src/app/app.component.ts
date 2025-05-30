import { Component, OnInit, OnDestroy, signal, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AudioPlayerService } from './services/audio-player.service';
import { SearchService } from './services/search.service';
import { ThemeService } from './services/theme.service';
import { Song } from './interfaces/song.interface';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink],
  standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private audioPlayerService = inject(AudioPlayerService);
  private searchService = inject(SearchService);
  private themeService = inject(ThemeService); // Inject để khởi tạo theme service

  showSearch = false;
  isVisible = false;
  searchQuery = '';
  searchResults: Song[] = [];

  currentSong: Song | null = null;
  isPlaying = false;
  progressPercentage = 0;

  ngOnInit() {
    // Theme service sẽ tự động apply theme khi khởi tạo
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleSearch() {
  if (!this.showSearch) {
    // Mở: cho hiện luôn và áp hiệu ứng
    this.isVisible = true;
    setTimeout(() => {
      this.showSearch = true;
    }, 10); // delay nhỏ để áp class `slide-down`
  } else {
    // Đóng: áp hiệu ứng trước rồi ẩn hẳn
    this.showSearch = false;
    setTimeout(() => {
      this.isVisible = false;
    }, 300); // chờ hiệu ứng `slide-up` xong rồi mới ẩn
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
}
