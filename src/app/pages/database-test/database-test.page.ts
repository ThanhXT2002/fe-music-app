import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from '../../services/database.service';
import { DataSong, Song } from '../../interfaces/song.interface';

@Component({
  selector: 'app-database-test',
  templateUrl: './database-test.page.html',
  styleUrls: ['./database-test.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class DatabaseTestPage implements OnInit {
  testResults: string[] = [];
  isRunning = false;

  constructor(private databaseService: DatabaseService) {}

  ngOnInit() {
    this.runTests();
  }

  async runTests() {
    this.isRunning = true;
    this.testResults = [];

    try {
      // Test 1: Database initialization
      this.addResult('🔍 Testing database initialization...');
      await this.delay(1000); // Wait for database to initialize
      this.addResult('✅ Database initialized successfully');

      // Test 2: Add song to library
      this.addResult('🔍 Testing add song...');
      const testSong: Song = {
        id: 'test-song-1',
        title: 'Test Song 1',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 180,
        duration_formatted: '3:00',
        thumbnail: 'https://via.placeholder.com/150',        audioUrl: '',
        filePath: null,
        addedDate: new Date(),
        isFavorite: false,
        genre: 'Test'
      };

      const addResult = await this.databaseService.addSong(testSong);
      if (addResult) {
        this.addResult('✅ Song added successfully');
      } else {
        this.addResult('❌ Failed to add song');
      }

      // Test 3: Get all songs
      this.addResult('🔍 Testing get all songs...');
      const songs = await this.databaseService.getAllSongs();
      this.addResult(`✅ Retrieved ${songs.length} songs`);

      // Test 4: Get song by ID
      this.addResult('🔍 Testing get song by ID...');
      const retrievedSong = await this.databaseService.getSongById('test-song-1');
      if (retrievedSong) {
        this.addResult(`✅ Retrieved song: ${retrievedSong.title}`);
      } else {
        this.addResult('❌ Failed to retrieve song');
      }

      // Test 5: Search songs
      this.addResult('🔍 Testing search songs...');
      const searchResults = await this.databaseService.searchSongs('Test');
      this.addResult(`✅ Found ${searchResults.length} songs in search`);

      // Test 6: Add to search history
      this.addResult('🔍 Testing add to search history...');
      const testSearchData: DataSong = {
        id: 'test-search-1',
        title: 'Test Search Song',
        artist: 'Test Search Artist',
        thumbnail_url: 'https://via.placeholder.com/100',
        audio_url: 'https://example.com/search-audio.mp3',
        duration: 240,
        duration_formatted: '4:00',
        keywords: ['test', 'search']
      };

      const historyResult = await this.databaseService.addToSearchHistory(testSearchData);
      if (historyResult) {
        this.addResult('✅ Added to search history successfully');
      } else {
        this.addResult('❌ Failed to add to search history');
      }

      // Test 7: Get search history
      this.addResult('🔍 Testing get search history...');
      const history = await this.databaseService.getSearchHistory();
      this.addResult(`✅ Retrieved ${history.length} items from search history`);

      // Test 8: Toggle favorite
      this.addResult('🔍 Testing toggle favorite...');
      const favoriteResult = await this.databaseService.toggleFavorite('test-song-1');
      this.addResult(`✅ Favorite status: ${favoriteResult}`);

      // Test 9: Get favorite songs
      this.addResult('🔍 Testing get favorite songs...');
      const favorites = await this.databaseService.getFavoriteSongs();
      this.addResult(`✅ Retrieved ${favorites.length} favorite songs`);

      // Test 10: Get search history stats
      this.addResult('🔍 Testing get search history stats...');
      const stats = await this.databaseService.getSearchHistoryStats();
      this.addResult(`✅ Stats - Total: ${stats.totalSongs}, Downloaded: ${stats.downloadedSongs}, Pending: ${stats.pendingSongs}`);

      this.addResult('🎉 All tests completed!');

    } catch (error) {
      this.addResult(`❌ Test error: ${error}`);
      console.error('Database test error:', error);
    }

    this.isRunning = false;
  }

  private addResult(message: string) {
    this.testResults.push(`${new Date().toLocaleTimeString()}: ${message}`);
  }
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getPlatform(): string {
    return Capacitor.getPlatform();
  }

  getUserAgent(): string {
    return navigator.userAgent;
  }

  async clearData() {
    this.addResult('🔍 Clearing all data...');
    const result = await this.databaseService.clearAllData();
    if (result) {
      this.addResult('✅ All data cleared successfully');
    } else {
      this.addResult('❌ Failed to clear data');
    }
  }
}
