# XTMusic - Music Progressive Web App

## 🏗️ Công nghệ sử dụng

- **Angular 19** + **Ionic 8**: UI framework cho web/mobile.
- **Capacitor**: Đóng gói native app (Android/iOS).
- **PWA (Progressive Web App)**: Hỗ trợ cài đặt, offline, cache, auto-update.
- **IndexedDB/SQLite**: Lưu trữ dữ liệu local (web/native).
- **Service Worker**: Cache assets, API, nhạc offline.
- **TailwindCSS**: Tùy biến giao diện.
- **RxJS**: Quản lý trạng thái bất đồng bộ.
- **Vercel**: Triển khai production.

## 🎵 Chức năng chính

- **Nghe nhạc online/offline**: Phát nhạc từ YouTube, lưu nhạc offline.
- **Tìm kiếm bài hát**: Search nhanh qua YouTube Music API.
- **Quản lý playlist**: Tạo, sửa, xóa, đổi tên, thêm/xóa bài hát.
- **Download nhạc**: Tải nhạc và thumbnail về thiết bị, quản lý tiến trình tải.
- **Phát nhạc nâng cao**: Shuffle, repeat, next/prev, hiển thị lời bài hát.
- **Quản lý yêu thích**: Đánh dấu và lọc bài hát yêu thích.
- **Lịch sử tìm kiếm**: Lưu và tìm lại các bài hát đã tìm kiếm.
- **Đồng bộ dữ liệu**: Import/Export toàn bộ dữ liệu (playlist, nhạc, audio).
- **Cài đặt ứng dụng**: Hỗ trợ cài đặt như app native trên mobile/desktop.
- **Hỗ trợ đa nền tảng**: Web, Android, iOS (qua Capacitor).
- **Giao diện hiện đại, responsive**: Tối ưu cho mobile/PWA.

## 🗂️ Cấu trúc thư mục

- `src/app/pages/`: Các trang chính (home, player, search, downloads, playlists, settings, yt-player, ...).
- `src/app/services/`: Service quản lý nhạc, download, database, playlist, PWA, ...
- `src/app/components/`: Component UI (player, progress bar, playlist, ...).
- `src/assets/`, `public/`: Ảnh, icon, manifest, ...
- `ngsw-config.json`, `manifest.webmanifest`: Cấu hình PWA.

## ⚡ Hướng dẫn cài đặt & sử dụng

### 1. Cài đặt

```bash
git clone https://github.com/ThanhXT2002/fe-music-app.git
cd fe-txt-music
npm install
```

### 2. Chạy ứng dụng

```bash
# Chạy dev server
npm run start

# Build PWA production
npm run build:pwa

# Test PWA local (http://localhost:8080)
npm run serve:pwa
```

### 3. Cài đặt như ứng dụng (PWA)

- Truy cập http://localhost:8080 hoặc production URL
- Chọn "Add to Home Screen" trên mobile hoặc click icon install trên desktop

### 4. Sử dụng các tính năng chính

- **Tìm kiếm bài hát**: Nhập tên bài hát hoặc dán link YouTube vào ô tìm kiếm
- **Nghe nhạc**: Click vào bài hát để phát, sử dụng player để điều khiển
- **Tải nhạc**: Nhấn nút download trên từng bài hát hoặc trong trang downloads
- **Quản lý playlist**: Vào mục Playlists để tạo, sửa, xóa, thêm bài hát
- **Yêu thích**: Nhấn icon "heart" để thêm vào danh sách yêu thích
- **Import/Export dữ liệu**: Vào Settings để backup/restore toàn bộ dữ liệu

## 🛠️ API Backend (tham khảo)

Dự án sử dụng API backend riêng (FastAPI hoặc custom server) để lấy thông tin nhạc, playlist, download. Một số endpoint mẫu:

- `GET /api/search?q=...` — Tìm kiếm bài hát qua YouTube
- `GET /api/song/{id}` — Lấy thông tin chi tiết bài hát
- `POST /api/download` — Yêu cầu tải nhạc về server
- `GET /api/playlist` — Lấy danh sách playlist
- `POST /api/playlist` — Tạo playlist mới

> **Lưu ý:** Bạn cần cấu hình endpoint backend phù hợp trong file môi trường (`src/environments/`).

## 🌟 Một số tính năng nổi bật

- **PWA installable**: Cài đặt như app native, offline-first.
- **Download offline-first**: Lưu nhạc, thumbnail, phát offline.
- **Clipboard thông minh**: Tự động nhận link YouTube từ clipboard.
- **Import/Export dữ liệu**: Backup/restore playlist, nhạc, audio.
- **Tối ưu hiệu năng**: Cache thông minh, lazy load, responsive UI.

## 📚 Tài liệu bổ sung

- Xem thêm chi tiết về PWA, offline, database, ... trong các file:
  - `PWA-README.md`
  - `OFFLINE_DOWNLOAD_IMPLEMENTATION.md`
  - `INDEXEDDB_INTEGRATION.md`

---

**© 2025 XTMusic - ThanhXT2002**
