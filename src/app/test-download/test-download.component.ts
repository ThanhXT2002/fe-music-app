import { Component, OnInit } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-test-download',
  template: `
    <div style="padding: 20px;">
      <h2>Simple Download Test</h2>

      <button (click)="testBasicFilesystem()" style="margin: 10px; padding: 10px;">
        Test Basic Filesystem
      </button>

      <button (click)="testSimpleDownload()" style="margin: 10px; padding: 10px;">
        Test Simple Download
      </button>

      <button (click)="testCapacitorInfo()" style="margin: 10px; padding: 10px;">
        Show Capacitor Info
      </button>

      <div style="margin-top: 20px; font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 5px;">
        <h3>Results:</h3>
        <div *ngFor="let log of logs" [style.color]="log.includes('❌') ? 'red' : log.includes('✅') ? 'green' : 'black'">
          {{ log }}
        </div>
      </div>
    </div>
  `,
  standalone: true,
  imports: []
})
export class TestDownloadComponent implements OnInit {
  logs: string[] = [];

  ngOnInit() {
    this.log('🚀 Test component loaded');
    this.log('📱 Platform: ' + Capacitor.getPlatform());
    this.log('🔧 Is Native: ' + Capacitor.isNativePlatform());
  }

  private log(message: string) {
    const timestamp = new Date().toTimeString().split(' ')[0];
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(logMessage);

    // Keep only last 20 logs
    if (this.logs.length > 20) {
      this.logs = this.logs.slice(-20);
    }
  }

  async testCapacitorInfo() {
    try {
      this.log('📊 Testing Capacitor info...');

      const platform = Capacitor.getPlatform();
      const isNative = Capacitor.isNativePlatform();

      this.log(`✅ Platform: ${platform}`);
      this.log(`✅ Is Native: ${isNative}`);

      if (isNative) {
        const directory = platform === 'android' ? Directory.Cache : Directory.Documents;
        this.log(`✅ Target Directory: ${directory}`);
      }

    } catch (error) {
      this.log(`❌ Capacitor info error: ${error}`);
    }
  }

  async testBasicFilesystem() {
    try {
      this.log('📁 Testing basic filesystem...');

      if (!Capacitor.isNativePlatform()) {
        this.log('⚠️ Skipping filesystem test - not native platform');
        return;
      }

      const platform = Capacitor.getPlatform();
      const directory = platform === 'android' ? Directory.Cache : Directory.Documents;

      this.log(`📂 Using directory: ${directory} on ${platform}`);

      // Test 1: Create directory
      try {
        await Filesystem.mkdir({
          path: 'TestDownload',
          directory: directory,
          recursive: true
        });
        this.log('✅ Directory created successfully');
      } catch (error) {
        this.log(`❌ Directory creation failed: ${error}`);
        return;
      }

      // Test 2: Write simple file
      const testContent = 'Hello World - ' + new Date().toISOString();
      try {
        const writeResult = await Filesystem.writeFile({
          path: 'TestDownload/test.txt',
          data: testContent,
          directory: directory,
          encoding: Encoding.UTF8
        });
        this.log(`✅ File written to: ${writeResult.uri}`);
      } catch (error) {
        this.log(`❌ File write failed: ${error}`);
        return;
      }

      // Test 3: Read file back
      try {
        const readResult = await Filesystem.readFile({
          path: 'TestDownload/test.txt',
          directory: directory,
          encoding: Encoding.UTF8
        });
        this.log(`✅ File read back: ${readResult.data}`);
      } catch (error) {
        this.log(`❌ File read failed: ${error}`);
      }

      // Test 4: Get file info
      try {
        const statResult = await Filesystem.stat({
          path: 'TestDownload/test.txt',
          directory: directory
        });
        this.log(`✅ File size: ${statResult.size} bytes`);
      } catch (error) {
        this.log(`❌ File stat failed: ${error}`);
      }

    } catch (error) {
      this.log(`❌ Filesystem test failed: ${error}`);
    }
  }

  async testSimpleDownload() {
    try {
      this.log('⬇️ Testing simple download...');

      if (!Capacitor.isNativePlatform()) {
        this.log('⚠️ Skipping download test - not native platform');
        return;
      }

      // Download a small text file from httpbin
      const testUrl = 'https://httpbin.org/base64/VGVzdCBkb3dubG9hZCBzdWNjZXNzZnVsIQ%3D%3D'; // "Test download successful!" in base64

      this.log(`🌐 Downloading from: ${testUrl}`);

      // Step 1: Fetch the file
      let response: Response;
      try {
        response = await fetch(testUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        this.log(`✅ HTTP request successful: ${response.status}`);
      } catch (error) {
        this.log(`❌ HTTP request failed: ${error}`);
        return;
      }

      // Step 2: Get response data
      let textData: string;
      try {
        textData = await response.text();
        this.log(`✅ Downloaded ${textData.length} characters: "${textData}"`);
      } catch (error) {
        this.log(`❌ Failed to read response: ${error}`);
        return;
      }

      // Step 3: Save to filesystem
      const platform = Capacitor.getPlatform();
      const directory = platform === 'android' ? Directory.Cache : Directory.Documents;

      try {
        // Ensure directory exists
        await Filesystem.mkdir({
          path: 'TestDownload',
          directory: directory,
          recursive: true
        });

        const fileName = 'downloaded_' + Date.now() + '.txt';
        const writeResult = await Filesystem.writeFile({
          path: `TestDownload/${fileName}`,
          data: textData,
          directory: directory,
          encoding: Encoding.UTF8
        });

        this.log(`✅ Downloaded file saved to: ${writeResult.uri}`);

        // Verify the file was saved correctly
        const readBack = await Filesystem.readFile({
          path: `TestDownload/${fileName}`,
          directory: directory,
          encoding: Encoding.UTF8
        });

        if (readBack.data === textData) {
          this.log(`✅ File verification successful!`);
        } else {
          this.log(`❌ File verification failed - content mismatch`);
        }

      } catch (error) {
        this.log(`❌ Failed to save downloaded file: ${error}`);
      }

    } catch (error) {
      this.log(`❌ Download test failed: ${error}`);
    }
  }
}
