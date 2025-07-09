import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import {
  checkmarkCircle,
  alertCircle,
  warning,
  informationCircle,
  hourglass,
} from 'ionicons/icons';
import { addIcons } from 'ionicons';

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

  constructor(private toastController: ToastController) {
    addIcons({
      'checkmark-circle': checkmarkCircle,
      'alert-circle': alertCircle,
      'warning': warning,
      'information-circle': informationCircle,
      'hourglass': hourglass,
    });
  }

  /**
   * Show a toast, always dismissing any current toast and showing the new one immediately
   * @param options Toast configuration
   */
  async show(options: ToastOptions): Promise<void> {
    await this.dismiss();
    await this.showSingleToast(options);
  }

  /**
   * Convenience methods for common toast types
   */
  success(message: string, duration: number = 3000) {
    this.show({
      message,
      color: 'success',
      duration,
      icon: 'checkmark-circle'
    });
  }

  error(message: string, duration: number = 3000) {
    this.show({
      message,
      color: 'danger',
      duration,
      icon: 'alert-circle'
    });
  }

  warning(message: string, duration: number = 3000) {
    this.show({
      message,
      color: 'warning',
      duration,
      icon: 'warning'
    });
  }

  info(message: string, duration: number = 3000) {
    this.show({
      message,
      color: 'primary',
      duration,
      icon: 'information-circle'
    });
  }

  /**
   * Dismiss current toast immediately
   */
  async dismiss() {
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
   * Show a single toast
   */
  private async showSingleToast(options: ToastOptions): Promise<void> {
    try {
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

