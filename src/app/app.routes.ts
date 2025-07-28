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
      },
      {
        path: 'list',
        loadComponent: () =>
          import('./pages/list/list.page').then((m) => m.ListPage),
      },
      {
        path: 'downloads',
        loadComponent: () =>
          import('./pages/downloads/downloads.page').then(
            (m) => m.DownloadsPage
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: 'playlists',
        loadComponent: () =>
          import('./pages/playlists/playlists.page').then(
            (m) => m.PlaylistsPage
          ),
      },
    ],
  },
  {
    path: 'player',
    loadComponent: () =>
      import('./pages/player/player.page').then((m) => m.PlayerPage),
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./pages/search/search.page').then((m) => m.SearchPage),
  },
  {
    path: 'privacy-policy',
    loadComponent: () =>
      import('./pages/privacy-policy/privacy-policy.page').then(
        (m) => m.PrivacyPolicyPage
      ),
  },
  {
    path: 'terms-of-service',
    loadComponent: () =>
      import('./pages/terms-of-service/terms-of-service.page').then(
        (m) => m.TermsOfServicePage
      ),
  },
  {
    path: 'edit-playlist/:playlistId',
    loadComponent: () =>
      import('./pages/playlists/edit-playlist/edit-playlist.page').then(
        (m) => m.EditPlaylistPage
      ),
  },
  {
    path: 'find-song-with-file',
    loadComponent: () =>
      import(
        './components/find-infor-song-with-file/find-infor-song-with-file.component'
      ).then((m) => m.FindInforSongWithFileComponent),
  },
  {
    path: 'yt-player',
    loadComponent: () =>
      import('./pages/yt-player/yt-player.page').then((m) => m.YtPlayerPage),
  },
  {
    path: 'pwa-guide',
    loadComponent: () =>
      import('./pages/pwa-guide/pwa-guide.page').then((m) => m.PwaGuidePage),
  },
  {
    path: 'oops-404',
    loadComponent: () =>
      import('./pages/oops-404/oops-404.page').then((m) => m.Oops404Page),
  },
  // Wildcard route cho 404
  {
    path: '**',
    redirectTo: 'oops-404',
    pathMatch: 'full',
  },
];
