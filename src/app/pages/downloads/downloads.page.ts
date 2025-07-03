import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from '../../services/database.service';
import { DownloadService, DownloadTask } from '../../services/download.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { MusicApiService } from '../../services/api/music-api.service';
import {
  DataSong,
  Song,
  SearchHistoryItem,
  SongConverter,
} from '../../interfaces/song.interface';
import { ClipboardService } from 'src/app/services/clipboard.service';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { finalize, firstValueFrom, tap } from 'rxjs';
import { routeAnimation } from 'src/app/shared/route-animation';
import { SongItemComponent } from "../../components/song-item/song-item.component";

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
  private audioPlayerService = inject(AudioPlayerService);
  private clipboardService = inject(ClipboardService);
  private musicApiService = inject(MusicApiService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private platform = inject(Platform);

  searchQuery = signal('');
  searchResults = signal<DataSong[]>([]); // Chỉ cho YouTube URL
  isSearching = signal(false);
  downloadHistory = signal<Song[]>([]);
  searchHistoryItem = signal<SearchHistoryItem[]>([]);
  originalSearchHistory = signal<SearchHistoryItem[]>([]); // ✅ Lưu danh sách gốc
  isClipboardLoading = signal<boolean>(false);

  // Download state
  downloads = signal<DownloadTask[]>([]);
  // Song status tracking
  songStatusMap = signal<Map<string, { status: string; progress: number; ready: boolean }>>(new Map());
  pollingIntervals = new Map<string, any>();

  // Cache for downloaded songs (for instant UI feedback)
  private downloadedSongsCache = new Set<string>();

  async ngOnInit() {
    await this.loadSearchHistory();
    await this.loadDownloadedSongsCache(); // Load cache from database for instant UI feedback

    // Subscribe to download changes
    this.downloadService.downloads$.subscribe((downloads) => {
      this.downloads.set(downloads);
    });

    // Auto-paste from clipboard on load
    await this.tryAutoPaste();
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
          await this.showToast(
            'Đã tự động dán link YouTube từ clipboard!',
            'success'
          );
        }
      }
      // Không hiển thị lỗi cho auto-paste để tránh làm phiền user
    } catch (error) {
      console.log('Auto-paste failed silently:', error);
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

      // Step 1: Get song info từ API v3
      const response = await firstValueFrom(
        this.downloadService.getSongInfo(url)
      );

      if (response.success) {
        const songData = response.data;

        // Step 2: Save ONLY to search history (not to songs table yet)
        await this.databaseService.addToSearchHistory(songData);

        // Step 3: Show song info to user
        this.showSongInfo(songData);

        // Step 4: Start polling status in background để check khi nào ready
        this.startStatusPolling(songData.id);

        // Reload search history to show the new item
        await this.loadSearchHistory();

        await this.showToast('Đã lấy thông tin bài hát thành công! Bấm Download để tải xuống.', 'success');
      } else {
        console.error('API returned error:', response.message);
        await this.showToast(`Lỗi: ${response.message}`, 'danger');
        this.searchResults.set([]);
      }
    } catch (error) {
      console.error('Error processing YouTube URL:', error);
      await this.showToast(`Lỗi: ${error instanceof Error ? error.message : 'Không thể xử lý URL'}`, 'danger');
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
      if (!this.isSongReadyForDownload(songData.id)) {
        await this.showToast('Bài hát chưa sẵn sàng để tải xuống!', 'warning');
        return;
      }

      // Step 2: Kiểm tra xem đã download chưa
      if (this.isDownloaded(songData.id)) {
        await this.showToast('Bài hát đã được tải xuống!', 'warning');
        return;
      }

      // Step 3: Bắt đầu download audio và thumbnail trước
      await this.showToast(`Đang tải "${songData.title}"...`, 'primary');

      // Step 4: Download audio và thumbnail cùng lúc
      const { audioBlob, thumbnailBlob } = await this.musicApiService.downloadSongWithThumbnail(songData.id);

      // Step 5: Save audio blob to IndexedDB (thumbnails will be base64 in song table)
      const audioSaved = await this.databaseService.saveSongAudioBlob(songData.id, audioBlob);

      if (!audioSaved) {
        throw new Error('Failed to save audio data');
      }

      // Step 6: Convert thumbnail to base64 data URL
      const thumbnailBase64 = thumbnailBlob ? await this.blobToDataUrl(thumbnailBlob) : null;

      // Step 7: Tạo blob URL cho audio (giữ cách cũ) và base64 cho thumbnail
      const audioBlobUrl = URL.createObjectURL(audioBlob);

      const song = SongConverter.fromApiData(songData);
      song.addedDate = new Date();
      song.isFavorite = false;
      song.keywords = songData.keywords || [];
      song.audio_url = audioBlobUrl; // Blob URL thực tế cho audio (cách cũ)
      song.thumbnail_url = thumbnailBase64 || songData.thumbnail_url; // Base64 cho thumbnail

      // Step 8: Lưu song vào database với new URLs
      await this.databaseService.addSong(song);

      // Step 9: Update cache để hiển thị check icon ngay lập tức
      this.updateDownloadedCache(songData.id);

      await this.showToast(`Tải xuống "${songData.title}" thành công!`, 'success');

      // Reload để show downloaded status
      await this.loadSearchHistory();

    } catch (error) {
      console.error('Download error:', error);
      await this.showToast(`Lỗi khi tải bài hát: ${error instanceof Error ? error.message : 'Unknown error'}`, 'danger');
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
        await this.showToast('Bài hát đã được tải xuống!', 'warning');
        return;
      }

      // Check if we need to poll status first
      const songStatus = this.getSongStatus(historyItem.songId);
      if (!songStatus) {
        // Start status polling first
        this.startStatusPolling(historyItem.songId);
        await this.showToast('Đang kiểm tra trạng thái bài hát...', 'primary');
        return;
      }

      // If song is ready, proceed with download
      if (songStatus.ready) {
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

        await this.downloadSong(songData);
      } else {
        await this.showToast(`Bài hát đang xử lý (${songStatus.progress}%)...`, 'warning');
      }

    } catch (error) {
      console.error('Download error:', error);
      await this.showToast('Lỗi khi tải bài hát!', 'danger');
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
   * Kiểm tra xem bài hát đã download xong chưa - sử dụng cache cho instant feedback
   * @param songId - ID bài hát
   * @returns boolean
   */
  isDownloaded(songId: string): boolean {
    return this.downloadedSongsCache.has(songId);
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
  }  async searchHistory(query: string) {
    try {
      this.isSearching.set(true);

      // Tìm kiếm trong lịch sử IndexedDB cục bộ
      this.filterSearchHistory(query);

    } catch (error) {
      console.error('❌ Error searching in history:', error);
      await this.showToast('Lỗi khi tìm kiếm trong lịch sử.', 'danger');
    } finally {
      this.isSearching.set(false);
    }
  }
  onSearchYoutubeUrl() {
    const query = this.searchQuery().trim();

    if (query.length === 0) {
      return;
    }    if (this.downloadService.validateYoutubeUrl(query)) {
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
   * Hiển thị toast message
   * @param message - Nội dung thông báo
   * @param color - Màu sắc toast
   */
  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top',
    });
    await toast.present();
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

          // Hiển thị thông báo thành công
          if (result.method === 'web') {
            await this.showToast('Đã đọc clipboard thành công!', 'success');
          }
        } else if (result.error) {
          if (result.error === 'PERMISSION_DENIED') {
            await this.showPermissionDeniedInstructions();
          } else if (result.error === 'NOT_SUPPORTED') {
            await this.showManualPasteInstructions();
          } else {
            await this.showToast(
              'Không thể đọc clipboard. Vui lòng paste thủ công.',
              'warning'
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
          await this.showToast('Đã dán link YouTube!', 'success');
        }
      } else {
        await this.showToast(
          'Clipboard trống hoặc không có nội dung hợp lệ',
          'warning'
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
        await this.showToast(message, 'success');
      } else if (result.needsManualPaste) {
        await this.showManualPasteInstructions();
      } else {
        // Hiển thị lỗi với suggestion từ service
        const errorMessage =
          result.suggestion || result.error || 'Không thể đọc clipboard';
        await this.showToast(errorMessage, 'warning');
        this.focusSearchInput();
      }
    } catch (error) {
      console.error('Smart paste failed:', error);
      await this.showToast('Lỗi khi đọc clipboard', 'danger');
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
    const filtered = originalHistory.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.artist.toLowerCase().includes(query.toLowerCase()) ||
      (item.keywords && item.keywords.some(keyword =>
        keyword.toLowerCase().includes(query.toLowerCase())
      ))
    );

    this.searchHistoryItem.set(filtered);
  }

    onImageError(event: any): void {
    event.target.src = 'assets/images/musical-note.webp';
  }

  /**
   * Start polling song status để check khi nào ready for download
   * @param songId - ID của bài hát
   */
  private startStatusPolling(songId: string) {
    // Clear existing polling if any
    this.stopStatusPolling(songId);

    const pollStatus = async () => {
      try {
        const statusResponse = await firstValueFrom(
          this.downloadService.getSongStatus(songId)
        );

        if (statusResponse.success) {
          const status = statusResponse.data;
          const isReady = status.status === 'completed' && status.progress === 1;

          // Update status map
          const currentMap = this.songStatusMap();
          currentMap.set(songId, {
            status: status.status,
            progress: Math.round(status.progress * 100),
            ready: isReady
          });
          this.songStatusMap.set(new Map(currentMap));

          if (isReady) {
            this.stopStatusPolling(songId);
            await this.showToast('Bài hát đã sẵn sàng để tải xuống!', 'success');
          } else if (status.status === 'failed') {
            console.error('❌ Song processing failed:', status.error_message);
            this.stopStatusPolling(songId);
            await this.showToast(`Xử lý thất bại: ${status.error_message}`, 'danger');
          }
        } else {
          console.warn('⚠️ Status check failed:', statusResponse.message);
        }
      } catch (error) {
        console.error('❌ Error polling status:', error);
        // Continue polling, don't stop on single error
      }
    };

    // Poll immediately, then every 2 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    this.pollingIntervals.set(songId, interval);
  }

  /**
   * Stop polling song status
   * @param songId - ID của bài hát
   */
  private stopStatusPolling(songId: string) {
    const interval = this.pollingIntervals.get(songId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(songId);
    }
  }

  /**
   * Get song status from signal
   * @param songId - ID của bài hát
   * @returns Status object or undefined
   */
  getSongStatus(songId: string) {
    return this.songStatusMap().get(songId);
  }

  /**
   * Check if song is ready for download
   * @param songId - ID của bài hát
   * @returns boolean
   */
  isSongReadyForDownload(songId: string): boolean {
    const status = this.getSongStatus(songId);
    return status?.ready === true;
  }

  /**
   * Get user-friendly status message for display
   * @param songId - ID của bài hát
   * @returns string
   */
  getStatusMessage(songId: string): string {
    const status = this.getSongStatus(songId);
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
   * Get CSS class for status display
   * @param songId - ID của bài hát
   * @returns string
   */
  getStatusClass(songId: string): string {
    const status = this.getSongStatus(songId);
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

  ngOnDestroy() {
    // Clear all polling intervals
    this.pollingIntervals.forEach((interval, songId) => {
      clearInterval(interval);
    });
    this.pollingIntervals.clear();
  }

  /**
   * Convert blob to base64 data URL
   * @param blob - Blob to convert
   * @returns Promise<string>
   */
  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Load cache downloaded songs từ database
   */
  private async loadDownloadedSongsCache() {
    try {
      const songs = await this.databaseService.getAllSongs();
      this.downloadedSongsCache.clear();
      songs.forEach(song => {
        if (song.id) {
          this.downloadedSongsCache.add(song.id);
        }
      });
    } catch (error) {
      console.error('❌ Error loading downloaded songs cache:', error);
    }
  }

  /**
   * Update the downloaded songs cache after a successful download
   */
  private updateDownloadedCache(songId: string) {
    this.downloadedSongsCache.add(songId);
  }

  /**
   * Check if song is in polling state
   */
  isPolling(songId: string): boolean {
    const status = this.getSongStatus(songId);
    return status ? (status.status === 'pending' || status.status === 'processing') && !status.ready : false;
  }

  /**
   * Get polling progress for display
   */
  getPollProgress(songId: string): number {
    const status = this.getSongStatus(songId);
    return status?.progress || 0;
  }

  /**
   * Check if song is ready for download
   */
  isReady(songId: string): boolean {
    const status = this.getSongStatus(songId);
    return status?.ready === true;
  }
}
