import { Component, OnInit } from '@angular/core';

/**
 * Màn hình cảnh báo trạng thái lỗi 5XX / Lỗi không lường trước từ Backend Server API.
 * Thông báo rằng vấn đề là từ phía hệ thống máy chủ, qua mặt các lỗi gián đoạn cơ bản khác.
 */
@Component({
  selector: 'app-oops-505',
  templateUrl: './oops-505.component.html',
  styleUrls: ['./oops-505.component.scss'],
})
export class Oops505Component implements OnInit {
  constructor() {}

  ngOnInit() {}
}
