import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

export interface ToastOptions {
  message: string;
  color?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' | 'light' | 'medium' | 'dark';
  duration?: number;
  position?: 'top' | 'bottom' | 'middle';
  buttons?: Array<{
    text: string;
    role?: string;
    handler?: () => void;
  }>;
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private currentToast: HTMLIonToastElement | null = null;
  private toastQueue: ToastOptions[] = [];
  private isProcessing = false;

  constructor(private toastController: ToastController) {}

  /**
   * Show a toast, automatically dismissing any current toast
   * @param options Toast configuration
   */
  async show(options: ToastOptions): Promise<void> {
    // Add to queue
    this.toastQueue.push(options);

    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  /**
   * Convenience methods for common toast types
   */
  async success(message: string, duration: number = 3000): Promise<void> {
    await this.show({
      message,
      color: 'success',
      duration,
      icon: 'checkmark-circle'
    });
  }

  async error(message: string, duration: number = 4000): Promise<void> {
    await this.show({
      message,
      color: 'danger',
      duration,
      icon: 'alert-circle'
    });
  }

  async warning(message: string, duration: number = 3500): Promise<void> {
    await this.show({
      message,
      color: 'warning',
      duration,
      icon: 'warning'
    });
  }

  async info(message: string, duration: number = 3000): Promise<void> {
    await this.show({
      message,
      color: 'primary',
      duration,
      icon: 'information-circle'
    });
  }

  /**
   * Dismiss current toast immediately
   */
  async dismiss(): Promise<void> {
    if (this.currentToast) {
      try {
        await this.currentToast.dismiss();
        this.currentToast = null;
      } catch (error) {
        console.warn('Error dismissing toast:', error);
        this.currentToast = null;
      }
    }
  }

  /**
   * Clear all queued toasts
   */
  clearQueue(): void {
    this.toastQueue = [];
  }

  /**
   * Process the toast queue one by one
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.toastQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.toastQueue.length > 0) {
      const options = this.toastQueue.shift()!;
      await this.showSingleToast(options);
    }

    this.isProcessing = false;
  }

  /**
   * Show a single toast
   */
  private async showSingleToast(options: ToastOptions): Promise<void> {
    try {
      // Dismiss current toast if exists
      await this.dismiss();

      // Create new toast
      const toast = await this.toastController.create({
        message: options.message,
        duration: options.duration || 3000,
        color: options.color || 'primary',
        position: options.position || 'top',
        buttons: options.buttons,
        icon: options.icon,
        cssClass: 'custom-toast',
        mode: 'ios' // Consistent styling
      });

      this.currentToast = toast;

      // Present toast
      await toast.present();

      // Wait for toast to be dismissed (either by duration or user action)
      await toast.onDidDismiss();

      // Clear reference
      if (this.currentToast === toast) {
        this.currentToast = null;
      }

    } catch (error) {
      console.error('Error showing toast:', error);
      this.currentToast = null;
    }
  }

  /**
   * Show loading toast (no auto-dismiss)
   */
  async showLoading(message: string): Promise<void> {
    await this.show({
      message,
      color: 'medium',
      duration: 0, // No auto-dismiss
      icon: 'hourglass'
    });
  }

  /**
   * Show persistent toast with action button
   */
  async showWithAction(message: string, actionText: string, actionHandler: () => void, color: ToastOptions['color'] = 'primary'): Promise<void> {
    await this.show({
      message,
      color,
      duration: 0, // No auto-dismiss
      buttons: [
        {
          text: actionText,
          handler: actionHandler
        },
        {
          text: 'Đóng',
          role: 'cancel'
        }
      ]
    });
  }
}
