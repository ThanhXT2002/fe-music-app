import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IonicModule } from '@ionic/angular';


@Component({
  selector: 'app-btn-icon',
  imports: [CommonModule, IonicModule],
  templateUrl: './btn-icon.component.html',
  styleUrls: ['./btn-icon.component.scss'],
})
export class BtnIconComponent  {
  @Input() icon!: string;
  @Input() cssClass: string = '';
  @Input() height: string = '';
  @Input() width: string = '';
  @Input() color: string = '';
  @Input() disabled: boolean = false;
  @Output() btnClick = new EventEmitter<void>();
  onClick() {
    this.btnClick.emit();
  }

}
