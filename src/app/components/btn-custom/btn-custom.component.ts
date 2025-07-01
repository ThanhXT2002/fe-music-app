import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';
@Component({
  selector: 'app-btn-custom',
  imports: [CommonModule, IonicModule],
  templateUrl: './btn-custom.component.html',
  styleUrls: ['./btn-custom.component.scss'],
})
export class BtnCustomComponent {
  @Input() icon!: string;
  @Input() cssClass: string = '';
  @Input() height: string = '40px';
  @Input() width: string = '40px';
  @Input() color: string = '';
  @Input() borderClass: string = '';
  @Input() rounded: string = 'rounded-full';
  @Input() disabled: boolean = false;
  @Input() text: string = '';
  @Output() btnClick = new EventEmitter<void>();
  onClick() {
    this.btnClick.emit();
  }
}
