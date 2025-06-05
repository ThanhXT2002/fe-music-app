import { Injectable } from '@angular/core';
import { Clipboard } from '@capacitor/clipboard';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ClipboardService {
  constructor(private platform: Platform) {}

  async read(): Promise<string> {
    try {
      if (this.platform.is('capacitor')) {
        // Native app
        const result = await Clipboard.read();
        return result.value || '';
      } else {
        // Web fallback
        if (navigator.clipboard && navigator.clipboard.readText) {
          return await navigator.clipboard.readText();
        }
        throw new Error('Clipboard not supported');
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      throw error;
    }
  }

  async write(text: string): Promise<void> {
    try {
      if (this.platform.is('capacitor')) {
        // Native app
        await Clipboard.write({ string: text });
      } else {
        // Web fallback
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error('Clipboard write not supported');
        }
      }
    } catch (error) {
      console.error('Failed to write to clipboard:', error);
      throw error;
    }
  }

  // clipboard.service.ts
async checkPermissions(): Promise<boolean> {
  try {
    if (this.platform.is('capacitor')) {
      // Native app - thử đọc để test
      const result = await this.read();
      return result !== null && result !== undefined;
    } else {
      // Web - check permissions API
      if ('permissions' in navigator) {
        const result = await navigator.permissions.query({
          name: 'clipboard-read' as PermissionName
        });
        return result.state === 'granted' || result.state === 'prompt';
      }

      // Fallback - thử đọc trực tiếp
      if ((navigator as any).clipboard && (navigator as any).clipboard.readText) {
        await (navigator as any).clipboard.readText();
        return true;
      }

      return false;
    }
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}
}
