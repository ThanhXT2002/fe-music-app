import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { YtMusicService } from '@core/api/ytmusic.service';
import { YTMusicSearchResult } from '@core/interfaces/ytmusic.interface';
import { Song } from '@core/interfaces/song.interface';

/**
 * SearchStore — Cột trụ lõi quản lý tiến trình Tìm Kiếm Nhạc.
 *
 * Nhiệm vụ kiến trúc: Tầng Store (API → **Store** → Component)
 * - Tách Logic xử lý chằng chịt ra khỏi SearchPage.
 * - Giải quyết tự động bài toán Debounce Search (Chống dội API).
 * - Quản lý Gợi ý từ khoá (Autocomplete suggestions).
 * - Biến đổi Raw Data (Youtube API) thành Song Models cục bộ.
 */
@Injectable({ providedIn: 'root' })
export class SearchStore {
  private ytMusicService = inject(YtMusicService);

  // ─────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────

  /** Current search query */
  readonly query = signal('');

  /** Raw search results from YouTube Music API */
  readonly results = signal<YTMusicSearchResult[]>([]);

  /** Whether a search is in progress */
  readonly isSearching = signal(false);

  /** Autocomplete suggestions */
  readonly suggestions = signal<string[]>([]);

  /** Whether to show suggestions dropdown */
  readonly showSuggestions = signal(false);

  /** Highlighted suggestion index (-1 = none) */
  readonly highlightedIndex = signal(-1);

  // ─────────────────────────────────────────────────────────
  // SUBJECTS - Nguồn chảy cho luồng Debounce
  // ─────────────────────────────────────────────────────────

  private searchSubject = new Subject<string>();
  private suggestionSubject = new Subject<string>();

  // ─────────────────────────────────────────────────────────
  // COMPUTED - State sinh ra từ dữ liệu gốc
  // ─────────────────────────────────────────────────────────

  /** Transformed song results for UI display */
  readonly songResults = computed(() =>
    this.results()
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
        keywords: [] as string[],
        audio_url: '',
        thumbnail_url:
          item.thumbnails && item.thumbnails.length > 0
            ? item.thumbnails[0].url
            : '',
        isFavorite: false,
        addedDate: new Date(),
      } as Song))
  );

  /** Whether there is an active query */
  readonly hasQuery = computed(() => this.query().trim().length > 0);

  // ─────────────────────────────────────────────────────────
  // INIT — Thiết lập vòng đời (Cần được Inject từ Component có DestroyRef)
  // ─────────────────────────────────────────────────────────

  /**
   * Khởi chạy hệ stream lắng nghe tìm kiếm và gợi ý từ khóa.
   * Phải được gọi bên trong phương thức `ngOnInit` ở Component, đồng bộ DestroyRef.
   */
  init(destroyRef: DestroyRef): void {
    // Search debounce (400ms)
    this.searchSubject
      .pipe(debounceTime(400), takeUntilDestroyed(destroyRef))
      .subscribe(query => this.executeSearch(query));

    // Suggestion debounce (200ms)
    this.suggestionSubject
      .pipe(debounceTime(200), takeUntilDestroyed(destroyRef))
      .subscribe(query => this.fetchSuggestions(query));
  }

  // ─────────────────────────────────────────────────────────
  // ACTIONS - Method cho Giao diện UI
  // ─────────────────────────────────────────────────────────

  /** Update query and trigger debounced search */
  setQuery(query: string): void {
    this.query.set(query);

    if (query.trim().length < 3) {
      this.results.set([]);
      this.isSearching.set(false);
      return;
    }

    this.isSearching.set(true);
    this.searchSubject.next(query);
  }

  /** Update query and trigger suggestions (lightweight, for input changes) */
  updateQueryForSuggestions(query: string): void {
    this.query.set(query);

    if (query.trim().length > 0) {
      this.suggestionSubject.next(query);
    } else {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  /** Select a suggestion → trigger search */
  selectSuggestion(suggestion: string): void {
    this.query.set(suggestion);
    this.showSuggestions.set(false);
    this.searchNow();
  }

  /** Trigger immediate search (e.g., button click or Enter key) */
  searchNow(): void {
    const query = this.query().trim();
    this.showSuggestions.set(false);

    if (query.length < 1) {
      this.results.set([]);
      return;
    }

    this.isSearching.set(true);
    this.executeSearch(query);
  }

  /** Navigate highlighted suggestion via keyboard */
  navigateHighlight(direction: 'up' | 'down'): void {
    const count = this.suggestions().length;
    if (!count) return;

    if (direction === 'down') {
      this.highlightedIndex.set(
        (this.highlightedIndex() + 1) % count
      );
    } else {
      this.highlightedIndex.set(
        (this.highlightedIndex() - 1 + count) % count
      );
    }
  }

  /** Clear all search state */
  clear(): void {
    this.query.set('');
    this.results.set([]);
    this.isSearching.set(false);
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.highlightedIndex.set(-1);
  }

  // ─────────────────────────────────────────────────────────
  // PRIVATE - Helpers nội bộ
  // ─────────────────────────────────────────────────────────

  private executeSearch(query: string): void {
    if (!query.trim()) {
      this.results.set([]);
      this.isSearching.set(false);
      return;
    }

    this.ytMusicService.search(query, 'songs').subscribe({
      next: results => this.results.set(results),
      error: err => {
        console.error('Search error:', err);
        this.results.set([]);
      },
      complete: () => this.isSearching.set(false),
    });
  }

  private fetchSuggestions(query: string): void {
    if (query.trim().length < 1) {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
      return;
    }

    this.ytMusicService.searchSuggestions(query).subscribe({
      next: suggests => {
        this.suggestions.set(suggests);
        this.showSuggestions.set(suggests.length > 0);
        this.highlightedIndex.set(-1);
      },
      error: () => {
        this.suggestions.set([]);
        this.showSuggestions.set(false);
        this.highlightedIndex.set(-1);
      },
    });
  }
}
