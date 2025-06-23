import { Injectable } from '@angular/core';
import {
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
} from '@angular/fire/auth';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);

  constructor(private auth: Auth) {
    // Listen to auth state changes
    this.auth.onAuthStateChanged((user) => {
      this.userSubject.next(user);
    });  }

  // Main login method for Firebase Google authentication
  async loginWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    const result = await signInWithPopup(this.auth, provider);
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
    await signOut(this.auth);
  }

  // Signal-like property for template binding
  get currentUser() {
    return () => this.userSubject.value;
  }
}
