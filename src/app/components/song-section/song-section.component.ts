import { Component, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Platform } from '@ionic/angular/standalone';
import { PlaybackState, Song } from 'src/app/interfaces/song.interface';
import { SongItemHomeComponent } from '../song-item-home/song-item-home.component';
import { SkeletonSongItemComponent } from "../skeleton-song-item/skeleton-song-item.component";

@Component({
  selector: 'app-song-section',
  standalone: true,
  imports: [CommonModule, SongItemHomeComponent, SkeletonSongItemComponent],
  templateUrl: './song-section.component.html',
  styleUrls: ['./song-section.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SongSectionComponent {
  private platform = inject(Platform);

  @Input() title?: string;
  @Input() songs: Song[] = [];
  @Input() loading: boolean = false;
  @Input() loadingText: string = 'Đang tải...';
  @Input() playerState!: PlaybackState;

@Output() songClick = new EventEmitter<{ song: Song, playlist: Song[] }>();
  @Output() songPlay = new EventEmitter<Song>();
  @Output() songOptions = new EventEmitter<Song>();

  // Group songs into arrays of 4 for slide layout
  getGroupedSongs(songs: Song[]): Song[][] {
    if (!songs || songs.length === 0) {
      return [];
    }

    const groupedSongs: Song[][] = [];
    for (let i = 0; i < songs.length; i += 4) {
      groupedSongs.push(songs.slice(i, i + 4));
    }
    return groupedSongs;
  }

  // Generate skeleton items for loading state
  getSkeletonItems(): number[][] {
    const isMobile = this.platform.is('mobile') || this.platform.is('tablet') || window.innerWidth < 768;
    const totalItems = isMobile ? 8 : 25;
    const itemsPerSlide = 4;

    const skeletonGroups: number[][] = [];
    for (let i = 0; i < totalItems; i += itemsPerSlide) {
      const remainingItems = Math.min(itemsPerSlide, totalItems - i);
      skeletonGroups.push(Array(remainingItems).fill(0).map((_, index) => i + index));
    }
    return skeletonGroups;
  }

onSongClick(song: Song) {
  this.songClick.emit({ song, playlist: this.songs });
}

  onSongOptions(song: Song) {
    this.songOptions.emit(song);
  }
}
