import { Injectable, signal } from '@angular/core';
import { ListPageStateService } from './list-page-state.service';
import { PlaylistsPageStateService } from './playlists-page-state.service';
import { SearchPageStateService } from './search-page-state.service';
import { DownloadService } from './download.service';

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  // Current active tab in the main tab navigation
  private activeMainTab = signal<string>('list');

  constructor(
    private listPageState: ListPageStateService,
    private playlistsPageState: PlaylistsPageStateService,
    private searchPageState: SearchPageStateService,
    private downloadService: DownloadService
  ) {}

  // Main tab navigation
  get currentMainTab() {
    return this.activeMainTab();
  }

  setActiveMainTab(tab: string) {
    this.activeMainTab.set(tab);
  }

  // Method to refresh data for all pages (useful after login, data sync, etc.)
  async refreshAllData() {
    // Reset and reload data for all pages
    this.listPageState.resetState();
    this.playlistsPageState.resetState();

    // Don't reset search state and download state as they should persist
    // Comment below line if you want search results to persist between app refreshes
    // this.searchPageState.resetState();
    // this.downloadService.clearAll();
  }

  // Method to clear all user-specific data (for logout)
  async clearUserData() {
    this.listPageState.resetState();
    this.playlistsPageState.resetState();
    this.searchPageState.resetState();
    // Downloads might persist even after logout, depending on business logic
    // this.downloadService.clearAll();
  }

  // Get summary of app state (for debugging)
  getAppStateSummary() {
    return {
      activeMainTab: this.currentMainTab,
      listPage: {
        activeTab: this.listPageState.activeTab,
        isDataLoaded: this.listPageState.isDataLoaded,
        songsCount: this.listPageState.allSongs.length
      },
      playlistsPage: {
        isDataLoaded: this.playlistsPageState.isDataLoaded,
        playlistsCount: this.playlistsPageState.playlists.length
      },      searchPage: {
        hasQuery: !!this.searchPageState.searchQuery,
        hasResults: this.searchPageState.searchResults.length > 0,
        historyCount: this.searchPageState.searchHistory.length,
        downloadHistoryCount: this.searchPageState.downloadHistory.length
      },
      downloads: {
        total: this.downloadService.currentDownloads.length,
        active: this.downloadService.getDownloadsByStatus('downloading').length,
        completed: this.downloadService.getDownloadsByStatus('completed').length
      }
    };
  }
}
