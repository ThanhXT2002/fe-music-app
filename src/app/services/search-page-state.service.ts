import { Injectable, signal } from '@angular/core';
import { SearchResult } from '../interfaces/song.interface';

interface SearchPageState {
  searchQuery: string;
  searchResult: SearchResult | null;
  searchHistory: string[];
  isSearching: boolean;
  scrollPosition: number;
}

@Injectable({
  providedIn: 'root'
})
export class SearchPageStateService {
  private state = signal<SearchPageState>({
    searchQuery: '',
    searchResult: null,
    searchHistory: [],
    isSearching: false,
    scrollPosition: 0
  });

  constructor() {
    // Load search history from localStorage
    this.loadSearchHistory();
  }

  // Getters for reactive access
  get searchQuery() {
    return this.state().searchQuery;
  }

  get searchResult() {
    return this.state().searchResult;
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

  // State setters
  setSearchQuery(query: string) {
    this.state.update(current => ({
      ...current,
      searchQuery: query
    }));
  }

  setSearchResult(result: SearchResult | null) {
    this.state.update(current => ({
      ...current,
      searchResult: result
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

  // Add search query to history
  addToSearchHistory(query: string) {
    if (!query.trim()) return;

    this.state.update(current => {
      const history = current.searchHistory.filter(h => h !== query);
      history.unshift(query);

      // Keep only last 20 searches
      const limitedHistory = history.slice(0, 20);

      // Save to localStorage
      this.saveSearchHistory(limitedHistory);

      return {
        ...current,
        searchHistory: limitedHistory
      };
    });
  }

  // Clear search history
  clearSearchHistory() {
    this.state.update(current => ({
      ...current,
      searchHistory: []
    }));
    localStorage.removeItem('xtmusic_search_history');
  }

  // Remove item from search history
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

  // Reset state
  resetState() {
    this.state.update(current => ({
      ...current,
      searchQuery: '',
      searchResult: null,
      isSearching: false,
      scrollPosition: 0
      // Keep search history
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
