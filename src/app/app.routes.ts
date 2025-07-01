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
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage),
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
        path: 'downloads',
        loadComponent: () => import('./pages/downloads/downloads.page').then( m => m.DownloadsPage)
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
  },  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.page').then(m => m.SearchPage),
  },
  {
    path: 'database-test',
    loadComponent: () => import('./pages/database-test/database-test.page').then(m => m.DatabaseTestPage),
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./pages/privacy-policy/privacy-policy.page').then( m => m.PrivacyPolicyPage)
  },
  {
    path: 'terms-of-service',
    loadComponent: () => import('./pages/terms-of-service/terms-of-service.page').then( m => m.TermsOfServicePage)
  }


];
