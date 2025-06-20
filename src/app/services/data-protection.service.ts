import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class DataProtectionService {

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private platform: Platform
  ) {}

  /**
   * Show user-friendly alert about enabling persistent storage
   */
  async showPersistentStorageGuide(): Promise<boolean> {
    const alert = await this.alertController.create({
      header: '🛡️ Protect Your Music',
      subHeader: 'Enable data protection to prevent music loss',
      message: this.getPersistentStorageInstructions(),
      cssClass: 'data-protection-alert',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Enable Protection',
          cssClass: 'alert-button-confirm',
          handler: () => {
            this.openStorageSettings();
            return true;
          }
        }
      ]
    });

    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'confirm';
  }

  /**
   * Show data loss warning with recovery options
   */
  async showDataLossWarning(previousSongCount: number): Promise<void> {
    const alert = await this.alertController.create({
      header: '⚠️ Data Loss Detected',
      subHeader: `You had ${previousSongCount} downloaded songs`,
      message: `
Your downloaded music was lost due to browser storage cleanup.

This happened because persistent storage permission was denied.

What you can do:
• Re-download your favorite songs
• Enable storage protection (button below)
• Use the mobile app for better reliability
      `,
      cssClass: 'data-loss-alert',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        },
        {
          text: 'Enable Protection',
          cssClass: 'alert-button-confirm',
          handler: () => {
            this.showPersistentStorageGuide();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Show success toast when persistent storage is granted
   */
  async showProtectionEnabledToast(): Promise<void> {
    const toast = await this.toastController.create({
      message: '✅ Data protection enabled! Your music is now safe.',
      duration: 4000,
      color: 'success',
      position: 'bottom',
      icon: 'shield-checkmark-outline'
    });
    await toast.present();
  }

  /**
   * Show warning toast when protection fails
   */
  async showProtectionFailedToast(): Promise<void> {
    const toast = await this.toastController.create({
      message: '⚠️ Could not enable protection. Music may be lost on restart.',
      duration: 5000,
      color: 'warning',
      position: 'bottom',
      icon: 'warning-outline',
      buttons: [
        {
          text: 'Help',
          handler: () => {
            this.showPersistentStorageGuide();
          }
        }
      ]
    });
    await toast.present();
  }

  /**
   * Get platform-specific instructions for enabling persistent storage
   */
  private getPersistentStorageInstructions(): string {
    if (this.platform.is('desktop')) {
      return `
<strong>Desktop Browser Instructions:</strong>

<strong>Chrome/Edge:</strong>
1. Click the lock icon (🔒) in address bar
2. Click "Site settings"
3. Change "Storage" to "Allow"
4. Refresh the page

<strong>Firefox:</strong>
1. Click the shield icon in address bar
2. Turn off "Enhanced Tracking Protection"
3. Or go to Preferences → Privacy & Security

<strong>Safari:</strong>
1. Safari → Preferences → Privacy
2. Uncheck "Prevent cross-site tracking"
      `;
    } else {
      return `
<strong>Mobile Browser Instructions:</strong>

<strong>Chrome Mobile:</strong>
1. Tap the menu (⋮) in address bar
2. Tap "Site settings"
3. Allow "Storage"

<strong>Safari Mobile:</strong>
1. Settings → Safari → Privacy & Security
2. Allow storage for this site

<strong>Better Option:</strong>
Use our native mobile app for guaranteed data persistence!
      `;
    }
  }

  /**
   * Attempt to open browser storage settings
   */
  private openStorageSettings(): void {
    if (this.platform.is('desktop')) {
      // For desktop, we can only show instructions
      console.log('🔗 Opening storage settings instructions...');
      // In a real app, you might open a help page
    } else {
      // For mobile, try to open app settings
      console.log('📱 Redirecting to app settings...');
      // This would need platform-specific implementation
    }
  }
}
