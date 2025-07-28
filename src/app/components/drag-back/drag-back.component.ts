import { Location } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-drag-back',
  templateUrl: './drag-back.component.html',
  imports: [DragDropModule],
  styleUrls: ['./drag-back.component.scss'],
})
export class DragBackComponent  implements OnInit {
  private location = inject(Location);
  private justDragged = false;

  constructor() { }

  ngOnInit() {}

  handleBack(){
    if (!this.justDragged) {
      this.location.back();
      // Sau khi back thì reset flag
      this.justDragged = false;
    }
  }

  onDragStarted() {
    // Không cần xử lý gì ở đây
  }

  onDragEnded() {
    // Đánh dấu vừa drag xong
    this.justDragged = true;
    // Reset flag sau một khoảng thời gian nếu không click
    setTimeout(() => {
      this.justDragged = false;
    }, 1000);
  }
}
