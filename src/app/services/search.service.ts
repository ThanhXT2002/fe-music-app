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
  }  private setupFuseSearch() {
    const options = {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'artist', weight: 0.3 },
        { name: 'album', weight: 0.2 },
        { name: 'genre', weight: 0.1 }
      ],
      threshold: 0.3, // Lower threshold for more strict matching
      includeScore: true,
      shouldSort: true,
      ignoreLocation: true,
      includeMatches: true
    };

    this.songsFuse = new Fuse(this.allSongs, options);
  }

  async updateSearchIndex() {
    this.allSongs = await this.databaseService.getAllSongs();
    this.setupFuseSearch();
  }

  searchAll(query: string): Promise<SearchResult> {
    return new Promise(async (resolve) => {
      if (!query.trim()) {
        resolve({
          songs: [],
          albums: [],
          artists: [],
          playlists: []
        });
        return;
      }

      // Search songs
      const songs = this.searchSongs(query);

      // Group songs by album and artist for additional results
      const albums = this.groupSongsByAlbum(songs);
      const artists = this.groupSongsByArtist(songs);

      resolve({
        songs,
        albums,
        artists,
        playlists: [] // Playlists search can be implemented later
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

  searchByAlbum(albumName: string): Song[] {
    return this.allSongs.filter(song =>
      song.album?.toLowerCase().includes(albumName.toLowerCase())
    );
  }

  searchByGenre(genre: string): Song[] {
    return this.allSongs.filter(song =>
      song.genre?.toLowerCase().includes(genre.toLowerCase())
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
        s.album?.toLowerCase() === song.album?.toLowerCase() ||
        s.genre?.toLowerCase() === song.genre?.toLowerCase()
      )
    );

    // Sort by relevance (same artist > same album > same genre)
    similar.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (a.artist.toLowerCase() === song.artist.toLowerCase()) scoreA += 3;
      if (a.album?.toLowerCase() === song.album?.toLowerCase()) scoreA += 2;
      if (a.genre?.toLowerCase() === song.genre?.toLowerCase()) scoreA += 1;

      if (b.artist.toLowerCase() === song.artist.toLowerCase()) scoreB += 3;
      if (b.album?.toLowerCase() === song.album?.toLowerCase()) scoreB += 2;
      if (b.genre?.toLowerCase() === song.genre?.toLowerCase()) scoreB += 1;

      return scoreB - scoreA;
    });

    return similar.slice(0, limit);
  }

  private groupSongsByAlbum(songs: Song[]): Album[] {
    const albumMap = new Map<string, Album>();

    songs.forEach(song => {
      if (song.album) {
        const albumKey = `${song.artist}-${song.album}`;

        if (!albumMap.has(albumKey)) {
          albumMap.set(albumKey, {
            id: `album_${albumKey}`,
            name: song.album,
            artist: song.artist,
            thumbnail: song.thumbnail,
            songs: [],
            genre: song.genre,
            totalDuration: 0
          });
        }

        const album = albumMap.get(albumKey)!;
        album.songs.push(song);
        album.totalDuration += song.duration;
      }
    });

    return Array.from(albumMap.values());
  }

  private groupSongsByArtist(songs: Song[]): Artist[] {
    const artistMap = new Map<string, Artist>();

    songs.forEach(song => {
      if (!artistMap.has(song.artist)) {
        artistMap.set(song.artist, {
          id: `artist_${song.artist}`,
          name: song.artist,
          thumbnail: song.thumbnail,
          albums: [],
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
      if (song.album?.toLowerCase().startsWith(lowerQuery)) {
        suggestions.add(song.album);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }

  highlightSearchTerm(text: string, searchTerm: string): string {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
}
