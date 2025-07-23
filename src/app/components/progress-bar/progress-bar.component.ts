import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
} from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  templateUrl: './progress-bar.component.html',
  imports: [CommonModule],
  styleUrls: ['./progress-bar.component.scss'],
})
export class ProgressBarComponent implements OnInit {
  @Input() progress: number = 0; // phần trăm đã nghe
  @Input() buffer: number = 100; // phần trăm đã preload (mặc định 100)
  @Input() hover: number = -1; // phần trăm hover preview
  @Input() isDragging: boolean = false;
  @Input() isHovering: boolean = false;
  @Input() duration: number = 0;
  @Input() currentTime: number = 0;

  @Output() seek = new EventEmitter<number>(); // emit thời gian mới khi seek
  @Output() dragStart = new EventEmitter<void>();
  @Output() dragEnd = new EventEmitter<void>();
  @Output() hoverChange = new EventEmitter<number>();

  @ViewChild('progressContainer', { static: false })
  progressContainer?: ElementRef<HTMLElement>;

  tempProgress: number = 0;
  dragging: boolean = false;
  hoverPercent: number = -1;

  ngOnInit() {}

  onProgressClick(event: MouseEvent) {
    const percent = this.getProgressPercent(event);
    const seekTime = (percent / 100) * this.duration;
    this.seek.emit(seekTime);
  }

  onProgressStart(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    this.dragging = true;
    this.tempProgress = this.getProgressPercent(event);
    this.dragStart.emit();
    document.addEventListener('mousemove', this.onGlobalMouseMove, {
      passive: false,
    });
    document.addEventListener('mouseup', this.onGlobalMouseUp, {
      passive: true,
    });
    document.addEventListener('touchmove', this.onGlobalTouchMove, {
      passive: false,
    });
    document.addEventListener('touchend', this.onGlobalTouchEnd, {
      passive: true,
    });
  }

  onProgressMove(event: MouseEvent | TouchEvent) {
    if (!this.dragging) {
      this.hoverPercent = this.getProgressPercent(event);
      this.hoverChange.emit(this.hoverPercent);
    } else {
      this.tempProgress = this.getProgressPercent(event);
    }
  }

  onProgressEnd(event: MouseEvent | TouchEvent) {
    if (this.dragging) {
      this.finishDrag();
    }
  }

  onProgressLeave() {
    if (!this.dragging) {
      this.hoverPercent = -1;
      this.hoverChange.emit(-1);
    }
  }

  private onGlobalMouseMove = (event: MouseEvent) => {
    if (this.dragging) {
      event.preventDefault();
      this.tempProgress = this.getProgressPercent(event);
    }
  };
  private onGlobalMouseUp = (event: MouseEvent) => {
    if (this.dragging) {
      this.finishDrag();
    }
  };
  private onGlobalTouchMove = (event: TouchEvent) => {
    if (this.dragging) {
      event.preventDefault();
      this.tempProgress = this.getProgressPercent(event);
    }
  };
  private onGlobalTouchEnd = (event: TouchEvent) => {
    if (this.dragging) {
      this.finishDrag();
    }
  };

  private finishDrag() {
    if (!this.dragging) return;
    const seekTime = (this.tempProgress / 100) * this.duration;
    this.seek.emit(seekTime);
    this.dragging = false;
    this.dragEnd.emit();
    this.cleanupGlobalListeners();
  }

  private cleanupGlobalListeners() {
    document.removeEventListener('mousemove', this.onGlobalMouseMove);
    document.removeEventListener('mouseup', this.onGlobalMouseUp);
    document.removeEventListener('touchmove', this.onGlobalTouchMove);
    document.removeEventListener('touchend', this.onGlobalTouchEnd);
  }

  private getProgressPercent(event: MouseEvent | TouchEvent): number {
    let clientX = 0;
    if (event instanceof MouseEvent) {
      clientX = event.clientX;
    } else if (event instanceof TouchEvent) {
      clientX = event.touches[0]?.clientX || 0;
    }
    let progressElem: HTMLElement | null = null;
    if (this.progressContainer && this.progressContainer.nativeElement) {
      progressElem = this.progressContainer.nativeElement;
    } else {
      progressElem = document.querySelector(
        '[data-progress-container]'
      ) as HTMLElement;
    }
    if (!progressElem) return 0;
    const rect = progressElem.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}
}
