import { Injectable } from '@angular/core';
import Fuse from 'fuse.js';
import { Song, SearchResult, Album, Artist, Playlist } from '../interfaces/song.interface';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private songsFuse?: Fuse<Song>;
  private allSongs: Song[] = [];

  constructor(private databaseService: DatabaseService) {
    this.initializeSearch();
  }

  private async initializeSearch() {
    this.allSongs = await this.databaseService.getAllSongs();
    this.setupFuseSearch();
  }  // Thiết lập Fuse search cho tìm kiếm nâng cao
  private setupFuseSearch() {
    const options = {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'artist', weight: 0.4 }, // Tăng trọng số cho artist vì đây là cơ sở của playlist
        { name: 'keywords', weight: 0.2 }
      ],
      threshold: 0.3, // Lower threshold for more strict matching
      includeScore: true,
      shouldSort: true,
      ignoreLocation: true,
      includeMatches: true
    };

    this.songsFuse = new Fuse(this.allSongs, options);
  }

  // Cập nhật chỉ mục tìm kiếm
  async updateSearchIndex() {
    this.allSongs = await this.databaseService.getAllSongs();
    this.setupFuseSearch();
  }

  // Tìm kiếm tổng hợp
  searchAll(query: string): Promise<SearchResult> {
    return new Promise(async (resolve) => {
      if (!query.trim()) {
        resolve({
          songs: [],
          artists: [],
          playlists: []
        });
        return;
      }

      // Tìm kiếm bài hát
      const songs = this.searchSongs(query);

      // Nhóm bài hát theo artist playlists và artists
      const artistPlaylists = this.groupSongsIntoArtistPlaylists(songs);
      const artists = this.groupSongsByArtist(songs);

      resolve({
        songs,
        artists,
        playlists: artistPlaylists // Artist playlists được hiển thị dưới dạng playlists
      });
    });
  }

  searchSongs(query: string): Song[] {
    if (!this.songsFuse || !query.trim()) {
      return [];
    }

    const results = this.songsFuse.search(query);
    return results.map(result => result.item);
  }

  searchByArtist(artistName: string): Song[] {
    return this.allSongs.filter(song =>
      song.artist.toLowerCase().includes(artistName.toLowerCase())
    );
  }

  // Tìm kiếm theo playlist (dựa trên tên artist)
  searchByPlaylist(playlistName: string): Song[] {
    // Tìm kiếm trong artist playlists
    return this.allSongs.filter(song =>
      song.artist?.toLowerCase().includes(playlistName.toLowerCase())
    );
  }

  /** @deprecated Sử dụng searchByPlaylist thay thế */
  searchByAlbum(albumName: string): Song[] {
    return this.searchByPlaylist(albumName);
  }

  searchByGenre(genre: string): Song[] {
    // Since genre field is removed, search by keywords instead
    return this.allSongs.filter(song =>
      song.keywords?.some(keyword => keyword.toLowerCase().includes(genre.toLowerCase()))
    );
  }



  getRecentlyAddedSongs(limit: number = 20): Song[] {
    return [...this.allSongs]
      .sort((a, b) => b.addedDate.getTime() - a.addedDate.getTime())
      .slice(0, limit);
  }

  getSimilarSongs(song: Song, limit: number = 10): Song[] {
    const similar = this.allSongs.filter(s =>
      s.id !== song.id && (
        s.artist.toLowerCase() === song.artist.toLowerCase() ||
        s.keywords?.some(keyword => song.keywords?.includes(keyword))
      )
    );

    // Sort by relevance (same artist > same keywords)
    similar.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (a.artist.toLowerCase() === song.artist.toLowerCase()) scoreA += 3;
      // Check keyword matches
      const aKeywordMatches = a.keywords?.filter(k => song.keywords?.includes(k)).length || 0;
      const bKeywordMatches = b.keywords?.filter(k => song.keywords?.includes(k)).length || 0;
      scoreA += aKeywordMatches;
      scoreB += bKeywordMatches;

      return scoreB - scoreA;
    });

    return similar.slice(0, limit);
  }

  // Nhóm bài hát thành artist playlists
  private groupSongsIntoArtistPlaylists(songs: Song[]): Album[] {
    const playlistMap = new Map<string, Album>();

    songs.forEach(song => {
      // Nhóm theo artist để tạo artist playlist
      const playlistKey = song.artist;

      if (!playlistMap.has(playlistKey)) {
        playlistMap.set(playlistKey, {
          id: `playlist_${playlistKey}`,
          name: song.artist, // Artist name becomes playlist name
          artist: song.artist,
          thumbnail: song.thumbnail_url,
          songs: [],
          genre: 'Music', // Default genre
          totalDuration: 0,
          isUserCreated: false, // Auto-generated from artist
          isEditable: true
        });
      }

      const playlist = playlistMap.get(playlistKey)!;
      playlist.songs.push(song);
      playlist.totalDuration += song.duration;
    });

    return Array.from(playlistMap.values());
  }

  /** @deprecated Sử dụng groupSongsIntoArtistPlaylists thay thế */
  private groupSongsByAlbum(songs: Song[]): Album[] {
    return this.groupSongsIntoArtistPlaylists(songs);
  }

  private groupSongsByArtist(songs: Song[]): Artist[] {
    const artistMap = new Map<string, Artist>();

    songs.forEach(song => {
      if (!artistMap.has(song.artist)) {
        artistMap.set(song.artist, {
          id: `artist_${song.artist}`,
          name: song.artist,
          thumbnail: song.thumbnail_url,
          playlists: [],
          totalSongs: 0,
          bio: undefined
        });
      }

      const artist = artistMap.get(song.artist)!;
      artist.totalSongs++;
    });

    return Array.from(artistMap.values());
  }

  getSearchSuggestions(query: string, limit: number = 5): string[] {
    if (!query.trim()) return [];

    const suggestions = new Set<string>();
    const lowerQuery = query.toLowerCase();

    // Add song titles that start with the query
    this.allSongs.forEach(song => {
      if (song.title.toLowerCase().startsWith(lowerQuery)) {
        suggestions.add(song.title);
      }
      if (song.artist.toLowerCase().startsWith(lowerQuery)) {
        suggestions.add(song.artist);
      }
      // Search in keywords instead of album
      song.keywords?.forEach(keyword => {
        if (keyword.toLowerCase().startsWith(lowerQuery)) {
          suggestions.add(keyword);
        }
      });
    });

    return Array.from(suggestions).slice(0, limit);
  }

  highlightSearchTerm(text: string, searchTerm: string): string {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}
