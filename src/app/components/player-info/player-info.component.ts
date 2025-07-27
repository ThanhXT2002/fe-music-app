import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-player-info',
  templateUrl: './player-info.component.html',
  styleUrls: ['./player-info.component.scss'],
  imports: [CommonModule],
})
export class PlayerInfoComponent {
  @Input() thumbnail?: string | null;
  @Input() title?: string | null;
  @Input() artist?: string | null;
  @Input() isPlaying: boolean = false;

    onImageError(event: any): void {
    event.target.src = 'assets/images/background.webp';
  }

}
