import { Location, NgClass } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';


@Component({
  selector: 'app-drag-back',
  templateUrl: './drag-back.component.html',
  styleUrls: ['./drag-back.component.scss'],
  imports: [NgClass]
})
export class DragBackComponent  implements OnInit {
  private location = inject(Location);
  isNative = Capacitor.isNativePlatform()


  constructor() { }

  ngOnInit() {}

  handleBack(){
    this.location.back();
  }

}
