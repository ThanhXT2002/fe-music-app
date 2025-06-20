import { Injectable } from '@angular/core';
import { Song, SearchHistoryItem, Playlist } from '../interfaces/song.interface';
import { IndexedDBService } from './indexeddb.service';
import { StorageManagerService } from './storage-manager.service';
import { DataProtectionService } from './data-protection.service';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private indexedDB: IndexedDBService;
  private storageManager: StorageManagerService;
  private dataProtection: DataProtectionService;
  private static isDbReady = false; // Static shared state
  private static isInitializing = false; // Static shared flag
  private static initPromise: Promise<void> | null = null; // Static shared promise
  private static hasRequestedPersistentStorage = false; // Track if we've requested
  private static dataLossAlertShown = false; // Prevent multiple alerts

  constructor(
    indexedDBService: IndexedDBService,
    storageManagerService: StorageManagerService,
    dataProtectionService: DataProtectionService
  ) {
    this.indexedDB = indexedDBService;
    this.storageManager = storageManagerService;
    this.dataProtection = dataProtectionService;
    // NO automatic initialization here
  }

  async initializeDatabase(): Promise<void> {
    // Use static shared state to prevent multiple initialization
    if (DatabaseService.isDbReady) {
      return;
    }

    if (DatabaseService.isInitializing && DatabaseService.initPromise) {
      return DatabaseService.initPromise;
    }

    DatabaseService.isInitializing = true;
    DatabaseService.initPromise = this.performInitialization();

    try {
      await DatabaseService.initPromise;
      DatabaseService.isDbReady = true;
      console.log('✅ DatabaseService: Initialization completed');
    } catch (error) {
      console.error('❌ DatabaseService: Initialization failed:', error);
      DatabaseService.isDbReady = false;
      throw error;
    } finally {
      DatabaseService.isInitializing = false;
    }
  }
  private async performInitialization(): Promise<void> {
    console.log('🔄 DatabaseService: Starting IndexedDB initialization...');
    await this.indexedDB.initDB();
    console.log('✅ DatabaseService: IndexedDB initialization completed');

    // Verify data integrity after initialization
    await this.verifyDataIntegrity();
  }

  /**
   * Verify data integrity and detect data loss
   */
  private async verifyDataIntegrity(): Promise<void> {
    try {
      console.log('🔍 DatabaseService: Verifying data integrity...');

      // Check if we have any songs
      const songs = await this.indexedDB.getAll('songs');
      const songCount = songs.length;

      console.log(`📊 DatabaseService: Found ${songCount} songs in database`);      if (songCount === 0) {
        // Check if this is first time or data loss
        const hasDataLossIndicator = localStorage.getItem('xtmusic_has_downloaded_songs');
        const appVersion = localStorage.getItem('xtmusic_app_version') || 'v1';
        const isV2Upgrade = appVersion === 'v1' && !localStorage.getItem('xtmusic_v2_migrated');

        if (hasDataLossIndicator === 'true') {
          // If this is a v1 -> v2 upgrade, be more lenient
          if (isV2Upgrade) {
            console.warn('⚠️ POTENTIAL v1->v2 MIGRATION: Database empty but data indicator present');
            console.warn('⚠️ This might be normal during v2 upgrade - attempting recovery...');

            // Mark as v2 migrated to avoid future false positives
            localStorage.setItem('xtmusic_v2_migrated', 'true');
            localStorage.setItem('xtmusic_app_version', 'v2');

            // Try data recovery silently first
            const recovery = await this.attemptDataRecovery();
            if (recovery.success) {
              console.log(`✅ v2 Migration recovery: ${recovery.message}`);
              return; // Success, no need to show alarming messages
            }

            // Only show mild warning for v2 upgrade issues
            console.warn('⚠️ v2 Migration: Could not recover data automatically');
            console.warn('⚠️ Your downloaded music may need to be re-downloaded');
          } else {
            // This is genuine data loss for v2 users
            console.error('🚨 DATA LOSS DETECTED: Previously had songs but database is now empty!');
            console.error('🚨 This may be due to browser cleaning storage without persistent permission');

            // Check persistent storage status
            if ('storage' in navigator && 'persisted' in navigator.storage) {
              const isPersistent = await navigator.storage.persisted();
              console.error(`🚨 Persistent Storage Status: ${isPersistent ? 'GRANTED' : 'DENIED'}`);
            }

            // Show user-friendly data loss alert (only once per session)
            if (!DatabaseService.dataLossAlertShown) {
              DatabaseService.dataLossAlertShown = true;

              // Get the previous song count from backup
              const previousSongCount = await this.getPreviousSongCount();

              // Show data loss warning to user
              setTimeout(() => {
                this.dataProtection.showDataLossWarning(previousSongCount);
              }, 1000); // Delay to ensure UI is ready
            }
          }

          // Offer data recovery for both cases (but less aggressively for v2 migration)
          const recovery = await this.attemptDataRecovery();
          if (recovery.success) {
            console.log(`✅ Data recovery: ${recovery.message}`);
          } else {
            console.error(`❌ Data recovery failed: ${recovery.message}`);
            if (!isV2Upgrade) {
              this.showDataRecoveryOptions(); // Only show recovery UI for genuine data loss
            }
          }
        } else {
          console.log('ℹ️ DatabaseService: Clean installation - no previous data detected');
          // Mark as v2 for new installations
          localStorage.setItem('xtmusic_app_version', 'v2');
        }      } else {
        // Mark that we have data (for future data loss detection)
        localStorage.setItem('xtmusic_has_downloaded_songs', 'true');
        localStorage.setItem('xtmusic_app_version', 'v2'); // Ensure v2 is marked
        console.log('✅ DatabaseService: Data integrity verified - songs present');
      }

    } catch (error) {
      console.error('❌ DatabaseService: Error verifying data integrity:', error);
    }
  }

  private async ensureReady(): Promise<void> {
    if (!DatabaseService.isDbReady) {
      await this.initializeDatabase();
    }
  }

  isReady(): boolean {
    return DatabaseService.isDbReady && this.indexedDB.isReady();
  }  async addSong(song: Song): Promise<boolean> {
    await this.ensureReady();
    try {
      // Request persistent storage on first song download (with user interaction)
      if (!DatabaseService.hasRequestedPersistentStorage) {
        console.log('🎯 First song download - requesting persistent storage...');
        const granted = await this.storageManager.requestPersistentStorageWithUserInteraction();
        DatabaseService.hasRequestedPersistentStorage = true;

        if (!granted) {
          console.warn('⚠️ Persistent storage denied - using fallback protection');
        }
      }

      const success = await this.indexedDB.put('songs', song);

      if (success) {
        // Mark that we have data (for data loss detection)
        localStorage.setItem('xtmusic_has_downloaded_songs', 'true');

        // Update backup data
        await this.updateDataBackup();

        console.log(`✅ DatabaseService: Song "${song.title}" added successfully`);
      }

      return success;
    } catch (error) {
      console.error('Error adding song:', error);
      return false;
    }
  }
  /**
   * Update data backup in localStorage
   */
  private async updateDataBackup(): Promise<void> {
    try {
      const songs = await this.getAllSongs();
      const backup = {
        timestamp: Date.now(),
        hasData: true,
        songCount: songs.length,
        lastUpdate: new Date().toISOString()
      };

      localStorage.setItem('xtmusic_data_backup', JSON.stringify(backup));
    } catch (error) {
      console.warn('⚠️ Failed to update data backup:', error);
    }
  }

  /**
   * Get previous song count from backup data
   */
  private async getPreviousSongCount(): Promise<number> {
    try {
      const backupData = localStorage.getItem('xtmusic_data_backup');
      if (backupData) {
        const backup = JSON.parse(backupData);
        return backup.songCount || 0;
      }
      return 0;
    } catch (error) {
      console.warn('⚠️ Failed to get previous song count:', error);
      return 0;
    }
  }

  async getAllSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAll('songs');
    } catch (error) {
      console.error('Error getting all songs:', error);
      return [];
    }
  }

  async getSongById(id: string): Promise<Song | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.get('songs', id);
    } catch (error) {
      console.error('Error getting song by ID:', error);
      return null;
    }
  }

  async updateSong(song: Song): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('songs', song);
    } catch (error) {
      console.error('Error updating song:', error);
      return false;
    }
  }

  async deleteSong(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.delete('songs', songId);
    } catch (error) {
      console.error('Error deleting song:', error);
      return false;
    }
  }

  async toggleFavorite(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      const song = await this.getSongById(songId);
      if (song) {
        song.isFavorite = !song.isFavorite;
        return await this.updateSong(song);
      }
      return false;
    } catch (error) {
      console.error('Error toggling favorite:', error);
      return false;
    }
  }
  async addSearchHistory(item: SearchHistoryItem): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('search_history', item);
    } catch (error) {
      console.error('Error adding to search history:', error);
      return false;
    }
  }

  async getSearchHistory(): Promise<SearchHistoryItem[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAll('search_history');
    } catch (error) {
      console.error('Error getting search history:', error);
      return [];
    }
  }

  async clearSearchHistory(): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.clear('search_history');
    } catch (error) {
      console.error('Error clearing search history:', error);
      return false;
    }
  }

  async addPlaylist(playlist: Playlist): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('playlists', playlist);
    } catch (error) {
      console.error('Error adding playlist:', error);
      return false;
    }
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAll('playlists');
    } catch (error) {
      console.error('Error getting all playlists:', error);
      return [];
    }
  }

  async getPlaylistById(id: string): Promise<Playlist | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.get('playlists', id);
    } catch (error) {
      console.error('Error getting playlist by ID:', error);
      return null;
    }
  }

  async updatePlaylist(playlist: Playlist): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.put('playlists', playlist);
    } catch (error) {
      console.error('Error updating playlist:', error);
      return false;
    }
  }

  async deletePlaylist(playlistId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.delete('playlists', playlistId);
    } catch (error) {
      console.error('Error deleting playlist:', error);
      return false;
    }
  }  async storeThumbnailFile(songId: string, file: Blob): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.saveThumbnailFile(songId, file, file.type);
    } catch (error) {
      console.error('Error storing thumbnail file:', error);
      return false;
    }
  }

  async saveThumbnailBlob(songId: string, file: Blob): Promise<boolean> {
    return await this.storeThumbnailFile(songId, file);
  }
  async getThumbnailFile(songId: string): Promise<Blob | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getThumbnailFile(songId);
    } catch (error) {
      console.error('Error getting thumbnail file:', error);
      return null;
    }
  }

  async getThumbnailBlob(songId: string): Promise<Blob | null> {
    return await this.getThumbnailFile(songId);
  }
  async storeAudioFile(songId: string, file: Blob): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.saveAudioFile(songId, file, file.type);
    } catch (error) {
      console.error('Error storing audio file:', error);
      return false;
    }
  }

  async getAudioFile(songId: string): Promise<Blob | null> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAudioFile(songId);
    } catch (error) {
      console.error('Error getting audio file:', error);
      return null;
    }
  }

  async deleteAudioFile(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.deleteAudioFile(songId);
    } catch (error) {
      console.error('Error deleting audio file:', error);
      return false;
    }
  }
  async deleteThumbnailFile(songId: string): Promise<boolean> {
    await this.ensureReady();
    try {
      return await this.indexedDB.deleteThumbnailFile(songId);
    } catch (error) {
      console.error('Error deleting thumbnail file:', error);
      return false;
    }
  }
  async getDownloadedSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      const songs = await this.getAllSongs();
      const downloadedSongs: Song[] = [];

      for (const song of songs) {
        const audioFile = await this.getAudioFile(song.id);
        if (audioFile) {
          downloadedSongs.push(song);
        }
      }

      return downloadedSongs;
    } catch (error) {
      console.error('Error getting downloaded songs:', error);
      return [];
    }
  }

  async getAllThumbnails(): Promise<any[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.getAll('thumbnailFiles');
    } catch (error) {
      console.error('Error getting all thumbnails:', error);
      return [];
    }
  }

  async searchSongs(query: string): Promise<Song[]> {
    await this.ensureReady();
    try {
      return await this.indexedDB.search('songs', 'title', query);
    } catch (error) {
      console.error('Error searching songs:', error);
      return [];
    }
  }

  async getFavoriteSongs(): Promise<Song[]> {
    await this.ensureReady();
    try {
      const songs = await this.getAllSongs();
      return songs.filter(song => song.isFavorite === true);
    } catch (error) {
      console.error('Error getting favorite songs:', error);
      return [];
    }
  }

  async getRecentlyPlayed(limit: number = 50): Promise<Song[]> {
    await this.ensureReady();
    try {
      const history = await this.getSearchHistory();
      const sortedHistory = history.sort((a, b) =>
        new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime()
      );
      const recentSongIds = sortedHistory.slice(0, limit).map(item => item.songId);
      const songs: Song[] = [];

      for (const songId of recentSongIds) {
        const song = await this.getSongById(songId);
        if (song) {
          songs.push(song);
        }
      }

      return songs;
    } catch (error) {
      console.error('Error getting recently played songs:', error);
      return [];
    }
  }

  async getDatabaseStats(): Promise<any> {
    await this.ensureReady();
    try {
      const songs = await this.getAllSongs();
      const playlists = await this.getAllPlaylists();
      const history = await this.getSearchHistory();
      const thumbnails = await this.getAllThumbnails();

      return {
        totalSongs: songs.length,
        totalPlaylists: playlists.length,
        totalSearchHistory: history.length,
        totalThumbnails: thumbnails.length,
        favoriteSongs: songs.filter(s => s.isFavorite).length
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {};
    }
  }

  async clearDatabase(): Promise<boolean> {
    await this.ensureReady();
    try {
      await this.indexedDB.clear('songs');
      await this.indexedDB.clear('search_history');
      await this.indexedDB.clear('playlists');
      await this.indexedDB.clear('thumbnailFiles');
      await this.indexedDB.clear('audioFiles');
      return true;
    } catch (error) {
      console.error('Error clearing database:', error);
      return false;
    }
  }

  /**
   * Attempt to recover data after detected loss
   */
  async attemptDataRecovery(): Promise<{
    success: boolean;
    songsRecovered: number;
    message: string;
  }> {
    try {
      console.log('🔄 Attempting data recovery...');

      // Check backup data
      const backupData = localStorage.getItem('xtmusic_data_backup');
      if (!backupData) {
        return {
          success: false,
          songsRecovered: 0,
          message: 'No backup data found'
        };
      }

      const backup = JSON.parse(backupData);
      console.log(`📊 Backup info: ${backup.songCount} songs, last update: ${backup.lastUpdate}`);

      // For now, we can only recover metadata
      // Audio files are too large for localStorage backup
      return {
        success: false,
        songsRecovered: 0,
        message: `Found backup with ${backup.songCount} songs, but audio files cannot be recovered. Please re-download.`
      };

    } catch (error) {
      console.error('❌ Data recovery failed:', error);
      return {
        success: false,
        songsRecovered: 0,
        message: 'Data recovery failed'
      };
    }
  }

  /**
   * Show data recovery options to user
   */
  showDataRecoveryOptions(): void {
    const backup = localStorage.getItem('xtmusic_data_backup');
    if (backup) {
      const backupInfo = JSON.parse(backup);
      console.warn(`
🔄 DATA RECOVERY OPTIONS:

We detected you previously had ${backupInfo.songCount} downloaded songs.
Unfortunately, the audio files were lost due to browser storage cleanup.

RECOVERY OPTIONS:
1. 🔄 Re-download your favorite songs
2. 🛡️ Enable persistent storage to prevent future data loss
3. 📱 Use the mobile app for better data persistence

PREVENT FUTURE DATA LOSS:
- Grant persistent storage permission when prompted
- Keep the app open occasionally to mark storage as "active"
- Consider using the native mobile app instead of web browser
      `);
    }
  }
}
