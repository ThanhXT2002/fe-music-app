import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BtnAddPlaylistComponent } from "../btn-add-playlist/btn-add-playlist.component";
import { BtnDownAndHeartComponent } from "../btn-down-and-heart/btn-down-and-heart.component";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-song-item-actions',
  templateUrl: './song-item-actions.component.html',
  styleUrls: ['./song-item-actions.component.scss'],
  imports: [BtnAddPlaylistComponent, BtnDownAndHeartComponent, CommonModule],
})
export class SongItemActionsComponent {
  @Input() song: any;
  @Input() modeItem:'itemHome' | 'itemList' = 'itemList';
  @Output() close = new EventEmitter<void>();

  get isItemHome(): boolean {
    return this.modeItem === 'itemHome';
  }
  get isItemList(): boolean {
    return this.modeItem === 'itemList';
  }

  onClose(event: Event) {
    event.stopPropagation();
    this.close.emit();
  }
}
