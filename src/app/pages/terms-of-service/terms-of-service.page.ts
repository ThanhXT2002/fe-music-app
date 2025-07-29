import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DragBackComponent } from "src/app/components/drag-back/drag-back.component";

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.page.html',
  styleUrls: ['./terms-of-service.page.scss'],
  standalone: true,
  imports: [ CommonModule, FormsModule, RouterModule, DragBackComponent]
})
export class TermsOfServicePage implements OnInit {
  constructor() { }

  ngOnInit() {
  }


  termsCards = [
    {
      title: 'Quy định sử dụng',
      iconClass: 'fas fa-scroll',
      colors: {
        cardBg: 'bg-[#312e81]',
        iconContainerBg: 'bg-purple-700/30',
        iconColor: 'text-purple-300',
        titleColor: 'text-purple-100',
      },
      contentType: 'list',
      content: [
        'Chỉ sử dụng ứng dụng cho mục đích cá nhân, không thương mại',
        'Không sử dụng ứng dụng cho các hành vi vi phạm pháp luật',
        'Không tải lên hoặc chia sẻ nội dung vi phạm bản quyền',
      ],
    },
    {
      title: 'Quyền sở hữu trí tuệ',
      iconClass: 'fas fa-copyright',
      colors: {
        cardBg: 'bg-[#0f766e]',
        iconContainerBg: 'bg-teal-700/30',
        iconColor: 'text-teal-200',
        titleColor: 'text-teal-100',
      },
      contentType: 'paragraph',
      content: 'Toàn bộ mã nguồn, logo, giao diện thuộc sở hữu của tác giả Tran Xuan Thanh. Không được sao chép, chỉnh sửa, phân phối khi chưa có sự đồng ý.',
    },
    {
      title: 'Giới hạn trách nhiệm',
      iconClass: 'fas fa-shield-alt',
      colors: {
        cardBg: 'bg-[#1e293b]',
        iconContainerBg: 'bg-slate-700/30',
        iconColor: 'text-slate-200',
        titleColor: 'text-slate-100',
      },
      contentType: 'paragraph',
      content: 'XTMusic cung cấp "nguyên trạng" (as is), không chịu trách nhiệm với bất kỳ thiệt hại nào phát sinh từ việc sử dụng ứng dụng.',
    },
    {
      title: 'Thay đổi & chấm dứt dịch vụ',
      iconClass: 'fas fa-power-off',
      colors: {
        cardBg: 'bg-[#334155]',
        iconContainerBg: 'bg-blue-700/30',
        iconColor: 'text-blue-200',
        titleColor: 'text-blue-100',
      },
      contentType: 'paragraph',
      content: 'Chúng tôi có thể thay đổi hoặc ngừng cung cấp dịch vụ bất cứ lúc nào mà không cần báo trước.',
    },
    {
      title: 'Liên hệ',
      iconClass: 'fas fa-envelope',
      colors: {
        cardBg: 'bg-[#6d28d9]',
        iconContainerBg: 'bg-purple-900/30',
        iconColor: 'text-purple-200',
        titleColor: 'text-purple-100',
      },
      contentType: 'html',
      content: 'Mọi thắc mắc, khiếu nại vui lòng liên hệ: <a href="mailto:tranxuanthanhtxt2002&#64;gmail.com" class="text-purple-300 underline hover:text-purple-200 transition-colors">tranxuanthanhtxt2002&#64;gmail.com</a>',
    },
    {
      title: 'Lưu ý sử dụng',
      iconClass: 'fas fa-lightbulb',
      colors: {
        cardBg: 'bg-[#f59e42]',
        iconContainerBg: 'bg-orange-700/30',
        iconColor: 'text-orange-200',
        titleColor: 'text-orange-100',
      },
      contentType: 'list',
      content: [
        'Đảm bảo cập nhật ứng dụng và trình duyệt thường xuyên để có trải nghiệm tốt nhất.',
      ],
    },
  ];

}
