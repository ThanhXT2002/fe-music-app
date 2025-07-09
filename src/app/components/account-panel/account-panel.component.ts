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
  private authService = inject(AuthService);
  private router = inject(Router);
  textFB= 'Đăng nhập với Facebook';

  user = signal<User | null>(null);

  constructor() {}

  ngOnInit() {
    // Subscribe to user changes
    this.authService.user$.subscribe((user) => {
      console.log('User updated in settings:', user);
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

  onLoginWithFacebook() {
    const oldText = this.textFB;
    this.textFB = 'Chức Năng chưa Hoạt Động';
    setTimeout(() => {
      this.textFB = oldText;
    }, 5000);
  }
}
