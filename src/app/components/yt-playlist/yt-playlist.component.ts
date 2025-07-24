import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { YTPlayerTrack } from 'src/app/interfaces/ytmusic.interface';
import {
  IonReorderGroup,
  IonItem,
  IonContent,
} from '@ionic/angular/standalone';
import { SongItemComponent } from '../song-item/song-item.component';
import { Song } from 'src/app/interfaces/song.interface';

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
  @Input() currentIndex: number = 0;
  @Input() currentSong: YTPlayerTrack | null = null;
  @Input() isPlaying: boolean = true;
  @Input() isShuffling: boolean = false;
  @Input() songTitle: string = '';
  @Input() songArtist: string = '';
  @Input() songThumbnail: string = '';
  @Input() songDuration: string = '';

  @Input() progressPercentage: () => number = () => 0;

  // Các hàm callback truyền từ cha xuống
  @Input() onPlaySong!: (event: { song: Song; playlist: Song[]; index: number }) => void;
  @Input() onPreviousTrack!: () => void;
  @Input() onNextTrack!: () => void;
  @Input() onTogglePlayPause!: () => void;
  @Input() onToggleShuffle!: () => void;
  @Input() onReorder!: (from: number, to: number) => void;

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

  constructor() {}

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
