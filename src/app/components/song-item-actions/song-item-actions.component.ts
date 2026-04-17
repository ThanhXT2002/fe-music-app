import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BtnAddPlaylistComponent } from "../btn-add-playlist/btn-add-playlist.component";
import { BtnDownAndHeartComponent } from "../btn-down-and-heart/btn-down-and-heart.component";
import { CommonModule } from '@angular/common';
import { BtnDeleteSongComponent } from "../btn-delete-song/btn-delete-song.component";

/**
 * Component Hiển thị Nút Trượt thả xuống để tích hợp thêm tổ hợp Phím tương tác.
 *
 * Chức năng:
 * - Được lồng ghép vào Song Item tuỳ vào Item List để trồi sụt ngăn kéo Toolbar Menu nhanh.
 */
@Component({
  selector: 'app-song-item-actions',
  templateUrl: './song-item-actions.component.html',
  styleUrls: ['./song-item-actions.component.scss'],
  imports: [BtnAddPlaylistComponent, BtnDownAndHeartComponent, CommonModule, BtnDeleteSongComponent],
})
export class SongItemActionsComponent {
  // ─────────────────────────────────────────────────────────
  // Inputs & Mode Controls
  // ─────────────────────────────────────────────────────────
  /** Binding Model */
  @Input() song: any;
  
  /** Điều hướng layout style dựa trên Mode Grid Home (Box vuông) hay List dọc thuần (List Thẳng) */
  @Input() modeItem: 'itemHome' | 'itemList' = 'itemList';

  // ─────────────────────────────────────────────────────────
  // Output Event Emitters
  // ─────────────────────────────────────────────────────────
  /** Gọi ngược lên cha thu hẹp Action Box lại */
  @Output() close = new EventEmitter<void>();

  // Dùng Getter thay vì Function Call Angular thuần DOM check
  get isItemHome(): boolean {
    return this.modeItem === 'itemHome';
  }
  
  get isItemList(): boolean {
    return this.modeItem === 'itemList';
  }

  // ─────────────────────────────────────────────────────────
  // Core Logics
  // ─────────────────────────────────────────────────────────
  onClose(event: Event) {
    event.stopPropagation();
    this.close.emit();
  }
}
