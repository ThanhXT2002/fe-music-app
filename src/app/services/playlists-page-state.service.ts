import { Injectable, signal } from '@angular/core';
import { Album } from '../interfaces/song.interface';

// Interface cho trạng thái trang playlists
interface PlaylistsPageState {
  playlists: Album[]; // Album objects representing artist playlists
  isDataLoaded: boolean;
  scrollPosition: number;
}

@Injectable({
  providedIn: 'root'
})
export class PlaylistsPageStateService {
  // State signal chứa trạng thái trang playlists
  private state = signal<PlaylistsPageState>({
    playlists: [],
    isDataLoaded: false,
    scrollPosition: 0
  });

  // Getters để truy cập reactive state
  get playlists() {
    return this.state().playlists;
  }

  get isDataLoaded() {
    return this.state().isDataLoaded;
  }

  get scrollPosition() {
    return this.state().scrollPosition;
  }

  // Setters để cập nhật state
  setPlaylists(playlists: Album[]) {
    this.state.update(current => ({
      ...current,
      playlists: [...playlists], // Tạo array mới để đảm bảo signal detect change
      isDataLoaded: true
    }));
    console.log('State updated with playlists:', playlists.length);
  }

  setScrollPosition(position: number) {
    this.state.update(current => ({
      ...current,
      scrollPosition: position
    }));
  }

  // Reset state (nếu cần)
  resetState() {
    this.state.set({
      playlists: [],
      isDataLoaded: false,
      scrollPosition: 0
    });
  }

  // Cập nhật một playlist cụ thể
  updatePlaylist(playlistId: string, updates: Partial<Album>) {
    this.state.update(current => ({
      ...current,
      playlists: current.playlists.map(playlist =>
        playlist.id === playlistId ? { ...playlist, ...updates } : playlist
      )
    }));
    console.log('Playlist updated in state:', playlistId, updates);
  }
}
