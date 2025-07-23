import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  // Use Angular signal for loading state
  private readonly _loading = signal<boolean>(false);


  /** Show loading indicator */
  show() {
    this._loading.set(true);
  }


  /** Hide loading indicator */
  hide() {
    this._loading.set(false);
  }


  /** Toggle loading indicator */
  toggle() {
    this._loading.set(!this._loading());
  }


  /** Get loading state as signal (for template or computed) */
  loading() {
    return this._loading();
  }

  /** Get current loading state (imperative) */
  isLoading(): boolean {
    return this._loading();
  }
}
