import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ModalGestureControlService {
  // Signal to track if modal gestures should be disabled
  private _gesturesDisabled = signal<boolean>(false);

  // Read-only accessor
  gesturesDisabled = this._gesturesDisabled.asReadonly();

  // Methods to control gesture state
  disableGestures() {
    this._gesturesDisabled.set(true);
  }

  enableGestures() {
    this._gesturesDisabled.set(false);
  }

  // Method for modal to check if gestures should be allowed
  canStartGesture(): boolean {
    const canStart = !this._gesturesDisabled();
    return canStart;
  }
}
