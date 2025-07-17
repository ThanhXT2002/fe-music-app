import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { User } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ToastController } from '@ionic/angular/standalone';

@Component({
  selector: 'app-account-panel',
  imports: [CommonModule],
  templateUrl: './account-panel.component.html',
  styleUrls: ['./account-panel.component.scss'],
})
export class AccountPanelComponent implements OnInit {
  private toastController = inject(ToastController);
  isLoading = signal(false);
  private authService = inject(AuthService);
  private router = inject(Router);
  textFB= 'Đăng nhập với Facebook';

  user = signal<User | null>(null);
  email!: string;

  constructor() {}

  ngOnInit() {
    // Subscribe to user changes
    this.authService.user$.subscribe((user) => {
      this.user.set(user);
      console.log('User updated in AccountPanelComponent:', user?.providerData);
      console.log('User emial:', user?.providerData?.map(p => p.email).join(', '));
      this.email = user?.providerData?.map(p => p.email).join(', ') || '';
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
      await this.showToast('Đăng nhập Google thất bại', 'danger');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onLoginWithFacebook() {
    try {
      await this.authService.loginWithFacebook();
      await this.router.navigate(['/tabs/settings'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Login Facebook error:', error);
      await this.showToast('Đăng nhập Facebook thất bại', 'danger');
    } finally {
     
    }

  }

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
