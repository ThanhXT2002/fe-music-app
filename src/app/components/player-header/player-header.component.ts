import { Component, Output, EventEmitter, Input } from '@angular/core';

@Component({
  selector: 'app-player-header',
  templateUrl: './player-header.component.html',
  styleUrls: ['./player-header.component.scss'],
})
export class PlayerHeaderComponent {
  @Output() back = new EventEmitter<void>();
  @Output() menu = new EventEmitter<void>();
  @Input() title: string = 'NOW PLAYING';
  @Input() subtitle: string = '_ ___ _';
}
