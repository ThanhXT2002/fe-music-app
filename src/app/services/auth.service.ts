import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  User,
} from '@angular/fire/auth';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();
  constructor(private auth: Auth) {
    // Listen to auth state changes
    this.auth.onAuthStateChanged((user) => {
      this.userSubject.next(user);
    });

    // Handle redirect result when app loads
    this.handleRedirectResult().subscribe({
      next: (user) => {
        if (user) {
          console.log('Login successful via redirect:', user);
        }
      },
      error: (error) => {
        console.error('Error handling redirect result:', error);
      }
    });
  }
  signInWithGoogle(): Observable<void> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    return from(signInWithRedirect(this.auth, provider));
  }

  // Method to handle redirect result
  handleRedirectResult(): Observable<User | null> {
    return from(getRedirectResult(this.auth)).pipe(
      map((result) => result?.user || null)
    );
  }

  // Alias for compatibility with login page
  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    await signInWithRedirect(this.auth, provider);
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
  }

  // Lấy token với force refresh
  async getIdTokenForceRefresh(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (user) {
      try {
        return await user.getIdToken(true); // force refresh
      } catch (error) {
        console.error('Error getting fresh ID token:', error);
        return null;
      }
    }
    return null;
  }

  // Guest login - just set a flag or create anonymous session
  async loginAsGuest(): Promise<void> {
    // For now, we'll just create a mock guest user
    // In a real app, you might use Firebase anonymous auth
    const guestUser = {
      uid: 'guest-' + Date.now(),
      displayName: 'Guest User',
      email: null,
      photoURL: null,
    } as any;
    this.userSubject.next(guestUser);
  }

  signOut(): Observable<void> {
    return from(signOut(this.auth));
  }

  // Alias for compatibility
  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  getCurrentUser(): User | null {
    return this.userSubject.value;
  }

  // Signal-like property for template binding
  get currentUser() {
    return () => this.getCurrentUser();
  }

  isAuthenticated(): boolean {
    return this.userSubject.value !== null;
  }

  getUserDisplayName(): string {
    const user = this.getCurrentUser();
    return user?.displayName || user?.email || 'User';
  }

  getUserPhotoURL(): string | null {
    const user = this.getCurrentUser();
    return user?.photoURL || null;
  }

  getUserEmail(): string | null {
    const user = this.getCurrentUser();
    return user?.email || null;
  }

  // Method để gửi request có kèm token
async makeAuthenticatedRequest(url: string, options: any = {}): Promise<any> {
  const token = await this.getIdToken();

  if (!token) {
    throw new Error('No authentication token available');
  }

  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };

  return fetch(url, {
    ...options,
    headers
  });
}
}
