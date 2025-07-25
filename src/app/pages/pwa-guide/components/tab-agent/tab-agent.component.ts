import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-tab-agent',
  templateUrl: './tab-agent.component.html',
  imports: [CommonModule],
  styleUrls: ['./tab-agent.component.scss'],
})
export class TabAgentComponent implements OnInit {
  readonly tabs = [
    { key: 'ios', label: 'iOS', icon: 'fab fa-apple' },
    { key: 'android', label: 'Android', icon: 'fab fa-android' },
  ] as const;

  activeTab: 'ios' | 'android' = 'ios';


  setTab(tab: 'ios' | 'android') {
    this.activeTab = tab;
    this.loadAgentContent();
  }

  listAgent: any[] = [];
  imgSelect = 'assets/images/musical-note.webp';

  constructor() {}

  ngOnInit() {
    this.setTab('ios');
    this.loadAgentContent();
  }

  loadAgentContent() {
    const result =
      this.INSTALL_GUIDE.find((item) => item.key === this.activeTab)?.items ||
      [];
    this.imgSelect = result[0]?.img || this.imgSelect;
    this.listAgent = [...result];
    console.log('listAgent', this.listAgent);
  }

  selectAgent(item: any) {
    this.imgSelect = item.img;
    console.log('Selected agent:', item);
  }

  readonly INSTALL_GUIDE = [
    {
      key: 'ios',
      items: [
        {
          id: 1,
          content: 'Mở trình duyệt Safari trên iPhone hoặc iPad.',
          img: 'assets/images/musical-note.webp',
        },
        {
          id: 2,
          content: 'Truy cập vào website XTMusic.',
          img: 'assets/images/musical-note.webp',
        },
        {
          id: 3,
          content:
            'Nhấn nút "Chia sẻ" (Share) ở dưới cùng, chọn "Thêm vào Màn hình chính".',
          img: 'assets/images/musical-note.webp',
        },
        {
          id: 4,
          content:
            'Xác nhận và hoàn tất, biểu tượng XTMusic sẽ xuất hiện trên màn hình chính.',
          img: 'assets/images/musical-note.webp',
        },
      ],
    },
    {
      key: 'android',
      items: [
        {
          id: 1,
          content: 'Mở trình duyệt Chrome trên thiết bị Android.',
          img: 'assets/images/musical-note.webp',
        },
        {
          id: 2,
          content: 'Truy cập vào website XTMusic.',
          img: 'assets/images/musical-note.webp',
        },
        {
          id: 3,
          content:
            'Nhấn vào menu (3 chấm), chọn "Thêm vào Màn hình chính" hoặc "Cài đặt ứng dụng".',
          img: 'assets/images/musical-note.webp',
        },
        {
          id: 4,
          content:
            'Xác nhận và hoàn tất, biểu tượng XTMusic sẽ xuất hiện trên màn hình chính.',
          img: 'assets/images/musical-note.webp',
        },
      ],
    },
  ] as const;
}
