import { Injectable, signal } from '@angular/core';
import {
  Auth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  User,
} from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { ToastController, Platform } from '@ionic/angular/standalone';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();
  private readonly USER_STORAGE_KEY = 'txt_music_user';
  private _isLoading = signal<boolean>(false);

  // Public readonly signals
  public readonly isLoading = this._isLoading.asReadonly();

  constructor(
    private auth: Auth,
    private toastController: ToastController,
    private platform: Platform
  ) {
    this.initializeGoogleAuth();
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
  }  // Main login method for Firebase Google authentication
  async loginWithGoogle(): Promise<User> {
    try {
      this._isLoading.set(true);

      if (this.platform.is('capacitor')) {
        // Mobile platform - use Capacitor Google Auth
        return await this.loginWithGoogleMobile();
      } else {
        // Web platform - use Firebase popup
        return await this.loginWithGoogleWeb();
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }
  private async loginWithGoogleMobile(): Promise<User> {
    // Sử dụng Capacitor Firebase Authentication
    const result = await FirebaseAuthentication.signInWithGoogle();

    if (!result.user) {
      throw new Error('Google sign in failed');
    }

    // User đã được authenticate qua Firebase
    // this.auth.currentUser sẽ tự động cập nhật
    const firebaseUser = this.auth.currentUser;
    if (!firebaseUser) {
      throw new Error('Firebase user not found after authentication');
    }

    // Save user info
    this.saveUserToLocalStorage(firebaseUser);
    this.userSubject.next(firebaseUser);
    await this.showSuccessToast();

    return firebaseUser;
  }

  private async loginWithGoogleWeb(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(this.auth, provider);

    // Save user info
    this.saveUserToLocalStorage(result.user);
    this.userSubject.next(result.user);
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
    return null;
  }  // Main logout method
  async logout(): Promise<void> {
    try {
      this._isLoading.set(true);

      // Sign out from Firebase (sẽ tự động sign out khỏi Google)
      await FirebaseAuthentication.signOut();

      // Xóa thông tin user từ localStorage trước
      localStorage.removeItem(this.USER_STORAGE_KEY);

      // Cập nhật BehaviorSubject ngay lập tức
      this.userSubject.next(null);

      // Thực hiện đăng xuất với Firebase
      await signOut(this.auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      this._isLoading.set(false);
    }
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
  private async initializeGoogleAuth() {
    try {
      // Không cần initialize vì sử dụng google-services.json
      console.log('Firebase Authentication initialized from google-services.json');
    } catch (error) {
      console.error('Error initializing Firebase Auth:', error);
    }
  }
}
