import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface PermissionStatus {
  granted: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  constructor() {}

  /**
   * Kiểm tra và yêu cầu quyền truy cập bộ nhớ.
   * Cần thiết để tải và lưu các file nhạc.
   * @returns {Promise<PermissionStatus>} Trạng thái của quyền.
   */
  async checkStoragePermissions(): Promise<PermissionStatus> {
    if (!Capacitor.isNativePlatform()) {
      return { granted: true, message: 'Nền tảng web - không cần quyền' };
    }

    try {
      // Kiểm tra quyền hiện tại
      const permissions = await Filesystem.checkPermissions();

      if (permissions.publicStorage === 'granted') {
        return { granted: true, message: 'Quyền truy cập bộ nhớ đã được cấp' };
      }

      // Yêu cầu quyền nếu chưa được cấp
      const requestResult = await Filesystem.requestPermissions();

      if (requestResult.publicStorage === 'granted') {
        return { granted: true, message: 'Quyền truy cập bộ nhớ đã được cấp' };
      } else {
        console.warn('⚠️ Quyền truy cập bộ nhớ đã bị từ chối');
        return {
          granted: false,
          message: 'Quyền truy cập bộ nhớ bị từ chối. Vui lòng bật trong cài đặt để tải nhạc.'
        };
      }

    } catch (error) {
      console.error('❌ Lỗi khi kiểm tra quyền truy cập bộ nhớ:', error);
      return {
        granted: false,
        message: 'Lỗi khi kiểm tra quyền truy cập bộ nhớ: ' + error
      };
    }
  }

  /**
   * Kiểm tra và yêu cầu quyền hiển thị thông báo.
   * Dùng để hiển thị tiến trình tải xuống.
   * @returns {Promise<PermissionStatus>} Trạng thái của quyền.
   */
  async checkNotificationPermissions(): Promise<PermissionStatus> {
    if (!Capacitor.isNativePlatform()) {
      return { granted: true, message: 'Nền tảng web - không cần quyền' };
    }

    try {
      // Kiểm tra quyền hiện tại
      const permissions = await LocalNotifications.checkPermissions();

      if (permissions.display === 'granted') {
        return { granted: true, message: 'Quyền thông báo đã được cấp' };
      }

      // Yêu cầu quyền nếu chưa được cấp
      const requestResult = await LocalNotifications.requestPermissions();

      if (requestResult.display === 'granted') {
        return { granted: true, message: 'Quyền thông báo đã được cấp' };
      } else {
        console.warn('⚠️ Quyền thông báo đã bị từ chối');
        return {
          granted: false,
          message: 'Quyền thông báo bị từ chối. Bạn sẽ không nhận được thông báo về tiến trình tải xuống.'
        };
      }

    } catch (error) {
      console.error('❌ Lỗi khi kiểm tra quyền thông báo:', error);
      return {
        granted: false,
        message: 'Lỗi khi kiểm tra quyền thông báo: ' + error
      };
    }
  }

  /**
   * Kiểm tra tất cả các quyền cần thiết cùng một lúc.
   * @returns {Promise<{storage: PermissionStatus, notifications: PermissionStatus}>} Đối tượng chứa trạng thái của các quyền.
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
   * Yêu cầu tất cả các quyền cần thiết.
   * @returns {Promise<boolean>} Trả về `true` nếu các quyền quan trọng được cấp, ngược lại `false`.
   */
  async requestAllPermissions(): Promise<boolean> {
    try {
      const results = await this.checkAllPermissions();

      // Quyền bộ nhớ là bắt buộc, thông báo là tùy chọn
      if (!results.storage.granted) {
        console.error('❌ Quyền truy cập bộ nhớ quan trọng đã bị từ chối');
        return false;
      }

      if (!results.notifications.granted) {
        console.warn('⚠️ Quyền thông báo tùy chọn đã bị từ chối');
        // Vẫn tiếp tục vì quyền này không bắt buộc
      }

      return true;

    } catch (error) {
      console.error('❌ Lỗi khi yêu cầu các quyền:', error);
      return false;
    }
  }

  /**
   * Lấy chuỗi giải thích lý do cần quyền cho người dùng.
   * @returns {{storage: string, notifications: string}} Đối tượng chứa các chuỗi giải thích.
   */
  getPermissionExplanation(): {
    storage: string;
    notifications: string;
  } {
    return {
      storage: 'Quyền truy cập bộ nhớ là cần thiết để tải và lưu các file nhạc vào thiết bị của bạn. Nếu không có quyền này, bạn sẽ không thể tải bài hát để nghe offline.',
      notifications: 'Quyền thông báo cho phép ứng dụng hiển thị tiến trình tải xuống và thông báo khi hoàn tất. Quyền này là tùy chọn nhưng được khuyến nghị để có trải nghiệm tốt hơn.'
    };
  }
}
