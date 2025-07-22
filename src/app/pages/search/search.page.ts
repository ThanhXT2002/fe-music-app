import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalController, IonicModule } from '@ionic/angular';
import { BtnCustomComponent } from 'src/app/components/btn-custom/btn-custom.component';
import { YtMusicService } from 'src/app/services/api/ytmusic.service';
import {
  YTMusicSearchResult,
  YTMusicArtist,
  YTMusicSong,
  YTMusicPlaylist
} from 'src/app/interfaces/ytmusic.interface';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, BtnCustomComponent],
  styleUrls: ['./search.page.scss'],
})
export class SearchPage implements OnInit {
  searchQuery = signal('');
  searchResults = signal<YTMusicSearchResult[]>([]);
  isSearching = signal(false);

  activeTab: string = 'all';
  tabs = [
    { id: 'all', label: 'Tất cả' },
    { id: 'songs', label: 'Bài hát' },
    { id: 'artists', label: 'Nghệ sĩ' },
    { id: 'playlists', label: 'Danh sách phát' },
  ];

  constructor(private modalCtrl: ModalController, private ytMusic: YtMusicService) {}

  ngOnInit() {}

  onTabChange(tab: any) {
    this.activeTab = tab.id;
  }

  getTabClass(tabId: string): string {
    const baseClasses =
      ' flex-shrink-0 px-2 py-1.5 text-sm font-medium transition-colors whitespace-nowrap text-white';
    if (this.activeTab === tabId) {
      return baseClasses + ' bg-pink-500/30';
    }
    return baseClasses + ' bg-white bg-opacity-20 text-black text-white border-transparent';
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

  onInputChange(event: any) {
    const query = event.target.value;
    this.searchQuery.set(query);
    // Không tự động search ở đây
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  async searchYouTube(query: string) {
    try {
      this.isSearching.set(true);
      this.ytMusic.search(query).subscribe({
        next: (results) => {
          this.searchResults.set(results);
        },
        error: (err) => {
          this.searchResults.set([]);
        },
        complete: () => {
          this.isSearching.set(false);
        },
      });
    } catch (error) {
      this.isSearching.set(false);
      this.searchResults.set([]);
    }
  }

  getTitle(item: YTMusicSearchResult): string {
    if (item.resultType === 'song' || item.resultType === 'playlist') {
      return (item as YTMusicSong | YTMusicPlaylist).title;
    }
    if (item.resultType === 'artist') {
    const artistObj = item as YTMusicArtist;
    return artistObj.artist || (artistObj.artists && artistObj.artists.length > 0 ? artistObj.artists[0].name : '');
  }
    return '';
  }

  getArtists(item: YTMusicSearchResult): string {
    if (item.resultType === 'song') {
      const song = item as YTMusicSong;
      return song.artists && song.artists.length > 0
        ? song.artists.map(a => a.artist).join(', ')
        : '';
    }
    return '';
  }

  getDuration(item: YTMusicSearchResult): string {
    if (item.resultType === 'song') {
      return (item as YTMusicSong).duration;
    }
    return '';
  }

  getSubscribers(item: YTMusicSearchResult): string {
    if (item.resultType === 'artist') {
      return (item as YTMusicArtist).subscribers || '';
    }
    return '';
  }

  getPlaylistAuthor(item: YTMusicSearchResult): string {
    if (item.resultType === 'playlist') {
      return (item as YTMusicPlaylist).author || '';
    }
    return '';
  }

  onSearchButtonClick() {
    const query = this.searchQuery().trim();
    if (query.length < 3) {
      this.searchResults.set([]);
      return;
    }
    this.searchYouTube(query);
  }

  // filteredResults(): YTMusicSearchResult[] {
  //   if (this.activeTab === 'all') return this.searchResults();
  //   if (this.activeTab === 'songs')
  //     return this.searchResults().filter((r) => r.resultType === 'song');
  //   if (this.activeTab === 'artists')
  //     return this.searchResults().filter((r) => r.resultType === 'artist');
  //   if (this.activeTab === 'playlists')
  //     return this.searchResults().filter((r) => r.resultType === 'playlist');
  //   return this.searchResults();
  // }
}
