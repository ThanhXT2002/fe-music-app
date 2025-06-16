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
      if (this.platform.is('capacitor')) {
        // Native app
        const result = await Clipboard.read();
        return result.value || '';
      } else {
        // Web - check permissions first
        if (!navigator.clipboard) {
          throw new Error('Clipboard API not available');
        }

        if (!navigator.clipboard.readText) {
          throw new Error('Clipboard read not supported');
        }

        // For web, we need to be more careful with permissions
        try {
          // Try to read clipboard
          return await navigator.clipboard.readText();
        } catch (error) {
          // Handle specific permission errors
          if (error instanceof DOMException) {
            if (error.name === 'NotAllowedError') {
              throw new Error('PERMISSION_DENIED');
            } else if (error.name === 'NotSupportedError') {
              throw new Error('NOT_SUPPORTED');
            }
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('PERMISSION_DENIED') ||
            error.message.includes('permissions') ||
            error.message.includes('denied')) {
          throw new Error('PERMISSION_DENIED');
        } else if (error.message.includes('not supported') ||
                   error.message.includes('not available') ||
                   error.message.includes('NOT_SUPPORTED')) {
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

      // Web - check if API exists first
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        console.warn('Clipboard API not available');
        return false;
      }

      // Try to use permissions API first
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({
            name: 'clipboard-read' as PermissionName
          });

          if (result.state === 'granted') {
            this.hasPermission = true;
            this.lastPermissionCheck = Date.now();
            return true;
          } else if (result.state === 'denied') {
            this.hasPermission = false;
            this.lastPermissionCheck = Date.now();
            return false;
          }
          // If 'prompt', we'll try the actual read below
        } catch (permError) {
          console.warn('Permissions API failed:', permError);
        }
      }

      // Fallback: try actual read to trigger permission prompt
      // This should only be done in response to user action
      return false; // Don't try automatic read as it will fail

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
  /**
   * Smart clipboard read with automatic fallbacks
   */
  async smartRead(): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    method?: 'native' | 'web' | 'user-action-required';
  }> {
    console.log('📋 Attempting smart clipboard read...');

    // For web, clipboard read requires user interaction
    if (!Capacitor.isNativePlatform()) {
      console.log('🌐 Web platform detected - clipboard needs user interaction');
      return {
        success: false,
        error: 'USER_ACTION_REQUIRED',
        method: 'user-action-required'
      };
    }

    // Method 1: Try native read
    try {
      const content = await this.read();
      console.log('✅ Clipboard read successful (native method)');
      return {
        success: true,
        content,
        method: 'native'
      };
    } catch (error) {
      console.warn('⚠️ Native clipboard read failed:', error);

      return {
        success: false,
        error: 'NEEDS_MANUAL_PASTE',
        method: 'user-action-required'
      };
    }
  }

  /**
   * Read clipboard in response to user action (like paste event)
   * This is the preferred method for web platforms
   */
  async readFromUserAction(): Promise<{
    success: boolean;
    content?: string;
    error?: string;
    method?: 'native' | 'web' | 'event';
  }> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Native app
        const result = await Clipboard.read();
        return {
          success: true,
          content: result.value || '',
          method: 'native'
        };
      } else {
        // Web - this should be called from a user interaction event
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          return {
            success: false,
            error: 'NOT_SUPPORTED',
            method: 'web'
          };
        }

        try {
          const content = await navigator.clipboard.readText();
          return {
            success: true,
            content,
            method: 'web'
          };
        } catch (error) {
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            return {
              success: false,
              error: 'PERMISSION_DENIED',
              method: 'web'
            };
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('Failed to read clipboard from user action:', error);
      return {
        success: false,
        error: 'UNKNOWN_ERROR',
        method: 'web'
      };
    }
  }

  /**
   * Validate if clipboard content looks like a YouTube URL
   */
  validateClipboardContent(content: string): {
    isValid: boolean;
    isYouTubeUrl: boolean;
    cleanUrl?: string;
    suggestion?: string;
  } {
    if (!content || content.trim().length === 0) {
      return {
        isValid: false,
        isYouTubeUrl: false,
        suggestion: 'Clipboard is empty. Please copy a YouTube URL first.'
      };
    }

    const trimmed = content.trim();

    // Check if it's a YouTube URL
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
    const match = trimmed.match(youtubeRegex);

    if (match) {
      const videoId = match[1];
      const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

      return {
        isValid: true,
        isYouTubeUrl: true,
        cleanUrl,
        suggestion: 'Valid YouTube URL detected!'
      };
    }

    // Check if it might be a partial or malformed YouTube URL
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      return {
        isValid: false,
        isYouTubeUrl: false,
        suggestion: 'This looks like a YouTube URL but is not in the correct format. Please copy the full video URL.'
      };
    }

    // Check if it's just a video ID
    const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/;
    if (videoIdRegex.test(trimmed)) {
      const cleanUrl = `https://www.youtube.com/watch?v=${trimmed}`;
      return {
        isValid: true,
        isYouTubeUrl: true,
        cleanUrl,
        suggestion: 'Video ID detected and converted to full URL!'
      };
    }

    return {
      isValid: false,
      isYouTubeUrl: false,
      suggestion: 'This doesn\'t look like a YouTube URL. Please copy a YouTube video URL.'
    };
  }

  /**
   * Auto-paste with content validation
   */
  async autoPasteWithValidation(): Promise<{
    success: boolean;
    content?: string;
    cleanUrl?: string;
    error?: string;
    suggestion?: string;
    needsManualPaste?: boolean;
  }> {
    try {
      console.log('🔄 Starting auto-paste with validation...');

      // Try smart read
      const readResult = await this.smartRead();

      if (!readResult.success) {
        if (readResult.error === 'NEEDS_MANUAL_PASTE') {
          return {
            success: false,
            needsManualPaste: true,
            error: 'Manual paste required',
            suggestion: 'Please paste the YouTube URL manually using Ctrl+V (or Cmd+V on Mac)'
          };
        }

        return {
          success: false,
          error: readResult.error || 'Unknown clipboard error',
          suggestion: 'Failed to read clipboard. Please try again or paste manually.'
        };
      }

      // Validate content
      const validation = this.validateClipboardContent(readResult.content!);

      if (validation.isValid && validation.isYouTubeUrl) {
        console.log('✅ Valid YouTube URL found in clipboard');
        return {
          success: true,
          content: readResult.content,
          cleanUrl: validation.cleanUrl,
          suggestion: validation.suggestion
        };
      } else {
        console.log('❌ Invalid clipboard content');
        return {
          success: false,
          content: readResult.content,
          error: 'Invalid content',
          suggestion: validation.suggestion
        };
      }

    } catch (error) {
      console.error('❌ Auto-paste validation failed:', error);
      return {
        success: false,
        error: 'Clipboard operation failed',
        suggestion: 'Please try pasting manually or check your clipboard permissions.'
      };
    }
  }
}
