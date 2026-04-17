import { Component, Input, OnInit } from '@angular/core';

/**
 * Component trình chiếu hoạt ảnh Skeleton (khối xám loang lổ) dự phòng khi Loading API.
 *
 * Chức năng:
 * - Kích cỡ Layout mô phỏng hoàn toàn bằng đúng một Song Item có thật.
 * - Ionic Skeleton Text được thiết kế giúp giao diện có cảm giác mượt mà không đột ngột bể vỡ.
 */
@Component({
  selector: 'app-skeleton-song-item',
  templateUrl: './skeleton-song-item.component.html',
  styleUrls: ['./skeleton-song-item.component.scss'],
})
export class SkeletonSongItemComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Inputs Properties
  // ─────────────────────────────────────────────────────────
  /** Thông số Index truyền từ List Array chèn ngoài For Loops nhằm track By logic Framework */
  @Input() index: number = 0;

  constructor() { }

  ngOnInit() {}
}
