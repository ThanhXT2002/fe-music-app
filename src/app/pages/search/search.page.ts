import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { DataSong, Song } from '../../interfaces/song.interface';
import { ClipboardService } from 'src/app/services/clipboard.service';
import { AlertController } from '@ionic/angular/standalone';
import { finalize, tap } from 'rxjs';
import { DownloadService } from 'src/app/services/download.service';
import { ModalController, IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  styleUrls: ['./search.page.scss'],
})
export class SearchPage implements OnInit {
  downloadService = inject(DownloadService);
  private databaseService = inject(DatabaseService);
  private audioPlayerService = inject(AudioPlayerService);
  private clipboardService = inject(ClipboardService);
  private alertController = inject(AlertController);

  searchQuery = signal('');
  searchResults = signal<DataSong[]>([]);
  isSearching = signal(false);
  downloadHistory = signal<Song[]>([]);
  isClipboardLoading = signal<boolean>(false);
  private clipboardRetryCount = 0; // Thêm counter
  private readonly MAX_CLIPBOARD_RETRIES = 2; // Giới hạn retry

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {}

  async onSearchInput(event: any) {
    const query = event.target.value;
    this.searchQuery.set(query);

    if (query.trim().length < 3) {
      this.searchResults.set([]);
      return;
    }

    // Check if the input is a valid YouTube URL
    if (this.downloadService.validateYoutubeUrl(query)) {
      // Don't automatically process YouTube URLs - wait for user to click search button
      this.searchResults.set([]);
      return;
    } else {
      await this.searchYouTube(query);
    }
  }

  async processYouTubeUrl(url: string) {
    try {
      this.isSearching.set(true);
      this.downloadService
        .getYoutubeUrlInfo(url)
        .pipe(
          tap((response) => {
            if (response.success) {
              const song = response.data;
              // Convert API response to search result format
              const result: DataSong = {
                id: song.id,
                title: song.title,
                artist: song.artist,
                duration: song.duration,
                duration_formatted: song.duration_formatted,
                thumbnail_url: song.thumbnail_url,
                keywords: song.keywords || [],
                original_url: song.original_url || '',
                created_at: song.created_at || new Date().toISOString(),
              };

              this.searchResults.set([result]);
            } else {
              console.error('API returned error:', response.message);
              this.searchResults.set([]);
            }
          }),
          finalize(() => this.isSearching.set(false))
        )
        .subscribe();
    } catch (error) {
      console.error('Error processing YouTube URL:', error);
      this.isSearching.set(false);
      this.searchResults.set([]);
    }
  }

  closeModal() {
    this.modalCtrl.dismiss(); // Có thể truyền dữ liệu ra nếu muốn
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  async searchYouTube(query: string) {
    try {
      this.isSearching.set(true);

      // Simulate YouTube search results (in real implementation, use YouTube API)
      const mockResults: DataSong[] = [
        {
          id: '1',
          title: 'Sample Song 1',
          artist: 'Artist Name',
          duration_formatted: '3:45',
          duration: 225, // seconds
          thumbnail_url: 'https://via.placeholder.com/120x90',
          keywords: ['sample', 'test'],
          original_url: 'https://youtube.com/watch?v=sample1',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Another Great Track',
          artist: 'Different Artist',
          duration_formatted: '4:12',
          duration: 252, // seconds
          thumbnail_url: 'https://via.placeholder.com/120x90',
          keywords: ['another', 'great'],
          original_url: 'https://youtube.com/watch?v=sample2',
          created_at: new Date().toISOString(),
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

  onSearchYoutubeUrl() {
    const query = this.searchQuery().trim();

    if (query.length === 0) {
      return;
    }

    // Check if the input is a valid YouTube URL
    if (this.downloadService.validateYoutubeUrl(query)) {
      this.processYouTubeUrl(query);
    } else {
      // If not a YouTube URL, perform regular search
      this.searchYouTube(query);
    }
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
