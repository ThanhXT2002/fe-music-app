import { Injectable } from '@angular/core';
import { NetworkService } from './network.service';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class ProductionDebugService {

  constructor(private networkService: NetworkService) {}

  /**
   * Debug network connectivity issues in production
   */
  async debugNetworkIssues() {
    if (!Capacitor.isNativePlatform()) return;

    console.group('🔍 Production Network Debug');

    try {
      // Check network status
      const networkInfo = await this.networkService.getNetworkInfo();
      console.log('📶 Network Info:', networkInfo);

      // Test API connectivity
      await this.testAPIConnectivity();

      // Check permissions
      await this.checkNetworkPermissions();

    } catch (error) {
      console.error('❌ Debug failed:', error);
    } finally {
      console.groupEnd();
    }
  }

  private async testAPIConnectivity() {
    try {
      console.log('🌐 Testing API connectivity...');

      const testUrl = 'https://api-music.tranxuanthanhtxt.com/api/v1/health';
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      console.log('✅ API Response Status:', response.status);
      console.log('✅ API Response Headers:', response.headers);

    } catch (error) {
      console.error('❌ API Connectivity Test Failed:', error);

      // Additional debug info
      if (error instanceof TypeError) {
        console.log('🔍 Network Error Details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
    }
  }

  private async checkNetworkPermissions() {
    console.log('🔒 Checking network permissions...');

    if (Capacitor.getPlatform() === 'android') {
      // Check if we have internet permission
      console.log('📱 Platform: Android');
      console.log('📋 Network Security Config should be active');
    }
  }

  /**
   * Log network state changes
   */
  startNetworkMonitoring() {
    if (!Capacitor.isNativePlatform()) return;

    this.networkService.isOnline$.subscribe(isOnline => {
      console.log('📶 Network Status Changed:', isOnline ? 'ONLINE' : 'OFFLINE');
    });
  }
}
