import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class CorsTestService {
  private baseUrl = 'http://192.168.1.9:8000'; // Thay bằng IP server của bạn

  constructor(
    private http: HttpClient,
    private platform: Platform
  ) {}

  async testCorsConfiguration(): Promise<void> {
    console.log('🧪 Testing CORS Configuration...');

    const platform = this.platform.is('capacitor') ? 'native' : 'web';
    console.log(`📱 Platform: ${platform}`);

    // Test 1: Simple GET request
    await this.testSimpleGet();

    // Test 2: GET with custom headers
    await this.testGetWithHeaders();

    // Test 3: OPTIONS preflight request
    await this.testPreflightRequest();

    // Test 4: POST request (nếu có endpoint POST)
    await this.testPostRequest();
  }

  private async testSimpleGet(): Promise<void> {
    try {
      console.log('🔍 Test 1: Simple GET request');

      const response = await this.http.get(`${this.baseUrl}/health`, {
        observe: 'response'
      }).toPromise();

      console.log('✅ Simple GET - Success:', response?.status);
      console.log('📤 Response headers:', response?.headers.keys());

    } catch (error: any) {
      console.error('❌ Simple GET - Failed:', error);
      this.analyzeCorsError(error);
    }
  }

  private async testGetWithHeaders(): Promise<void> {
    try {
      console.log('🔍 Test 2: GET with custom headers');

      const headers = new HttpHeaders({
        'X-Platform': this.platform.is('capacitor') ? 'native' : 'web',
        'X-App-Version': '1.0.0',
        'X-Custom-Header': 'test-value'
      });

      const response = await this.http.get(`${this.baseUrl}/health`, {
        headers,
        observe: 'response'
      }).toPromise();

      console.log('✅ GET with headers - Success:', response?.status);

    } catch (error: any) {
      console.error('❌ GET with headers - Failed:', error);
      this.analyzeCorsError(error);
    }
  }

  private async testPreflightRequest(): Promise<void> {
    try {
      console.log('🔍 Test 3: Testing preflight (OPTIONS)');

      // Kiểm tra nếu có CORS preflight headers
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'test-preflight'
      });

      const response = await this.http.post(`${this.baseUrl}/test-endpoint`,
        { test: 'data' },
        { headers, observe: 'response' }
      ).toPromise();

      console.log('✅ Preflight test - Success:', response?.status);

    } catch (error: any) {
      console.error('❌ Preflight test - Failed:', error);
      this.analyzeCorsError(error);
    }
  }

  private async testPostRequest(): Promise<void> {
    try {
      console.log('🔍 Test 4: POST request');

      const response = await this.http.post(`${this.baseUrl}/download`,
        { url: 'test-url' },
        { observe: 'response' }
      ).toPromise();

      console.log('✅ POST request - Success:', response?.status);

    } catch (error: any) {
      console.error('❌ POST request - Failed:', error);
      this.analyzeCorsError(error);
    }
  }

  private analyzeCorsError(error: any): void {
    console.log('🔍 Analyzing CORS error...');

    if (error.status === 0) {
      console.log('❌ Status 0 - Possible CORS block or network issue');
      console.log('💡 Solutions:');
      console.log('   - Check if server is running');
      console.log('   - Check CORS configuration on server');
      console.log('   - Check network connectivity');
    }

    if (error.status === 504) {
      console.log('❌ Status 504 - Gateway timeout');
      console.log('💡 Solutions:');
      console.log('   - Increase server timeout');
      console.log('   - Check server processing time');
      console.log('   - Implement request retry logic');
    }

    if (error.message && error.message.includes('CORS')) {
      console.log('❌ CORS policy error detected');
      console.log('💡 Solutions:');
      console.log('   - Add origin to CORS configuration');
      console.log('   - Check Access-Control-Allow-Origin header');
      console.log('   - Check preflight response');
    }

    // Log thêm thông tin chi tiết
    console.log('📋 Error details:', {
      status: error.status,
      statusText: error.statusText,
      message: error.message,
      error: error.error,
      headers: error.headers?.keys?.() || 'No headers'
    });
  }

  // Method để test connectivity với các origins khác nhau
  async testMultipleOrigins(): Promise<void> {
    const origins = [
      'http://192.168.1.9:8000',
      'http://localhost:8000',
      'http://127.0.0.1:8000'
    ];

    for (const origin of origins) {
      console.log(`🔍 Testing origin: ${origin}`);

      try {
        const response = await this.http.get(`${origin}/health`, {
          observe: 'response'
        }).toPromise();

        console.log(`✅ ${origin} - Success:`, response?.status);

      } catch (error: any) {
        console.error(`❌ ${origin} - Failed:`, error.status);
      }
    }
  }

  // Kiểm tra CORS headers trong response
  async checkCorsHeaders(): Promise<void> {
    try {
      const response = await this.http.get(`${this.baseUrl}/health`, {
        observe: 'response'
      }).toPromise();

      console.log('🔍 Checking CORS headers in response:');

      const corsHeaders = [
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Credentials',
        'Access-Control-Max-Age'
      ];

      corsHeaders.forEach(header => {
        const value = response?.headers.get(header);
        console.log(`📤 ${header}: ${value || 'Not present'}`);
      });

    } catch (error) {
      console.error('❌ Failed to check CORS headers:', error);
    }
  }
}
