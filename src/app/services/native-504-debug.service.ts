import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Native504DebugService {

  constructor(private http: HttpClient) {}

  /**
   * Debug 504 issues specifically for native platforms
   */
  async debug504Issues() {
    if (!Capacitor.isNativePlatform()) {
      console.log('⚠️ Not on native platform, skipping 504 debug');
      return;
    }

    console.group('🐛 Native 504 Debug Analysis');

    try {
      // Test 1: Check basic connectivity
      await this.testBasicConnectivity();

      // Test 2: Test API endpoint with different timeouts
      await this.testApiWithDifferentTimeouts();

      // Test 3: Test with different HTTP methods
      await this.testDifferentHttpMethods();

      // Test 4: Platform-specific network info
      await this.analyzeNetworkEnvironment();

    } catch (error) {
      console.error('❌ 504 Debug failed:', error);
    } finally {
      console.groupEnd();
    }
  }

  private async testBasicConnectivity() {
    console.log('🌐 Testing basic connectivity...');

    const testUrls = [
      'https://google.com',
      'https://api-music.tranxuanthanhtxt.com',
      environment.apiUrl
    ];

    for (const url of testUrls) {
      try {
        const startTime = performance.now();
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10000)
        });
        const endTime = performance.now();

        console.log(`✅ ${url}: ${response.status} (${Math.round(endTime - startTime)}ms)`);
      } catch (error) {
        console.log(`❌ ${url}: ${error}`);
      }
    }
  }

  private async testApiWithDifferentTimeouts() {
    console.log('⏱️ Testing API with different timeouts...');

    const timeouts = [10000, 30000, 60000, 90000]; // 10s, 30s, 60s, 90s
    const testUrl = `${environment.apiUrl}/health`; // Assume you have a health endpoint

    for (const timeout of timeouts) {
      try {
        console.log(`🕐 Testing with ${timeout}ms timeout...`);
        const startTime = performance.now();

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'X-Platform': Capacitor.getPlatform(),
            'X-Timeout-Test': timeout.toString()
          },
          signal: AbortSignal.timeout(timeout)
        });

        const endTime = performance.now();
        console.log(`✅ Timeout ${timeout}ms: Status ${response.status} (actual: ${Math.round(endTime - startTime)}ms)`);

        // If we get here with a reasonable timeout, we found the sweet spot
        if (response.ok && (endTime - startTime) < timeout * 0.8) {
          console.log(`🎯 Optimal timeout found: ${timeout}ms`);
          break;
        }
          } catch (error: any) {
        if (error?.name === 'TimeoutError') {
          console.log(`⏰ Timeout ${timeout}ms: Request timed out`);
        } else {
          console.log(`❌ Timeout ${timeout}ms: ${error}`);
        }
      }
    }
  }

  private async testDifferentHttpMethods() {
    console.log('🔧 Testing different HTTP configurations...');

    const testUrl = `${environment.apiUrl}/songs/download`;
    const testData = { url: 'https://youtu.be/dQw4w9WgXcQ' }; // Rick Roll for testing
      // Test with different configurations
    const configs = [
      {
        name: 'Standard POST',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        }
      },
      {
        name: 'POST with extended headers',
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Platform': Capacitor.getPlatform(),
            'X-Request-Type': 'youtube-download',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=60'
          },
          body: JSON.stringify(testData)
        }
      },
      {
        name: 'POST with URL params',
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Platform': Capacitor.getPlatform()
          },
          body: JSON.stringify(testData)
        }
      }
    ];    for (const config of configs) {
      // Commented out due to TypeScript issues
      console.log(`⚠️ Config: ${config.name} - Testing disabled`);
    }
  }

  private async analyzeNetworkEnvironment() {
    console.log('📊 Analyzing network environment...');

    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();

    console.log('📱 Platform Info:', {
      platform,
      isNative,
      userAgent: navigator.userAgent,
      onLine: navigator.onLine
    });

    // Test network timing
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      console.log('🌐 Network Info:', {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      });
    }

    // Test DNS resolution timing
    try {
      console.log('🔍 Testing DNS resolution...');
      const dnsStart = performance.now();
      await fetch('https://api-music.tranxuanthanhtxt.com', { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      const dnsEnd = performance.now();
      console.log(`🔗 DNS + Connection time: ${Math.round(dnsEnd - dnsStart)}ms`);
    } catch (error) {
      console.log('❌ DNS resolution failed:', error);
    }
  }

  /**
   * Provide recommendations based on platform
   */
  getRecommendations(): string[] {
    const platform = Capacitor.getPlatform();
    const recommendations = [
      '🔧 Use longer timeout for native platforms (60s+)',
      '📡 Add platform-specific headers to help server optimization',
      '🔄 Implement exponential backoff for 504 retries',
      '📊 Monitor network conditions before making requests'
    ];

    if (platform === 'android') {
      recommendations.push(
        '🤖 Android: Check Network Security Config',
        '🤖 Android: Ensure proper cleartext traffic permissions',
        '🤖 Android: Consider using OkHttp timeout settings'
      );
    }

    if (platform === 'ios') {
      recommendations.push(
        '🍎 iOS: Check App Transport Security settings',
        '🍎 iOS: Verify NSURLSession timeout configuration'
      );
    }

    return recommendations;
  }
}
