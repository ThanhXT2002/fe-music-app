import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full',
  },
  {
    path: 'tabs',
    loadComponent: () => import('./pages/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'list',
        pathMatch: 'full',
      },
      {
        path: 'list',
        loadComponent: () => import('./pages/list/list.page').then(m => m.ListPage),
      },
      {
        path: 'albums',
        loadComponent: () => import('./pages/albums/albums.page').then(m => m.AlbumsPage),
      },
      {
        path: 'search',
        loadComponent: () => import('./pages/search/search.page').then(m => m.SearchPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage),
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'player',
    loadComponent: () => import('./pages/player/player.page').then(m => m.PlayerPage),
  },
  {
    path: 'album/:id',
    loadComponent: () => import('./pages/album-detail/album-detail.page').then(m => m.AlbumDetailPage),
  },
  {
    path: 'artist/:name',
    loadComponent: () => import('./pages/artist-detail/artist-detail.page').then(m => m.ArtistDetailPage),
  },
];
