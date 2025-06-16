import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface PermissionStatus {
  granted: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  constructor() {}  /**
   * Check and request storage permissions
   * Directory.Cache trên Android không cần permissions
   */
  async checkStoragePermissions(): Promise<PermissionStatus> {
    if (!Capacitor.isNativePlatform()) {
      return { granted: true, message: 'Web platform - no permissions needed' };
    }

    // Với Directory.Cache trên Android, không cần storage permissions
    if (Capacitor.getPlatform() === 'android') {
      console.log('✅ Using Directory.Cache - no storage permissions needed');
      return { granted: true, message: 'Using cache directory - no permissions needed' };
    }

    // Cho iOS hoặc các platform khác
    try {
      // Check current permissions first
      console.log('🔐 Checking filesystem permissions...');
      const permissions = await Filesystem.checkPermissions();

      console.log('Permission status:', permissions);

      if (permissions.publicStorage === 'granted') {
        console.log('✅ Storage permissions already granted');
        return { granted: true, message: 'Storage permissions granted' };
      }

      // Request permissions if not granted
      console.log('🔐 Requesting storage permissions...');
      const requestResult = await Filesystem.requestPermissions();

      console.log('Permission request result:', requestResult);

      if (requestResult.publicStorage === 'granted') {
        console.log('✅ Storage permissions granted after request');
        return { granted: true, message: 'Storage permissions granted' };
      } else {
        console.log('❌ Storage permissions denied');
        return {
          granted: false,
          message: 'Storage permissions denied. Please enable storage access in app settings to download music.'
        };
      }

    } catch (error) {
      console.error('❌ Error checking storage permissions:', error);
      return {
        granted: false,
        message: `Error checking storage permissions: ${error}`
      };
    }
  }

  /**
   * Check and request notification permissions
   */
  async checkNotificationPermissions(): Promise<PermissionStatus> {
    if (!Capacitor.isNativePlatform()) {
      return { granted: true, message: 'Web platform - no permissions needed' };
    }

    try {
      // Check current permissions
      const permissions = await LocalNotifications.checkPermissions();

      if (permissions.display === 'granted') {
        console.log('✅ Notification permissions already granted');
        return { granted: true, message: 'Notification permissions granted' };
      }

      // Request permissions if not granted
      console.log('🔐 Requesting notification permissions...');
      const requestResult = await LocalNotifications.requestPermissions();

      if (requestResult.display === 'granted') {
        console.log('✅ Notification permissions granted');
        return { granted: true, message: 'Notification permissions granted' };
      } else {
        console.log('⚠️ Notification permissions denied');
        return {
          granted: false,
          message: 'Notification permissions denied. You won\'t receive download progress notifications.'
        };
      }

    } catch (error) {
      console.error('❌ Error checking notification permissions:', error);
      return {
        granted: false,
        message: 'Error checking notification permissions: ' + error
      };
    }
  }

  /**
   * Check all required permissions at once
   */
  async checkAllPermissions(): Promise<{
    storage: PermissionStatus;
    notifications: PermissionStatus;
  }> {
    console.log('🔐 Checking all app permissions...');

    const [storage, notifications] = await Promise.all([
      this.checkStoragePermissions(),
      this.checkNotificationPermissions()
    ]);

    return {
      storage,
      notifications
    };
  }

  /**
   * Request all permissions with user-friendly prompts
   */
  async requestAllPermissions(): Promise<boolean> {
    try {
      console.log('🔐 Requesting all required permissions...');

      const results = await this.checkAllPermissions();

      // Storage is critical, notifications are optional
      if (!results.storage.granted) {
        console.error('❌ Critical storage permissions denied');
        return false;
      }

      if (!results.notifications.granted) {
        console.warn('⚠️ Optional notification permissions denied');
        // Continue anyway, just log the warning
      }

      console.log('✅ All required permissions granted');
      return true;

    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Show user-friendly permission explanation
   */
  getPermissionExplanation(): {
    storage: string;
    notifications: string;
  } {
    return {
      storage: 'Storage permission is required to download and save music files to your device. Without this permission, you won\'t be able to download songs for offline listening.',
      notifications: 'Notification permission allows the app to show download progress and completion notifications. This is optional but recommended for better user experience.'
    };
  }
}
