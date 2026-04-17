import { Song } from '@core/interfaces/song.interface';
import { YTPlayerTrack } from '@core/interfaces/ytmusic.interface';

/**
 * Ánh xạ chuẩn (Convert mapper) đúc rút `YTPlayerTrack` gốc lấy được từ YouTube Music API qua lại sang
 * giao diện thực thể domain `Song` nội bộ chung của Project để hiển thị UI.
 * Thiết lập các data khuyết tật bằng param tự nội suy (như Duration rỗng, url ảo).
 * 
 * @param track Node đối tượng `YTPlayerTrack` (YtMusic Payload raw)
 * @returns Trả về Interface `Song` chuẩn của App
 */
export function ytPlayerTrackToSong(track: YTPlayerTrack): Song {
  return {
    id: track.videoId,
    // Hack Nối chuỗi tên các Artist vào một hàng ngang phân cách bằng dấu phẩy
    title: track.title,
    artist: track.artists?.map(a => a.name).join(', ') || 'Unknown',
    duration: Number(track.length) || 0,
    duration_formatted: track.length || '00:00',
    keywords: [],
    // Audio stream chưa được khởi tạo, móc lại sau khi load thực thể play
    audio_url: '',
    // Chọc vào mảng chứa Size lớn nhất của chuỗi Array Thumbnail (Vị trí cuối cùng)
    thumbnail_url: track.thumbnail?.[track.thumbnail.length - 1]?.url || '',
    isFavorite: false,
    addedDate: new Date(),
  };
}
