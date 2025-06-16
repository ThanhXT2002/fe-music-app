import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

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
import { OfflineMediaService } from '../../services/offline-media.service';

@Component({
  selector: 'app-downloads',
  templateUrl: './downloads.page.html',
  styleUrls: ['./downloads.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class DownloadsPage implements OnInit {
  private databaseService = inject(DatabaseService);
  downloadService = inject(DownloadService);
  private audioPlayerService = inject(AudioPlayerService);
  private clipboardService = inject(ClipboardService);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);
  private platform = inject(Platform);
  private offlineMediaService = inject(OfflineMediaService);
  searchQuery = signal('');
  searchResults = signal<DataSong[]>([]);
  isSearching = signal(false);
  downloadHistory = signal<Song[]>([]);
  searchHistoryItem = signal<SearchHistoryItem[]>([]);
  isClipboardLoading = signal<boolean>(false);

  // Download state
  downloads = signal<DownloadTask[]>([]);
  downloadedSongIds = signal<Set<string>>(new Set()); // Track downloaded song IDs

  async ngOnInit() {
    await this.loadSearchHistory();
    await this.loadDownloadedSongs(); // Load downloaded songs

    // Subscribe to download changes
    this.downloadService.downloads$.subscribe((downloads) => {
      this.downloads.set(downloads);

      // Cập nhật downloaded songs khi có task hoàn thành
      const completedSongs = downloads
        .filter(d => d.status === 'completed' && d.songData?.id)
        .map(d => d.songData!.id);

      if (completedSongs.length > 0) {
        const currentDownloaded = this.downloadedSongIds();
        const updatedDownloaded = new Set([...currentDownloaded, ...completedSongs]);
        this.downloadedSongIds.set(updatedDownloaded);
      }
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
      keywords: historyItem.keywords,
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
   * Kiểm tra xem bài hát đã download xong chưa (dựa vào database)
   * @param songId - ID bài hát
   * @returns boolean
   */
  isDownloaded(songId: string): boolean {
    return this.downloadedSongIds().has(songId);
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
   * Load danh sách songs đã download từ database
   */
  private async loadDownloadedSongs() {
    // Lấy tất cả bài hát đã download
    const songs = await this.databaseService.getAllSongs();
    for (const song of songs) {
      (song as any).thumbnailUrl = await this.getOfflineThumbnail(song);
    }
    this.downloadHistory.set(songs);
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
      position: 'bottom',
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

  private focusSearchInput() {
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
   * Lấy thumbnail offline (ưu tiên offline, fallback online)
   */
  async getOfflineThumbnail(song: Song | DataSong): Promise<string> {
    // Nếu là DataSong (chưa download), trả về thumbnail_url
    if ('thumbnail_url' in song) return song.thumbnail_url;
    // Nếu là Song đã download, lấy offline (ưu tiên), fallback online
    return await this.offlineMediaService.getThumbnailUrl(song.id, song.thumbnail || '');
  }

  onThumbnailError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/placeholder.png';
  }

  onSongClick(song: Song) {
    this.audioPlayerService.playSong(song, this.downloadHistory());
  }
}
