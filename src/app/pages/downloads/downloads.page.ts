import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from '../../services/database.service';
import {
  DownloadService,
  DownloadTask,
  CompletionNotification,
  StatusNotification,
} from '../../services/download.service';
import { DataSong, SearchHistoryItem } from '../../interfaces/song.interface';
import { ClipboardService } from 'src/app/services/clipboard.service';
import { ToastService } from 'src/app/services/toast.service';
import { AlertController } from '@ionic/angular/standalone';
import { firstValueFrom, skip, takeUntil } from 'rxjs';
import { routeAnimation } from 'src/app/shared/route-animation';
import { SongItemComponent } from '../../components/song-item/song-item.component';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-downloads',
  templateUrl: './downloads.page.html',
  styleUrls: ['./downloads.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, SongItemComponent],
  animations: [routeAnimation],
})
export class DownloadsPage implements OnInit, OnDestroy {
  private databaseService = inject(DatabaseService);
  downloadService = inject(DownloadService);
  private clipboardService = inject(ClipboardService);
  private alertController = inject(AlertController);
  private toastService = inject(ToastService);
  private platform = inject(Platform);

  searchQuery = signal('');
  searchResults = signal<DataSong[]>([]);
  isSearching = signal(false);
  searchHistoryItem = signal<SearchHistoryItem[]>([]);
  originalSearchHistory = signal<SearchHistoryItem[]>([]);
  isClipboardLoading = signal<boolean>(false);

  // Download state - chỉ subscribe từ service
  downloads = signal<DownloadTask[]>([]);

  private destroy$ = new Subject<void>();

  constructor() {}

  // Song status tracking - sử dụng service thay vì local
  // private songStatusMap = signal<Map<string, { status: string; progress: number; ready: boolean }>>(new Map());
  // private pollingIntervals = new Map<string, any>();

  async ngOnInit() {
    await this.loadSearchHistory();

    // Subscribe to download changes - notification logic moved to service
    this.downloadService.downloads$
      .pipe(takeUntil(this.destroy$))
      .subscribe((downloads) => {
        this.downloads.set(downloads);
      });

    // Auto-paste from clipboard on load
    // await this.tryAutoPaste();
  }
  /**
   * Tự động paste từ clipboard nếu có URL YouTube hợp lệ (chỉ cho native)
   */
  private async tryAutoPaste() {
    try {
      // Chỉ auto-paste trên native platform
      const result = await this.clipboardService.smartRead();

      if (result.success && result.content) {
        // Validate YouTube URL trước khi auto-paste
        const validation = this.clipboardService.validateClipboardContent(
          result.content
        );

        if (validation.isValid && validation.isYouTubeUrl) {
          const finalUrl = validation.cleanUrl || result.content;
          this.searchQuery.set(finalUrl);
          await this.processYouTubeUrl(finalUrl);
          this.toastService.success(
            'Đã tự động dán link YouTube từ clipboard!'
          );
        }
      }
      // Không hiển thị lỗi cho auto-paste để tránh làm phiền user
    } catch (error) {
      // Silent fail cho auto-paste
    }
  }
  async onSearchInput(event: any) {
    const query = event.target.value?.trim() || '';
    this.searchQuery.set(query);

    // Nếu query rỗng, reset về trạng thái ban đầu
    if (query.length === 0) {
      this.clearSearch();
      return;
    }

    // Nếu là YouTube URL, không filter lịch sử
    if (this.downloadService.validateYoutubeUrl(query)) {
      // Reset search results, giữ nguyên lịch sử
      this.searchResults.set([]);
      this.searchHistoryItem.set(this.originalSearchHistory());
      return;
    }

    // Nếu là text search, filter lịch sử theo query
    if (query.length >= 2) {
      this.filterSearchHistory(query);
    }
  }

  async processYouTubeUrl(url: string) {
    try {
      this.isSearching.set(true);

      // Step 1: Get song info từ API
      const response = await firstValueFrom(
        this.downloadService.getSongInfo(url)
      );

      if (response.success) {
        const songData = response.data;

        // Step 2: Kiểm tra xem bài hát đã được download chưa
        if (this.isDownloaded(songData.id)) {
          // Show song info nhưng không start polling
          this.showSongInfo(songData);
          this.toastService.success('Bài hát đã được tải về!');
          return;
        }

        // Step 3: Save ONLY to search history (not to songs table yet)
        await this.databaseService.addToSearchHistory(songData);

        // Step 4: Show song info to user
        this.showSongInfo(songData);

        // Step 5: Start polling status in background để check khi nào ready
        this.downloadService.startStatusPolling(songData);

        // Reload search history to show the new item
        await this.loadSearchHistory();

        this.toastService.success(
          'Đã lấy thông tin bài hát thành công! Đang chuẩn bị dữ liệu.'
        );
      } else {
        console.error('API returned error:', response.message);
        this.toastService.error(`Lỗi: ${response.message}`);
        this.searchResults.set([]);
      }
    } catch (error) {
      console.error('Error processing YouTube URL:', error);
      this.toastService.error(
        `Lỗi: ${error instanceof Error ? error.message : 'Không thể xử lý URL'}`
      );
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
    }
  }

  showSongInfo(song: DataSong) {
    const result: DataSong = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      duration: song.duration,
      duration_formatted: song.duration_formatted,
      thumbnail_url: song.thumbnail_url,
      keywords: song.keywords || [],
      original_url: song.original_url,
      created_at: song.created_at,
    };

    this.searchResults.set([result]);
  }

  /**
   * Download bài hát từ search results - NEW WORKFLOW
   * @param songData - Data bài hát từ API
   */
  async downloadSong(songData: DataSong) {
    try {
      // Step 1: Kiểm tra xem bài hát có ready không
      if (!this.downloadService.isSongReadyForDownload(songData.id)) {
        this.toastService.warning('Bài hát chưa sẵn sàng để tải xuống!');
        return;
      }

      // Step 2: Kiểm tra xem đã download chưa
      if (this.isDownloaded(songData.id)) {
        this.toastService.warning('Bài hát đã được tải xuống!');
        return;
      }

      // Step 3: Sử dụng downloadService để tạo download task với progress tracking
      this.toastService.info(`Đang tải "${songData.title}"...`);

      // Tạo download task bằng downloadService
      await this.downloadService.downloadSong(songData);

      // Download task đã được tạo và bắt đầu process tự động thông qua downloadService
      // UI sẽ tự động update thông qua reactive streams
    } catch (error) {
      console.error('Download error:', error);
      this.toastService.error(
        `Lỗi khi tải bài hát: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Download bài hát từ search history - NEW WORKFLOW
   * @param historyItem - Item từ lịch sử tìm kiếm
   */
  async downloadFromHistory(historyItem: SearchHistoryItem) {
    try {
      // Kiểm tra xem đã download chưa
      if (this.isDownloaded(historyItem.songId)) {
        this.toastService.warning('Bài hát đã được tải xuống!');
        return;
      }

      const songData: DataSong = {
        id: historyItem.songId,
        title: historyItem.title,
        artist: historyItem.artist,
        thumbnail_url: historyItem.thumbnail_url,
        duration: historyItem.duration,
        duration_formatted: historyItem.duration_formatted,
        keywords: historyItem.keywords,
        original_url: '', // Will be fetched if needed
        created_at: new Date().toISOString(), // Default value
      };

      // Check if we need to poll status first
      const songStatus = this.downloadService.getSongStatusSync(
        historyItem.songId
      );

      if (!songStatus) {
        // Start status polling first
        this.downloadService.startStatusPolling(songData);
        this.toastService.info('Đang kiểm tra trạng thái bài hát...');
        return;
      }

      // If song is ready, proceed with download
      if (songStatus.ready) {
        if (!this.isDownloaded(historyItem.songId)) {
        await this.downloadSong(songData);
      } else {
        this.toastService.warning(`Bài hát ${historyItem.title} đã được tải xuống!`);
      }
      } else {
        this.toastService.warning(
          `Bài hát đang xử lý (${songStatus.progress}%)...`
        );
      }
    } catch (error) {
      console.error('Download error:', error);
      this.toastService.error('Lỗi khi tải bài hát!');
    }
  }

  /**
   * Kiểm tra trạng thái download của bài hát
   * @param songId - ID bài hát
   * @returns DownloadTask | undefined
   */
  getDownloadStatus(songId: string): DownloadTask | undefined {
    return this.downloadService.getDownloadBySongId(songId);
  }

  /**
   * Kiểm tra xem bài hát có đang download không
   * @param songId - ID bài hát
   * @returns boolean
   */
  isDownloading(songId: string): boolean {
    const download = this.getDownloadStatus(songId);
    return download?.status === 'downloading' || download?.status === 'pending';
  }

  /**
   * Lấy progress của download
   * @param songId - ID bài hát
   * @returns number
   */
  getDownloadProgress(songId: string): number {
    const download = this.getDownloadStatus(songId);
    return download?.progress || 0;
  }
  /**
   * Kiểm tra xem bài hát đã download xong chưa - chỉ dùng downloadService
   * @param songId - ID bài hát
   * @returns boolean
   */
  isDownloaded(songId: string): boolean {
    return this.downloadService.isSongDownloaded(songId);
  }

  /**
   * Show completion notification (one-time only)
   */
  private async showCompletedNotification(songTitle: string) {
    this.toastService.success(
      `Bài hát "${songTitle}" đã được tải xuống thành công!`
    );
  }

  /**
   * Cancel download
   * @param songId - ID bài hát
   */
  cancelDownload(songId: string) {
    const download = this.getDownloadStatus(songId);
    if (download) {
      this.downloadService.cancelDownload(download.id);
    }
  }

  /**
   * Pause download
   * @param songId - ID bài hát
   */
  pauseDownload(songId: string) {
    const download = this.getDownloadStatus(songId);
    if (download) {
      this.downloadService.pauseDownload(download.id);
    }
  }

  /**
   * Resume download
   * @param songId - ID bài hát
   */
  resumeDownload(songId: string) {
    const download = this.getDownloadStatus(songId);
    if (download) {
      this.downloadService.resumeDownload(download.id);
    }
  }
  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]); // Clear YouTube search results
    this.searchHistoryItem.set(this.originalSearchHistory()); // Reset về danh sách gốc
    this.isSearching.set(false);
  }
  async searchHistory(query: string) {
    try {
      this.isSearching.set(true);

      // Tìm kiếm trong lịch sử IndexedDB cục bộ
      this.filterSearchHistory(query);
    } catch (error) {
      console.error('❌ Error searching in history:', error);
      this.toastService.error('Lỗi khi tìm kiếm trong lịch sử.');
    } finally {
      this.isSearching.set(false);
    }
  }
  onSearchYoutubeUrl() {
    const query = this.searchQuery().trim();

    if (query.length === 0) {
      return;
    }
    if (this.downloadService.validateYoutubeUrl(query)) {
      // YouTube URL → tìm kiếm API và hiển thị trong searchResults
      this.processYouTubeUrl(query);
    } else {
      // Text search → tìm kiếm trong lịch sử cục bộ
      this.searchHistory(query);
    }
  }
  /**
   * Tải lịch sử tìm kiếm được sắp xếp theo thời gian gần nhất
   */
  async loadSearchHistory() {
    try {
      const history = await this.databaseService.getSearchHistory();
      const first20 = history.slice(0, 20);

      this.originalSearchHistory.set(first20); // ✅ Lưu bản gốc
      this.searchHistoryItem.set(first20); // Hiển thị
    } catch (error) {
      console.error('❌ Error loading search history:', error);
      this.originalSearchHistory.set([]);
      this.searchHistoryItem.set([]);
    }
  }

  /**
   * Paste từ clipboard với logic thông minh
   */
  async onPaste(event?: Event) {
    this.isClipboardLoading.set(true);

    try {
      let clipboardText = '';

      // Nếu có event paste từ input, sử dụng dữ liệu từ event
      if (event) {
        const pasteEvent = event as ClipboardEvent;
        if (pasteEvent.clipboardData) {
          clipboardText = pasteEvent.clipboardData.getData('text');
        }
      } else {
        // Sử dụng readFromUserAction - phù hợp cho user interaction
        const result = await this.clipboardService.readFromUserAction();

        if (result.success && result.content) {
          clipboardText = result.content;
        } else if (result.error) {
          if (result.error === 'PERMISSION_DENIED') {
            await this.showPermissionDeniedInstructions();
          } else if (result.error === 'NOT_SUPPORTED') {
            await this.showManualPasteInstructions();
          } else {
            this.toastService.warning(
              'Không thể đọc clipboard. Vui lòng paste thủ công.'
            );
            this.focusSearchInput();
          }
          return;
        }
      }

      if (clipboardText.trim()) {
        this.searchQuery.set(clipboardText.trim());
        this.onSearchInput({ target: { value: clipboardText.trim() } } as any);

        // Nếu là YouTube URL, tự động xử lý
        if (this.downloadService.validateYoutubeUrl(clipboardText.trim())) {
          this.toastService.success('Đã dán link YouTube!');
        }
      } else {
        this.toastService.warning(
          'Clipboard trống hoặc không có nội dung hợp lệ'
        );
      }
    } catch (error) {
      console.error('Paste failed:', error);
      await this.showManualPasteInstructions();
    } finally {
      this.isClipboardLoading.set(false);
    }
  }
  /**
   * Hiển thị hướng dẫn paste thủ công với giao diện thân thiện theo platform
   */
  private async showManualPasteInstructions() {
    let message = '';
    let header = '📋 Paste thủ công';

    if (Capacitor.isNativePlatform()) {
      // Native Android/iOS
      if (this.platform.is('android')) {
        header = '📱 Android - Hướng dẫn paste';
        message = `Không thể đọc clipboard tự động.

Cách paste:
• Nhấn giữ vào ô tìm kiếm
• Chọn "Dán" từ menu`;
      } else if (this.platform.is('ios')) {
        header = '📱 iOS - Hướng dẫn paste';
        message = `Không thể đọc clipboard tự động.

Cách paste:
• Nhấn giữ vào ô tìm kiếm
• Chọn "Paste" từ menu`;
      } else {
        // Native khác
        header = '📱 Hướng dẫn paste';
        message = `Không thể đọc clipboard tự động.

Cách paste:
• Nhấn giữ vào ô tìm kiếm
• Chọn "Dán" từ menu`;
      }
    } else {
      // Web/PWA - detect desktop vs mobile
      if (this.platform.is('desktop')) {
        header = '�️ Hướng dẫn paste trên Desktop';
        // Detect Mac vs Windows/Linux through user agent
        const isMac = navigator.userAgent.includes('Mac');
        if (isMac) {
          message = `Không thể đọc clipboard tự động.

Cách paste trên Mac:
• Nhấn Cmd+V vào ô tìm kiếm
• Hoặc chuột phải và chọn "Paste"`;
        } else {
          message = `Không thể đọc clipboard tự động.

Cách paste trên Windows/Linux:
• Nhấn Ctrl+V vào ô tìm kiếm
• Hoặc chuột phải và chọn "Paste"`;
        }
      } else {
        // Mobile web
        header = '📱 Mobile Browser - Hướng dẫn paste';
        message = `Không thể đọc clipboard tự động.

Cách paste:
• Nhấn giữ vào ô tìm kiếm
• Chọn "Dán" từ menu
• Có thể cần cho phép quyền clipboard`;
      }
    }

    const alert = await this.alertController.create({
      mode: 'ios',
      header,
      message,
      buttons: [
        {
          text: 'Thử lại',
          cssClass: 'alert-button-confirm',
          handler: () => {
            this.onPaste(); // Thử lại
          },
        },
        {
          text: 'OK',
          handler: () => {
            this.focusSearchInput();
          },
        },
      ],
      cssClass: 'custom-info-alert',
    });

    await alert.present();
  }

  /**
   * Hiển thị hướng dẫn khi permission bị từ chối
   */
  private async showPermissionDeniedInstructions() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: '🔐 Quyền clipboard bị từ chối',
      message: `Trình duyệt đã từ chối quyền đọc clipboard.

Cách bật quyền:

Chrome/Edge:
• Nhấn vào biểu tượng khóa bên cạnh URL
• Bật "Clipboard" permissions

Firefox:
• Vào Settings → Privacy & Security
• Tìm "Permissions" → Clipboard

Hoặc paste thủ công:
• Nhấn Ctrl+V (PC) / Cmd+V (Mac)
• Mobile: Nhấn giữ và chọn "Dán"`,
      buttons: [
        {
          text: 'Thử lại',
          cssClass: 'alert-button-confirm',
          handler: () => {
            this.onPaste(); // Thử lại
          },
        },
        {
          text: 'Paste thủ công',
          handler: () => {
            this.focusSearchInput();
          },
        },
      ],
      cssClass: 'custom-permission-alert',
    });

    await alert.present();
  }

  focusSearchInput() {
    setTimeout(() => {
      const searchInput = document.getElementById(
        'searchInput'
      ) as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, 300);
  }

  /**
   * Smart paste button với validation tự động
   */
  async smartPasteButton() {
    this.isClipboardLoading.set(true);

    try {
      const result = await this.clipboardService.autoPasteWithValidation();

      if (result.success && result.content) {
        // Sử dụng cleanUrl nếu có, hoặc content gốc
        const finalUrl = result.cleanUrl || result.content;
        this.searchQuery.set(finalUrl);

        // Tự động xử lý YouTube URL
        await this.processYouTubeUrl(finalUrl);

        // Hiển thị thông báo thành công với suggestion
        const message =
          result.suggestion || 'Đã tự động dán và xử lý link YouTube!';
        this.toastService.success(message);
      } else if (result.needsManualPaste) {
        await this.showManualPasteInstructions();
      } else {
        // Hiển thị lỗi với suggestion từ service
        const errorMessage =
          result.suggestion || result.error || 'Không thể đọc clipboard';
        this.toastService.warning(errorMessage);
        this.focusSearchInput();
      }
    } catch (error) {
      console.error('Smart paste failed:', error);
      this.toastService.error('Lỗi khi đọc clipboard');
      await this.showManualPasteInstructions();
    } finally {
      this.isClipboardLoading.set(false);
    }
  }

  /**
   * Mới: Filter lịch sử tìm kiếm theo text
   */
  private filterSearchHistory(query: string) {
    const originalHistory = this.originalSearchHistory();
    const filtered = originalHistory.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.artist.toLowerCase().includes(query.toLowerCase()) ||
        (item.keywords &&
          item.keywords.some((keyword) =>
            keyword.toLowerCase().includes(query.toLowerCase())
          ))
    );

    this.searchHistoryItem.set(filtered);
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/musical-note.webp';
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Check if song is in polling state - use service
   */
  isPolling(songId: string): boolean {
    return this.downloadService.isPolling(songId)
  }


  /**
   * Get polling progress for display - use service
   */
  getPollProgress(songId: string): number {
    const status = this.downloadService.getSongStatusSync(songId);
    return status?.progress || 0;
  }

  /**
   * Check if song is ready for download - use service
   */
  isReady(songId: string): boolean {
    const status = this.downloadService.getSongStatusSync(songId);
    return status?.ready === true;
  }

  /**
   * Get user-friendly status message for display - use service
   */
  getStatusMessage(songId: string): string {
    const status = this.downloadService.getSongStatusSync(songId);
    if (!status) {
      return 'Đang kiểm tra...';
    }

    switch (status.status) {
      case 'pending':
        return 'Đang chờ xử lý...';
      case 'processing':
        return `Đang xử lý... ${status.progress}%`;
      case 'completed':
        return 'Sẵn sàng tải xuống';
      case 'failed':
        return 'Xử lý thất bại';
      default:
        return 'Trạng thái không xác định';
    }
  }

  /**
   * Get CSS class for status display - use service
   */
  getStatusClass(songId: string): string {
    const status = this.downloadService.getSongStatusSync(songId);
    if (!status) {
      return 'status-checking';
    }

    switch (status.status) {
      case 'pending':
        return 'status-pending';
      case 'processing':
        return 'status-processing';
      case 'completed':
        return 'status-ready';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-unknown';
    }
  }
}
