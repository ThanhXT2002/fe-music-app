import { Component, OnInit } from '@angular/core';

/**
 * Màn hình cảnh báo khi thiết bị không phát hiện kết nối mạng cục bộ.
 * Cung cấp phản hồi trực quan giải thích tại sao luồng mạng đang gián đoạn.
 */
@Component({
  selector: 'app-internet-error',
  templateUrl: './internet-error.component.html',
  styleUrls: ['./internet-error.component.scss'],
})
export class InternetErrorComponent implements OnInit {
  constructor() {}

  ngOnInit() {}
}
