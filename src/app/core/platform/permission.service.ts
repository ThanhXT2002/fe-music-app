import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface PermissionStatus {
  granted: boolean;
  message?: string;
}

/**
 * PermissionService — Quản lý mảng Giấy Phép Cấp Quyền lõi (Disk Storage & Push Notifications)
 * TẠI SAO:
 * Capacitor Native Plugin yêu cầu chặn cổng xin cấp rèn riêng rẽ thay vì nhảy Popup xin tuỳ hứng loạn xạ. 
 * Service wrap lại gom chung xử lý và thông báo message lỗi Tiếng Việt cho User.
 */
@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  // ─────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────

  constructor() {}

  // ─────────────────────────────────────────────────────────
  // PUBLIC ACTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Kiểm tra và tạo luồng Yêu Cầu Cài Đặt Disk (Disk I/O Write Permission).
   * Vùng nhớ mốc là bắt buộc để tải và lưu mã nhị phân Blob Audio IndexedDB/File Manager.
   */
  async checkStoragePermissions(): Promise<PermissionStatus> {
    // Trên Web Browser tự Sandbox File nên không có khái niệm cấp quyền Folder, nhả về True luôn.
    if (!Capacitor.isNativePlatform()) {
      return { granted: true, message: 'Nền tảng web - không cần xin xuất quyền' };
    }

    try {
      // Check thăm dò
      const permissions = await Filesystem.checkPermissions();

      if (permissions.publicStorage === 'granted') {
        return { granted: true, message: 'Quyền truy nhập bộ nhớ kho chốt đã cấp' };
      }

      // Popup Native yêu cầu cấp
      const requestResult = await Filesystem.requestPermissions();

      if (requestResult.publicStorage === 'granted') {
        return { granted: true, message: 'Quyền truy nhập bộ nhớ mới cấp thành công' };
      } else {
        console.warn('Quyền truy nhập ROM Storage bị cản trở (Ban/Deny)');
        return {
          granted: false,
          message: 'Quyền cấp bộ nhớ ghi Disk bị từ chối. Lùi ra Cài đặt ứng dụng của máy và bật lên lại!'
        };
      }

    } catch (error) {
      console.error('Sụp đổ Exception Quyền Ghi Nhớ I/O Disk:', error);
      return {
        granted: false,
        message: 'Lỗi gãy sập khi gọi Quyền truy xuất bộ nhớ: ' + error
      };
    }
  }

  /**
   * Kiểm tra quyền nhúng Banner Nhắc Nhở cục bộ Notifications.
   * Gắn vào chốt Hook để nổ pop báo tiến độ Download App khi nhúng ngầm dưới nền Background.
   */
  async checkNotificationPermissions(): Promise<PermissionStatus> {
    if (!Capacitor.isNativePlatform()) {
      return { granted: true, message: 'Nền tảng web - Miễn thông báo quyền App' };
    }

    try {
      // Check trước cờ
      const permissions = await LocalNotifications.checkPermissions();

      if (permissions.display === 'granted') {
        return { granted: true, message: 'Quyền báo Notifications đã mở chốt' };
      }

      // Xoè khung cấp Native
      const requestResult = await LocalNotifications.requestPermissions();

      if (requestResult.display === 'granted') {
        return { granted: true, message: 'Quyền khép thông báo đã mở cài đặt.' };
      } else {
        console.warn('Chặn rẽ nhánh Notifications cản lại');
        return {
          granted: false,
          message: 'Thông báo Push Local đã tắt ngúm.'
        };
      }

    } catch (error) {
      console.error('Đứt chốt Pop Quản trị Banner Thồng bào:', error);
      return {
        granted: false,
        message: 'Lỗi gãy Notifications Native Engine: ' + error
      };
    }
  }

  /**
   * Đúc rút gói kiểm tra chéo luồng nhiều Permission cản mốc một lúc.
   */
  async checkAllPermissions(): Promise<{
    storage: PermissionStatus;
    notifications: PermissionStatus;
  }> {
    const [storage, notifications] = await Promise.all([
      this.checkStoragePermissions(),
      this.checkNotificationPermissions()
    ]);

    return {
      storage,
      notifications
    };
  }

  /**
   * Xin tổng kiểm soát tất cả Quyền đập màn chéo Native System.
   * Áp dụng khi Boot Splash load luồng đầu App.
   * LƯU Ý: Rẽ vòng nếu App khước từ Notification (vẫn cho xài), nhưng Storage là bắt buộc True.
   */
  async requestAllPermissions(): Promise<boolean> {
    try {
      const results = await this.checkAllPermissions();

      if (!results.storage.granted) {
        console.error('Thiết lập ổ cứng ROM thất thủ (Từ chối)');
        return false;
      }

      if (!results.notifications.granted) {
        console.warn('Người dùng không cho báo Message');
        // Vẫn tiếp tục Bypass (Ignore Noti)
      }

      return true;

    } catch (error) {
      console.error('Gãy chuỗi khai báo All Permissions Batch:', error);
      return false;
    }
  }

  /**
   * Trả về đoạn Văn mô tả Explainer Prompt cho User hiểu Tại Sao phải bấm OK!.
   */
  getPermissionExplanation(): {
    storage: string;
    notifications: string;
  } {
    return {
      storage: 'Quyền truy nhập ROM File ổ cứng nhằm hỗ trợ việc kết nối Database SQLite/IDB Cục Bộ tải nhạc vĩnh trú Offline vào hệ thống mảng.',
      notifications: 'Hỗ trợ nổ popup Notify chớp nháy lên thanh Status Bar hệ thống báo cáo khi tiến trình FFmpeg ghép dải nhạc hoàn thiện.'
    };
  }
}
