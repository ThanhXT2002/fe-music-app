import { UiStateService } from '@core/ui/ui-state.service';
import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  Input,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  effect,
} from '@angular/core';
import { DataSong, Song } from '@core/interfaces/song.interface';
import { PlayerStore } from '../../core/stores/player.store';
import { DownloadStore } from '../../core/stores/download.store';
import { LibraryStore } from '../../core/stores/library.store';
import {
  DownloadService,
  DownloadTask,
} from '@core/services/download.service';
import { Subscription, takeWhile } from 'rxjs';

/**
 * Component cụm tổng hợp chức năng Action thao tác nhanh về bài hát.
 * Chứa đựng: Nút "Tải Xuống Offline" (Download) & Nút thả "Tim" (Heart/Favorite) gom thành hàng ngang.
 *
 * Chức năng:
 * - Trực tiếp gọi DownloadStore để tống nhạc vào hàng chờ đợi kéo mảng mp3.
 * - Call LibraryStore để lật ngược biến số Yêu thích (Toggle Like) theo model bài hát.
 * - Hiển thị đồ hoạ Spinner tiến trình nhỏ xinh báo cáo cho bài đang Download.
 */
@Component({
  selector: 'app-btn-down-and-heart',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './btn-down-and-heart.component.html',
  styleUrls: ['./btn-down-and-heart.component.scss'],
})
export class BtnDownAndHeartComponent implements OnInit, OnDestroy {
  // ─────────────────────────────────────────────────────────
  // Dependencies Injection (Store/Service)
  // ─────────────────────────────────────────────────────────
  private readonly downloadService = inject(DownloadService);
  private readonly downloadStore = inject(DownloadStore);
  private readonly player = inject(PlayerStore);
  private readonly library = inject(LibraryStore);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly pageContext = inject(UiStateService);

  // ─────────────────────────────────────────────────────────
  // Variables 
  // ─────────────────────────────────────────────────────────
  private downloadStatusSub?: Subscription;
  private songDownloadedSub?: Subscription;

  /** Phiên bản Data Model Bài Hát nhồi từ Component lớn cha truyền qua */
  @Input() song!: Song;

  /** Cờ khẳng định file âm thanh đã được download và đóng kho lưu ổn thoả 100% trong máy */
  isDownloaded: boolean = false;
  
  /** Cờ cho giao diện thiết kế biết chúng ta đang bị chèn vào trang Search List chứ không phải Player */
  isSearchPage = false;

  // ─────────────────────────────────────────────────────────
  // Computed Getters (Logic Render)
  // ─────────────────────────────────────────────────────────
  /**
   * Tính kết quả Loading chớp chớp khi API backend còn đang fetch URL Stream trước giờ G Download.
   */
  get isLoading(): boolean {
    return (
      !!this.song &&
      this.downloadService.loadingFallbackSongIds().has(this.song.id)
    );
  }

  /**
   * Bốc Data Object từ Service đang làm nhiệm vụ Download để quan sát nội bộ tiến trình.
   */
  get downloadTask(): DownloadTask | undefined {
    return this.downloadService.getDownloadBySongId(this.song.id);
  }

  /**
   * Biến phản biện xem Service Tải Ngầm liệu có đang nhúc nhíc cắn Byte mạng cho dòng chảy này.
   */
  get isDownloading(): boolean {
    return (
      !!this.downloadTask &&
      (this.downloadTask.status === 'downloading' ||
        this.downloadTask.status === 'pending')
    );
  }

  /**
   * Số tỉ lệ tải theo mốc thập phân phần trăm dùng lợp viền SVG Spinner tròn.
   */
  get downloadProgress(): number {
    return this.downloadTask?.progress ?? 0;
  }

  // ─────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      const page = this.pageContext.getCurrentPage()();
      if (page === 'search') {
        this.isSearchPage = true;
      }
    });
  }

  ngOnInit() {
    this.songDownloadedSub = this.downloadService.songDownloaded$.subscribe(
      (data) => {
        if (data && data.songId === this.song.id) {
          this.isDownloaded = data.downloaded;
          this.cdr.markForCheck();
        }
      }
    );
    this.checkDownloaded();
  }

  ngOnDestroy() {
    this.songDownloadedSub?.unsubscribe();
    this.downloadStatusSub?.unsubscribe();
  }

  // ─────────────────────────────────────────────────────────
  // Core Actions
  // ─────────────────────────────────────────────────────────
  /**
   * Giao tiếp lấy kết quả tải về thật của Node ID và cập nhật tick icon xanh hoàn thành.
   */
  async checkDownloaded() {
    this.isDownloaded = await this.downloadService.isSongDownloadedDB(
      this.song.id
    );
    this.cdr.markForCheck();
  }

  /**
   * Hành động đổi màu Tim khi User thích List Nhạc (Favorite Toggle) và thao tác lên CSDL.
   */
  async toggleFavorite() {
    if (this.song) {
      try {
        await this.library.toggleFavorite(this.song.id);
        this.song.isFavorite = !this.song.isFavorite;
        this.player.updateCurrentSong(this.song); // Phản chiếu thay đổi lên Box Player cha nếu đang phát
      } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Lỗi cấu hình CSDL Yêu Thích:', error);
      }
    }
  }

  /**
   * Khởi phát dây chuyền tạo lập đối tượng Tải bài hát nhét vào hàng đợi.
   */
  async toggleDownload(): Promise<void> {
    const song: DataSong = {
      id: this.song.id,
      title: this.song.title,
      artist: this.song.artist,
      thumbnail_url: this.song.thumbnail_url,
      duration: this.song.duration,
      duration_formatted: this.song.duration_formatted,
      keywords: this.song.keywords,
      original_url: '',
      created_at: new Date().toISOString(),
    };

    if (!song) return;
    if (this.isDownloaded) return;

    try {
      await this.downloadStore.download(song);

      this.downloadStatusSub?.unsubscribe();
      this.downloadStatusSub = this.downloadStore.downloads$
        .pipe(
          takeWhile((downloads) => {
            const task = downloads.find((d) => d.songData?.id === this.song.id);
            return !(task && task.status === 'completed');
          }, true)
        )
        .subscribe((downloads) => {
          const task = downloads.find((d) => d.songData?.id === this.song.id);
          if (task && task.status === 'completed') {
            setTimeout(() => {
              this.checkDownloaded();
              this.library.refresh();
            }, 300);
          }
        });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('Tải xuống luồng mảng lỗi:', error);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Helper Queries
  // ─────────────────────────────────────────────────────────
  /**
   * Lục lọi List Download Đang Xử Lý xem phiên của Bài hát này còn làm việc kéo Mạng không.
   */
  get currentDownloadTask() {
    if (!this.song) return null;
    const downloads = this.downloadService.currentDownloads;
    return downloads.find((d) => d.songData?.id === this.song.id);
  }

  /**
   * Bắt Array Download thô và gạn lọc trả về Object Task chứa bài hát hiện thời.
   */
  getDownloadTask(downloads: DownloadTask[] | null): DownloadTask | null {
    if (!downloads) return null;
    return downloads.find((d) => d.songData?.id === this.song.id) || null;
  }

  /**
   * Trả về Boolean khẳng định Server Crawler YTC vẫn đang xử lý chưa cấy xong Audio Buffer.
   */
  isPolling(songId: string): boolean {
    return this.downloadService.isPolling(songId);
  }
}
