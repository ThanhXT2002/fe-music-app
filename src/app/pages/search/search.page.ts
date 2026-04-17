import { UiStateService } from '@core/ui/ui-state.service';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ModalController } from '@ionic/angular/standalone';
import { SearchStore } from '../../core/stores/search.store';
import { YtPlayerStore } from '../../core/stores/yt-player.store';
import { SongItemHomeComponent } from 'src/app/components/song-item-home/song-item-home.component';
import { Song } from '@core/interfaces/song.interface';
import { Router } from '@angular/router';
import { LoadingService } from '@core/ui/loading.service';
import { Capacitor } from '@capacitor/core';

import { SkeletonSongItemComponent } from 'src/app/components/skeleton-song-item/skeleton-song-item.component';
import { HealthCheckService } from '@core/api/health-check.service';
import { InternetErrorComponent } from 'src/app/components/internet-error/internet-error.component';
import { Oops505Component } from 'src/app/components/oops-505/oops-505.component';

/**
 * Trang tìm kiếm bài hát trên YouTube.
 *
 * Chức năng:
 * - Gợi ý tự động (auto-suggest) khi người dùng gõ từ khóa
 * - Hỗ trợ thao tác bàn phím trên Desktop (mũi tên Lên/Xuống/Enter) để chọn gợi ý
 * - Lấy kết quả từ YouTube và khởi chạy trình phát YtPlayer
 * - Theo dõi và báo trạng thái kết nối mạng
 *
 * Route: /search
 * Phụ thuộc: SearchStore, YtPlayerStore, LoadingService
 */
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
  // ═══ STORES (2 main) ═══
  /** Store phụ trách lưu trữ trạng thái tìm kiếm và auto-suggest */
  readonly search = inject(SearchStore);
  /** Store phụ trách cấu hình play list nhạc truyền từ YouTube */
  private readonly ytPlayer = inject(YtPlayerStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly modalCtrl = inject(ModalController);
  private readonly location = inject(Location);
  private readonly loadingService = inject(LoadingService);
  private readonly pageContext = inject(UiStateService);
  private readonly router = inject(Router);
  /** Service kiểm tra backend có đang online không */
  readonly healthCheckService = inject(HealthCheckService);

  /** Trạng thái online offline của thiết bị */
  isOnline: boolean = navigator.onLine;
  /** Nền tảng thiết bị */
  isNative = Capacitor.isNativePlatform();
  /** Mảng dummy 20 phần tử dùng cho skeleton loading */
  skeletonArray = Array.from({ length: 20 }, (_, i) => i);

  /** Tham chiếu đến list các element gợi ý để phục vụ auto-scroll khi dùng phím lướt */
  @ViewChildren('suggestionItem') suggestionItems!: QueryList<ElementRef>;

  get isHealthyValue() {
    return this.healthCheckService.isHealthy();
  }

  // ═══ DELEGATES → SearchStore signals ═══
  get searchQuery() { return this.search.query; }
  get searchResults() { return this.search.results; }
  get isSearching() { return this.search.isSearching; }
  get suggestions() { return this.search.suggestions; }
  get showSuggestions() { return this.search.showSuggestions; }
  get highlightedIndex() { return this.search.highlightedIndex; }
  get songSectionData() { return this.search.songResults; }

  // ═══ LIFECYCLE ═══
  ngOnInit() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.healthCheckService.refreshHealth();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    this.pageContext.setCurrentPage('search');
    this.search.init(this.destroyRef);
  }

  ngAfterViewInit() {
    this.suggestionItems.changes.subscribe(() => {
      this.scrollToHighlighted();
    });
  }

  // ═══ EVENT HANDLERS ═══
  onSearchInput(event: any) {
    const query = event.target.value;
    this.search.setQuery(query);
  }

  onInputChange(event: any) {
    const query = event.target.value;
    this.search.updateQueryForSuggestions(query);
  }

  onSuggestionClick(s: string) {
    this.search.selectSuggestion(s);
  }

  onSearchButtonClick() {
    this.search.searchNow();
  }

  clearSearch() {
    this.search.clear();
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

  onInputKeydown(event: KeyboardEvent) {
    const suggests = this.suggestions();
    if (!suggests.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.search.navigateHighlight('down');
      this.scrollToHighlighted();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.search.navigateHighlight('up');
      this.scrollToHighlighted();
    } else if (event.key === 'Enter' && this.highlightedIndex() >= 0) {
      this.onSuggestionClick(suggests[this.highlightedIndex()]);
    }
  }

  async onSongClick(song: Song) {
    this.loadingService.show();
    const success = await this.ytPlayer.loadPlaylist(song.id);
    this.loadingService.hide();

    if (success) {
      this.router.navigate(['/yt-player'], {
        queryParams: { v: song.id, list: this.ytPlayer.playlistId() },
      });
    }
  }

  onSongOptions(song: Song) {
    console.log('Song options:', song);
  }

  trackBySongId(index: number, song: Song): string {
    return song.id;
  }

  // ═══ PRIVATE ═══
  private scrollToHighlighted() {
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
}
