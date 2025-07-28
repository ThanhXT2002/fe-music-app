import { Location } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';


@Component({
  selector: 'app-drag-back',
  templateUrl: './drag-back.component.html',
  styleUrls: ['./drag-back.component.scss'],
})
export class DragBackComponent  implements OnInit {
  private location = inject(Location);

  constructor() { }

  ngOnInit() {}

  handleBack(){
    this.location.back();
  }

}
