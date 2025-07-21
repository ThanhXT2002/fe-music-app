import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataSong, Song } from '../../interfaces/song.interface';
import { ModalController, IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  styleUrls: ['./search.page.scss'],
})
export class SearchPage implements OnInit {
  searchQuery = signal('');
  searchResults = signal<DataSong[]>([]);
  isSearching = signal(false);
  downloadHistory = signal<Song[]>([]);
  isClipboardLoading = signal<boolean>(false);

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {}

  async onSearchInput(event: any) {
    const query = event.target.value;
    this.searchQuery.set(query);

    if (query.trim().length < 3) {
      this.searchResults.set([]);
      return;
    }

    await this.searchYouTube(query);
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
    this.searchYouTube(query);


  }
}
