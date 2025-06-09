# 🚀 Hướng dẫn Fix Splash Screen cho Ionic + Capacitor + Android

## 📋 Tổng quan

Splash screen là màn hình đầu tiên xuất hiện khi người dùng mở ứng dụng. Đây là hướng dẫn chi tiết để khắc phục vấn đề splash screen không hiển thị trên Android cho dự án Ionic + Capacitor.

## 🔍 Nguyên nhân phổ biến

1. **Xung đột tài nguyên**: Có nhiều file splash cùng tên
2. **Cấu hình sai**: Theme không được áp dụng đúng
3. **Timing issue**: Splash screen bị ẩn quá nhanh
4. **File ảnh lỗi**: Kích thước hoặc format không phù hợp
5. **Native configuration**: AndroidManifest.xml không đúng

## 🛠️ Giải pháp Step-by-Step

### Bước 1: Kiểm tra và chuẩn bị file ảnh

```powershell
# Kiểm tra file splash có tồn tại không
Get-ChildItem "assets\splash.png" | Select-Object Name, Length

# Kiểm tra kích thước và định dạng (nên là PNG, kích thước tối thiểu 2732x2732px)
```

**Yêu cầu ảnh splash:**
- Format: PNG
- Kích thước khuyến nghị: 2732x2732px
- Background: Solid color hoặc transparent
- Logo/Content: Đặt ở giữa, kích thước ~512x512px

### Bước 2: Cấu hình Capacitor

**File: `capacitor.config.ts`**
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.yourapp',
  appName: 'YourApp',
  webDir: 'www',
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,      // Hiển thị 3 giây
      launchAutoHide: false,         // Tắt auto hide để kiểm soát thủ công
      backgroundColor: "#ffffff",    // Màu nền
      androidSplashResourceName: "splash", // Tên resource
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
```

### Bước 3: Tạo Native Splash Screen (Phương pháp 1 - Capacitor Plugin)

**A. Tạo drawable XML:**

**File: `android/app/src/main/res/drawable/splash.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Background color -->
    <item android:drawable="@android:color/white"/>
    
    <!-- Splash image -->
    <item>
        <bitmap
            android:gravity="center"
            android:src="@drawable/splash_screen"/>
    </item>
</layer-list>
```

**B. Copy ảnh splash:**
```powershell
# Copy ảnh splash vào drawable
Copy-Item "assets\splash.png" "android\app\src\main\res\drawable\splash_screen.png"
```

**C. Cấu hình styles.xml:**

**File: `android/app/src/main/res/values/styles.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Base application theme -->
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>
    
    <!-- Splash screen theme -->
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
    </style>
</resources>
```

**D. Cấu hình AndroidManifest.xml:**

**File: `android/app/src/main/AndroidManifest.xml`**
```xml
<?xml version="1.0" encoding="utf-8" ?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <!-- Other activities and providers -->
    </application>
    
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
```

**E. Xử lý splash screen trong app.component.ts:**

**File: `src/app/app.component.ts`**
```typescript
import { Component, OnInit, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true
})
export class AppComponent implements OnInit {
  private platform = inject(Platform);

  async ngOnInit() {
    await this.initializeApp();
  }

  async initializeApp() {
    await this.platform.ready();
    
    if (Capacitor.isNativePlatform()) {
      // Cấu hình status bar
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
      
      // Ẩn splash screen sau khi app đã load xong
      setTimeout(async () => {
        await SplashScreen.hide();
      }, 2000); // Hiển thị 2 giây
    }
  }
}
```

### Bước 4: Tạo Native Splash Activity (Phương pháp 2 - Tốt hơn)

**A. Tạo SplashActivity.java:**

**File: `android/app/src/main/java/com/yourpackage/yourapp/SplashActivity.java`**
```java
package com.yourpackage.yourapp;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import androidx.appcompat.app.AppCompatActivity;

public class SplashActivity extends AppCompatActivity {
    private static final int SPLASH_DISPLAY_LENGTH = 2000; // 2 seconds
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);
        
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                Intent mainIntent = new Intent(SplashActivity.this, MainActivity.class);
                SplashActivity.this.startActivity(mainIntent);
                SplashActivity.this.finish();
                
                // Thêm animation chuyển màn hình
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
            }
        }, SPLASH_DISPLAY_LENGTH);
    }
}
```

**B. Tạo layout cho splash:**

**File: `android/app/src/main/res/layout/activity_splash.xml`**
```xml
<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@android:color/white">

    <ImageView
        android:layout_width="200dp"
        android:layout_height="200dp"
        android:layout_centerInParent="true"
        android:src="@drawable/splash_screen"
        android:scaleType="centerInside"
        android:contentDescription="App Logo" />

</RelativeLayout>
```

**C. Cập nhật AndroidManifest.xml:**

```xml
<?xml version="1.0" encoding="utf-8" ?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        
        <!-- Splash Activity as launcher -->
        <activity
            android:name=".SplashActivity"
            android:theme="@style/AppTheme.NoActionBar"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        
        <!-- Main Activity -->
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBar"
            android:launchMode="singleTask"
            android:exported="false">
        </activity>
        
    </application>
    
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>
```

**D. Đơn giản hóa app.component.ts:**

```typescript
async initializeApp() {
  await this.platform.ready();
  
  if (Capacitor.isNativePlatform()) {
    // Chỉ cấu hình status bar, không cần quản lý splash screen
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#ffffff' });
  }
}
```

## 🔨 Các lệnh Build và Test

### Build và Deploy

```powershell
# 1. Build Ionic app (nếu có thay đổi web code)
ionic build
# hoặc
ng build --configuration production

# 2. Copy web assets sang native project
npx cap copy android

# 3. Sync dependencies (nếu thêm plugin mới)
npx cap sync android

# 4. Build APK debug
cd android
.\gradlew assembleDebug

# 5. Build APK release
.\gradlew assembleRelease

# 6. Quay lại thư mục gốc
cd ..
```

### Test và Deploy

```powershell
# Kiểm tra thiết bị kết nối
adb devices

# Cài đặt APK debug
adb install -r "android\app\build\outputs\apk\debug\app-debug.apk"

# Cài đặt trên thiết bị cụ thể
adb -s [DEVICE_ID] install -r "android\app\build\outputs\apk\debug\app-debug.apk"

# Chạy app trực tiếp (build + deploy + run)
npx cap run android

# Mở Android Studio
npx cap open android
```

### Debug và Logs

```powershell
# Xem logs realtime
adb logcat

# Lọc logs của app
adb logcat | Select-String "YourAppName"

# Xem logs với tag cụ thể
adb logcat -s "SplashScreen"

# Clear logs trước khi test
adb logcat -c
```

### Clean và Reset

```powershell
# Clean build cache
cd android
.\gradlew clean

# Xóa node_modules và reinstall
Remove-Item -Recurse -Force node_modules
npm install

# Reset Capacitor
npx cap sync android --force

# Clean Ionic cache
ionic cache clear
```

## 🐛 Troubleshooting

### Vấn đề 1: Splash screen không hiển thị

**Nguyên nhân:**
- Theme không được áp dụng
- File ảnh bị lỗi
- Cấu hình sai

**Giải pháp:**
1. Kiểm tra AndroidManifest.xml có sử dụng đúng theme
2. Verify file splash_screen.png tồn tại trong drawable
3. Test với drawable XML đơn giản:

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <solid android:color="#FF6B35"/>
</shape>
```

### Vấn đề 2: Splash screen hiển thị nhưng bị lỗi

**Nguyên nhân:**
- Ảnh quá lớn
- Format không hỗ trợ
- Scale type không phù hợp

**Giải pháp:**
```powershell
# Kiểm tra kích thước file
Get-ChildItem "android\app\src\main\res\drawable\splash_screen.png" | Format-List

# Nén ảnh nếu cần (dùng tool online hoặc Photoshop)
# Đảm bảo format PNG và kích thước hợp lý (<1MB)
```

### Vấn đề 3: Xung đột tài nguyên

**Lỗi:** `Resource compilation failed. Duplicate resources`

**Giải pháp:**
```powershell
# Liệt kê tất cả file splash
Get-ChildItem -Recurse "android\app\src\main\res" -Name "*splash*"

# Xóa các file trùng lặp
Remove-Item "android\app\src\main\res\drawable\splash.png" -Force
```

### Vấn đề 4: Build failed

```powershell
# Clean và rebuild
cd android
.\gradlew clean
.\gradlew assembleDebug --info

# Nếu vẫn lỗi, check Java version
java -version

# Kiểm tra Gradle wrapper
.\gradlew --version
```

## 📱 Test Checklist

- [ ] Splash screen hiển thị khi mở app
- [ ] Thời gian hiển thị phù hợp (2-3 giây)
- [ ] Không có flash trắng trước splash
- [ ] Transition mượt mà sang main app
- [ ] Hoạt động trên các kích thước màn hình khác nhau
- [ ] Hoạt động ở cả portrait và landscape
- [ ] Performance tốt (không lag)

## 🎯 Best Practices

1. **Ảnh splash:**
   - Sử dụng vector hoặc ảnh chất lượng cao
   - Tối ưu kích thước file (<500KB)
   - Consistent với branding

2. **Timing:**
   - 2-3 giây là optimal
   - Không quá ngắn (< 1s) hoặc quá dài (> 5s)

3. **Animation:**
   - Sử dụng fade in/out
   - Tránh animation phức tạp

4. **Testing:**
   - Test trên nhiều thiết bị
   - Test với internet chậm/nhanh
   - Test cold start vs warm start

## 📚 Tài liệu tham khảo

- [Capacitor Splash Screen Plugin](https://capacitorjs.com/docs/apis/splash-screen)
- [Android Splash Screen Guide](https://developer.android.com/develop/ui/views/launch/splash-screen)
- [Ionic Native Splash Screen](https://ionicframework.com/docs/native/splash-screen)

## 🔄 Version History

- **v1.0** (2024): Hướng dẫn cơ bản với Capacitor plugin
- **v2.0** (2025): Thêm native SplashActivity approach
- **v2.1** (2025): Cập nhật commands cho PowerShell Windows

---

*Được tạo bởi AI Assistant - Cập nhật lần cuối: Tháng 6, 2025*
