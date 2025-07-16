import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DataSong, Song } from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DownloadService, DownloadTask } from 'src/app/services/download.service';
import { RefreshService } from 'src/app/services/refresh.service';
import { Subscription } from 'rxjs';

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

  @Input() song!: Song;

  isDownloaded = false;
  private songDownloadedSub?: Subscription;

  constructor() {}

  ngOnInit() {
    // Lắng nghe trạng thái đã download từ service
    this.songDownloadedSub = this.downloadService.songDownloaded$.subscribe(data => {
      if (data && data.songId === this.song.id) {
        console.log('BtnDownAndHeartComponent nhận sự kiện:', data.downloaded);
        this.isDownloaded = data.downloaded;
         this.cdr.markForCheck();
      }
    });
    // Kiểm tra trạng thái ban đầu
    this.checkDownloaded();
  }

  ngOnDestroy() {
    this.songDownloadedSub?.unsubscribe();
  }

  private async checkDownloaded() {
    await this.downloadService.isSongDownloadedDB(this.song.id);
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
     const sub = this.downloadService.downloads$.subscribe(downloads => {
      const task = downloads.find(d => d.songData?.id === this.song.id);
      if (task && task.status === 'completed') {
        setTimeout(() => {
          this.checkDownloaded();
        }, 300); // Đợi thêm 5s sau khi completed
        sub.unsubscribe();
      }
    });
      this.refreshService.triggerRefresh();
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
    return downloads.find(d => d.songData?.id === this.song.id) || null;
  }
}
