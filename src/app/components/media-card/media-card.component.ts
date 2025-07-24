import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Album } from '../../interfaces/song.interface';
import { formatDuration } from 'src/app/utils/format-time.util';

export interface MediaItem {
  id?: string;
  name: string;
  artist?: string;
  thumbnail?: string;
  thumbnail_url?: string;
  songCount?: number;
  totalDurationFormatted?: string;
  songs?: any[];
  totalDuration?: number;
  isUserCreated?: boolean;
  description?: string;
}

@Component({
  selector: 'app-media-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-card.component.html',
  styleUrls: ['./media-card.component.scss']
})
export class MediaCardComponent {
  @Input() item!: MediaItem | Album;
  @Input() isActive: boolean = false;
  @Input() type: 'artist' | 'album' = 'artist';
  @Input() showMenu: boolean = false;

  @Output() itemClick = new EventEmitter<MediaItem | Album>();
  @Output() menuClick = new EventEmitter<{item: MediaItem | Album, event: Event}>();

  onItemClick() {
    this.itemClick.emit(this.item);
  }

  onMenuClick(event: Event) {
    event.stopPropagation();
    this.menuClick.emit({ item: this.item, event });
  }

  onImageError(event: any) {
    event.target.src = 'assets/images/musical-note.webp';
  }

  getImageSrc(): string {
    return this.item.thumbnail || (this.item as any).thumbnail_url || 'assets/images/musical-note.webp';
  }

  get displayName(): string {
    return this.item.name;
  }

  get displayInfo(): string {
    if (this.type === 'album') {
      const songCount = this.item.songs?.length || (this.item as any).songCount || 0;
      const duration = (this.item as any).totalDurationFormatted || formatDuration(this.item.totalDuration || 0);
      return `${songCount} bài • ${duration}`;
    } else {
      const songCount = (this.item as any).songCount || 0;
      const duration = (this.item as any).totalDurationFormatted || '';
      return `${songCount} bài - ${duration}`;
    }
  }
}
