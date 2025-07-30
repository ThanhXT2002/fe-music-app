import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController, IonicModule } from '@ionic/angular';
import { YtMusicService } from 'src/app/services/api/ytmusic.service';

import { YTMusicSearchResult } from 'src/app/interfaces/ytmusic.interface';
import { debounceTime, Subject } from 'rxjs';
import { SongItemHomeComponent } from 'src/app/components/song-item-home/song-item-home.component';
import { Song } from 'src/app/interfaces/song.interface';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { YtPlayerService } from 'src/app/services/yt-player.service';
import { Router } from '@angular/router';
import { LoadingService } from 'src/app/services/loading.service';
import { Capacitor } from '@capacitor/core';
import { PageContextService } from 'src/app/services/page-context.service';
import { SkeletonSongItemComponent } from 'src/app/components/skeleton-song-item/skeleton-song-item.component';
import { Title } from '@angular/platform-browser';
import { HealthCheckService } from 'src/app/services/api/health-check.service';
import { InternetErrorComponent } from 'src/app/components/internet-error/internet-error.component';
import { Oops505Component } from 'src/app/components/oops-505/oops-505.component';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SongItemHomeComponent,
    SkeletonSongItemComponent,
    InternetErrorComponent,
    Oops505Component,
  ],
  styleUrls: ['./search.page.scss'],
})
export class SearchPage implements OnInit, AfterViewInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly ytMusicService = inject(YtMusicService);
  private readonly destroyRef = inject(DestroyRef);
  private location = inject(Location);
  private ytPlayerService = inject(YtPlayerService);
  private loadingService = inject(LoadingService);
  private pageContext = inject(PageContextService);
  private router = inject(Router);
  healthCheckService = inject(HealthCheckService);

  isOnline: boolean = navigator.onLine;
  get isHealthyValue() {
    return this.healthCheckService.isHealthy();
  }

  isNative = Capacitor.isNativePlatform();

  // Signals
  searchQuery = signal('');
  searchResults = signal<YTMusicSearchResult[]>([]);
  isSearching = signal(false);
  // Gợi ý autocomplete
  suggestions = signal<string[]>([]);
  showSuggestions = signal(false);

  highlightedIndex = signal(-1);
  @ViewChildren('suggestionItem') suggestionItems!: QueryList<ElementRef>;

  // Computed signal để tối ưu performance
  songSectionData = computed(() => {
    return this.searchResults()
      .filter((item: any) => item.resultType === 'song')
      .map((item: any) => ({
        id: item.videoId || '',
        title: item.title || '',
        artist:
          item.artists && item.artists.length > 0
            ? item.artists[0].artist || item.artists[0].name
            : '',
        duration: item.duration_seconds || 0,
        duration_formatted: item.duration || '',
        keywords: [],
        audio_url: '',
        thumbnail_url:
          item.thumbnails && item.thumbnails.length > 0
            ? item.thumbnails[0].url
            : '',
        isFavorite: false,
        addedDate: new Date(),
      }));
  });

  private searchSubject = new Subject<string>();
  private suggestionSubject = new Subject<string>();
  skeletonArray = Array.from({ length: 20 }, (_, i) => i);

  ngOnInit() {
    window.addEventListener('online', () => {
      console.log('Online status changed:', navigator.onLine);
      this.isOnline = true;
      this.healthCheckService.refreshHealth();
    });

    window.addEventListener('offline', () => {
      console.log('Offline status detected');
      this.isOnline = false;
    });

    this.pageContext.setCurrentPage('search');
    // Sử dụng takeUntilDestroyed để tự động unsubscribe
    this.searchSubject
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        this.searchYouTube(query);
      });

    // Gợi ý autocomplete
    this.suggestion();
  }

  ngAfterViewInit() {
    this.suggestionItems.changes.subscribe(() => {
      this.scrollToHighlighted();
    });
  }

  suggestion() {
    this.suggestionSubject
      .pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => {
        if (query.trim().length < 1) {
          this.suggestions.set([]);
          this.showSuggestions.set(false);
          return;
        }
        this.ytMusicService.searchSuggestions(query).subscribe({
          next: (suggests) => {
            this.suggestions.set(suggests);
            this.showSuggestions.set(suggests.length > 0);
            this.highlightedIndex.set(-1); // Reset highlight khi có gợi ý mới
          },
          error: () => {
            this.suggestions.set([]);
            this.showSuggestions.set(false);
            this.highlightedIndex.set(-1);
          },
        });
      });
  }

  scrollToHighlighted() {
    setTimeout(() => {
      const items = this.suggestionItems.toArray();
      const idx = this.highlightedIndex();
      if (items[idx]) {
        items[idx].nativeElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    });
  }

  async onSearchInput(event: any) {
    const query = event.target.value;
    this.searchQuery.set(query);

    if (query.trim().length < 3) {
      this.searchResults.set([]);
      this.isSearching.set(false);
      return;
    }

    this.isSearching.set(true);
    this.searchSubject.next(query);
  }

  onInputChange(event: any) {
    const query = event.target.value;
    this.searchQuery.set(query);
    // Gọi gợi ý
    if (query.trim().length > 0) {
      this.suggestionSubject.next(query);
    } else {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  onSuggestionClick(s: string) {
    this.searchQuery.set(s);
    this.onSearchButtonClick();
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  onBack() {
    const backUrl = localStorage.getItem('back-search');
    if (backUrl) {
      localStorage.removeItem('back-search');
      this.router.navigate([backUrl]);
    } else {
      this.location.back();
    }
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.isSearching.set(false);
    this.suggestions.set([]);
    this.showSuggestions.set(false);
  }

  async searchYouTube(query: string) {
    if (!query.trim()) {
      this.searchResults.set([]);
      this.isSearching.set(false);
      return;
    }

    try {
      this.ytMusicService
        .search(query, 'songs')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (results) => {
            this.searchResults.set(results);
          },
          error: (err) => {
            console.error('Search error:', err);
            this.searchResults.set([]);
            this.isOnline = navigator.onLine;
            if(this.isOnline){
              this.healthCheckService.refreshHealth();
            }
          },
          complete: () => {
            this.isSearching.set(false);
          },
        });
    } catch (error) {
      console.error('Search error:', error);
      this.isSearching.set(false);
      this.searchResults.set([]);
    }
  }

  onSearchButtonClick() {
    this.showSuggestions.set(false);
    const query = this.searchQuery().trim();
    if (query.length < 1) {
      this.searchResults.set([]);
      return;
    }
    this.isSearching.set(true);
    this.searchYouTube(query);
  }

  onInputKeydown(event: KeyboardEvent) {
    const suggestions = this.suggestions();
    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex.set(
        (this.highlightedIndex() + 1) % suggestions.length
      );
      this.scrollToHighlighted(); // Thêm dòng này
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex.set(
        (this.highlightedIndex() - 1 + suggestions.length) % suggestions.length
      );
      this.scrollToHighlighted(); // Thêm dòng này
    } else if (event.key === 'Enter' && this.highlightedIndex() >= 0) {
      this.onSuggestionClick(suggestions[this.highlightedIndex()]);
    }
  }

  onSongClick(song: Song) {
    this.loadingService.show();
    this.ytMusicService.getPlaylistWithSong(song.id).subscribe({
      next: (res) => {
        const tracks = res.tracks;
        const playlistId = res.playlistId ?? null;
        const related = res.related ?? null;
        localStorage.setItem('yt-tracks', JSON.stringify(tracks));
        localStorage.setItem('yt-playlistId', JSON.stringify(playlistId));
        localStorage.setItem('yt-related', JSON.stringify(related));
        this.ytPlayerService.currentPlaylist.set(tracks);
        this.ytPlayerService.playlistId.set(playlistId);
        this.ytPlayerService.ralated.set(related);
        this.loadingService.hide();
        this.router.navigate(['/yt-player'], {
          queryParams: { v: song.id, list: res.playlistId },
        });
      },
      error: (err) => {
        console.error('Error fetching playlist with related:', err);
      },
    });
  }

  onSongOptions(song: Song) {
    // Xử lý khi click vào nút options của bài hát
    console.log('Song options:', song);
    // TODO: Implement options menu
  }

  // Trackby function để tối ưu ngFor
  trackBySongId(index: number, song: Song): string {
    return song.id;
  }
}
