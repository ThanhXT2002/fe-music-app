import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DragBackComponent } from "src/app/components/drag-back/drag-back.component";

/**
 * Trang Chính sách Quyền riêng tư (Privacy Policy).
 *
 * Chức năng:
 * - Hiển thị nội dung thông báo về quyền riêng tư
 * - Đảm bảo tính minh bạch về thu thập, lưu trữ, và sử dụng dữ liệu của ứng dụng
 *
 * Route: /privacy-policy
 */
@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  standalone: true,
  imports: [ CommonModule, FormsModule, RouterModule, DragBackComponent]
})
export class PrivacyPolicyPage implements OnInit {

  constructor(  ) { }

  ngOnInit() {

  }


}
