import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    loadComponent: () =>
      import('./pages/layout/layout.component').then((m) => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.page').then((m) => m.HomePage),
        data: { title: 'Trang chủ' },
      },
      {
        path: 'list',
        loadComponent: () =>
          import('./pages/list/list.page').then((m) => m.ListPage),
        data: { title: 'Danh sách bài hát' }
      },
      {
        path: 'downloads',
        loadComponent: () =>
          import('./pages/downloads/downloads.page').then(
            (m) => m.DownloadsPage
          ),
          data: { title: 'Tải xuống' }
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.page').then((m) => m.SettingsPage),
        data: { title: 'Cài đặt chung' }
      },
      {
        path: 'playlists',
        loadComponent: () =>
          import('./pages/playlists/playlists.page').then(
            (m) => m.PlaylistsPage
          ),
          data: { title: 'Danh sách phát' }
      },
    ],
  },
  {
    path: 'player',
    loadComponent: () =>
      import('./pages/player/player.page').then((m) => m.PlayerPage),
    data: { title: 'Trình phát nhạc' }
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./pages/search/search.page').then((m) => m.SearchPage),
    data: { title: 'Tìm kiếm bài hát' }
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./pages/privacy-policy/privacy-policy.page').then(
        (m) => m.PrivacyPolicyPage
      ),
      data: { title: 'Chính sách bảo mật' }
  },
  {
    path: 'terms-of-service',
    loadComponent: () =>
      import('./pages/terms-of-service/terms-of-service.page').then(
        (m) => m.TermsOfServicePage
      ),
      data: { title: 'Điều khoản dịch vụ' }
  },
  {
    path: 'edit-playlist/:playlistId',
    loadComponent: () =>
      import('./pages/playlists/edit-playlist/edit-playlist.page').then(
        (m) => m.EditPlaylistPage
      ),
      data: { title: 'Chỉnh sửa danh sách phát' }
  },
  {
    path: 'find-song-with-file',
    loadComponent: () =>
      import(
        './components/find-infor-song-with-file/find-infor-song-with-file.component'
      ).then((m) => m.FindInforSongWithFileComponent),
      data: { title: 'Tìm kiếm bài hát từ file' }
  },
  {
    path: 'yt-player',
    loadComponent: () =>
      import('./pages/yt-player/yt-player.page').then((m) => m.YtPlayerPage),
    data: { title: 'Trình phát nhạc YouTube Music' }
  },
  {
    path: 'pwa-guide',
    loadComponent: () =>
      import('./pages/pwa-guide/pwa-guide.page').then((m) => m.PwaGuidePage),
    data: { title: 'Hướng dẫn cài đặt PWA' }
  },
  {
    path: 'oops-404',
    loadComponent: () =>
      import('./pages/oops-404/oops-404.page').then((m) => m.Oops404Page),
    data: { title: '404 - không tìm thấy trang' }
  },
  // Wildcard route cho 404
  {
    path: '**',
    redirectTo: 'oops-404',
    pathMatch: 'full',
  },
];
