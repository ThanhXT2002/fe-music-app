import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Platform } from '@ionic/angular/standalone';
import { FooterComponent } from '../../components/footer/footer.component';
import { SongSectionComponent } from '../../components/song-section/song-section.component';
import { HomeService } from 'src/app/services/api/home.service';
import { Song } from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from 'src/app/services/database.service';
import { InternetErrorComponent } from 'src/app/components/internet-error/internet-error.component';
import { HealthCheckService } from 'src/app/services/api/health-check.service';
import { Oops505Component } from 'src/app/components/oops-505/oops-505.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    FormsModule,
    FooterComponent,
    SongSectionComponent,
    InternetErrorComponent,
    Oops505Component,
  ],
})
export class HomePage implements OnInit {
  healthCheckService = inject(HealthCheckService);
  private homeService = inject(HomeService);
  audioPlayerService = inject(AudioPlayerService);
  private databaseService = inject(DatabaseService);
  private platform = inject(Platform);

  listEveryoneToListens: Song[] = [];
  listRemixSongs: Song[] = [];
  listInstrumentalSongs: Song[] = [];
  listTikTokSongs: Song[] = [];
  isCurrentSong = !!this.audioPlayerService.currentSong();
  pbCustom!: string;

  isOnline: boolean = navigator.onLine;
  get isHealthyValue() {
    return this.healthCheckService.isHealthy();
  }

  constructor() {}

  ngOnInit() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.healthCheckService.refreshHealth();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    if (Capacitor.isNativePlatform()) {
      // For native platforms, set padding based on current song
      this.pbCustom = this.isCurrentSong ? 'pb-16' : '';
    } else {
      if (this.platform.is('pwa')) {
        this.pbCustom = this.isCurrentSong ? 'pb-16' : '';
      } else if (this.platform.is('desktop')) {
        this.pbCustom = this.isCurrentSong ? 'pb-80' : 'pb-64';
      } else {
        this.pbCustom = this.isCurrentSong ? 'pb-[445px]' : 'pb-96';
      }
    }

    this.loadEveryoneToListen();
    this.loadRemixSongs();
    this.loadInstrumentalSongs();
    this.loadTikTokSongs();
  }

  async loadEveryoneToListen() {
    // Get cached data (already loaded when app started)
    this.homeService.getHomeData().subscribe({
      next: async (res) => {
        if (res && res.data) {
          // Ensure data is an array
          if (Array.isArray(res.data)) {
            this.listEveryoneToListens = await this.syncFavorites(res.data);
          } else {
            console.warn('Expected array but got:', typeof res.data);
            this.listEveryoneToListens = [];
          }
        } else {
          this.listEveryoneToListens = [];
        }
      },
      error: (error) => {
        console.error('Error in home page:', error);
        this.listEveryoneToListens = [];
      },
    });
  }

  async loadRemixSongs() {
    this.homeService.getHomeData('remix', 25).subscribe({
      next: async (res) => {
        if (res && res.data) {
          if (Array.isArray(res.data)) {
            this.listRemixSongs = await this.syncFavorites(res.data);
          } else {
            this.listRemixSongs = [];
          }
        } else {
          this.listRemixSongs = [];
        }
      },
      error: (error) => {
        this.listRemixSongs = [];
      },
    });
  }

  async loadInstrumentalSongs() {
    this.homeService.getHomeData('Không Lời', 25).subscribe({
      next: async (res) => {
        if (res && res.data) {
          if (Array.isArray(res.data)) {
            this.listInstrumentalSongs = await this.syncFavorites(res.data);
          } else {
            this.listInstrumentalSongs = [];
          }
        } else {
          this.listInstrumentalSongs = [];
        }
      },
      error: (error) => {
        console.error('Error loading instrumental songs:', error);
        this.listInstrumentalSongs = [];
      },
    });
  }

  async loadTikTokSongs() {
    this.homeService.getHomeData('tik', 25).subscribe({
      next: async (res) => {
        if (res && res.data) {
          if (Array.isArray(res.data)) {
            this.listTikTokSongs = await this.syncFavorites(res.data);
          } else {
            this.listTikTokSongs = [];
          }
        } else {
          this.listTikTokSongs = [];
        }
      },
      error: (error) => {
        this.listTikTokSongs = [];
      },
    });
  }

  // Các method tiện ích để refresh từng danh sách
  refreshRemixSongs() {
    this.homeService.refreshData('remix', 25).subscribe({
      next: (res) => {
        this.listRemixSongs = res.data;
      },
      error: (error) => {
        console.error('Error refreshing remix songs:', error);
      },
    });
  }

  refreshInstrumentalSongs() {
    this.homeService.refreshData('khong loi', 25).subscribe({
      next: (res) => {
        this.listInstrumentalSongs = res.data;
      },
      error: (error) => {
        console.error('Error refreshing instrumental songs:', error);
      },
    });
  }
  refreshTikTokSongs() {
    this.homeService.refreshData('tik', 25).subscribe({
      next: (res) => {
        this.listTikTokSongs = res.data;
      },
      error: (error) => {
        console.error('Error refreshing TikTok songs:', error);
      },
    });
  }

  // Event handlers for song interactions
  onSongClick(event: { song: Song; playlist: Song[] }) {
    const { song, playlist } = event;
    const index = playlist.findIndex((s) => s.id === song.id);
    if (index !== -1) {
      this.audioPlayerService.setPlaylist(playlist, index);
    }
  }

  async syncFavorites(songs: Song[]): Promise<Song[]> {
    const favoriteIds = await this.databaseService.getAllFavoriteSongIds(); // Trả về mảng id các bài hát favorite
    return songs.map((song) => ({
      ...song,
      isFavorite: favoriteIds.includes(song.id),
    }));
  }

  onSongOptions(song: Song) {
    console.log('Song options:', song.title);
    // TODO: Show song options menu (add to playlist, download, etc.)
  }
}
