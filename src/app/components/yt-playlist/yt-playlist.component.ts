import { CommonModule } from '@angular/common';
import { Component, effect, Input, OnInit, inject } from '@angular/core';
import { YTPlayerTrack } from '@core/interfaces/ytmusic.interface';
import {
  IonReorderGroup,
  IonItem,
  IonContent,
} from '@ionic/angular/standalone';
import { SongItemComponent } from '../song-item/song-item.component';
import { Song } from '@core/interfaces/song.interface';
import { ytPlayerTrackToSong } from '@core/utils/yt-player-track.converter';
import { YtPlayerStore } from '../../core/stores/yt-player.store';
import { PlaylistModalLayoutComponent } from "../playlist-modal-layout/playlist-modal-layout.component";
import { BtnDownAndHeartComponent } from "../btn-down-and-heart/btn-down-and-heart.component";
import { BtnAddPlaylistComponent } from "../btn-add-playlist/btn-add-playlist.component";

/**
 * Component Hiển thị Danh sách phát phiên bản rẽ nhánh dành riêng cho Youtube Audio Tracker.
 *
 * Chức năng:
 * - Trình bày Playlist với định dạng Schema của thiết kế Youtube.
 * - Call YtPlayerStore và thực thi Callback hàm qua các Output Params.
 */
@Component({
  selector: 'app-yt-playlist',
  templateUrl: './yt-playlist.component.html',
  imports: [
    CommonModule,
    PlaylistModalLayoutComponent,
    BtnDownAndHeartComponent,
    BtnAddPlaylistComponent
  ],
  styleUrls: ['./yt-playlist.component.scss'],
})
export class YtPlaylistComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Store & Properties
  // ─────────────────────────────────────────────────────────
  private readonly yt = inject(YtPlayerStore);

  /** Mảng danh sách phát thô chứa dữ liệu bóc từ nguồn Youtube */
  @Input() playlist: YTPlayerTrack[] = [];
  
  /** Hàm nặc danh đẩy ra ngoài số lượng phần trăm tua bài (Closure) */
  @Input() progressPercentage: () => number = () => 0;

  // ─────────────────────────────────────────────────────────
  // Output Mappings (Props Drilling Model)
  // ─────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────
  // Internal State Data
  // ─────────────────────────────────────────────────────────
  currentIndex = 0;
  currentSong: YTPlayerTrack | null = null;
  isPlaying = true;
  isShuffling = false;
  songTitle = '';
  songArtist = '';
  songThumbnail = '';
  songDuration = '';

  // ─────────────────────────────────────────────────────────
  // Constructor & Init
  // ─────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      this.currentIndex = this.yt.currentIndex();
      this.currentSong = this.yt.currentTrack();
      this.isPlaying = this.yt.isPlaying();
      this.isShuffling = this.yt.isShuffling();
      this.songTitle = this.yt.songTitle();
      this.songArtist = this.yt.songArtist();
      this.songThumbnail = this.yt.songThumbnail();
      this.songDuration = this.yt.songDuration();
    });
  }

  ngOnInit() {}

  // ─────────────────────────────────────────────────────────
  // Utilities & Connectors
  // ─────────────────────────────────────────────────────────
  /** Convert Track Object gốc về Data Model Song System */
  ytTrackToSong(track: YTPlayerTrack): Song {
    return ytPlayerTrackToSong(track);
  }

  /** Phóng tác thành Array mới theo Interface toàn cục UI ứng dụng */
  get playlistAsSong(): Song[] {
    return this.playlist.map(this.ytTrackToSong);
  }
  
  trackBySongId = (index: number, song: Song) => song?.id || index;

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
