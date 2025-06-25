import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);

  ngOnInit() {
    // Check if user is already logged in
    if (this.authService.currentUser()) {
      this.router.navigate(['/tabs']);
    }
  }  async loginWithGoogle() {
    try {
      this.isLoading.set(true);

      // Đăng nhập với Google qua Firebase
      const user = await this.authService.loginWithGoogle();

      // Điều hướng ngay lập tức đến trang chính
      // Thông tin người dùng đã được lưu vào localStorage và cập nhật vào userSubject
      await this.router.navigate(['/tabs'], {
        replaceUrl: true // Thay thế route hiện tại để ngăn quay lại trang login
      });
    } catch (error) {
      console.error('Login error:', error);
      // You could show a toast or alert here
    } finally {
      this.isLoading.set(false);
    }
  }
}
