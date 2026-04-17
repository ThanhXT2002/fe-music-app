import { Component, OnInit, ViewChild } from '@angular/core';
import {
  IonHeader,
  IonModal,
  IonContent,
  IonNav,
} from '@ionic/angular/standalone';
import { RouterLink, Router } from '@angular/router';
import { SearchPage } from 'src/app/pages/search/search.page';
import { Location } from '@angular/common';
import { ModalController } from '@ionic/angular/standalone';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

/**
 * Component thanh điều hướng phía trên của phiên bản Web (Header).
 *
 * Chức năng:
 * - Hiển thị logo/tên ứng dụng trực quan.
 * - Cung cấp lối tắt điều hướng tới màn hình tìm kiếm thông thường.
 * - Cung cấp nút để mở modal/page tìm kiếm bài hát theo file (nhận diện bài hát).
 */
@Component({
  selector: 'app-header',
  imports: [IonHeader, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],

})
export class HeaderComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // ViewChild & Input
  // ─────────────────────────────────────────────────────────
  /** Tham chiếu đến IonNav để thao tác với stack navigation ẩn (nếu có ở giao diện web cũ) */
  @ViewChild('navSearch') private navSearch!: IonNav;

  // ─────────────────────────────────────────────────────────
  // Constructor & Lifecycle
  // ─────────────────────────────────────────────────────────
  constructor(
    private router: Router,
    private modalCtrl: ModalController,
    private breakpointObserver: BreakpointObserver
  ) {}

  ngOnInit() {}

  // ─────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────
  /**
   * Mở giao diện Tìm kiếm bài hát bằng file âm thanh.
   *
   * - Xem xét không gian hiển thị (dùng BreakpointObserver).
   * - Trên giao diện lớn (Tablet/Web): Điều hướng trực tiếp sang route `/find-song-with-file`.
   * - Trên nền mobile (nhỏ): Mở modal component sheet hiển thị từ dưới lên để có trải nghiệm native mobile tốt nhất.
   */
  async toggleFindSongByAudio() {
    try {
      this.breakpointObserver
        .observe([Breakpoints.Tablet, Breakpoints.Web])
        .subscribe(async (result) => {
          if (result.matches) {
            // Điều hướng sang trang riêng khi ở màn hình rộng
            this.router.navigate(['/find-song-with-file']);
          } else {
            // Import động Component để giảm dung lượng bundle tải về ban đầu
            const { FindInforSongWithFileComponent } = await import(
              '../find-infor-song-with-file/find-infor-song-with-file.component'
            );
            const modal = await this.modalCtrl.create({
              component: FindInforSongWithFileComponent,
              presentingElement: undefined,
              breakpoints: [0, 0.9],
              handle: true,
              backdropDismiss: true,
              mode: 'ios',
            });
            await modal.present();
          }
        });
    } catch (error) {
      console.error('Error opening playlist select modal:', error);
    }
  }

  /**
   * Điều hướng sang trang Tìm kiếm thông thường.
   *
   * Lưu lại URL hiện tại vào LocalStorage để hỗ trợ thao tác back quay lại đúng ngữ cảnh trước đó.
   */
  navToSearch() {
    localStorage.setItem('back-search', this.router.url);
    this.router.navigate(['/search']);
  }
}
