# TXT Music - Progressive Web App

## 🎵 Tính năng PWA

Ứng dụng TXT Music đã được cấu hình như một Progressive Web App (PWA) với các tính năng:

### ✨ Tính năng chính
- **📱 Installable**: Có thể cài đặt như một ứng dụng native trên điện thoại và máy tính
- **🔄 Offline Support**: Hoạt động offline với Service Worker
- **🚀 Fast Loading**: Cache tự động các assets và API responses
- **🔄 Auto Updates**: Tự động cập nhật khi có phiên bản mới
- **📲 App-like Experience**: Giao diện như ứng dụng native

### 🛠️ Development Commands

```bash
# Build và test PWA locally
npm run serve:pwa

# Chỉ test PWA (sau khi đã build)
npm run test:pwa

# Build cho production với PWA
npm run build:pwa
```

### 🧪 Test PWA Features

1. **Build và chạy local server:**
   ```bash
   npm run serve:pwa
   ```

2. **Mở browser tại http://localhost:8080**

3. **Test các tính năng:**
   - **Install Prompt**: Sau 3 giây sẽ hiện prompt cài đặt
   - **Offline**: Tắt internet và reload trang
   - **Service Worker**: Mở DevTools > Application > Service Workers
   - **Cache**: Kiểm tra Cache Storage trong DevTools

### 📱 Cách cài đặt trên thiết bị

#### 📱 Mobile (Android/iOS)
1. Mở website trong Chrome/Safari
2. Chờ install prompt xuất hiện hoặc:
3. Android: Menu > "Add to Home screen"
4. iOS: Share button > "Add to Home Screen"

#### 💻 Desktop (Chrome/Edge)
1. Nhìn thấy icon install trong address bar
2. Click vào icon install
3. Hoặc Menu > "Install TXT Music..."

### 🔧 PWA Configuration Files

- **`ngsw-config.json`**: Cấu hình Service Worker
- **`public/manifest.webmanifest`**: App manifest
- **`src/app/services/pwa.service.ts`**: PWA service
- **`src/app/components/install-prompt/`**: Install prompt component

### 🌐 Deployment

- **Vercel**: Tự động build và deploy với PWA support
- **Production URL**: Sẽ có đầy đủ tính năng PWA khi deploy

### 📊 PWA Audit

Sử dụng Lighthouse trong Chrome DevTools để kiểm tra PWA score:
1. Mở DevTools > Lighthouse
2. Chọn "Progressive Web App"
3. Chạy audit

### 🔍 Debug PWA

1. **Service Worker**:
   - DevTools > Application > Service Workers
   - Kiểm tra status và update

2. **Cache**:
   - DevTools > Application > Cache Storage
   - Xem các files đã cache

3. **Network**:
   - DevTools > Network
   - Filter by "service worker" để xem requests

### 📋 PWA Checklist

- ✅ HTTPS (required for PWA)
- ✅ Service Worker đã đăng ký
- ✅ Web App Manifest
- ✅ Icons đầy đủ kích thước
- ✅ Responsive design
- ✅ Fast loading
- ✅ Offline functionality
- ✅ Install prompt

### 🚀 Performance Tips

- Service Worker cache các assets tự động
- API responses được cache 3 ngày
- Images được cache vĩnh viễn
- Tự động update khi có phiên bản mới

---

# PWA Configuration for TXT Music App

This document outlines the Progressive Web App (PWA) configuration for the TXT Music application.

## ✅ Completed Configuration

### Icons and Visual Assets
- **Source Image**: Generated from `src/assets/icon/icon-app.png`
- **Generated Icons**: Complete set of PWA icons in `public/icons/` and `www/icons/`
  - App icons: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
  - Maskable icons: 192x192, 512x512 
  - Apple touch icon: 180x180
  - Apple splash screens: Complete set for all iOS device sizes
- **Favicon**: Updated with new icon design in `src/assets/icon/favicon.png`

### Service Worker Configuration
- **File**: `ngsw-config.json`
- **Caching Strategies**:
  - **Performance**: Static assets, fonts, images (cache-first)
  - **Freshness**: API endpoints, dynamic content (network-first)
  - **Music Files**: mp3, wav, flac, m4a files (cache-first with 1GB limit)

## ✅ Current Status
- PWA successfully built with custom icons from `icon-app.png`
- Service Worker configuration completed
- Local testing server running on `http://localhost:8081`
- All icon paths correctly configured in manifest and index.html
- Ready for production deployment

## Testing PWA Features

### Local Testing
```bash
# Build and serve PWA locally
npm run build:pwa  # or ng build --configuration production --optimization=false
npm run ngsw-config
npx http-server www -p 8081 -c-1
```

### Browser Testing
1. Open `http://localhost:8081` in Chrome/Edge
2. Check Application tab in DevTools for:
   - Service Worker registration
   - Manifest validation
   - Icon display
3. Test install prompt functionality
4. Test offline capabilities

### Production Testing
Deploy to Vercel/hosting platform with HTTPS to test:
- Install prompt on mobile devices
- Add to Home Screen functionality
- Background sync and push notifications
- Full offline support

## PWA Manifest Features
- **Name**: TXT Music App
- **Short Name**: TXT Music  
- **Theme Color**: #3880ff
- **Background Color**: #ffffff
- **Display**: standalone
- **Categories**: music, entertainment, multimedia
- **Icons**: Complete set with proper maskable support

## Next Steps
1. Deploy to production with HTTPS
2. Test PWA installation on various devices
3. Verify Service Worker caching in production
4. Test offline music playback capabilities

**💡 Tip**: Để test đầy đủ tính năng PWA, hãy deploy lên production (Vercel) vì một số tính năng chỉ hoạt động trên HTTPS.
