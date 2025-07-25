import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-benefit-common',
  templateUrl: './benefit-common.component.html',
  imports: [CommonModule],
  styleUrls: ['./benefit-common.component.scss'],
})
export class BenefitCommonComponent implements OnInit {


  BENEFIT_LIST = [
    {
      icon: 'fas fa-rocket',
      title: 'Truy cập nhanh chóng',
      content:
        'Mở ứng dụng chỉ với một chạm từ màn hình chính, không cần tìm kiếm trong trình duyệt.',
    },
    {
      icon: 'fas fa-mobile-alt',
      title: 'Trải nghiệm như ứng dụng gốc',
      content:
        'Tận hưởng giao diện mượt mà, tốc độ tải nhanh và các tính năng tương tác phong phú.',
    },
    {
      icon: 'fas fa-bell-slash',
      title: 'Làm việc ngoại tuyến',
      content:
        'Tiếp tục sử dụng một số tính năng của ứng dụng ngay cả khi không có kết nối internet.',
    },
    {
      icon: 'fas fa-hdd',
      title: 'Tiết kiệm dung lượng',
      content:
        'Cài đặt PWA không tốn nhiều không gian lưu trữ như ứng dụng thông thường.',
    },
    {
      icon: 'fas fa-sync-alt',
      title: 'Luôn cập nhật',
      content:
        'Ứng dụng tự động cập nhật phiên bản mới nhất mà không cần tải lại từ cửa hàng.',
    },
    {
      icon: 'fas fa-lock',
      title: 'Bảo mật cao',
      content:
        'Hoạt động qua HTTPS, đảm bảo an toàn dữ liệu và quyền riêng tư của bạn.',
    },
  ];

  constructor() {}

  ngOnInit() {}
}
