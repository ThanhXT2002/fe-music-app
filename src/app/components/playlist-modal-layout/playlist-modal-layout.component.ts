import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonReorderGroup } from "@ionic/angular/standalone";
import { IonicModule } from "@ionic/angular";
import { SongItemComponent } from "../song-item/song-item.component";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-playlist-modal-layout',
  templateUrl: './playlist-modal-layout.component.html',
  styleUrls: ['./playlist-modal-layout.component.scss'],
  imports: [IonicModule,CommonModule, SongItemComponent],
})
export class PlaylistModalLayoutComponent {
  @Input() playlist: any[] = [];
  @Input() currentSong: any;
  @Input() currentIndex: number = 0;
  @Input() isPlaying: boolean = false;
  @Input() isShuffling: boolean = false;
  @Input() progressPercentage: number = 0;
  @Input() durationTime: string = '0:00';
  @Input() songThumbnail: string = '';
  @Input() songTitle: string = '';
  @Input() songArtist: string = '';
  @Input() trackBySongId: any;

  @Output() playSong = new EventEmitter<{ song: any, index: number }>();
  @Output() previousTrack = new EventEmitter<void>();
  @Output() nextTrack = new EventEmitter<void>();
  @Output() togglePlayPause = new EventEmitter<void>();
  @Output() toggleShuffle = new EventEmitter<void>();
  @Output() onIonReorder = new EventEmitter<any>();
}
