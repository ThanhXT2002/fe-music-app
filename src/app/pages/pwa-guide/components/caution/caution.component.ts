import { Component, OnInit } from '@angular/core';

/**
 * Component hiển thị khối cảnh báo hoặc lưu ý cho người dùng.
 *
 * Chức năng:
 * - Được dùng để nhấn mạnh các thông tin quan trọng trong trang hướng dẫn (PWA)
 */
@Component({
  selector: 'app-caution',
  templateUrl: './caution.component.html',
  styleUrls: ['./caution.component.scss'],
})
export class CautionComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
