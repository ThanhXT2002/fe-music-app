import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { User } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastController } from '@ionic/angular/standalone';

/**
 * Component quản lý thông tin tài khoản người dùng và thực hiện các chức năng đăng nhập/đăng xuất.
 *
 * Chức năng:
 * - Cung cấp giao diện để người dùng ủy quyền Đăng nhập với các Social Provider (Google/Facebook).
 * - Hiển thị Avatar, Địa chỉ Email của user nội bộ khi đã xác thực xong.
 * - Xử lý tính năng đăng xuất tài khoản và xóa token.
 */
@Component({
  selector: 'app-account-panel',
  imports: [CommonModule],
  templateUrl: './account-panel.component.html',
  styleUrls: ['./account-panel.component.scss'],
})
export class AccountPanelComponent implements OnInit {
  // ─────────────────────────────────────────────────────────
  // Dependencies
  // ─────────────────────────────────────────────────────────
  private toastController = inject(ToastController);
  private authService = inject(AuthService);
  private router = inject(Router);

  // ─────────────────────────────────────────────────────────
  // Properties & Signals
  // ─────────────────────────────────────────────────────────
  /** Trạng thái cờ hiển thị tiến trình loading cục bộ khi bấm nút đăng nhập */
  isLoading = signal(false);

  /** Nội dung label gán mặc định cho nút chức năng Đăng nhập Facebook */
  textFB = 'Đăng nhập với Facebook';

  /** Đồng bộ hóa trạng thái chờ của Facebook trực tiếp từ AuthService thông qua Signal */
  isLoadingFb = this.authService.isLoadingFb; 

  /** Lưu trữ thông tin định danh (User Object) của người dùng được Firebase trả về */
  user = signal<User | null>(null);

  /** Tập hợp chuỗi các email nội bộ người dùng dùng để hiển thị trên giao diện */
  email!: string;

  // ─────────────────────────────────────────────────────────
  // Constructor & Lifecycle
  // ─────────────────────────────────────────────────────────
  constructor() {}

  /**
   * Theo dõi và cập nhật trạng thái người dùng liên tục.
   * Đồng thời lọc ra các email từ provider để điền vào property `email`.
   */
  async ngOnInit() {
    this.authService.user$.subscribe((user) => {
      this.user.set(user);
      this.email = user?.providerData?.map((p) => p.email).join(', ') || '';
    });
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────
  /**
   * Lấy URL ảnh đại diện của cá nhân người dùng.
   * 
   * @returns Chuỗi string là URL (Hoặc fallback sang đường dẫn ảnh vô danh nếu không có Photo URL)
   */
  getUserAvatar(): string {
    const user = this.user();
    if (user?.photoURL) {
      return user.photoURL;
    }
    return 'assets/images/avatar-default.webp';
  }

  /**
   * Phương án phòng thủ đính kèm lại hình ảnh thay thế trong trường hợp Photo URL bị hỏng/vô hiệu hóa đường link.
   */
  onImageError(event: any): void {
    event.target.src = 'assets/images/avatar-default.webp';
  }

  // ─────────────────────────────────────────────────────────
  // Authenticate Actions
  // ─────────────────────────────────────────────────────────
  /**
   * Hủy phiên làm việc và đăng xuất người dùng khỏi hệ thống bộ nhớ Auth chung.
   */
  async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Điều hướng người dùng tới đường dẫn `/login` thủ công (để dùng cho màn hình thay thế).
   */
  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  /**
   * Khởi sự logic gửi yêu cầu Authentication tới OAuth provider của dịch vụ Google.
   * Cho phép load quá trình tới khi xác thực kết thúc.
   */
  async loginWithGoogle() {
    try {
      this.isLoading.set(true);
      await this.authService.loginWithGoogle();
      await this.router.navigate(['/settings'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Login error:', error);
      await this.showToast('Đăng nhập Google thất bại', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Khởi sự logic gửi kết quả Authentication tới kênh cung cấp OAuth qua mạng lưới Facebook.
   */
  async onLoginWithFacebook() {
    try {
      await this.authService.loginWithFacebook();
      await this.router.navigate(['/settings'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Login Facebook error:', error);
      await this.showToast('Đăng nhập Facebook thất bại', 'danger');
    } finally {
    }
  }

  // ─────────────────────────────────────────────────────────
  // UI Handlers
  // ─────────────────────────────────────────────────────────
  /**
   * Hiển thị bảng mô tả thông báo Toast nhỏ.
   * 
   * @param message - Thông điệp cần báo cáo lên popup
   * @param color - Màu sắc hiển thị chỉ định
   */
  private async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'top',
      color,
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }
}
