import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';

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
  imgSelect = 'assets/images/ios_1.webp';

  constructor(
    private platform: Platform
  ) {}

  ngOnInit() {
    if( this.platform.is('ios') || this.platform.is('ipad') || this.platform.is('iphone') ) {
      this.setTab('ios');

    }else if (this.platform.is('android') || this.platform.is('tablet') || this.platform.is('mobileweb')) {
      this.setTab('android');
    } else {
      this.setTab('ios');
    }
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
          content:
            'Nhấn nút "Chia sẻ" ở phí dưới.',
          img: 'assets/images/ios_1.webp',
        },
        {
          id: 2,
          content:
            'Chọn "Thêm vào màn hình chính".',
          img: 'assets/images/ios_2.webp',
        },
         {
          id: 3,
          content: 'Xác nhận "Thêm" để hoàn tất.',
          img: 'assets/images/ios_3.webp',
        },
      ],
    },
    {
      key: 'android',
      items: [
        {
          id: 1,
          content: 'Nhấn vào menu (3 chấm) ở góc trên bên phải.',
          img: 'assets/images/android_1.webp',
        },
        {
          id: 2,
          content: 'Chọn "Thêm vào màn hình chính".',
          img: 'assets/images/android_2.webp',
        },
        {
          id: 3,
          content:
            'Chọn "Cài đặt ứng dụng" để hoàn tất.',
          img: 'assets/images/android_3.webp',
        },
      ],
    },
  ] as const;
}
