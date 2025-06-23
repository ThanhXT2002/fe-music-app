import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { ToastController } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();
  private readonly USER_STORAGE_KEY = 'txt_music_user';

  constructor(
    private auth: Auth,
    private toastController: ToastController
  ) {
    // Khôi phục user từ localStorage nếu có
    this.loadUserFromLocalStorage();

    // Listen to auth state changes
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        // Nếu có user mới từ Firebase, lưu vào localStorage và cập nhật subject
        this.saveUserToLocalStorage(user);
      } else {
        // Nếu đăng xuất, xóa dữ liệu khỏi localStorage
        localStorage.removeItem(this.USER_STORAGE_KEY);
      }
      this.userSubject.next(user);
    });
  }

  /**
   * Lưu thông tin user vào localStorage
   */
  private saveUserToLocalStorage(user: User): void {
    try {
      // Chỉ lưu những thông tin cần thiết và an toàn
      const userToSave = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };
      localStorage.setItem(this.USER_STORAGE_KEY, JSON.stringify(userToSave));
    } catch (error) {
      console.error('Error saving user to localStorage', error);
    }
  }
  /**
   * Khôi phục thông tin user từ localStorage
   */
  private loadUserFromLocalStorage(): void {
    try {
      const savedUser = localStorage.getItem(this.USER_STORAGE_KEY);
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        // Cập nhật userSubject ngay lập tức để UI hiển thị thông tin user
        // (bao gồm avatar) ngay khi app khởi động
        this.userSubject.next(parsedUser as User);
      }
    } catch (error) {
      console.error('Error loading user from localStorage', error);
    }
  }// Main login method for Firebase Google authentication
  async loginWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    // Luôn hiển thị màn hình chọn tài khoản
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(this.auth, provider);

    // Lưu thông tin user vào localStorage ngay lập tức
    this.saveUserToLocalStorage(result.user);

    // Cập nhật BehaviorSubject ngay lập tức
    this.userSubject.next(result.user);

    // Hiển thị thông báo đăng nhập thành công
    await this.showSuccessToast();

    return result.user;
  }
  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (user) {
      try {
        // forceRefresh = true để đảm bảo token mới nhất
        return await user.getIdToken(true);
      } catch (error) {
        console.error('Error getting ID token:', error);
        return null;
      }
    }
    return null;  }
  // Main logout method
  async logout(): Promise<void> {
    // Xóa thông tin user từ localStorage trước
    localStorage.removeItem(this.USER_STORAGE_KEY);

    // Cập nhật BehaviorSubject ngay lập tức
    this.userSubject.next(null);

    // Thực hiện đăng xuất với Firebase
    await signOut(this.auth);
  }
  /**
   * Xử lý đặc biệt để luôn ưu tiên thông tin từ localStorage trước
   * để tránh tình trạng avatar không hiển thị ngay
   */
  get currentUser() {
    return () => {
      // Nếu đã có thông tin user trong BehaviorSubject, trả về luôn
      if (this.userSubject.value) {
        return this.userSubject.value;
      }

      // Nếu chưa có, thử lấy từ localStorage
      try {
        const savedUser = localStorage.getItem(this.USER_STORAGE_KEY);
        if (savedUser) {
          return JSON.parse(savedUser) as User;
        }
      } catch (error) {
        console.error('Error reading user from localStorage', error);
      }

      // Nếu không có gì, trả về null
      return null;
    };
  }

  /**
   * Hiển thị thông báo đăng nhập thành công
   */
  private async showSuccessToast(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Đăng nhập thành công',
      duration: 3000,
      position: 'top',
      color: 'success',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }
}
