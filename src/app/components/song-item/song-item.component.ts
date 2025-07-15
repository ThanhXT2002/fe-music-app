import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  ChangeDetectorRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Song } from '../../interfaces/song.interface';
import { IonIcon, IonReorder, IonCheckbox } from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { apps, reorderThreeOutline } from 'ionicons/icons';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { LottieEqualizerComponent } from '../lottie-equalizer/lottie-equalizer.component';
import { BtnDownAndHeartComponent } from "../btn-down-and-heart/btn-down-and-heart.component";
import { BtnAddPlaylistComponent } from "../btn-add-playlist/btn-add-playlist.component";

@Component({
  selector: 'app-song-item',
  templateUrl: './song-item.component.html',
  styleUrls: ['./song-item.component.scss'],
  imports: [IonCheckbox, IonReorder, CommonModule, IonIcon, LottieEqualizerComponent, BtnDownAndHeartComponent, BtnAddPlaylistComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongItemComponent implements OnInit {
  @Input() modePage: 'list-page' | 'current-play' | 'down-page' |'edit-playlist' |'favorite' = 'list-page';
  @Input() song!: any;
  @Input() showAlbum: boolean = true;
  @Input() showArtist: boolean = true;
  @Input() playlist: Song[] = [];
  @Input() index: number = 0;
  @Input() showRemoveButton: boolean = false; // ✨ Enable remove button
  @Input() checked: boolean = false;

  // @Input() isSelected!: string;
  // @Input() showRemoveButton: boolean = false;

  @Output() play = new EventEmitter<{
    song: Song;
    playlist: Song[];
    index: number;
  }>();
  @Output() showMenu = new EventEmitter<Song>();
  @Output() toggleFavorite = new EventEmitter<Song>();
  @Output() openPlayer = new EventEmitter<void>();
  @Output() removeSong = new EventEmitter<Song>(); // ✨ Remove song event
  @Output() download = new EventEmitter<any>();
  @Output() pauseDownload = new EventEmitter<any>();
  @Output() resumeDownload = new EventEmitter<any>();
  @Output() cancelDownload = new EventEmitter<any>();
  @Output() checkedChange = new EventEmitter<boolean>();

  currentSong: Song | null = null;
  isPlaying = false;

  // -- Download state:
  @Input() isDownloaded: boolean = false;
  @Input() isDownloading: boolean = false;
  @Input() downloadProgress: number = 0;
  @Input() isPolling: boolean = false; // 🆕 Đang polling status
  @Input() pollProgress: number = 0; // 🆕 Progress polling
  @Input() isReady: boolean = false; // 🆕 Sẵn sàng download

  isShowBoxFunction: boolean = false;

  get isCurrentPlayPage(): boolean {
    return this.modePage === 'current-play';
  }
  get isDownPage(): boolean {
    return this.modePage === 'down-page';
  }
  get isListPage(): boolean {
    return this.modePage === 'list-page';
  }
  get isEditPlaylistPage(): boolean {
    return this.modePage === 'edit-playlist';
  }

  get isFavoriteTab(): boolean {
    return this.modePage === 'favorite';
  }

  constructor(
    private audioPlayerService: AudioPlayerService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    addIcons({ apps, reorderThreeOutline });

    // Use effect to reactively update when playback state changes
    effect(() => {
      const state = this.audioPlayerService.playbackState();
      this.currentSong = state.currentSong;
      this.isPlaying = state.isPlaying;
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    // Get initial state
    const state = this.audioPlayerService.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;
  }

  get isCurrentSong(): boolean {
    return this.currentSong?.id === this.song.id;
  }

  get isThisSongPlaying(): boolean {
    return this.isCurrentSong && this.audioPlayerService.isPlaying();
  }

  onPlay() {
    this.isCurrentSong ? this.handleCurrentSong() : this.playNewSong();
  }

  private handleCurrentSong() {
    if (this.isListPage) {
      this.router.navigate(['/player']);
    }
    this.openPlayer.emit();
  }

  private playNewSong() {
    this.play.emit({
      song: this.song,
      playlist: this.playlist,
      index: this.index,
    });
  }

  onShowMenu(event: Event) {
    event.stopPropagation();
    this.showMenu.emit(this.song);
  }

  onToggleFavorite(event: Event) {
    event.stopPropagation();
    this.toggleFavorite.emit(this.song);
  }

  onRemoveSong(event: Event) {
    event.stopPropagation();
    this.removeSong.emit(this.song);
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/musical-note.webp';
  }

  onSongCheckboxChange(event: any) {
    this.checkedChange.emit(event.detail.checked);
  }

  toogleShowBoxFunction(songId: string) {
    if(songId === this.song.id) {
      this.isShowBoxFunction = !this.isShowBoxFunction;
    }
  }
}
