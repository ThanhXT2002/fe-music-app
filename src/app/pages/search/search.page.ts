import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YoutubeService } from '../../services/youtube.service';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { Song } from '../../interfaces/song.interface';
import { ClipboardService } from 'src/app/services/clipboard.service';
import { AlertController } from '@ionic/angular/standalone';

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  url: string;
  isDownloading?: boolean;
  downloadProgress?: number;
}
@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class SearchPage implements OnInit {
  private youtubeService = inject(YoutubeService);
  private databaseService = inject(DatabaseService);
  private audioPlayerService = inject(AudioPlayerService);
  private clipboardService = inject(ClipboardService);
  private alertController = inject(AlertController);

  searchQuery = signal('');
  searchResults = signal<SearchResult[]>([]);
  isSearching = signal(false);
  downloadHistory = signal<Song[]>([]);
  isClipboardLoading = signal<boolean>(false);
  private clipboardRetryCount = 0; // Thêm counter
  private readonly MAX_CLIPBOARD_RETRIES = 2; // Giới hạn retry

  ngOnInit() {
    this.loadDownloadHistory();
  }

  async onSearchInput(event: any) {
    const query = event.target.value;
    this.searchQuery.set(query);

    if (query.trim().length < 3) {
      this.searchResults.set([]);
      return;
    }

    await this.searchYouTube(query);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  async searchYouTube(query: string) {
    try {
      this.isSearching.set(true);

      // Simulate YouTube search results (in real implementation, use YouTube API)
      const mockResults: SearchResult[] = [
        {
          id: '1',
          title: 'Sample Song 1',
          artist: 'Artist Name',
          duration: '3:45',
          thumbnail: 'https://via.placeholder.com/120x90',
          url: 'https://youtube.com/watch?v=sample1',
        },
        {
          id: '2',
          title: 'Another Great Track',
          artist: 'Different Artist',
          duration: '4:12',
          thumbnail: 'https://via.placeholder.com/120x90',
          url: 'https://youtube.com/watch?v=sample2',
        },
      ];

      // Filter results based on query
      const filteredResults = mockResults.filter(
        (result) =>
          result.title.toLowerCase().includes(query.toLowerCase()) ||
          result.artist.toLowerCase().includes(query.toLowerCase())
      );

      this.searchResults.set(filteredResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      this.isSearching.set(false);
    }
  }

  async downloadSong(result: SearchResult) {
    try {
      // Update UI to show downloading state
      const updatedResults = this.searchResults().map((r) =>
        r.id === result.id
          ? { ...r, isDownloading: true, downloadProgress: 0 }
          : r
      );
      this.searchResults.set(updatedResults);

      // Simulate download progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const progressResults = this.searchResults().map((r) =>
          r.id === result.id ? { ...r, downloadProgress: progress } : r
        );
        this.searchResults.set(progressResults);
      } // Create song object
      const song: Song = {
        id: `yt_${result.id}_${Date.now()}`,
        title: result.title,
        artist: result.artist,
        album: 'Downloaded',
        duration: this.parseDuration(result.duration),
        audioUrl: `/data/music/${result.title.replace(
          /[^a-zA-Z0-9]/g,
          '_'
        )}.mp3`,
        filePath: `/data/music/${result.title.replace(
          /[^a-zA-Z0-9]/g,
          '_'
        )}.mp3`,
        thumbnail: result.thumbnail,
        youtubeUrl: result.url,
        addedDate: new Date(),
        playCount: 0,
        isFavorite: false,
      };

      // Save to database
      await this.databaseService.addSong(song);

      // Update UI
      const finalResults = this.searchResults().map((r) =>
        r.id === result.id
          ? { ...r, isDownloading: false, downloadProgress: 100 }
          : r
      );
      this.searchResults.set(finalResults);

      // Refresh download history
      await this.loadDownloadHistory();

      console.log('Song downloaded successfully:', song.title);
    } catch (error) {
      console.error('Download error:', error);
      // Reset downloading state on error
      const errorResults = this.searchResults().map((r) =>
        r.id === result.id
          ? { ...r, isDownloading: false, downloadProgress: 0 }
          : r
      );
      this.searchResults.set(errorResults);
    }
  }

  async playDownloadedSong(song: Song) {
    await this.audioPlayerService.playSong(song);
  }

  async toggleFavorite(song: Song) {
    await this.databaseService.toggleFavorite(song.id);
    await this.loadDownloadHistory();
  }

  private async loadDownloadHistory() {
    try {
      const songs = await this.databaseService.getAllSongs();
      // Filter only downloaded songs (those with youtubeUrl)
      const downloaded = songs.filter((song) => song.youtubeUrl);
      this.downloadHistory.set(downloaded);
    } catch (error) {
      console.error('Error loading download history:', error);
    }
  }

  private parseDuration(durationStr: string): number {
    const parts = durationStr.split(':');
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async onPaste(event?: Event, isRetry: boolean = false) {
    if (!event) {
      // Button click - show loading
      this.isClipboardLoading.set(true);
    }

    try {
      let clipboardText = '';

      if (event) {
        // Paste từ keyboard
        const pasteEvent = event as ClipboardEvent;
        if (pasteEvent.clipboardData) {
          clipboardText = pasteEvent.clipboardData.getData('text');
        }
      } else {
        // Paste từ button - dùng service
        clipboardText = await this.clipboardService.read();
      }

      if (clipboardText.trim()) {
        this.searchQuery.set(clipboardText.trim());
        this.onSearchInput({ target: { value: clipboardText.trim() } } as any);

        // Reset retry count khi thành công
        this.clipboardRetryCount = 0;
      }
    } catch (error) {
      console.error('Failed to paste:', error);

      // Chỉ show error nếu không phải từ retry hoặc chưa vượt quá limit
      if (!isRetry || this.clipboardRetryCount < this.MAX_CLIPBOARD_RETRIES) {
        this.showClipboardError();
      } else {
        // Đã retry quá nhiều lần - chuyển thẳng sang manual paste
        this.showManualPasteAlert();
        this.clipboardRetryCount = 0; // Reset counter
      }
    } finally {
      this.isClipboardLoading.set(false);
    }
  }

  // Thêm method để focus vào input
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
              this.clipboardRetryCount++; // Tăng counter

              // Check permission trước
              const hasPermission =
                await this.clipboardService.checkPermissions();

              if (hasPermission) {
                // Có permission - thử paste lại
                this.onPaste(undefined, true); // isRetry = true
              } else {
                // Không có permission - show manual alert
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
            this.clipboardRetryCount = 0; // Reset counter
            this.focusSearchInput();
          },
        },
      ],
      cssClass: 'custom-permission-alert',
    });

    await alert.present();
  }

private async showManualPasteAlert() {
  this.clipboardRetryCount = 0; // Reset counter

  const alert = await this.alertController.create({
    mode: 'ios',
    header: 'Paste thủ công',
    message: 'Không thể đọc clipboard tự động. Vui lòng:\n\n• Desktop: Nhấn Ctrl+V (hoặc Cmd+V)\n• Mobile: Nhấn giữ và chọn "Dán"',
    buttons: [
      {
        text: 'OK',
        handler: () => {
          this.focusSearchInput();
        }
      }
    ],
    cssClass: 'custom-info-alert'
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
}
