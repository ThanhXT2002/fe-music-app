import { Injectable } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular/standalone';

export interface NotificationOptions {
  message: string;
  duration?: number;
  position?: 'top' | 'middle' | 'bottom';
  color?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'danger' | 'light' | 'medium' | 'dark';
  buttons?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  /**
   * Show a toast notification
   */
  async showToast(options: NotificationOptions): Promise<void> {
    const toast = await this.toastController.create({
      message: options.message,
      duration: options.duration || 3000,
      position: options.position || 'bottom',
      color: options.color || 'primary',
      buttons: options.buttons || [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  /**
   * Show a persistent storage warning with instructions
   */
  async showPersistentStorageWarning(): Promise<void> {
    const alert = await this.alertController.create({
      header: '⚠️ Storage Permission Required',
      message: `
        <p><strong>This app needs permission to store data permanently.</strong></p>
        <p>Without this permission, your music downloads and app data will be lost when you close the browser.</p>
        <br>
        <p><strong>To enable persistent storage:</strong></p>
        <ul>
          <li><strong>Chrome/Edge:</strong> Click the lock icon in the address bar → Site settings → Allow "Store data"</li>
          <li><strong>Firefox:</strong> Click the shield icon → Permissions → Allow "Store data on device"</li>
          <li><strong>Safari:</strong> Enable "Prevent cross-site tracking" in Settings</li>
        </ul>
        <p><small>You can also check "Remember this choice" to avoid seeing this warning again.</small></p>
      `,
      buttons: [
        {
          text: 'Ignore for now',
          role: 'cancel'
        },
        {
          text: 'Got it',
          role: 'confirm'
        }
      ]
    });
    await alert.present();
  }

  /**
   * Show incognito mode warning
   */
  async showIncognitoWarning(): Promise<void> {
    const alert = await this.alertController.create({
      header: '🚨 Incognito Mode Detected',
      message: `
        <p><strong>You're using this app in incognito/private mode.</strong></p>
        <p>All your data (downloads, settings, etc.) will be permanently lost when you close the browser.</p>
        <br>
        <p>For the best experience, please use this app in normal browsing mode.</p>
      `,
      buttons: [
        {
          text: 'Continue anyway',
          role: 'cancel'
        },
        {
          text: 'Understood',
          role: 'confirm'
        }
      ]
    });
    await alert.present();
  }

  /**
   * Show success message when persistence is working
   */
  async showPersistenceSuccess(markerCount: number): Promise<void> {
    await this.showToast({
      message: `✅ Data persistence is working! Found ${markerCount} markers from previous sessions.`,
      color: 'success',
      duration: 4000
    });
  }

  /**
   * Show warning when persistence markers are missing (first run or data cleared)
   */
  async showPersistenceFirstRun(): Promise<void> {
    await this.showToast({
      message: '🆕 First run detected or data was cleared. Testing persistence...',
      color: 'warning',
      duration: 3000
    });
  }
}
