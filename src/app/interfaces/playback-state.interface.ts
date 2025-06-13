export interface SavedPlaybackState {
  currentSong: {
    id: string;
    title: string;
    artist: string;
    url: string;
    thumbnail?: string;
    duration: number;
  } | null;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  isShuffling: boolean;
  repeatMode: 'none' | 'one' | 'all';
  queue: {
    id: string;
    title: string;
    artist: string;
    url: string;
    thumbnail?: string;
    duration: number;
  }[];
  currentIndex: number;
  savedAt: number; // timestamp
}
