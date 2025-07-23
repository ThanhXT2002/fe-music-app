export interface YTPlayerTrack {
  videoId: string;
  title: string;
  length?: string;
  thumbnail?: YTMusicThumbnail[];
  feedbackTokens?: any;
  likeStatus?: any;
  inLibrary?: boolean;
  videoType?: string;
  artists?: { name: string; id?: string }[];
  album?: { id: string; name?: string };
  year?: string;
  views?: string;
}

// Watch playlist structure (theo đúng response thực tế)
export interface YTMusicWatchPlaylistResponse {
  tracks: YTPlayerTrack[];
  playlistId?: string;
  lyrics?: string | null;
  related?: string;
}

// Section liên quan (tái sử dụng nếu đã có)
export interface YTMusicRelatedResponse {
  title: string;
  contents: YTMusicRelatedItem[];
}

// Item liên quan (tùy biến, có thể là bài hát, playlist, nghệ sĩ...)
export interface YTMusicRelatedItem {
  title?: string;
  description?: string;
  videoId?: string;
  browseId?: string;
  thumbnails?: YTMusicThumbnail[];
  [key: string]: any;
}

export interface YTMusicArtist {
  category?: string | null;
  resultType: 'artist';
  artist?: string;
  artists?: { name: string; id?: string }[];
  shuffleId?: string;
  radioId?: string;
  browseId?: string;
  subscribers?: string;
  thumbnails: YTMusicThumbnail[];
}

export interface YTMusicSong {
  category?: string | null;
  resultType: 'song';
  title: string;
  album?: { id: string } | null;
  inLibrary?: boolean;
  feedbackTokens?: { remove: string | null };
  videoId: string;
  videoType?: string;
  duration: string;
  year?: string | null;
  artists: YTMusicArtist[];
  duration_seconds: number;
  views?: string;
  isExplicit?: boolean;
  thumbnails: YTMusicThumbnail[];
}

export interface YTMusicPlaylist {
  category?: string | null;
  resultType: 'playlist';
  title: string;
  itemCount?: string | number;
  author?: string;
  browseId: string;
  thumbnails: YTMusicThumbnail[];
}

export interface YTMusicAlbum {
  title: string;
  type?: string;
  thumbnails: YTMusicThumbnail[];
  isExplicit?: boolean;
  description?: string | null;
  artists: YTMusicArtist[];
  year?: string;
  trackCount?: number;
  duration?: string;
  audioPlaylistId?: string;
  likeStatus?: string;
  tracks: YTMusicSong[];
  other_versions?: any[];
  duration_seconds?: number;
}

export interface YTMusicPlaylistDetail {
  owned?: boolean;
  id: string;
  privacy?: string;
  description?: string | null;
  views?: number | string;
  duration?: string;
  trackCount?: number;
  title: string;
  thumbnails: YTMusicThumbnail[];
  artists: YTMusicArtist[];
  year?: string;
  related?: any[];
  tracks: YTMusicSong[];
  duration_seconds?: number;
}

export interface YTMusicArtistDetail {
  description?: string;
  views?: string;
  name: string;
  channelId: string;
  shuffleId?: string;
  radioId?: string;
  subscribers?: string;
  subscribed?: boolean;
  thumbnails: YTMusicThumbnail[];
  songs?: any;
  albums?: any;
  singles?: any;
  videos?: any;
  related?: any;
}

export interface YTMusicSongDetail {
  playabilityStatus?: any;
  streamingData?: any;
  playbackTracking?: any;
  videoDetails?: any;
  microformat?: any;
}

export interface YTMusicThumbnail {
  url?: string;
  width?: number;
  height?: number;
}

// Search result union type
export type YTMusicSearchResult = YTMusicArtist | YTMusicSong | YTMusicPlaylist;

// API response types
export type YTMusicSearchResponse = YTMusicSearchResult[];
export type YTMusicAlbumResponse = YTMusicAlbum;
export type YTMusicPlaylistResponse = YTMusicPlaylistDetail;
export type YTMusicArtistResponse = YTMusicArtistDetail;
export type YTMusicSongResponse = YTMusicSongDetail;
