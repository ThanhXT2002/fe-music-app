import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import { DatabaseService } from './database.service';
import { Song, Playlist } from '../interfaces/song.interface';
import { saveAs } from 'file-saver';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root',
})
export class SaveFileZipService {
  constructor(
    private db: DatabaseService) {}

  /**
   * Export toàn bộ dữ liệu (songs, playlists, audio) thành file zip
   */
  async exportAllToZip(filename = 'music_backup.zip'): Promise<void> {
    const zip = new JSZip();
    // 1. Export songs
    const songs: Song[] = await this.db.getAllSongs();
    zip.file('songs.json', JSON.stringify(songs, null, 2));

    // 2. Export playlists
    const playlists: Playlist[] = await this.db.getAllPlaylists();
    zip.file('playlists.json', JSON.stringify(playlists, null, 2));

    // 3. Export audio blobs (lấy trực tiếp từ table audioFiles)
    const audioFolder = zip.folder('audio');
    // Lấy tất cả audioFiles từ IndexedDBService
    // @ts-ignore: access private indexedDB
    const audioFiles = await this.db['indexedDB'].getAll('audioFiles');
    for (const audioFile of audioFiles) {
      if (audioFile && audioFile.songId && audioFile.blob) {
        const ext = this.getAudioExtension(
          audioFile.mimeType || audioFile.blob.type
        );
        audioFolder?.file(`${audioFile.songId}${ext}`, audioFile.blob);
      }
    }

    // 4. Tạo file zip và lưu
    const content = await zip.generateAsync({ type: 'blob' });
    if (Capacitor.isNativePlatform()) {
      // Native: lưu bằng Filesystem
      const arrayBuffer = await content.arrayBuffer();
      const base64 = this.arrayBufferToBase64(arrayBuffer);
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents, // hoặc Directory.Downloads nếu plugin hỗ trợ
        recursive: true,
      });
    } else {
      // Web/PWA: dùng FileSaver.js
      saveAs(content, filename);
    }
  }

  /**
   * Import dữ liệu từ file zip (songs, playlists, audio)
   */
  async importAllFromZip(
    file: File
  ): Promise<{ songs: number; playlists: number; audio: number }> {
    const zip = await JSZip.loadAsync(file);
    // 1. Import songs
    const songsJson = await zip.file('songs.json')?.async('string');
    const songs: Song[] = songsJson ? JSON.parse(songsJson) : [];
    let songCount = 0;
    for (const song of songs) {
      // Chuyển lại các trường Date nếu cần
      if (song.addedDate) song.addedDate = new Date(song.addedDate);
      if (song.lastUpdated) song.lastUpdated = new Date(song.lastUpdated);
      if (song.lastPlayedDate)
        song.lastPlayedDate = new Date(song.lastPlayedDate);
      await this.db.addSong(song);
      songCount++;
    }

    // 2. Import playlists
    const playlistsJson = await zip.file('playlists.json')?.async('string');
    const playlists: Playlist[] = playlistsJson
      ? JSON.parse(playlistsJson)
      : [];
    let playlistCount = 0;
    for (const playlist of playlists) {
      if (playlist.createdDate)
        playlist.createdDate = new Date(playlist.createdDate);
      if (playlist.updatedDate)
        playlist.updatedDate = new Date(playlist.updatedDate);
      await this.db.addPlaylist(playlist);
      playlistCount++;
    }

    // 3. Import audio blobs
    let audioCount = 0;
    const audioFolder = zip.folder('audio');
    if (audioFolder) {
      const files = Object.keys(audioFolder.files);
      for (const fileName of files) {
        const match = fileName.match(/audio\/(.+)\.(mp3|wav|ogg|m4a|aac)$/);
        if (match) {
          const songId = match[1];
          const blob = await zip.file(fileName)?.async('blob');
          if (blob) {
            await this.db.saveAudioFile(
              songId,
              blob,
              blob.type || 'audio/mpeg'
            );
            audioCount++;
          }
        }
      }
    }
    return { songs: songCount, playlists: playlistCount, audio: audioCount };
  }

  /**
   * Lấy extension từ mime type
   */
  private getAudioExtension(mimeType: string): string {
    switch (mimeType) {
      case 'audio/mpeg':
        return '.mp3';
      case 'audio/wav':
        return '.wav';
      case 'audio/ogg':
        return '.ogg';
      case 'audio/x-m4a':
      case 'audio/mp4':
        return '.m4a';
      case 'audio/aac':
        return '.aac';
      default:
        return '.mp3';
    }
  }

  arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
