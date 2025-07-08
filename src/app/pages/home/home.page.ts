import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  Platform,
} from '@ionic/angular/standalone';
import { FooterComponent } from '../../components/footer/footer.component';
import { SongSectionComponent } from '../../components/song-section/song-section.component';
import { HomeService } from 'src/app/services/api/home.service';
import {
  Song,
  DataSong,
  SongConverter,
} from 'src/app/interfaces/song.interface';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Capacitor } from '@capacitor/core';

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
    SongSectionComponent
  ],
})
export class HomePage implements OnInit {
  listEveryoneToListens: Song[] = [];
  listRemixSongs: Song[] = [];
  listInstrumentalSongs: Song[] = [];
  listTikTokSongs: Song[] = [];
  isCurrentSong: boolean = false;
  pbCustom!: string; // Default padding for non-current song

  constructor(
    private homeService: HomeService,
    private audioPlayerService: AudioPlayerService,
    private platform: Platform
  ) {
    this.isCurrentSong = !!this.audioPlayerService.currentSong();
  }

  ngOnInit() {

    if(Capacitor.isNativePlatform()) {
      // For native platforms, set padding based on current song
      this.pbCustom = this.isCurrentSong ? 'pb-48' : 'pb-32';
      console.log('Native platform detected, padding set to:', this.pbCustom);
    }else{
      if(this.platform.is('ios') && this.platform.is('pwa')) {
        console.log('iOS PWA detected');
         this.pbCustom = this.isCurrentSong ? 'pb-16' : '';
      }
      else if(this.platform.is('android') && this.platform.is('pwa')){
        this.pbCustom = this.isCurrentSong ? 'pb-16' : '';
      }
      else if(this.platform.is('desktop')) {
          this.pbCustom = this.isCurrentSong ? 'pb-80' : 'pb-64';
      }
      else {
        this.pbCustom =this.isCurrentSong?'pb-[445px]' :'pb-96';
      }
    }

    this.loadEveryoneToListen();
    this.loadRemixSongs();
    this.loadInstrumentalSongs();
    this.loadTikTokSongs();
  }

  loadEveryoneToListen() {
    // Get cached data (already loaded when app started)
    this.homeService.getHomeData().subscribe({
      next: (res) => {
        if (res && res.data) {
          console.log('Home page received cached data:', res.data);
          // Ensure data is an array
          if (Array.isArray(res.data)) {
            this.listEveryoneToListens = res.data;
          } else {
            console.warn('Expected array but got:', typeof res.data);
            this.listEveryoneToListens = [];
          }
        } else {
          console.log('Data is still loading...');
          this.listEveryoneToListens = [];
        }
      },
      error: (error) => {
        console.error('Error in home page:', error);
        this.listEveryoneToListens = [];
      },
    });
  }

  loadRemixSongs() {
    this.homeService.getHomeData('remix', 25).subscribe({
      next: (res) => {
        if (res && res.data) {
          console.log('Remix songs loaded:', res.data);
          if (Array.isArray(res.data)) {
            this.listRemixSongs = res.data;
          } else {
            console.warn('Expected array but got:', typeof res.data);
            this.listRemixSongs = [];
          }
        } else {
          console.log('Remix songs are still loading...');
          this.listRemixSongs = [];
        }
      },
      error: (error) => {
        console.error('Error loading remix songs:', error);
        this.listRemixSongs = [];
      },
    });
  }

  loadInstrumentalSongs() {
    this.homeService.getHomeData('Không Lời', 25).subscribe({
      next: (res) => {
        if (res && res.data) {
          console.log('Instrumental songs loaded:', res.data);
          if (Array.isArray(res.data)) {
            this.listInstrumentalSongs = res.data;
          } else {
            console.warn('Expected array but got:', typeof res.data);
            this.listInstrumentalSongs = [];
          }
        } else {
          console.log('Instrumental songs are still loading...');
          this.listInstrumentalSongs = [];
        }
      },
      error: (error) => {
        console.error('Error loading instrumental songs:', error);
        this.listInstrumentalSongs = [];
      },
    });
  }

  loadTikTokSongs() {
    this.homeService.getHomeData('tik', 25).subscribe({
      next: (res) => {
        if (res && res.data) {
          console.log('TikTok songs loaded:', res.data);
          if (Array.isArray(res.data)) {
            this.listTikTokSongs = res.data;
          } else {
            console.warn('Expected array but got:', typeof res.data);
            this.listTikTokSongs = [];
          }
        } else {
          console.log('TikTok songs are still loading...');
          this.listTikTokSongs = [];
        }
      },
      error: (error) => {
        console.error('Error loading TikTok songs:', error);
        this.listTikTokSongs = [];
      },
    });
  }

  // Các method tiện ích để refresh từng danh sách
  refreshRemixSongs() {
    this.homeService.refreshData('remix', 25).subscribe({
      next: (res) => {
        console.log('Remix songs refreshed:', res.data);
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
        console.log('Instrumental songs refreshed:', res.data);
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
        console.log('TikTok songs refreshed:', res.data);
        this.listTikTokSongs = res.data;
      },
      error: (error) => {
        console.error('Error refreshing TikTok songs:', error);
      },
    });
  }

  // Event handlers for song interactions
  onSongClick(song: Song) {
    console.log('Song clicked:', song.title);
    // TODO: Navigate to song detail or add to queue
  }

  onSongPlay(song: Song) {
    console.log('Play song:', song.title);
    // TODO: Start playing the song
  }

  onSongOptions(song: Song) {
    console.log('Song options:', song.title);
    // TODO: Show song options menu (add to playlist, download, etc.)
  }
}
