import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { User } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-account-panel',
  imports: [CommonModule],
  templateUrl: './account-panel.component.html',
  styleUrls: ['./account-panel.component.scss'],
})
export class AccountPanelComponent implements OnInit {
  isLoading = signal(false);
  private authService = inject(AuthService);
  private router = inject(Router);
  textFB= 'Đăng nhập với Facebook';

  user = signal<User | null>(null);

  constructor() {}

  ngOnInit() {
    // Subscribe to user changes
    this.authService.user$.subscribe((user) => {
      this.user.set(user);
    });
  }

  // Lấy URL avatar với fallback
  getUserAvatar(): string {
    const user = this.user();
    if (user?.photoURL) {
      return user.photoURL;
    }
    return 'assets/images/avatar-default.webp';
  }

  // Xử lý lỗi khi load ảnh avatar
  onImageError(event: any): void {
    event.target.src = 'assets/images/avatar-default.webp';
  }

  async logout() {
    try {
      await this.authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
  async loginWithGoogle() {
    try {
      this.isLoading.set(true);
      await this.authService.loginWithGoogle();
      await this.router.navigate(['/tabs/settings'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onLoginWithFacebook() {
    try {
      this.isLoading.set(true);
      const fbResult = await this.authService.loginWithFacebook();
      // Nếu trả về object đặc biệt, xử lý flow liên kết
      if (fbResult && typeof fbResult === 'object' && 'error' in fbResult && fbResult.error === 'account-exists-with-different-credential') {
        this.textFB = 'Tài khoản đã đăng nhập bằng Google. Đang chờ liên kết...';
        // Hỏi user xác nhận đăng nhập Google để liên kết
        if (confirm('Tài khoản này đã đăng nhập bằng Google. Bạn có muốn đăng nhập Google để liên kết Facebook không?')) {
          try {
            const googleUser = await this.authService.loginWithGoogle();
            // Sau khi đăng nhập Google thành công, liên kết Facebook
            if (googleUser && 'pendingCred' in fbResult && fbResult.pendingCred) {
              await this.linkFacebookToGoogle(googleUser, fbResult.pendingCred);
              this.textFB = 'Đã liên kết Facebook thành công!';
              await this.router.navigate(['/tabs/settings'], { replaceUrl: true });
              return;
            }
          } catch (linkError) {
            console.error('Lỗi liên kết Facebook:', linkError);
            this.textFB = 'Liên kết Facebook thất bại';
          }
        } else {
          this.textFB = 'Bạn đã huỷ liên kết Facebook';
        }
        setTimeout(() => {
          this.textFB = 'Đăng nhập với Facebook';
        }, 5000);
        return;
      }
      // Nếu không có lỗi đặc biệt, chuyển trang như bình thường
      await this.router.navigate(['/tabs/settings'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Login Facebook error:', error);
      this.textFB = 'Đăng nhập Facebook thất bại';
      setTimeout(() => {
        this.textFB = 'Đăng nhập với Facebook';
      }, 5000);
    } finally {
      this.isLoading.set(false);
    }

  }

  // Hàm liên kết Facebook credential vào tài khoản Google
  private async linkFacebookToGoogle(googleUser: any, pendingCred: any) {
    try {
      await this.authService.linkWithCredential(googleUser, pendingCred);
      await this.authService.showSuccessToastPublic();
    } catch (error) {
      console.error('Lỗi khi link Facebook credential:', error);
      throw error;
    }
  }
}
