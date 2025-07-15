import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit } from '@angular/core';
import { DataSong, Song } from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DownloadService, DownloadTask } from 'src/app/services/download.service';
import { RefreshService } from 'src/app/services/refresh.service';

@Component({
  selector: 'app-btn-down-and-heart',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './btn-down-and-heart.component.html',
  styleUrls: ['./btn-down-and-heart.component.scss'],
})
export class BtnDownAndHeartComponent implements OnInit {
  private audioPlayerService = inject(AudioPlayerService);
   downloadService = inject(DownloadService);
  private databaseService = inject(DatabaseService);
  private refreshService = inject(RefreshService);

  @Input() song!: Song;

  constructor() {}

  ngOnInit() {}

  isDownloaded(): boolean {
    return this.downloadService.isSongDownloaded(this.song.id);
  }

  async toggleFavorite() {
    if (this.song) {
      try {
        await this.databaseService.toggleFavorite(this.song.id);
        // Update the song object
        this.song.isFavorite = !this.song.isFavorite;
        // this.audioPlayerService.updateCurrentSong(this.song);
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

    // console.table(song);
    if (!song) return;
    if (this.isDownloaded()) {
      return;
    }
    try {
      await this.downloadService.downloadSong(song);
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
