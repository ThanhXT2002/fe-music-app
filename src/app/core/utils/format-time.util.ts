/**
 * Hàm định dạng số đếm giây thành chuỗi thời gian dạng `H:MM:SS` hoặc `M:SS`.
 * @param seconds Số giây đếm (Time duration theo second unit)
 * @returns Chuỗi thời gian đã định dạng String hiển thị tĩnh cho View Layer
 */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * Hàm làm gọn chuỗi text hiển thị thời lượng bài hát cực lớn bằng giờ.
 * Rút gọn thời gian (VD thay vì 1:15:00 sẽ hiện 1h 15m)
 * @param seconds Tổng số giây thời lượng
 * @returns String format `1h 15m` cho những nội dung Podcast hay liên khúc lớn
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
