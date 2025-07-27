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
import { DataSong, Song } from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { DatabaseService } from 'src/app/services/database.service';
import {
  DownloadService,
  DownloadTask,
} from 'src/app/services/download.service';
import { RefreshService } from 'src/app/services/refresh.service';
import { Subscription, takeWhile } from 'rxjs';
import { PageContextService } from 'src/app/services/page-context.service';

@Component({
  selector: 'app-btn-down-and-heart',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './btn-down-and-heart.component.html',
  styleUrls: ['./btn-down-and-heart.component.scss'],
})
export class BtnDownAndHeartComponent implements OnInit, OnDestroy {
  downloadService = inject(DownloadService);
  private databaseService = inject(DatabaseService);
  private refreshService = inject(RefreshService);
  private audioPlayerService = inject(AudioPlayerService);
  private cdr = inject(ChangeDetectorRef);
  private pageContext = inject(PageContextService);

  private downloadStatusSub?: Subscription;

  @Input() song!: Song;
  get isLoading(): boolean {
    return (
      !!this.song &&
      this.downloadService.loadingFallbackSongIds().has(this.song.id)
    );
  }
  isDownloaded: boolean = false;

  private songDownloadedSub?: Subscription;
  isSearchPage = false;

  get downloadTask(): DownloadTask | undefined {
    return this.downloadService.getDownloadBySongId(this.song.id);
  }

  get isDownloading(): boolean {
    return (
      !!this.downloadTask &&
      (this.downloadTask.status === 'downloading' ||
        this.downloadTask.status === 'pending')
    );
  }

  get downloadProgress(): number {
    return this.downloadTask?.progress ?? 0;
  }

  constructor() {
    effect(() => {
      const page = this.pageContext.getCurrentPage()();
      if (page === 'search') {
        this.isSearchPage = true;
      }
    });
  }

  ngOnInit() {
    // Lắng nghe trạng thái đã download từ service, phân biệt bài hát nào đang được hiển thị
    this.songDownloadedSub = this.downloadService.songDownloaded$.subscribe(
      (data) => {
        if (data && data.songId === this.song.id) {
          this.isDownloaded = data.downloaded;
          this.cdr.markForCheck();
        }
      }
    );
    // Kiểm tra trạng thái ban đầu
    this.checkDownloaded();
    // Kiểm tra trạng thái ban đầu
    this.checkDownloaded();
  }

  ngOnDestroy() {
    this.songDownloadedSub?.unsubscribe();
    this.songDownloadedSub?.unsubscribe();
    this.downloadStatusSub?.unsubscribe();
  }

  async checkDownloaded() {
    this.isDownloaded = await this.downloadService.isSongDownloadedDB(
      this.song.id
    );
    this.cdr.markForCheck(); // Nếu dùng ChangeDetectionStrategy.OnPush
  }

  async toggleFavorite() {
    if (this.song) {
      try {
        await this.databaseService.toggleFavorite(this.song.id);
        this.song.isFavorite = !this.song.isFavorite;
        this.audioPlayerService.updateCurrentSong(this.song);
        this.refreshService.triggerRefresh();
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    }
  }

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
      await this.downloadService.downloadSong(song);

      // Hủy subscription cũ nếu có
      this.downloadStatusSub?.unsubscribe();

      this.downloadStatusSub = this.downloadService.downloads$
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
              this.refreshService.triggerRefresh();
            }, 300);
          }
        });
    } catch (error) {
      console.error('Download failed:', error);
    }
  }

  get currentDownloadTask() {
    if (!this.song) return null;
    const downloads = this.downloadService.currentDownloads;
    return downloads.find((d) => d.songData?.id === this.song.id);
  }

  getDownloadTask(downloads: DownloadTask[] | null): DownloadTask | null {
    if (!downloads) return null;
    return downloads.find((d) => d.songData?.id === this.song.id) || null;
  }

  isPolling(songId: string): boolean {
    return this.downloadService.isPolling(songId);
  }
}
