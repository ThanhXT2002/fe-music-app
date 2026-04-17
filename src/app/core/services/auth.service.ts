import { Injectable, signal } from '@angular/core';
import {
  Auth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  signOut,
  User,
  FacebookAuthProvider,
  getAuth,
  getRedirectResult
} from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { ToastController, Platform } from '@ionic/angular/standalone';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import {
  FacebookLogin,
  FacebookLoginPlugin,
  FacebookLoginResponse,
} from '@capacitor-community/facebook-login';
import { environment } from 'src/environments/environment';

/**
 * Service quản lý định danh người dùng và xác thực qua mạng xã hội (Firebase Auth).
 *
 * Chức năng:
 * - Hỗ trợ đăng nhập Google và Facebook (cả trên Web và Native App).
 * - Sử dụng BehaviourSubject lưu chuyển tài khoản toàn chu kỳ vòng đời App.
 * - Quản lý LocalStorage dự phòng Cache thông tin Token và User tránh mất Auth khi refresh trang.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // ─────────────────────────────────────────────────────────
  // State & Variables
  // ─────────────────────────────────────────────────────────

  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();
  private readonly USER_STORAGE_KEY = 'txt_music_user';
  
  private _isLoading = signal<boolean>(false);
  private _isLoadingFb = signal<boolean>(false);
  fbLogin!: FacebookLoginPlugin;

  // Public readonly signals để UI Component theo dõi tiến trình API
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isLoadingFb = this._isLoadingFb.asReadonly();

  // ─────────────────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────────────────

  constructor(
    private auth: Auth,
    private toastController: ToastController,
    private platform: Platform
  ) {
    // 1. Phục hồi user từ cache localStorage ngay trên tầng boot tránh nháy giao diện
    this.loadUserFromLocalStorage();

    // 2. Móc nối listener theo dõi sinh mệnh Auth từ Firebase SDK
    this.auth.onAuthStateChanged((user) => {
      if (user) {
        // Cập nhật lại khoá tươi mới
        this.saveUserToLocalStorage(user);
      } else {
        // Clear rác khi đã đăng xuất
        localStorage.removeItem(this.USER_STORAGE_KEY);
      }
      this.userSubject.next(user);
    });

    // 3. Khởi dựng Async Plugin FB Login
    this.initializeFacebookLogin();
  }

  /**
   * Khởi chạy thư viện Facebook Login (Capacitor plugin) lấy dữ liệu môi trường.
   */
  private async initializeFacebookLogin() {
    try {
      await FacebookLogin.initialize({ appId: environment.fbAppId });
    } catch (error) {
      console.error('Error initializing FacebookLogin', error);
    }
  }

  // ─────────────────────────────────────────────────────────
  // LocalStorage Helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Lưu trích xuất những Data nhỏ nhất của User xuống Storage Browser để load offline.
   *
   * @param user - Object Firebase User
   */
  private saveUserToLocalStorage(user: User): void {
    try {
      // Chỉ lưu những thông tin cần thiết và an toàn, cấm serialize toàn object Firebase
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
   * Bốc tách String JSON từ LocalStorage để đắp vào Subject.
   */
  private loadUserFromLocalStorage(): void {
    try {
      const savedUser = localStorage.getItem(this.USER_STORAGE_KEY);
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        // Cập nhật userSubject ngay lập tức để UI hiển thị thông tin user khởi chạy siêu tốc
        this.userSubject.next(parsedUser as User);
      }
    } catch (error) {
      console.error('Error loading user from localStorage', error);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Google Authentication
  // ─────────────────────────────────────────────────────────

  /**
   * Giao diện chính kích phát cơ chế đăng nhập bằng cơ chế định danh Google.
   *
   * Tự động điều tiết phương án Popup Web hoặc Redirect Native tuỳ biến theo Platform.
   */
  async loginWithGoogle(): Promise<User> {
    try {
      this._isLoading.set(true);
      if (Capacitor.isNativePlatform()) {
        return await this.loginWithGoogleMobile();
      } else {
        return await this.loginWithGoogleWeb();
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Xử lý xác thực Native Capacitor gọi Auth iOS/Android ngầm nguyên sinh.
   */
  async loginWithGoogleMobile(): Promise<User> {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();

      if (!result.credential?.idToken) {
        throw new Error('Google sign in failed: Missing ID token');
      }

      // Tạo credential để liên kết bắc cầu Token với kho Firebase Web SDK chéo
      const credential = GoogleAuthProvider.credential(
        result.credential.idToken
      );
      const firebaseResult = await signInWithCredential(this.auth, credential);

      this.saveUserToLocalStorage(firebaseResult.user);
      this.userSubject.next(firebaseResult.user);
      await this.showSuccessToast();

      return firebaseResult.user;
    } catch (error) {
      console.error('Mobile Google login error:', error);
      throw error;
    }
  }

  /**
   * Pop-up Oauth2 Google Web cho trình duyệt.
   */
  private async loginWithGoogleWeb(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    // Bắt buộc Oauth hỏi lại tài khoản nếu đã lưu ở phiên trước
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(this.auth, provider);

    this.saveUserToLocalStorage(result.user);
    this.userSubject.next(result.user);
    await this.showSuccessToast();

    return result.user;
  }

  // ─────────────────────────────────────────────────────────
  // Facebook Authentication
  // ─────────────────────────────────────────────────────────

  /**
   * Kích phát cơ chế đăng nhập bằng tài khoản mạng xã hội Facebook.
   * Cần cấu trúc ngàm chặn Spam hành động vì FB App Switch rất chậm.
   */
  async loginWithFacebook() {
    if (this.isLoadingFb()) return; // Chặn overlapped calls
    this._isLoadingFb.set(true);
    try {
      let user: User;
      let credential: any;
      let result: any;
      if (Capacitor.isNativePlatform()) {
        result = await this.loginWithFacebookMobile();
      } else {
        result = await this.loginWithFacebookWeb();
      }
      console.log('Facebook login result:', result);
      user = result.user;
      credential = result.credential;
      
      this.saveUserToLocalStorage(user);
      this.userSubject.next(user);
      await this.showSuccessToast();
      return user;
    } catch (error: any) {
      // Bẫy lỗi bảo mật khi email FB và Google trùng lấn nhau trong Database Auth Firebase
      if (error.code === 'auth/account-exists-with-different-credential') {
        alert(
          'Tài khoản này đã đăng nhập bằng Google. Vui lòng đăng nhập Google trước, sau đó liên kết Facebook trong phần cài đặt tài khoản.'
        );
      }
      throw error;
    } finally {
      this._isLoadingFb.set(false);
    }
  }

  /** Popup Đăng nhập OAuth2 FB Môi Trường Web */
  loginWithFacebookWeb() {
    const provider = new FacebookAuthProvider();
    provider.addScope('email');
    provider.addScope('public_profile');

    return signInWithPopup(getAuth(), provider);
  }

  /** Gọi cửa sổ Native Meta Graph Login App Điện Thoại */
  async loginWithFacebookMobile() {
    const FACEBOOK_PERMISSIONS = ['email'];
    const result = (await FacebookLogin.login({
      permissions: FACEBOOK_PERMISSIONS,
    })) as FacebookLoginResponse;

    if (result.accessToken) {
      const credential = FacebookAuthProvider.credential(
        result.accessToken.token
      );
      return signInWithCredential(getAuth(), credential);
    } else {
      console.error('Facebook login failed: No access token received');
      throw new Error('Facebook login failed');
    }
  }

  // ─────────────────────────────────────────────────────────
  // User Operations
  // ─────────────────────────────────────────────────────────

  /**
   * Xin refresh mới lại JWT Token của Server Firebase cho phiên liên lạc backend an toàn.
   *
   * @returns Chuỗi Token Session mã hoá
   */
  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (user) {
      try {
        // forceRefresh = true để đảm bảo token là mới nhất, phòng bị hốt Token cũ expired
        return await user.getIdToken(true);
      } catch (error) {
        console.error('Error getting ID token:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Kích phát việc xoá bỏ tài khoản Session, dọn Data Cache và huỷ liên kết Oauth gốc.
   */
  async logout(): Promise<void> {
    try {
      this._isLoading.set(true);

      // Sign out Native Firebase (xoá sạch cả Cache Native Google)
      await FirebaseAuthentication.signOut();

      // Dọn rác
      localStorage.removeItem(this.USER_STORAGE_KEY);
      this.userSubject.next(null);

      // Thực thi ngắt session SDK
      await signOut(this.auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Xử lý hack mẹo luôn ưu tiên lấy tài khoản tĩnh trên Local Cache đầu cuối thay vì đợi Subject rỗng khởi tạo
   * (Đảm bảo Avatar nháy mượt mà trong Guard Route chớp nhoáng).
   */
  get currentUser() {
    return () => {
      if (this.userSubject.value) {
        return this.userSubject.value;
      }

      try {
        const savedUser = localStorage.getItem(this.USER_STORAGE_KEY);
        if (savedUser) {
          return JSON.parse(savedUser) as User;
        }
      } catch (error) {
        console.error('Error reading user from localStorage', error);
      }

      return null;
    };
  }

  // ─────────────────────────────────────────────────────────
  // UI Helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Phun bóng UI Toast khai báo hệ thống Login vào Cửa sổ Ionic.
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
          role: 'cancel',
        },
      ],
    });

    await toast.present();
  }
}
