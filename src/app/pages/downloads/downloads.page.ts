import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from '@core/data/database.service';
import { DownloadStore } from '../../core/stores/download.store';
import { DownloadService, DownloadTask } from '@core/services/download.service';
import { DataSong, SearchHistoryItem } from '@core/interfaces/song.interface';
import { ClipboardService } from '@core/platform/clipboard.service';
import { ToastService } from '@core/ui/toast.service';
import { AlertController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { routeAnimation } from '@core/utils/route-animation';
import { SongItemComponent } from '../../components/song-item/song-item.component';

/**
 * Trang chính để tìm kiếm và tải nhạc.
 *
 * Chức năng:
 * - Tìm kiếm bài hát qua URL YouTube hoặc từ khóa
 * - Hiển thị kết quả tìm kiếm và lịch sử tìm kiếm
 * - Cho phép tải xuống bài hát và theo dõi trạng thái tải
 *
 * Route: /downloads
 * Phụ thuộc: DownloadStore, DownloadService, DatabaseService, ClipboardService
 */
@Component({
  selector: 'app-downloads',
  templateUrl: './downloads.page.html',
  styleUrls: ['./downloads.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, SongItemComponent],
  animations: [routeAnimation],
})
export class DownloadsPage implements OnInit, OnDestroy {
  // ═══ STORES ═══
  readonly downloadStore = inject(DownloadStore);
  private readonly downloadService = inject(DownloadService);
  private readonly databaseService = inject(DatabaseService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly alertController = inject(AlertController);
  private readonly toastService = inject(ToastService);
  private readonly platform = inject(Platform);

  // ═══ STATE ═══
  /** Từ khóa tìm kiếm hiện tại */
  searchQuery = signal('');
  
  /** Kết quả nhận được từ API tìm kiếm / phân tích dòng URL YouTube */
  searchResults = signal<DataSong[]>([]);
  
  /** Trạng thái loading khi đang tìm kiếm hoặc chờ API */
  isSearching = signal(false);
  
  /** Danh sách lịch sử tìm kiếm đang được hiển thị theo bộ lọc */
  searchHistoryItem = signal<SearchHistoryItem[]>([]);
  
  /** Danh sách lịch sử tìm kiếm gốc (chưa qua bộ lọc) */
  originalSearchHistory = signal<SearchHistoryItem[]>([]);
  
  /** Trạng thái loading khi đang xử lý sự kiện dán từ clipboard */
  isClipboardLoading = signal<boolean>(false);

  // Downloads state — from DownloadStore signal
  readonly downloads = this.downloadStore.tasks;

  /**
   * Kiểm tra xem chuỗi đầu vào có phải là URL YouTube hợp lệ hay không.
   * Dùng cho template HTML để đổi màu nút tìm kiếm.
   * 
   * @param url - Chuỗi cần kiểm tra
   * @returns true nếu là URL YouTube hợp lệ
   */
  isYoutubeUrl(url: string): boolean {
    return this.downloadService.validateYoutubeUrl(url);
  }

  // ═══ LIFECYCLE ═══
  async ngOnInit() {
    await this.loadSearchHistory();
  }

  ngOnDestroy() {}

  // ═══ SEARCH & URL PROCESSING ═══
  /**
   * Xử lý sự kiện khi người dùng nhập liệu vào ô tìm kiếm.
   * 
   * - Nếu ô tìm kiếm trống: Xóa kết quả tìm kiếm hiện tại
   * - Nếu là URL YouTube: Xóa kết quả và khôi phục lịch sử tìm kiếm ban đầu
   * - Nếu là từ khóa dài >= 2 ký tự: Lọc lịch sử tìm kiếm theo từ khóa
   * 
   * @param event - Sự kiện input từ thẻ input
   */
  async onSearchInput(event: any) {
    const query = event.target.value?.trim() || '';
    this.searchQuery.set(query);

    if (query.length === 0) {
      this.clearSearch();
      return;
    }

    if (this.downloadService.validateYoutubeUrl(query)) {
      this.searchResults.set([]);
      this.searchHistoryItem.set(this.originalSearchHistory());
      return;
    }

    if (query.length >= 2) {
      this.filterSearchHistory(query);
    }
  }

  /**
   * Xử lý URL YouTube: gọi API lấy thông tin bài hát và bắt đầu tải.
   * 
   * Nếu bài hát đã được tải, hiển thị thông báo.
   * Nếu chưa có, tiến hành lưu vào lịch sử, tải bài hát và theo dõi tiến trình.
   * 
   * @param url - URL YouTube cần xử lý
   */
  async processYouTubeUrl(url: string) {
    try {
      this.isSearching.set(true);

      const response = await firstValueFrom(
        this.downloadService.getSongInfo(url)
      );

      if (response.status) {
        const songData = response.data;

        if (!songData) return;

        if (this.isDownloaded(songData.id)) {
          this.showSongInfo(songData);
          this.toastService.success('Bài hát đã được tải về!');
          return;
        }

        await this.databaseService.addToSearchHistory(songData);
        this.showSongInfo(songData);
        this.downloadSong(songData);
        this.downloadService.startStatusPolling(songData);
        await this.loadSearchHistory();
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

  /**
   * Cập nhật danh sách kết quả tìm kiếm để hiển thị thông tin bài hát.
   * 
   * @param song - Thông tin bài hát nhận được từ API
   */
  showSongInfo(song: DataSong) {
    this.searchResults.set([{
      id: song.id,
      title: song.title,
      artist: song.artist,
      duration: song.duration,
      duration_formatted: song.duration_formatted,
      thumbnail_url: song.thumbnail_url,
      keywords: song.keywords || [],
      original_url: song.original_url,
      created_at: song.created_at,
    }]);
  }

  // ═══ DOWNLOAD ACTIONS ═══
  /**
   * Tải bài hát từ kết quả tìm kiếm.
   * 
   * @param songData - Dữ liệu bài hát cần tải
   */
  async downloadSong(songData: DataSong) {
    try {
      if (this.isDownloaded(songData.id)) {
        this.toastService.warning('Bài hát đã được tải xuống!');
        return;
      }

      this.toastService.info(`Đang tải "${songData.title}"...`);
      await this.downloadStore.download(songData);
    } catch (error) {
      console.error('Download error:', error);
      this.toastService.error(
        `Lỗi khi tải bài hát: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Tải bài hát từ danh sách lịch sử tìm kiếm.
   * Kiểm tra trạng thái xử lý trên server trước khi tải.
   * 
   * @param historyItem - Dữ liệu bài hát trong lịch sử
   */
  async downloadFromHistory(historyItem: SearchHistoryItem) {
    try {
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
        original_url: '',
        created_at: new Date().toISOString(),
      };

      const songStatus = this.downloadService.getSongStatusSync(historyItem.songId);

      if (!songStatus) {
        this.downloadService.startStatusPolling(songData);
        this.toastService.info('Đang kiểm tra trạng thái bài hát...');
        return;
      }

      if (songStatus.ready) {
        if (!this.isDownloaded(historyItem.songId)) {
          await this.downloadSong(songData);
        } else {
          this.toastService.warning(`Bài hát ${historyItem.title} đã được tải xuống!`);
        }
      } else {
        this.toastService.warning(`Bài hát đang xử lý (${songStatus.progress}%)...`);
      }
    } catch (error) {
      console.error('Download error:', error);
      this.toastService.error('Lỗi khi tải bài hát!');
    }
  }

  // ═══ DOWNLOAD STATUS HELPERS ═══
  /** Lấy thông tin trạng thái tải xuống hiện tại của một bài hát */
  getDownloadStatus(songId: string): DownloadTask | undefined {
    return this.downloadService.getDownloadBySongId(songId);
  }

  /** Kiểm tra xem bài hát có đang trong quá trình tải xuống hay không */
  isDownloading(songId: string): boolean {
    const download = this.getDownloadStatus(songId);
    return download?.status === 'downloading' || download?.status === 'pending';
  }

  /** Lấy phần trăm tiến độ tải xuống của bài hát (0-100) */
  getDownloadProgress(songId: string): number {
    return this.getDownloadStatus(songId)?.progress || 0;
  }

  /** Kiểm tra xem bài hát đã trạng thái tải xong hay chưa */
  isDownloaded(songId: string): boolean {
    return this.downloadStore.isDownloaded(songId);
  }

  /** Hủy tiến trình tải xuống của bài hát */
  cancelDownload(songId: string) {
    const download = this.getDownloadStatus(songId);
    if (download) {
      this.downloadStore.cancelDownload(download.id);
    }
  }

  /** Tạm dừng tiến trình tải xuống bài hát */
  pauseDownload(songId: string) {
    const download = this.getDownloadStatus(songId);
    if (download) {
      this.downloadService.pauseDownload(download.id);
    }
  }

  /** Tiếp tục tiến trình tải bài hát đang bị tạm dừng */
  resumeDownload(songId: string) {
    const download = this.getDownloadStatus(songId);
    if (download) {
      this.downloadService.resumeDownload(download.id);
    }
  }

  // ═══ SEARCH ═══
  /**
   * Xóa nội dung tìm kiếm hiện tại và khôi phục trạng thái mặc định.
   */
  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchHistoryItem.set(this.originalSearchHistory());
    this.isSearching.set(false);
  }

  /**
   * Tìm kiếm bài hát trong bộ nhớ lịch sử.
   * 
   * @param query - Từ khóa tìm kiếm
   */
  async searchHistory(query: string) {
    try {
      this.isSearching.set(true);
      this.filterSearchHistory(query);
    } catch (error) {
      console.error('Error searching in history:', error);
      this.toastService.error('Lỗi khi tìm kiếm trong lịch sử.');
    } finally {
      this.isSearching.set(false);
    }
  }

  /**
   * Xử lý khi người dùng nhấn nút tìm kiếm.
   * Quyết định gọi tải từ URL YouTube hoặc tìm kiếm bằng từ khóa.
   */
  onSearchYoutubeUrl() {
    const query = this.searchQuery().trim();
    if (query.length === 0) return;

    if (this.downloadService.validateYoutubeUrl(query)) {
      this.processYouTubeUrl(query);
    } else {
      this.searchHistory(query);
    }
  }

  /**
   * Tải danh sách lịch sử tìm kiếm (chỉ lưu 20 kết quả gần nhất).
   */
  async loadSearchHistory() {
    try {
      const history = await this.databaseService.getSearchHistory();
      const first20 = history.slice(0, 20);
      this.originalSearchHistory.set(first20);
      this.searchHistoryItem.set(first20);
    } catch (error) {
      console.error('Error loading search history:', error);
      this.originalSearchHistory.set([]);
      this.searchHistoryItem.set([]);
    }
  }

  // ═══ CLIPBOARD ═══
  /**
   * Xử lý sự kiện dán nội dung vào ô tìm kiếm.
   * 
   * @param event - Sự kiện paste (nếu người dùng thao tác dán)
   */
  async onPaste(event?: Event) {
    this.isClipboardLoading.set(true);

    try {
      let clipboardText = '';

      if (event) {
        const pasteEvent = event as ClipboardEvent;
        if (pasteEvent.clipboardData) {
          clipboardText = pasteEvent.clipboardData.getData('text');
        }
      } else {
        const result = await this.clipboardService.readFromUserAction();
        if (result.success && result.content) {
          clipboardText = result.content;
        } else if (result.error) {
          if (result.error === 'PERMISSION_DENIED') {
            await this.showPermissionDeniedInstructions();
          } else if (result.error === 'NOT_SUPPORTED') {
            await this.showManualPasteInstructions();
          } else {
            this.toastService.warning('Không thể đọc clipboard. Vui lòng paste thủ công.');
            this.focusSearchInput();
          }
          return;
        }
      }

      if (clipboardText.trim()) {
        this.searchQuery.set(clipboardText.trim());
        this.onSearchInput({ target: { value: clipboardText.trim() } } as any);
        if (this.downloadService.validateYoutubeUrl(clipboardText.trim())) {
          this.toastService.success('Đã dán link YouTube!');
        }
      } else {
        this.toastService.warning('Clipboard trống hoặc không có nội dung hợp lệ');
      }
    } catch (error) {
      console.error('Paste failed:', error);
      await this.showManualPasteInstructions();
    } finally {
      this.isClipboardLoading.set(false);
    }
  }

  /**
   * Nút dán thông minh (Smart Paste):
   * Tự động lấy nội dung clipboard, kiểm tra format YouTube rồi tiến hành xử lý.
   */
  async smartPasteButton() {
    this.isClipboardLoading.set(true);
    try {
      const result = await this.clipboardService.autoPasteWithValidation();
      if (result.success && result.content) {
        const finalUrl = result.cleanUrl || result.content;
        this.searchQuery.set(finalUrl);
        await this.processYouTubeUrl(finalUrl);
        this.toastService.success(result.suggestion || 'Đã tự động dán và xử lý link YouTube!');
      } else if (result.needsManualPaste) {
        await this.showManualPasteInstructions();
      } else {
        this.toastService.warning(result.suggestion || result.error || 'Không thể đọc clipboard');
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

  /** Đặt trỏ chuột (focus) vào ô input sau một khoảng thời gian chờ */
  focusSearchInput() {
    setTimeout(() => {
      const searchInput = document.getElementById('searchInput') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, 300);
  }

  // ═══ POLLING STATUS ═══
  /** Kiểm tra xem bài hát có đang trong quá trình polling (chờ server convert) không */
  isPolling(songId: string): boolean {
    return this.downloadService.isPolling(songId);
  }

  /** Lấy tiến độ xử lý trên server của bài hát (0-100) */
  getPollProgress(songId: string): number {
    return this.downloadService.getSongStatusSync(songId)?.progress || 0;
  }

  /** Kiểm tra xem bài hát đã sẵn sàng (xử lý xong trên server) để tải về chưa */
  isReady(songId: string): boolean {
    return this.downloadService.getSongStatusSync(songId)?.ready === true;
  }

  /** Lấy message mô tả trạng thái quá trình xử lý của bài hát trên server */
  getStatusMessage(songId: string): string {
    const status = this.downloadService.getSongStatusSync(songId);
    if (!status) return 'Đang kiểm tra...';

    switch (status.status) {
      case 'pending': return 'Đang chờ xử lý...';
      case 'processing': return `Đang xử lý... ${status.progress}%`;
      case 'completed': return 'Sẵn sàng tải xuống';
      case 'failed': return 'Xử lý thất bại';
      default: return 'Trạng thái không xác định';
    }
  }

  /** Lấy tên class CSS theo trạng thái polling dùng cho HTML template */
  getStatusClass(songId: string): string {
    const status = this.downloadService.getSongStatusSync(songId);
    if (!status) return 'status-checking';

    switch (status.status) {
      case 'pending': return 'status-pending';
      case 'processing': return 'status-processing';
      case 'completed': return 'status-ready';
      case 'failed': return 'status-failed';
      default: return 'status-unknown';
    }
  }

  /** Hiển thị ảnh nền mặc định nếu bị lỗi không tải được ảnh bìa */
  onImageError(event: any): void {
    event.target.src = 'assets/images/background.webp';
  }

  // ═══ PRIVATE — Alert dialogs ═══
  /**
   * Lọc kết quả tìm kiếm phần lịch sử.
   */
  private filterSearchHistory(query: string) {
    const originalHistory = this.originalSearchHistory();
    const filtered = originalHistory.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.artist.toLowerCase().includes(query.toLowerCase()) ||
        (item.keywords?.some((keyword) =>
          keyword.toLowerCase().includes(query.toLowerCase())
        ))
    );
    this.searchHistoryItem.set(filtered);
  }

  /**
   * Hiển thị popup hướng dẫn cách dán (paste) thủ công theo dòng máy.
   */
  private async showManualPasteInstructions() {
    let message = '';
    let header = '📋 Paste thủ công';

    if (Capacitor.isNativePlatform()) {
      if (this.platform.is('android')) {
        header = '📱 Android - Hướng dẫn paste';
        message = `Không thể đọc clipboard tự động.\n\nCách paste:\n• Nhấn giữ vào ô tìm kiếm\n• Chọn "Dán" từ menu`;
      } else if (this.platform.is('ios')) {
        header = '📱 iOS - Hướng dẫn paste';
        message = `Không thể đọc clipboard tự động.\n\nCách paste:\n• Nhấn giữ vào ô tìm kiếm\n• Chọn "Paste" từ menu`;
      } else {
        message = 'Nhấn giữ vào ô tìm kiếm và chọn "Dán"';
      }
    } else {
      if (this.platform.is('desktop')) {
        const isMac = navigator.userAgent.includes('Mac');
        header = '🖥️ Hướng dẫn paste trên Desktop';
        message = isMac
          ? 'Nhấn Cmd+V vào ô tìm kiếm, hoặc chuột phải → "Paste"'
          : 'Nhấn Ctrl+V vào ô tìm kiếm, hoặc chuột phải → "Paste"';
      } else {
        header = '📱 Mobile Browser - Hướng dẫn paste';
        message = 'Nhấn giữ vào ô tìm kiếm và chọn "Dán"';
      }
    }

    const alert = await this.alertController.create({
      mode: 'ios',
      header,
      message,
      buttons: [
        { text: 'Thử lại', cssClass: 'alert-button-confirm', handler: () => this.onPaste() },
        { text: 'OK', handler: () => this.focusSearchInput() },
      ],
      cssClass: 'custom-info-alert',
    });
    await alert.present();
  }

  /**
   * Hiển thị popup báo người dùng cấp quyền nếu clipboard bị chặn.
   */
  private async showPermissionDeniedInstructions() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: '🔐 Quyền clipboard bị từ chối',
      message: 'Vào Settings → Privacy → Clipboard để bật quyền, hoặc paste thủ công.',
      buttons: [
        { text: 'Thử lại', cssClass: 'alert-button-confirm', handler: () => this.onPaste() },
        { text: 'Paste thủ công', handler: () => this.focusSearchInput() },
      ],
      cssClass: 'custom-permission-alert',
    });
    await alert.present();
  }
}
