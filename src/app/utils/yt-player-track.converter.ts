import { Song } from 'src/app/interfaces/song.interface';
import { YTPlayerTrack } from 'src/app/interfaces/ytmusic.interface';

export function ytPlayerTrackToSong(track: YTPlayerTrack): Song {
  return {
    id: track.videoId,
    title: track.title,
    artist: track.artists?.map(a => a.name).join(', ') || 'Unknown',
    duration: Number(track.length) || 0,
    duration_formatted: track.length || '00:00',
    keywords: [],
    audio_url: '',
    thumbnail_url: track.thumbnail?.[0]?.url || '',
    isFavorite: false,
    addedDate: new Date(),
  };
}
