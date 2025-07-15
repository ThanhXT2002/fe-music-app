import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaybackState, Song } from 'src/app/interfaces/song.interface';
import { LottieEqualizerComponent } from "../lottie-equalizer/lottie-equalizer.component";
import { SongItemActionsComponent } from "../song-item-actions/song-item-actions.component";

@Component({
  selector: 'app-song-item-home',
  standalone: true,
  imports: [CommonModule, LottieEqualizerComponent, SongItemActionsComponent],
  templateUrl: './song-item-home.component.html',
  styleUrls: ['./song-item-home.component.scss']
})
export class SongItemHomeComponent {
  @Input() song!: Song;
  @Input() showDuration: boolean = true;
  @Input() showArtist: boolean = true;
  @Input() currentSong: Song | null = null;
  @Input() playerState!: PlaybackState;
@Input() sectionPlaylist: Song[] = [];
isShowBoxFunction = false;

  @Output() songClick = new EventEmitter<Song>();
  @Output() songOptions = new EventEmitter<Song>();

  onSongClick() {
    this.songClick.emit(this.song);
  }

  toogleShowBoxFunction() {
  this.isShowBoxFunction = !this.isShowBoxFunction;
}
}
