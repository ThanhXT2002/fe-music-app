import { Injectable, signal, computed, inject } from '@angular/core';
import { DataSong } from '@core/interfaces/song.interface';
import { DownloadService, DownloadTask } from '@core/services/download.service';

/**
 * Manage tiến trình Tải Nhạc lưu trữ cục bộ (Local Download Management).
 *
 * Kiến trúc lớp: Tầng Store (API → **Store** → Component)
 *
 * Nhiệm vụ:
 * - Thay vì gọi thẳng `DownloadService`, Component sẽ tiêm (inject) Store này.
 * - Chuyển đổi trạng thái từ BehaviorSubject sang Signals để đồng bộ quy chuẩn State.
 * - Cung cấp Computed Value cho các tab Đang tải (Active), Hoàn thành (Completed), Lỗi (Failed).
 */
@Injectable({ providedIn: 'root' })
export class DownloadStore {
  private downloadService = inject(DownloadService);

  // ─────────────────────────────────────────────────────────
  // STATE — Đồng bộ luồng BehaviorSubject thành Signal
  // ─────────────────────────────────────────────────────────

  /** Mảng quản lý danh sách tiến trình tải file (tự động đồng bộ từ DownloadService) */
  readonly tasks = signal<DownloadTask[]>([]);

  constructor() {
    // Pipeline Sync liên tục biến động Subject của Service đổ vào Signal
    this.downloadService.downloads$.subscribe(downloads => {
      this.tasks.set(downloads);
    });
  }

  // ─────────────────────────────────────────────────────────
  // COMPUTED - State Phái Sinh
  // ─────────────────────────────────────────────────────────

  /** Lọc các luồng tải đang trong quá trình Active (Đang tải hoặc Chờ) */
  readonly activeDownloads = computed(() =>
    this.tasks().filter(t =>
      t.status === 'downloading' || t.status === 'pending'
    )
  );

  /** Luồng tải thành công nằm ở vùng nhớ Đã lưu */
  readonly completedDownloads = computed(() =>
    this.tasks().filter(t => t.status === 'completed')
  );

  /** Luồng tải gặp rủi ro do quá trình Fetch lỗi */
  readonly failedDownloads = computed(() =>
    this.tasks().filter(t => t.status === 'error')
  );

  /** Cờ báo hiệu giao diện xem có luồng nào đang bận không (Icon Loading bar) */
  readonly hasActiveDownloads = computed(() =>
    this.activeDownloads().length > 0
  );

  /** Bộ đếm trực tiếp lượng Track Task đang tải */
  readonly activeCount = computed(() =>
    this.activeDownloads().length
  );

  // ─────────────────────────────────────────────────────────
  // ACTIONS - Method Giao Nối Component
  // ─────────────────────────────────────────────────────────

  /**
   * Kích phát việc tải một bài hát.
   */
  async download(song: DataSong): Promise<void> {
    await this.downloadService.downloadSong(song);
  }

  /**
   * Kiểm tra chéo trạng thái bài hát này đã từng được lưu hay chưa.
   */
  isDownloaded(songId: string): boolean {
    return this.downloadService.isSongDownloaded(songId);
  }

  /**
   * Truy xuất cấu trúc Data Task Download (Tiến trình đang tải) của bài hát.
   */
  getTask(songId: string): DownloadTask | undefined {
    return this.tasks().find(t => t.songData?.id === songId);
  }

  /**
   * Huỷ và xóa luồng tải đang chạy.
   */
  cancelDownload(songId: string): void {
    this.downloadService.cancelDownload(songId);
  }

  /**
   * Thử tải lại bài hát đã bị lỗi (Retry).
   */
  async retryDownload(song: DataSong): Promise<void> {
    await this.downloadService.downloadSong(song);
  }

  /**
   * Dọn dẹp thùng rác hoặc xóa cache mảng các bài đã tải XONG khỏi UI.
   */
  clearCompleted(): void {
    this.downloadService.clearCompleted();
  }

  /**
   * Trích xuất luồng Observable thô (Khuyến khích dùng Signals nếu muốn Native Sync UI).
   */
  get downloads$() {
    return this.downloadService.downloads$;
  }
}
