import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { DataSong } from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { DatabaseService } from 'src/app/services/database.service';
import { DownloadService } from 'src/app/services/download.service';
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
  private downloadService = inject(DownloadService);
  private databaseService = inject(DatabaseService);
  private refreshService = inject(RefreshService);

  currentSong = this.audioPlayerService.currentSong;

  constructor() {}

  ngOnInit() {}

  isDownloaded(songId: string): boolean {
    return this.downloadService.isSongDownloaded(songId);
  }

  async toggleFavorite() {
    const song = this.currentSong();
    if (song) {
      try {
        await this.databaseService.toggleFavorite(song.id);
        // Update the song object
        song.isFavorite = !song.isFavorite;
        this.audioPlayerService.updateCurrentSong(song);
        this.refreshService.triggerRefresh();
      } catch (error) {
        console.error('Error toggling favorite:', error);
      }
    }
  }

  async toggleDownload(currentSong: any): Promise<void> {
    const song: DataSong = {
      id: currentSong.id,
      title: currentSong.title,
      artist: currentSong.artist,
      thumbnail_url: currentSong.thumbnail_url,
      duration: currentSong.duration,
      duration_formatted: currentSong.duration_formatted,
      keywords: currentSong.keywords,
      original_url: '',
      created_at: new Date().toISOString(),
    };

    console.table(song);
    if (!song) return;
    if (this.isDownloaded(song.id)) {
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
    const song = this.currentSong();
    if (!song) return null;
    const downloads = this.downloadService.currentDownloads;
    return downloads.find((d) => d.songData?.id === song.id);
  }
}
