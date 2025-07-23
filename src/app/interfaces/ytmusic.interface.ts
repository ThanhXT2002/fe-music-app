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
  playabilityStatus?: YTMusicPlayabilityStatus;
  streamingData?: YTMusicStreamingData;
  playbackTracking?: YTMusicPlaybackTracking;
  videoDetails?: YTMusicVideoDetails;
  microformat?: YTMusicMicroformat;
}

export interface YTMusicPlayabilityStatus {
  status: string;
  playableInEmbed?: boolean;
  audioOnlyPlayability?: {
    audioOnlyPlayabilityRenderer: {
      trackingParams?: string;
      audioOnlyAvailability?: string;
    }
  };
  miniplayer?: {
    miniplayerRenderer: {
      playbackMode?: string;
      enableStashedPlayback?: boolean;
    }
  };
  contextParams?: string;
}

export interface YTMusicStreamingData {
  expiresInSeconds?: string;
  formats?: any[];
  adaptiveFormats?: any[];
  serverAbrStreamingUrl?: string;
}

export interface YTMusicPlaybackTracking {
  videostatsPlaybackUrl?: { baseUrl: string; headers?: any[] };
  videostatsDelayplayUrl?: { baseUrl: string; headers?: any[] };
  videostatsWatchtimeUrl?: { baseUrl: string; headers?: any[] };
  ptrackingUrl?: { baseUrl: string; headers?: any[] };
  qoeUrl?: { baseUrl: string; headers?: any[] };
  atrUrl?: { baseUrl: string; elapsedMediaTimeSeconds?: number; headers?: any[] };
  videostatsScheduledFlushWalltimeSeconds?: number[];
  videostatsDefaultFlushIntervalSeconds?: number;
  youtubeRemarketingUrl?: { baseUrl: string; elapsedMediaTimeSeconds?: number; headers?: any[] };
  googleRemarketingUrl?: { baseUrl: string; elapsedMediaTimeSeconds?: number; headers?: any[] };
}

export interface YTMusicVideoDetails {
  videoId: string;
  title: string;
  lengthSeconds: string;
  channelId: string;
  isOwnerViewing?: boolean;
  isCrawlable?: boolean;
  thumbnail?: { thumbnails: YTMusicThumbnail[] };
  allowRatings?: boolean;
  viewCount?: string;
  author?: string;
  isPrivate?: boolean;
  isUnpluggedCorpus?: boolean;
  musicVideoType?: string;
  isLiveContent?: boolean;
}

export interface YTMusicMicroformat {
  microformatDataRenderer: {
    urlCanonical?: string;
    title?: string;
    description?: string;
    thumbnail?: any;
    siteName?: string;
    appName?: string;
    androidPackage?: string;
    iosAppStoreId?: string;
    iosAppArguments?: string;
    ogType?: string;
    urlApplinksIos?: string;
    urlApplinksAndroid?: string;
    urlTwitterIos?: string;
    urlTwitterAndroid?: string;
    twitterCardType?: string;
    twitterSiteHandle?: string;
    schemaDotOrgType?: string;
    noindex?: boolean;
    unlisted?: boolean;
    paid?: boolean;
    familySafe?: boolean;
    tags?: string[];
    availableCountries?: string[];
    pageOwnerDetails?: { youtubeProfileUrl?: string };
    videoDetails?: { durationIso8601?: string };
    linkAlternates?: any[];
    viewCount?: string;
    publishDate?: string;
    category?: string;
    uploadDate?: string;
  }
}

// Interface cho từng mục trong related.contents
export interface YTMusicRelatedItem {
  // Có thể là bài hát, playlist, nghệ sĩ, hoặc object đặc biệt
  title?: string;
  description?: string;
  views?: string;
  year?: string;
  // fallback cho các trường hợp đặc biệt
  [key: string]: any;
}

// Interface cho từng section trong related
export interface YTMusicRelatedSection {
  title: string;
  contents: YTMusicRelatedItem[];
}

// Interface cho response mới: { song: ..., related: ... }
export interface YTMusicSongWithRelated {
  song: YTMusicSongDetail;
  related: YTMusicRelatedSection[];
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
export type YTMusicSongResponse = YTMusicSongWithRelated;
