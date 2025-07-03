import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatabaseService } from '../../services/database.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { Song } from '../../interfaces/song.interface';
import { ModalController, IonicModule } from '@ionic/angular';

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
  imports: [CommonModule, FormsModule,IonicModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
})
export class StrashComponent  implements OnInit {
  private databaseService = inject(DatabaseService);
  private audioPlayerService = inject(AudioPlayerService);


  constructor(private modalCtrl: ModalController){

  }

  searchQuery = signal('');
  searchResults = signal<SearchResult[]>([]);
  isSearching = signal(false);
  downloadHistory = signal<Song[]>([]);

  ngOnInit() {
    this.loadDownloadHistory();
  }

  closeModal() {
    this.modalCtrl.dismiss(); // Có thể truyền dữ liệu ra nếu muốn
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
          url: 'https://youtube.com/watch?v=sample1'
        },
        {
          id: '2',
          title: 'Another Great Track',
          artist: 'Different Artist',
          duration: '4:12',
          thumbnail: 'https://via.placeholder.com/120x90',
          url: 'https://youtube.com/watch?v=sample2'
        }
      ];

      // Filter results based on query
      const filteredResults = mockResults.filter(result =>
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
      const updatedResults = this.searchResults().map(r =>
        r.id === result.id ? { ...r, isDownloading: true, downloadProgress: 0 } : r
      );
      this.searchResults.set(updatedResults);

      // Simulate download progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const progressResults = this.searchResults().map(r =>
          r.id === result.id ? { ...r, downloadProgress: progress } : r
        );
        this.searchResults.set(progressResults);
      }      // Create song object
      const song: Song = {
        id: result.id,
        title: result.title,
        artist: result.artist,
        duration: this.parseDuration(result.duration),
        duration_formatted: result.duration,
        audio_url: `/data/music/${result.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
        thumbnail_url: result.thumbnail,
        keywords: [],
        addedDate: new Date(),
        lastUpdated: new Date(),
        isFavorite: false
      };

      // Save to database
      await this.databaseService.addSong(song);

      // Update UI
      const finalResults = this.searchResults().map(r =>
        r.id === result.id ? { ...r, isDownloading: false, downloadProgress: 100 } : r
      );
      this.searchResults.set(finalResults);

      // Refresh download history
      await this.loadDownloadHistory();
    } catch (error) {
      console.error('Download error:', error);
      // Reset downloading state on error
      const errorResults = this.searchResults().map(r =>
        r.id === result.id ? { ...r, isDownloading: false, downloadProgress: 0 } : r
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
      // const songs = await this.databaseService.getAllSongs();
      // // Filter only downloaded songs (those with youtubeUrl)
      // const downloaded = songs.filter(song => song.youtubeUrl);
      // this.downloadHistory.set(downloaded);
    } catch (error) {
      console.error('Error loading download history:', error);
    }
  }

  private parseDuration(durationStr: string): number {
    const parts = durationStr.split(':');
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return (minutes * 60) + seconds;
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

