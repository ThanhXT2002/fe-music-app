import { Component, effect, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
} from '@angular/router';
import { Song } from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Subject } from 'rxjs';
import { SearchService } from 'src/app/services/search.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  standalone: true,
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnDestroy {
  private destroy$ = new Subject<void>();
  private audioPlayerService = inject(AudioPlayerService);
  private router = inject(Router);
  private searchService = inject(SearchService);

  showSearch = false;
  isVisible = false;
  searchQuery = '';
  searchResults: Song[] = [];

  currentSong: Song | null = null;
  isPlaying = false;
  progressPercentage = 0;

  // Move effect to field initializer để tránh lỗi injection context
  private playerStateEffect = effect(() => {
    const state = this.audioPlayerService.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;

    if (state.duration > 0) {
      this.progressPercentage = (state.currentTime / state.duration) * 100;
    }
  });

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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
