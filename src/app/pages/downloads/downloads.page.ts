import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { DatabaseService } from '../../services/database.service';
import { DownloadService, DownloadTask } from '../../services/download.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import {
  DataSong,
  Song,
  SearchHistoryItem,
} from '../../interfaces/song.interface';
import { ClipboardService } from 'src/app/services/clipboard.service';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { finalize, firstValueFrom, tap } from 'rxjs';
// Import new components
import { DownloadButtonComponent } from '../../components/shared/download-button.component';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-downloads',
  templateUrl: './downloads.page.html',
  styleUrls: ['./downloads.page.scss'],
  standalone: true,  imports: [
    CommonModule,
    FormsModule,
    DownloadButtonComponent
  ],
})
export class DownloadsPage implements OnInit {
  private databaseService = inject(DatabaseService);
  downloadService = inject(DownloadService);
  private audioPlayerService = inject(AudioPlayerService);
  private clipboardService = inject(ClipboardService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private notificationService = inject(NotificationService);

  searchQuery = signal('');
  searchResults = signal<DataSong[]>([]);
  isSearching = signal(false);
  downloadHistory = signal<Song[]>([]);
  searchHistoryItem = signal<SearchHistoryItem[]>([]);
  isClipboardLoading = signal<boolean>(false);

  // Download state
  downloads = signal<DownloadTask[]>([]);

  private clipboardRetryCount = 0;
  private readonly MAX_CLIPBOARD_RETRIES = 2;
  async ngOnInit() {
    await this.loadSearchHistory();
    await this.loadDownloadHistory();

    // Subscribe to download changes
    this.downloadService.downloads$.subscribe(downloads => {
      this.downloads.set(downloads);
    });
  }

  async onSearchInput(event: any) {
    const query = event.target.value;
    this.searchQuery.set(query);

    if (query.trim().length < 3) {
      return;
    }

    if (this.downloadService.validateYoutubeUrl(query)) {
      return;
    } else {
      await this.searchHistory(query);
    }
  }

  async processYouTubeUrl(url: string) {
    try {
      this.isSearching.set(true);

      const response = await firstValueFrom(
        this.downloadService.getYoutubeUrlInfo(url)
      );

      if (response.success) {
        const song = response.data;
        await this.databaseService.addToSearchHistory(song);
        this.showSongInfo(song);
        // Reload search history to show the new item
        await this.loadSearchHistory();
      } else {
        console.error('API returned error:', response.message);
        this.searchResults.set([]);
      }
    } catch (error) {
      console.error('Error processing YouTube URL:', error);
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
      audio_url: song.audio_url,
      keywords: song.keywords || [],
    };

    this.searchResults.set([result]);
  }

  /**
   * Download bài hát từ search results
   * @param songData - Data bài hát từ API
   */
  async downloadSong(songData: DataSong) {
    try {
      // Kiểm tra xem đã download chưa
      if (this.downloadService.isSongDownloaded(songData.id)) {
        await this.showToast('Bài hát đã được tải xuống!', 'warning');
        return;
      }

      // Bắt đầu download
      const downloadId = await this.downloadService.downloadSong(songData);
      console.log('Started download with ID:', downloadId);

      await this.showToast(`Đang tải "${songData.title}"...`, 'primary');

    } catch (error) {
      console.error('Download error:', error);
      await this.showToast('Lỗi khi tải bài hát!', 'danger');
    }
  }

  /**
   * Download bài hát từ search history
   * @param historyItem - Item từ lịch sử tìm kiếm
   */
  async downloadFromHistory(historyItem: SearchHistoryItem) {
    const songData: DataSong = {
      id: historyItem.songId,
      title: historyItem.title,
      artist: historyItem.artist,
      thumbnail_url: historyItem.thumbnail_url,
      audio_url: historyItem.audio_url,
      duration: historyItem.duration,
      duration_formatted: historyItem.duration_formatted,
      keywords: historyItem.keywords
    };

    await this.downloadSong(songData);
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
   * Kiểm tra xem bài hát đã download xong chưa
   * @param songId - ID bài hát
   * @returns boolean
   */
  isDownloaded(songId: string): boolean {
    return this.downloadService.isSongDownloaded(songId);
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
  }

  async searchHistory(query: string) {
    try {
      this.isSearching.set(true);
      // Implementation for search in history if needed
    } catch (error) {
      console.error('Search error:', error);
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
      this.processYouTubeUrl(query);
    } else {
      this.searchHistory(query);
    }
  }

  async loadSearchHistory() {
    const history = await this.databaseService.getSearchHistory(20);
    this.searchHistoryItem.set(history);
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
      position: 'bottom'
    });
    await toast.present();
  }

  // ... Giữ nguyên các method khác (onPaste, showClipboardError, etc.)

  async onPaste(event?: Event, isRetry: boolean = false) {
    if (!event) {
      this.isClipboardLoading.set(true);
    }

    try {
      let clipboardText = '';

      if (event) {
        const pasteEvent = event as ClipboardEvent;
        if (pasteEvent.clipboardData) {
          clipboardText = pasteEvent.clipboardData.getData('text');
        }
      } else {
        clipboardText = await this.clipboardService.read();
      }

      if (clipboardText.trim()) {
        this.searchQuery.set(clipboardText.trim());
        this.onSearchInput({ target: { value: clipboardText.trim() } } as any);
        this.clipboardRetryCount = 0;
      }
    } catch (error) {
      console.error('Failed to paste:', error);

      if (!isRetry || this.clipboardRetryCount < this.MAX_CLIPBOARD_RETRIES) {
        this.showClipboardError();
      } else {
        this.showManualPasteAlert();
        this.clipboardRetryCount = 0;
      }
    } finally {
      this.isClipboardLoading.set(false);
    }
  }

  private async showClipboardError() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Quyền truy cập Clipboard',
      message:
        'App cần quyền đọc clipboard để tự động paste link YouTube. Bạn có muốn cấp quyền không?',
      buttons: [
        {
          text: 'Cấp quyền',
          cssClass: 'alert-button-confirm',
          handler: async () => {
            try {
              this.clipboardRetryCount++;
              const hasPermission = await this.clipboardService.checkPermissions();

              if (hasPermission) {
                this.onPaste(undefined, true);
              } else {
                this.showManualPasteAlert();
              }
            } catch (error) {
              console.error('Permission check failed:', error);
              this.showManualPasteAlert();
            }
          },
        },
        {
          text: 'Paste thủ công',
          role: 'cancel',
          cssClass: 'alert-button-cancel',
          handler: () => {
            this.clipboardRetryCount = 0;
            this.focusSearchInput();
          },
        },
      ],
      cssClass: 'custom-permission-alert',
    });

    await alert.present();
  }

  private async showManualPasteAlert() {
    this.clipboardRetryCount = 0;

    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Paste thủ công',
      message:
        'Không thể đọc clipboard tự động. Vui lòng:\n\n• Desktop: Nhấn Ctrl+V (hoặc Cmd+V)\n• Mobile: Nhấn giữ và chọn "Dán"',
      buttons: [
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
  private focusSearchInput() {
    setTimeout(() => {
      const searchInput = document.getElementById('searchInput') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, 300);
  }

  // === CONVERSION UTILITIES ===
  convertSearchHistoryToDataSong(historyItem: SearchHistoryItem): DataSong {
    return {
      id: historyItem.songId || '',
      title: historyItem.title,
      artist: historyItem.artist,
      duration: historyItem.duration,
      duration_formatted: historyItem.duration_formatted,
      thumbnail_url: historyItem.thumbnail_url,
      audio_url: historyItem.audio_url
    };
  }

  onDownloadStartedFromHistory(historyItem: SearchHistoryItem) {
    const dataSong = this.convertSearchHistoryToDataSong(historyItem);
    this.onDownloadStarted(dataSong);
  }

  onDownloadCompletedFromHistory(historyItem: SearchHistoryItem) {
    const dataSong = this.convertSearchHistoryToDataSong(historyItem);
    this.onDownloadCompleted(dataSong);
  }

  onDownloadFailedFromHistory(historyItem: SearchHistoryItem, error: string) {
    const dataSong = this.convertSearchHistoryToDataSong(historyItem);
    this.onDownloadFailed(dataSong, error);
  }

  // === DOWNLOAD EVENT HANDLERS ===
  onDownloadStarted(result: DataSong) {
    console.log('Download started for:', result.title);
    // Show toast notification
    this.showToast(`Downloading "${result.title}"`, 'primary');
  }

  onDownloadCompleted(result: DataSong) {
    console.log('Download completed for:', result.title);
    // Refresh download history and show success message
    this.loadDownloadHistory();
    this.showToast(`Download completed: "${result.title}"`, 'success');
  }

  onDownloadFailed(result: DataSong, error: string) {
    console.error('Download failed for:', result.title, error);
    // Show error message to user
    this.showAlert('Download Failed', `Failed to download "${result.title}": ${error}`);
  }

  onStorageCleared(event: any) {
    console.log('Storage cleared:', event);
    this.loadDownloadHistory();
    this.loadSearchHistory();
    this.showToast('Storage cleared successfully', 'success');
  }

  playDownloadedSong(song: Song) {
    this.audioPlayerService.playSong(song);
  }

  private async loadDownloadHistory() {
    try {
      const downloadedSongs = await this.databaseService.getOfflineSongs();
      this.downloadHistory.set(downloadedSongs);
    } catch (error) {
      console.error('Error loading download history:', error);
    }
  }

  private async showAlert(header: string, message: string) {    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
