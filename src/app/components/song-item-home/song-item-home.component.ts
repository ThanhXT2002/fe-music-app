import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Song } from 'src/app/interfaces/song.interface';

@Component({
  selector: 'app-song-item-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './song-item-home.component.html',
  styleUrls: ['./song-item-home.component.scss']
})
export class SongItemHomeComponent {
  @Input() song!: Song;
  @Input() showDuration: boolean = true;
  @Input() showArtist: boolean = true;

  @Output() songClick = new EventEmitter<Song>();
  @Output() songPlay = new EventEmitter<Song>();
  @Output() songOptions = new EventEmitter<Song>();

  onSongClick() {
    this.songClick.emit(this.song);
  }

  onPlayClick(event: Event) {
    event.stopPropagation();
    this.songPlay.emit(this.song);
  }

  onOptionsClick(event: Event) {
    event.stopPropagation();
    this.songOptions.emit(this.song);
  }
}
