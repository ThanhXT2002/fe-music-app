import { Injectable, signal, computed } from '@angular/core';
import { Song } from '../interfaces/song.interface';

interface ListPageState {
  activeTab: string;
  allSongs: Song[];
  recentSongs: Song[];
  favoriteSongs: Song[];
  artists: any[];
  isDataLoaded: boolean;
  scrollPosition: number;
}

@Injectable({
  providedIn: 'root'
})
export class ListPageStateService {
  private state = signal<ListPageState>({
    activeTab: 'all',
    allSongs: [],
    recentSongs: [],
    favoriteSongs: [],
    artists: [],
    isDataLoaded: false,
    scrollPosition: 0
  });

  // Getters for reactive access
  get activeTab() {
    return this.state().activeTab;
  }

  get allSongs() {
    return this.state().allSongs;
  }

  get recentSongs() {
    return this.state().recentSongs;
  }

  get favoriteSongs() {
    return this.state().favoriteSongs;
  }

  get artists() {
    return this.state().artists;
  }

  get isDataLoaded() {
    return this.state().isDataLoaded;
  }

  get scrollPosition() {
    return this.state().scrollPosition;
  }

  // Computed signals for reactive access
  allSongsSignal = computed(() => this.state().allSongs);
  recentSongsSignal = computed(() => this.state().recentSongs);
  favoriteSongsSignal = computed(() => this.state().favoriteSongs);
  artistsSignal = computed(() => this.state().artists);
  isDataLoadedSignal = computed(() => this.state().isDataLoaded);

  // State setters
  setActiveTab(tab: string) {
    this.state.update(current => ({
      ...current,
      activeTab: tab
    }));
  }

  setAllSongs(songs: Song[]) {
    this.state.update(current => ({
      ...current,
      allSongs: songs
    }));
  }

  setRecentSongs(songs: Song[]) {
    this.state.update(current => ({
      ...current,
      recentSongs: songs
    }));
  }

  setFavoriteSongs(songs: Song[]) {
    this.state.update(current => ({
      ...current,
      favoriteSongs: songs
    }));
  }

  setArtists(artists: any[]) {
    this.state.update(current => ({
      ...current,
      artists: artists
    }));
  }

  setDataLoaded(loaded: boolean) {
    this.state.update(current => ({
      ...current,
      isDataLoaded: loaded
    }));
  }

  setScrollPosition(position: number) {
    this.state.update(current => ({
      ...current,
      scrollPosition: position
    }));
  }

  // Update all data at once
  updateAllData(data: Partial<Omit<ListPageState, 'activeTab' | 'scrollPosition'>>) {
    this.state.update(current => ({
      ...current,
      ...data,
      isDataLoaded: true
    }));
  }

  // Reset state (if needed)
  resetState() {
    this.state.set({
      activeTab: 'all',
      allSongs: [],
      recentSongs: [],
      favoriteSongs: [],
      artists: [],
      isDataLoaded: false,
      scrollPosition: 0
    });
  }

  // Update a specific song (for favorite toggle, etc.)
  updateSong(songId: string, updates: Partial<Song>) {
    this.state.update(current => ({
      ...current,
      allSongs: current.allSongs.map(song =>
        song.id === songId ? { ...song, ...updates } : song
      ),
      recentSongs: current.recentSongs.map(song =>
        song.id === songId ? { ...song, ...updates } : song
      ),
      favoriteSongs: current.favoriteSongs.map(song =>
        song.id === songId ? { ...song, ...updates } : song
      )
    }));
  }

  // Remove song from favorites list
  removeSongFromFavorites(songId: string) {
    this.state.update(current => ({
      ...current,
      favoriteSongs: current.favoriteSongs.filter(song => song.id !== songId)
    }));
  }
}
