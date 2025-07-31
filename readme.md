

# XTMusic - Ứng dụng nghe nhạc đa nền tảng (PWA, Android, iOS)

![build](https://img.shields.io/badge/build-passing-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)



## Giới thiệu


XTMusic là ứng dụng nghe nhạc hiện đại, hỗ trợ cả web, PWA và mobile native (Android/iOS). Ứng dụng cho phép nghe nhạc online/offline, quản lý playlist, tải nhạc, đồng bộ dữ liệu, giao diện tối ưu cho mobile và desktop.

## Kiến trúc tổng quan

- **Frontend**: Angular + Ionic, chia module rõ ràng (pages, components, services, interfaces, utils, shared).
- **Backend**: API riêng (FastAPI hoặc custom server) phục vụ tìm kiếm, lấy thông tin nhạc, playlist, download.
- **Native**: Build Android/iOS qua Capacitor, tận dụng plugin native (clipboard, filesystem, notifications, background, ...).
- **PWA**: Service Worker, cache thông minh, offline-first, auto-update.

### Luồng hoạt động chính

1. Người dùng tìm kiếm bài hát (qua YouTube API/backend).
2. Chọn bài hát để nghe online hoặc tải về offline.
3. Quản lý playlist, yêu thích, lịch sử, import/export dữ liệu.
4. Dữ liệu lưu local (IndexedDB/SQLite) và đồng bộ khi cần.
5. Có thể cài đặt như app native trên mọi nền tảng.


## Công nghệ sử dụng

- **Angular 19** & **Ionic 8**: Xây dựng UI hiện đại, responsive.
- **Capacitor**: Đóng gói thành app native cho Android/iOS.
- **PWA**: Cài đặt như app, hỗ trợ offline, cache, auto-update.
- **IndexedDB/SQLite**: Lưu trữ dữ liệu local.
- **Service Worker**: Cache tài nguyên, nhạc, API.
- **TailwindCSS**: Tùy biến giao diện.
- **RxJS**: Quản lý trạng thái bất đồng bộ.
- **Vercel**: Triển khai production nhanh chóng.


## Tính năng nổi bật

- Nghe nhạc online từ YouTube, lưu nhạc offline.
- Tìm kiếm bài hát nhanh qua YouTube Music API.
- Quản lý playlist: tạo, sửa, xóa, thêm/xóa bài hát.
- Tải nhạc, thumbnail về thiết bị, quản lý tiến trình tải.
- Phát nhạc nâng cao: shuffle, repeat, next/prev, lời bài hát.
- Đánh dấu, lọc bài hát yêu thích.
- Lưu lịch sử tìm kiếm, phát nhạc.
- Import/Export dữ liệu (playlist, nhạc, audio).
- Cài đặt như app native trên mobile/desktop.
- Giao diện hiện đại, tối ưu cho mobile/PWA.


## Cấu trúc thư mục chính

- `src/app/pages/`: Các trang chính (home, player, search, downloads, playlists, settings, yt-player,...)
- `src/app/services/`: Service quản lý nhạc, download, playlist, database, PWA...
- `src/app/components/`: Component UI tái sử dụng (player, progress bar, playlist...)
- `src/app/interfaces/`: Định nghĩa kiểu dữ liệu (bài hát, playlist, trạng thái phát...)
- `src/app/utils/`: Hàm tiện ích, chuyển đổi dữ liệu.
- `src/app/shared/`: Code dùng chung (route animation...)
- `src/assets/`, `public/`: Ảnh, icon, manifest...
- `ngsw-config.json`, `manifest.webmanifest`: Cấu hình PWA.


## Hướng dẫn cài đặt & sử dụng


### 1. Cài đặt

```bash
git clone https://github.com/ThanhXT2002/fe-music-app.git
cd fe-txt-music
npm install
```


### 2. Chạy ứng dụng web/PWA

```bash
# Chạy dev server
npm run start

# Build PWA production
npm run build:pwa

# Test PWA local (http://localhost:8080)
npm run serve:pwa
```


### 3. Build native Android/iOS

#### Build Android
```bash
npm run build:android
# hoặc
npx ionic cap run android --livereload --external --port=8100
```

#### Build iOS
```bash
npm run build
npx cap sync ios
npx cap open ios
# Mở Xcode để build và chạy trên thiết bị/simulator
```



### 4. Cài đặt như ứng dụng (PWA)

- Truy cập http://localhost:8080, production URL hoặc domain chính:
  - [https://app-music.tranxuanthanhtxt.com](https://app-music.tranxuanthanhtxt.com) để trải nghiệm ứng dụng trực tiếp.
- Chọn "Add to Home Screen" trên mobile hoặc click icon install trên desktop
- Xem hướng dẫn chi tiết tại: [Hướng dẫn cài đặt PWA](https://app-music.tranxuanthanhtxt.com/pwa-guide)


### 5. Cấu hình môi trường

- Sửa file `src/environments/environment.ts` để cấu hình endpoint backend, API key, ...
- Ví dụ:
```ts
export const environment = {
  production: false,
  apiUrl: 'https://your-backend-api',
  // ...
};
```

### 6. Sử dụng các tính năng chính

- Tìm kiếm bài hát: Nhập tên hoặc dán link YouTube vào ô tìm kiếm
- Nghe nhạc: Click vào bài hát để phát, sử dụng player để điều khiển
- Tải nhạc: Nhấn nút download trên từng bài hát hoặc trong trang downloads
- Quản lý playlist: Vào Playlists để tạo, sửa, xóa, thêm bài hát
- Yêu thích: Nhấn icon "heart" để thêm vào danh sách yêu thích
- Import/Export dữ liệu: Vào Settings để backup/restore toàn bộ dữ liệu


## API Backend (tham khảo)

Dự án sử dụng API backend riêng (FastAPI hoặc custom server) để lấy thông tin nhạc, playlist, download. Một số endpoint mẫu:

- `GET /api/search?q=...` — Tìm kiếm bài hát qua YouTube
- `GET /api/song/{id}` — Lấy thông tin chi tiết bài hát
- `POST /api/download` — Yêu cầu tải nhạc về server
- `GET /api/playlist` — Lấy danh sách playlist
- `POST /api/playlist` — Tạo playlist mới

> **Lưu ý:** Cần cấu hình endpoint backend phù hợp trong file môi trường (`src/environments/`).


## Một số service/component chính

- `playlist.service.ts`, `playlist-manager.service.ts`: Quản lý playlist, thao tác thêm/xóa/sửa.
- `yt-player.service.ts`, `player.page.ts`: Phát nhạc, điều khiển player, hỗ trợ YouTube.
- `download.service.ts`: Quản lý tải nhạc, tiến trình, lưu file.
- `pwa.service.ts`, `install.service.ts`: Hỗ trợ cài đặt, thông báo, update PWA.
- `indexeddb.service.ts`, `database.service.ts`: Lưu trữ dữ liệu local.
- `find-infor-song-with-file.component.ts`: Nhận diện bài hát từ file/audio.
- `song-section.component.ts`, `current-playlist.component.ts`: Hiển thị danh sách nhạc, playlist.
- `route-animation.ts`: Hiệu ứng chuyển trang.

## Đóng góp & phát triển

Mọi đóng góp đều được hoan nghênh!

1. Fork repo, tạo branch mới.
2. Commit code, mô tả rõ thay đổi.
3. Tạo Pull Request, mô tả chi tiết tính năng/sửa lỗi.
4. Trao đổi qua Issues nếu cần thảo luận thêm.


## Tải ứng dụng Android (APK)

- [Tải file APK mới nhất tại đây (GitHub Releases)](https://github.com/ThanhXT2002/fe-music-app/releases/tag/version)

---

## Liên hệ & hỗ trợ

- Tác giả: [ThanhXT2002](https://github.com/ThanhXT2002)
- Email: tranxuanthanhtxt2002@gmail.com

## License

MIT License. Xem chi tiết trong file LICENSE.

- **PWA installable**: Cài đặt như app native, offline-first.
- **Download offline-first**: Lưu nhạc, thumbnail, phát offline.
- **Clipboard thông minh**: Tự động nhận link YouTube từ clipboard.
- **Import/Export dữ liệu**: Backup/restore playlist, nhạc, audio.
- **Tối ưu hiệu năng**: Cache thông minh, lazy load, responsive UI.

---
**© 2025 XTMusic - ThanhXT2002**
