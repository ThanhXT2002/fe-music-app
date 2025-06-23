import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { IonContent } from "@ionic/angular/standalone";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonContent, CommonModule],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = false;

  ngOnInit() {
    // Check if user is already logged in
    if (this.authService.currentUser()) {
      this.router.navigate(['/tabs']);
    }
  }
    async loginWithGoogle() {
    try {
      this.isLoading = true;

      // Đăng nhập và đợi cho đến khi dữ liệu người dùng đầy đủ
      const user = await this.authService.loginWithGoogle();

      // Thêm một chút delay để đảm bảo Firebase hoàn tất xử lý
      await new Promise(resolve => setTimeout(resolve, 500));

      // Sau khi đã có dữ liệu đầy đủ, điều hướng đến trang chính
      await this.router.navigate(['/tabs'], {
        replaceUrl: true // Thay thế route hiện tại để ngăn quay lại trang login
      });
    } catch (error) {
      console.error('Login error:', error);
      // You could show a toast or alert here
    } finally {
      this.isLoading = false;
    }
  }
}
