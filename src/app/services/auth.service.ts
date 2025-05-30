import { Injectable } from '@angular/core';
import { Auth, signInWithPopup, GoogleAuthProvider, signOut, User } from '@angular/fire/auth';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  public user$ = this.userSubject.asObservable();

  constructor(private auth: Auth) {
    // Listen to auth state changes
    this.auth.onAuthStateChanged(user => {
      this.userSubject.next(user);
    });
  }
  signInWithGoogle(): Observable<User> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    return from(signInWithPopup(this.auth, provider)).pipe(
      map(result => result.user)
    );
  }
  // Alias for compatibility with login page
  async loginWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    const result = await signInWithPopup(this.auth, provider);
    return result.user;
  }

  // Guest login - just set a flag or create anonymous session
  async loginAsGuest(): Promise<void> {
    // For now, we'll just create a mock guest user
    // In a real app, you might use Firebase anonymous auth
    const guestUser = {
      uid: 'guest-' + Date.now(),
      displayName: 'Guest User',
      email: null,
      photoURL: null
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
}
