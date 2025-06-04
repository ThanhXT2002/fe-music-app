import { Injectable, signal } from '@angular/core';
import { Album } from '../interfaces/song.interface';

interface AlbumsPageState {
  albums: Album[];
  isDataLoaded: boolean;
  scrollPosition: number;
}

@Injectable({
  providedIn: 'root'
})
export class AlbumsPageStateService {
  private state = signal<AlbumsPageState>({
    albums: [],
    isDataLoaded: false,
    scrollPosition: 0
  });

  // Getters for reactive access
  get albums() {
    return this.state().albums;
  }

  get isDataLoaded() {
    return this.state().isDataLoaded;
  }

  get scrollPosition() {
    return this.state().scrollPosition;
  }

  // State setters
  setAlbums(albums: Album[]) {
    this.state.update(current => ({
      ...current,
      albums: albums,
      isDataLoaded: true
    }));
  }

  setScrollPosition(position: number) {
    this.state.update(current => ({
      ...current,
      scrollPosition: position
    }));
  }

  // Reset state (if needed)
  resetState() {
    this.state.set({
      albums: [],
      isDataLoaded: false,
      scrollPosition: 0
    });
  }

  // Update a specific album
  updateAlbum(albumId: string, updates: Partial<Album>) {
    this.state.update(current => ({
      ...current,
      albums: current.albums.map(album =>
        album.id === albumId ? { ...album, ...updates } : album
      )
    }));
  }
}
