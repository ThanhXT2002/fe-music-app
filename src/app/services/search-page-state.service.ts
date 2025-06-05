import { Injectable, signal } from '@angular/core';
import { SearchResultItem, Song } from '../interfaces/song.interface';

interface SearchPageState {
  searchQuery: string;
  searchResults: SearchResultItem[];
  searchHistory: string[];
  isSearching: boolean;
  scrollPosition: number;
  downloadHistory: Song[];
}

@Injectable({
  providedIn: 'root'
})
export class SearchPageStateService {
  private state = signal<SearchPageState>({
    searchQuery: '',
    searchResults: [],
    searchHistory: [],
    isSearching: false,
    scrollPosition: 0,
    downloadHistory: []
  });

  constructor() {
    this.loadSearchHistory();
  }

  // Getters for reactive access
  get searchQuery() {
    return this.state().searchQuery;
  }

  get searchResults() {
    return this.state().searchResults;
  }

  get searchHistory() {
    return this.state().searchHistory;
  }

  get isSearching() {
    return this.state().isSearching;
  }
  get scrollPosition() {
    return this.state().scrollPosition;
  }

  get downloadHistory() {
    return this.state().downloadHistory;
  }

  // State setters
  setSearchQuery(query: string) {
    this.state.update(current => ({
      ...current,
      searchQuery: query
    }));
  }
  setSearchResults(results: SearchResultItem[]) {
    this.state.update(current => ({
      ...current,
      searchResults: results
    }));
  }

  // Compatible method for old code
  setSearchResult(result: any) {
    this.state.update(current => ({
      ...current,
      searchResults: result ? [result] : []
    }));
  }

  setIsSearching(isSearching: boolean) {
    this.state.update(current => ({
      ...current,
      isSearching
    }));
  }
  setScrollPosition(position: number) {
    this.state.update(current => ({
      ...current,
      scrollPosition: position
    }));
  }

  setDownloadHistory(songs: Song[]) {
    this.state.update(current => ({
      ...current,
      downloadHistory: songs
    }));
  }

  // Add search query to history
  addToSearchHistory(query: string) {
    if (!query.trim()) return;

    this.state.update(current => {
      const history = current.searchHistory.filter(h => h !== query);
      history.unshift(query);

      const limitedHistory = history.slice(0, 20);
      this.saveSearchHistory(limitedHistory);

      return {
        ...current,
        searchHistory: limitedHistory
      };
    });
  }

  clearSearchHistory() {
    this.state.update(current => ({
      ...current,
      searchHistory: []
    }));
    localStorage.removeItem('xtmusic_search_history');
  }

  removeFromHistory(query: string) {
    this.state.update(current => {
      const history = current.searchHistory.filter(h => h !== query);
      this.saveSearchHistory(history);

      return {
        ...current,
        searchHistory: history
      };
    });
  }
  resetState() {
    this.state.update(current => ({
      ...current,
      searchQuery: '',
      searchResults: [],
      isSearching: false,
      scrollPosition: 0
      // downloadHistory is kept intentionally
    }));
  }

  private saveSearchHistory(history: string[]) {
    try {
      localStorage.setItem('xtmusic_search_history', JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }

  private loadSearchHistory() {
    try {
      const saved = localStorage.getItem('xtmusic_search_history');
      if (saved) {
        const history = JSON.parse(saved);
        this.state.update(current => ({
          ...current,
          searchHistory: history
        }));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }
}
