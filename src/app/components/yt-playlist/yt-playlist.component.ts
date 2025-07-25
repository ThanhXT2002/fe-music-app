import { CommonModule } from '@angular/common';
import { Component, effect, Input, OnInit } from '@angular/core';
import { YTPlayerTrack } from 'src/app/interfaces/ytmusic.interface';
import {
  IonReorderGroup,
  IonItem,
  IonContent,
} from '@ionic/angular/standalone';
import { SongItemComponent } from '../song-item/song-item.component';
import { Song } from 'src/app/interfaces/song.interface';
import { YtPlayerService } from 'src/app/services/yt-player.service';

@Component({
  selector: 'app-yt-playlist',
  templateUrl: './yt-playlist.component.html',
  imports: [
    IonContent,
    IonItem,
    IonReorderGroup,
    CommonModule,
    SongItemComponent,
  ],
  styleUrls: ['./yt-playlist.component.scss'],
})
export class YtPlaylistComponent implements OnInit {
  @Input() playlist: YTPlayerTrack[] = [];

  @Input() progressPercentage: () => number = () => 0;


  // Các hàm callback truyền từ cha xuống
  @Input() onPlaySong!: (event: {
    song: Song;
    playlist: Song[];
    index: number;
  }) => void;
  @Input() onPreviousTrack!: () => void;
  @Input() onNextTrack!: () => void;
  @Input() onTogglePlayPause!: () => void;
  @Input() onToggleShuffle!: () => void;
  @Input() onReorder!: (from: number, to: number) => void;
  @Input() countdownTime: () => string = () => '0:00';

  currentIndex = 0;
  currentSong: YTPlayerTrack | null = null;
  isPlaying = true;
  isShuffling = false;
  songTitle = '';
  songArtist = '';
  songThumbnail = '';
  songDuration = '';

  ytTrackToSong(track: YTPlayerTrack): Song {
    return {
      id: track.videoId,
      title: track.title,
      artist: track.artists?.[0]?.name || '',
      duration: Number(track.length) || 0,
      duration_formatted: '',
      keywords: [],
      audio_url: '',
      thumbnail_url: track.thumbnail?.[track.thumbnail.length - 1]?.url || '',
      isFavorite: false,
      addedDate: new Date(),
    };
  }

  get playlistAsSong(): Song[] {
    return this.playlist.map(this.ytTrackToSong);
  }

  constructor(public ytPlayerService: YtPlayerService) {
    effect(() => {
      this.currentIndex = this.ytPlayerService.currentIndex();
      this.currentSong = this.ytPlayerService.currentSong();
      this.isPlaying = this.ytPlayerService.isPlaying();
      this.isShuffling = this.ytPlayerService.isShuffling();
      this.songTitle = this.ytPlayerService.songTitle();
      this.songArtist = this.ytPlayerService.songArtist();
      this.songThumbnail = this.ytPlayerService.songThumbnail();
      this.songDuration = this.ytPlayerService.songDuration();
    });
  }

  ngOnInit() {}

  playSong(event: { song: Song; playlist: Song[]; index: number }) {
    this.onPlaySong?.(event);
  }
  previousTrack() {
    this.onPreviousTrack?.();
  }
  nextTrack() {
    this.onNextTrack?.();
  }
  togglePlayPause() {
    this.onTogglePlayPause?.();
  }
  toggleShuffle() {
    this.onToggleShuffle?.();
  }
  onIonReorder(event: any) {
    const from = event.detail.from;
    const to = event.detail.to;
    if (from !== to) {
      this.onReorder?.(from, to);
    }
    event.detail.complete(true);
  }
}
