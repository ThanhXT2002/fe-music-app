export interface SongInfo {
  id: string;
  title: string;
  artist: string;
  thumbnail_url: string;
  duration: number;
  duration_formatted: string;
  keywords: string[];
  original_url: string;
  created_at: string;
}

export interface SongStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error_message?: string;
  audio_filename?: string;
  thumbnail_filename?: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
