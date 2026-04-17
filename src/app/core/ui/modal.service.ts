import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

import { IonModal } from '@ionic/angular/standalone';

// ─────────────────────────────────────────────────────────
// Trạm Dịch Vụ Cửa Sổ Bật Lên Modal (Modal Service)
// ─────────────────────────────────────────────────────────

/**
 * ModalService — Lớp chuyên quản lý và phân luồng trạng thái Component bật nổi Popup.
 *
 * TẠI SAO:
 * Thay vì để từng Page tự tạo lại `ModalController.create` gây thừa code và lỗi chồng lấn Modal,
 * ta dùng bộ trung tâm để kiểm soát luồng bật/tắt (Singleton) Modal. Mặc định tự động chặn chồng lấn.
 */
@Injectable({ providedIn: 'root' })
export class ModalService {
  // ─────────────────────────────────────────────────────────
  // DEPENDENCIES
  // ─────────────────────────────────────────────────────────
  private modalCtrl = inject(ModalController);
  private router = inject(Router);
  private location = inject(Location);
  
  // ─────────────────────────────────────────────────────────
  // STATE & PROPERTIES
  // ─────────────────────────────────────────────────────────

  /** Con trỏ lưu tham chiếu tới Modal Tổng rễ màn hình (Global Root Modal) */
  private globalModal?: IonModal;

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Dán tham chiếu gốc tới Modal toàn khung.
   */
  setGlobalModal(modal: IonModal) {
    this.globalModal = modal;
  }

  /**
   * Lệnh kích hoạt Show global base modal
   */
  async openGlobalModal() {
    await this.globalModal?.present();
  }

  /**
   * Cưỡng chế ẩn global modal
   */
  async closeGlobalModal() {
    await this.globalModal?.dismiss();
  }

  /**
   * Đẩy View Bottom Sheet danh sách phát nhạc (Current Playlist Modal).
   * @param breakpoints Trục neo danh sách mốc thả neo hiển thị (Mặc định vuốt lửng 0.6 hoặc Full 1.0)
   * @param initialBreakpoint Trục neo bật màn xuất phát (Defualt: 0.6 ở dạng Bottom Sheet thả đáy)
   */
  async openCurrentPlaylist(
    breakpoints = [0, 0.6, 1],
    initialBreakpoint = 0.6
  ): Promise<void> {
    try {
      // NOTE: Áp dụng Dynamic Import Component ngay lúc này để tránh tải bundle bị nặng vô ích lúc chưa cần mở Modal
      const { CurrentPlaylistComponent } = await import(
        '../../components/current-playlist/current-playlist.component'
      );

      const modal = await this.modalCtrl.create({
        component: CurrentPlaylistComponent,
        presentingElement: undefined,
        breakpoints,
        initialBreakpoint,
        handle: true,
        backdropDismiss: true,
        mode: 'ios',
      });

      await modal.present();
    } catch (error) {
      console.error('Lỗi khi cố gắn Modal Playlist hiển thị:', error);
    }
  }

  /**
   * Phóng to Component Play nhạc YouTube ra dạng Modal Box.
   * @param componentProps Tham số tuỳ chọn data truyền vô ruột Child Component bên trong Modal
   */
  async openYtPlaylist(componentProps: Record<string, any>): Promise<void> {
    try {
      // TODO: Tách Lazy Loading Bundle
      const { YtPlaylistComponent } = await import(
        '../../components/yt-playlist/yt-playlist.component'
      );

      const modal = await this.modalCtrl.create({
        component: YtPlaylistComponent,
        componentProps,
        presentingElement: undefined,
        breakpoints: [0, 1],
        initialBreakpoint: 1,
        handle: true,
        backdropDismiss: true,
        mode: 'ios',
      });

      await modal.present();
    } catch (error) {
      console.error('Sự cố bật YtPlaylist modal:', error);
    }
  }

  /**
   * Nút Back Cân Thông Minh: Smart Switch Close.
   * - Xử lý thông minh bắt sự kiện tắt cả việc là Modal nổi hay là Trang URL Route.
   * - Nếu thấy nó đang bật chèn dạng Floating Modal thì dismiss Modal. 
   * - Còn nếu thấy mảng là Native Page Navigation thì ấn ngầm location back của History.
   */
  async smartClose(): Promise<void> {
    try {
      const topModal = await this.modalCtrl.getTop();
      if (topModal) {
        await this.modalCtrl.dismiss();
      } else {
        if (window.history.length > 1) {
          this.location.back();
        } else {
          this.router.navigate(['/'], { replaceUrl: true });
        }
      }
    } catch {
      try {
        if (window.history.length > 1) {
          this.location.back();
        } else {
          this.router.navigate(['/'], { replaceUrl: true });
        }
      } catch (error) {
        console.error('Lệnh quay về lịch sử lỗi:', error);
        this.router.navigate(['/'], { replaceUrl: true });
      }
    }
  }

  /**
   * Điều phối mở Playlist Thông minh.
   * Chọc kiểm tra xem nếu đang ở sẵn trong thân Modal tổng thì tái sử dụng Modal cũ Ref.
   * Nếu không nằm ở context Modal nào thì Create đẩy tạo Modal mới hoàn toàn.
   */
  async smartOpenPlaylist(
    globalModalRef?: { open: () => Promise<void> }
  ): Promise<void> {
    try {
      const topModal = await this.modalCtrl.getTop();
      if (topModal && globalModalRef) {
        await globalModalRef.open();
      } else {
        await this.openCurrentPlaylist();
      }
    } catch {
      await this.openCurrentPlaylist();
    }
  }

  /**
   * Dọn đường dập đứt Modal đang đứng nắp trên mâm (Top Stack).
   */
  async dismiss(): Promise<void> {
    try {
      await this.modalCtrl.dismiss();
    } catch {
      // HACK: Pass lỗi im lặng khi xả Dismiss mà không có Component Modal nào cả
    }
  }
}
