/** 
 * Cấu trúc thông tin trạng thái phát nhạc (State playback snapshot) để khôi phục tiến trình cuối cùng. 
 * Cho phép thiết lập mở lại App ở đúng bài và timestamp ngay trước khi bị tắt.
 */
export interface SavedPlaybackState {
  /** Thông tin cơ bản cô đọng thiết yếu của bài đang đánh */
  currentSong: {
    id: string;
    title: string;
    artist: string;
    url: string;
    thumbnail?: string;
    duration: number;
  } | null;
  
  /** Mốc gián đoạn Track Time (Time cursor của bài hát tính theo mili giây) */
  currentTime: number;
  
  /** Đánh dấu Pause hay Resume */
  isPlaying: boolean;
  
  /** Độ phóng dải thanh âm (Volume setting cuối cùng) */
  volume: number;
  
  /** Bật cờ xáo mảng Random (Chế độ phát nhảy cóc ngẫu nhiên) */
  isShuffling: boolean;
  
  /** Trạng thái tiếp diễn lặp lại: 'none' -> next qua, 'one' -> repeat một vòng, 'all' -> reset Array */
  repeatMode: 'none' | 'one' | 'all';
  
  /** Danh sách đợi đánh các bài kế tiếp (Giỏ mảng list Queue chờ đợi phát) */
  queue: {
    id: string;
    title: string;
    artist: string;
    url: string;
    thumbnail?: string;
    duration: number;
  }[];
  
  /** Số đếm Index nhận dạng vị trí trỏ tới bài nào đang Play nằm trong ruột Queue mảng */
  currentIndex: number;
  
  /** Đóng dấu thời gian timestamp để đọ phiên (auto-save epoch number) */
  savedAt: number; 
}
