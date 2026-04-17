import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

/**
 * Trang báo lỗi 404.
 *
 * Chức năng:
 * - Hiển thị thông báo khi người dùng truy cập một route không tồn tại
 * - Cung cấp nút liên kết quay lại trang chủ
 *
 * Route: ** (Catch-all)
 */
@Component({
  selector: 'app-oops-404',
  templateUrl: './oops-404.page.html',
  styleUrls: ['./oops-404.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink]
})
export class Oops404Page implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
