# XTMusic - Ứng dụng Nghe & Tải Nhạc Đa Nền Tảng (PWA, Android, iOS)

![build](https://img.shields.io/badge/build-passing-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)
![angular](https://img.shields.io/badge/Angular-20-dd0031?logo=angular)
![ionic](https://img.shields.io/badge/Ionic-8-3880ff?logo=ionic)

## Giải pháp Cốt Lõi (Core Vision)
XTMusic là một ứng dụng nghe nhạc hiện đại được tối ưu hóa theo mô hình **Offline-First**. Thông qua việc ứng dụng công nghệ PWA (Progressive Web App) và hệ sinh thái Capacitor, XTMusic mang trải nghiệm quản lý thư viện âm nhạc cá nhân liền mạch từ trình duyệt Web đến Native Mobile (Android/iOS) vượt qua rào cản mạng 3G/4G chập chờn. 

Kiến trúc dự án mới nhất đánh dấu sự dịch chuyển mạnh mẽ sang sử dụng **Angular 20 Signals** để xây dựng mô hình Reactive State Management siêu tốc không độ trễ. 

## 🏗️ Kiến trúc Công nghệ (Tech Stack)

*   **Frontend Core**: Angular 20 (Sử dụng 100% Standalone Components & native control logic `@if`, `@for`).
*   **Mobile UI/UX**: Ionic 8 Framework mang đến trải nghiệm cảm ứng, Animation route nguyên bản như iOS.
*   **State Management**: Hệ thống Store phân nhánh độc lập sử dụng API `signal()` và `computed()`. Không phụ thuộc Redux/NgRx nặng nề.
*   **Persistence & Offline (Memory)**: Wrapper `IndexedDBService` qua nền tảng Dexie cho phép lưu trữ vĩnh viễn hàng GB khối dữ liệu File Audio MP3/M4A nén trực tiếp vào ổ cứng trình duyệt/thiết bị di động.
*   **Native Bridge**: Ionic Capacitor 6+ hỗ trợ Media Session API cho phép tương tác Trình phát nhạc kể cả ở màn hình khóa ngoài hệ điều hành.

## 🚀 Tính năng Nổi bật

*   **Offline First - Phát nhạc không cần Mạng**: Tải nhạc dạng file Blob trích xuất từ server, lưu trữ Offline không giới hạn. Tự động kiểm tra file Blob tải sẵn trước khi request mạng.
*   **Download Fallback Chống Chặn**: Hệ thống tải nhạc 2 chiều (Long-polling / Trực tiếp qua Proxy) nhằm vượt rào cản tốc độ và Rate-limit của Youtube, tránh tắc đẽn luồng Stream.
*   **Youtube Trực Tiếp (IFrame)**: Bổ sung module `YtPlayerStore` giải mã luồng video trực tiếp từ YouTube hỗ trợ nghe thử nhanh nhạc chất lượng cao.
*   **Quản Lý Thư Viện Cá Nhân**: Tổ chức Playlists, lịch sử phát nhạc, tự quét nghệ sĩ (Artist), đồng bộ trạng thái Real-time toàn app nhờ kết cấu Library Store.
*   **Nhận diện Web Share**: Trực tiếp nhận Link được "Share" từ ứng dụng YouTube bên ngoài vào XTMusic thông qua Share Target API.

## 📂 Tổ chức Thư mục (Core-First Architecture)

Mọi Business Logic (Nghiệp vụ) đã được tái cấu trúc và quy tụ về phân khu `@core`:

```text
src/app/
 ├── core/               # ♥️ Trái tim của hệ thống
 │   ├── api/            # Tầng HTTP: Giao tiếp REST / Youtube API.
 │   ├── data/           # Tầng DB: LocalStorage, DatabaseServices, IndexedDB.
 │   ├── platform/       # Tầng OS: PWA Update, Theme UI, App Info.
 │   ├── services/       # Domain Logic: Download Manager, Audio HTML5 Engine.
 │   ├── stores/         # Signal State: Player, Library, Playlist (Nguồn dữ liệu thật UI).
 │   ├── ui/             # Tiện ích UI (Toasts, Action Sheets, Modals Controller).
 │   ├── utils/          # Pure functions, Converter.
 │   └── interfaces/     # Typescript Typings & DTOs.
 │
 ├── components/         # Presentation UI thuần tuý (Cards, ProgressBar, Buttons...)
 └── pages/              # Giao diện Routing chính (Player, Playlists, Search, Library...)
```

Hệ thống Path Aliases `@core/*` được cấu hình chặt chẽ giúp loại bỏ sự rối rắm về đường dẫn (Relative Paths Callback). Tối đa hóa khả năng bảo trì.

> **Tiêu chuẩn JSDoc:** XTMusic yêu cầu mọi phương thức hay State phân tán phải được comment diễn giải bằng Tiếng Việt 100% tuân thủ quy tắc Angular 20 Vietnamese Comment.

## ⚙️ Hướng dẫn Cài đặt & Triển khai

### 1. Build & Run Web App

Yêu cầu môi trường: **Node.js v20+**

```bash
git clone https://github.com/ThanhXT2002/fe-music-app.git
cd fe-txt-music
npm install

# Chạy phiên bản Dev
npm start

# Build Production Web/PWA
npm run build:pwa
```

### 2. Triển khai Mobile (Android/iOS) qua Capacitor

```bash
# Build mã nguồn Web trước
npm run build

# Android
npx cap sync android
npx cap open android # Mở Android Studio Compile

# iOS (Máy Mac yêu cầu)
npx cap sync ios
npx cap open ios     # Mở XCode Compile
```

### 3. Cấu hình Môi trường API

Sửa tệp tin môi trường tại `src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  api_url: 'http://localhost:3232', // Trỏ đến Backend Python FastAPI cục bộ
  proxy_url: 'http://localhost:3232/stream',
  // ...
};
```

## 🤝 Đóng góp mã nguồn
Chúng tôi khuyến khích các Pull Request (PR). Trước khi Submit mã:
1. Đảm bảo UI/UX hiển thị tương đối chuẩn xác với Design System có hạn.
2. Code tuân thủ kiến trúc `@core` tách biệt rõ rệt giữa Class Logic và Class Component.
3. Không Push mã Comment tạm hoặc `console.log` hiển nhiên lên nhánh main.

Tác giả: [ThanhXT2002](https://github.com/ThanhXT2002) - XTMusic © 2025
Email liên hệ trao đổi: tranxuanthanhtxt2002@gmail.com
License: **MIT License**.
