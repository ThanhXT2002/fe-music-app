import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import {
  checkmarkCircle,
  alertCircle,
  warning,
  informationCircle,
  hourglass,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

/** Cấu hình thông số tạo Toast */
export interface ToastOptions {
  message: string;
  color?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' | 'light' | 'medium' | 'dark';
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
  buttons?: Array<{
    text: string;
    role?: string;
    handler?: () => void;
  }>;
  icon?: string;
}

// ─────────────────────────────────────────────────────────
// Thông báo Dịch vụ nhanh (Snackbar / Toast Alert)
// ─────────────────────────────────────────────────────────

/**
 * ToastService — Quản lý mảng xếp hàng thông báo đẩy tạm thời nổi lên màn hình thiết bị.
 * 
 * TẠI SAO:
 * Khi có các thao tác thành công/thất bại cần bắn cờ lên màn cho mượt, 
 * việc xài Custom Service giúp chặn rác (tự dismiss toast cũ nếu spam bấm nút)
 * và thống nhất kiểu dáng Icon / thời gian tắt chuẩn toàn hệ thống.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  // ─────────────────────────────────────────────────────────
  // STATE & PROPERTIES
  // ─────────────────────────────────────────────────────────

  /** Tham chiếu con trỏ tóm gọn UI HTML Element của Toast hiện tại trên mâm để Dismiss hủy đè trước khi bật mới */
  private currentToast: HTMLIonToastElement | null = null;

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  constructor(private toastController: ToastController) {
    // Inject thủ công bộ Icons Vector Ionic SVG vào App Registry của Ionic
    addIcons({
      'checkmark-circle': checkmarkCircle,
      'alert-circle': alertCircle,
      'warning': warning,
      'information-circle': informationCircle,
      'hourglass': hourglass,
    });
  }

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Khởi phát đẩy Toast ra màn hình (Mode ghi đè an toàn).
   * Luồng dọn dẹp Dismiss tàn tích của Toast cũ (nếu có) trước khi quăng View mới ra. Nhằm ngăn tình trạng "Toast kẹt cứng".
   * 
   * @param options Bộ param tuỳ chỉnh nội dung và tuỳ chọn
   */
  async show(options: ToastOptions): Promise<void> {
    await this.dismiss();
    await this.showSingleToast(options);
  }

  // ─────────────────────────────────────────────────────────
  // Shortcut Methods cho các thể loại Alerts thưòng dùng
  // ─────────────────────────────────────────────────────────

  /** In thông báo Xanh bọc nút Thành Công */
  success(message: string, duration: number = 3000) {
    this.show({
      message,
      color: 'success',
      duration,
      icon: 'checkmark-circle'
    });
  }

  /** In thông báo Đỏ chỉ định sự cố Error Alert */
  error(message: string, duration: number = 3000) {
    this.show({
      message,
      color: 'danger',
      duration,
      icon: 'alert-circle'
    });
  }

  /** In thông báo hộp thoại Warning màu Cam */
  warning(message: string, duration: number = 3000) {
    this.show({
      message,
      color: 'warning',
      duration,
      icon: 'warning'
    });
  }

  /** In hộp thoại xanh lơ của Notification nhẹ bình thường */
  info(message: string, duration: number = 3000) {
    this.show({
      message,
      color: 'primary',
      duration,
      icon: 'information-circle'
    });
  }

  // ─────────────────────────────────────────────────────────
  // Controller Logic
  // ─────────────────────────────────────────────────────────

  /**
   * Cưỡng ép dập màn Toast tắt ngay lập tức.
   */
  async dismiss() {
    if (this.currentToast) {
      try {
        await this.currentToast.dismiss();
        this.currentToast = null;
      } catch (error) {
        console.warn('Lỗi chập khi ép dập Notification Toast cũ:', error);
        this.currentToast = null;
      }
    }
  }

  /**
   * Lớp Private ẩn đằng sau thực thụ kích Activity Controller API của Ionic tạo Toast Component View.
   */
  private async showSingleToast(options: ToastOptions): Promise<void> {
    try {
      // Create new toast
      const toast = await this.toastController.create({
        message: options.message,
        duration: options.duration || 3000,
        color: options.color || 'primary',
        position: options.position || 'top',
        buttons: options.buttons,
        icon: options.icon,
        cssClass: 'custom-toast',
        mode: 'ios' // Cố định Style khung là bo tròn kiểu thẻ iOS cho đẹp
      });

      this.currentToast = toast;

      // Kích hiển thị DOM
      await toast.present();

      // Đứng đợi nghe ngóng sự ngắt chờ Toast kết thúc dòng đời
      await toast.onDidDismiss();

      // Trả lại vùng nhớ trống
      if (this.currentToast === toast) {
        this.currentToast = null;
      }
    } catch (error) {
      console.error('Ngoại lệ khi cố Push Toast:', error);
      this.currentToast = null;
    }
  }

  /**
   * Show thông báo thể hiện luồng Đang phân tích / Waiting Loading (Vĩnh cửu).
   * Không có auto-dismiss, bắt buộc gọi tay Dismiss hoặc gọi Toast màu khác chen đè lên.
   */
  async showLoading(message: string): Promise<void> {
    await this.show({
      message,
      color: 'medium',
      duration: 0, 
      icon: 'hourglass'
    });
  }

  /**
   * Hiển thị loại hộp thoại có kèm phím Tương Tác Cứng Action bên cạnh Text Notify.
   * @param actionHandler Hàm callback kích nổ khi User chịu nhấn vào cái Button.
   */
  async showWithAction(message: string, actionText: string, actionHandler: () => void, color: ToastOptions['color'] = 'primary'): Promise<void> {
    await this.show({
      message,
      color,
      duration: 0, // Không tắt
      buttons: [
        {
          text: actionText,
          handler: actionHandler
        },
        {
          text: 'Đóng',
          role: 'cancel'
        }
      ]
    });
  }
}
