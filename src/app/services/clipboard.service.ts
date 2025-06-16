import { Injectable } from '@angular/core';
import { Clipboard } from '@capacitor/clipboard';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class ClipboardService {
  private hasPermission: boolean | null = null;
  private lastPermissionCheck: number = 0;
  private readonly PERMISSION_CACHE_DURATION = 30000; // 30 seconds

  constructor(private platform: Platform) {}

  async read(): Promise<string> {
    try {
      // Check permissions first on native
      if (Capacitor.isNativePlatform()) {
        const hasPermission = await this.checkPermissions();
        if (!hasPermission) {
          throw new Error('Clipboard permissions denied');
        }
      }

      if (this.platform.is('capacitor')) {
        // Native app
        const result = await Clipboard.read();
        return result.value || '';
      } else {
        // Web fallback with better error handling
        if (!navigator.clipboard) {
          throw new Error('Clipboard API not available');
        }

        if (!navigator.clipboard.readText) {
          throw new Error('Clipboard read not supported');
        }

        return await navigator.clipboard.readText();
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('permissions') || error.message.includes('denied')) {
          throw new Error('PERMISSION_DENIED');
        } else if (error.message.includes('not supported') || error.message.includes('not available')) {
          throw new Error('NOT_SUPPORTED');
        }
      }

      throw new Error('UNKNOWN_ERROR');
    }
  }

  async write(text: string): Promise<void> {
    try {
      if (this.platform.is('capacitor')) {
        // Native app
        await Clipboard.write({ string: text });
      } else {
        // Web fallback
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          throw new Error('Clipboard write not supported');
        }
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      console.error('Failed to write to clipboard:', error);
      throw error;
    }
  }

  /**
   * Check clipboard permissions with caching
   */
  async checkPermissions(): Promise<boolean> {
    try {
      // Use cached result if recent
      const now = Date.now();
      if (this.hasPermission !== null &&
          (now - this.lastPermissionCheck) < this.PERMISSION_CACHE_DURATION) {
        return this.hasPermission;
      }

      let hasPermission = false;

      if (Capacitor.isNativePlatform()) {
        // Native app - try to read a small test
        try {
          await Clipboard.read();
          hasPermission = true;
        } catch (error) {
          console.warn('Native clipboard test failed:', error);
          hasPermission = false;
        }
      } else {
        // Web - check permissions API
        if ('permissions' in navigator) {
          try {
            const result = await navigator.permissions.query({
              name: 'clipboard-read' as PermissionName
            });
            hasPermission = result.state === 'granted' || result.state === 'prompt';
          } catch (permError) {
            console.warn('Permissions API failed:', permError);
            hasPermission = false;
          }
        }        // Fallback - check if API exists and try a test call
        if (!hasPermission && navigator.clipboard && navigator.clipboard.readText) {
          try {
            // Just check if the method exists, don't actually call it
            hasPermission = typeof navigator.clipboard.readText === 'function';
          } catch {
            hasPermission = false;
          }
        }
      }      // Cache the result
      this.hasPermission = hasPermission;
      this.lastPermissionCheck = Date.now();

      return hasPermission;

    } catch (error) {
      console.error('Permission check failed:', error);
      this.hasPermission = false;
      this.lastPermissionCheck = Date.now();
      return false;
    }
  }

  /**
   * Request clipboard permissions (mainly for web)
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Native permissions are handled by the OS
        return await this.checkPermissions();
      }

      // Web - try to trigger permission prompt by attempting to read
      if (navigator.clipboard && navigator.clipboard.readText) {
        try {
          await navigator.clipboard.readText();
          this.hasPermission = true;
          this.lastPermissionCheck = Date.now();
          return true;
        } catch (error) {
          console.warn('Failed to trigger clipboard permission:', error);
          this.hasPermission = false;
          this.lastPermissionCheck = Date.now();
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to request clipboard permissions:', error);
      return false;
    }
  }

  /**
   * Clear permission cache
   */
  clearPermissionCache(): void {
    this.hasPermission = null;
    this.lastPermissionCheck = 0;
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error: Error): string {
    if (error.message === 'PERMISSION_DENIED') {
      return 'Clipboard access denied. Please allow clipboard permissions in your browser or device settings.';
    } else if (error.message === 'NOT_SUPPORTED') {
      return 'Clipboard is not supported on this device/browser. Please paste manually.';
    } else {
      return 'Failed to access clipboard. Please try pasting manually.';
    }
  }
}
