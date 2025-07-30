import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonCheckbox,
  IonList,
  IonItem,
  AlertController,
  IonButtons,
  IonBackButton,
  IonModal,
  IonReorderGroup,
} from '@ionic/angular/standalone';
import { SongItemComponent } from 'src/app/components/song-item/song-item.component';
import { ActivatedRoute, Router } from '@angular/router';
import { PlaylistService } from 'src/app/services/playlist.service';
import { DatabaseService } from 'src/app/services/database.service';
import { Song } from 'src/app/interfaces/song.interface';
import { RefreshService } from 'src/app/services/refresh.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-edit-playlist',
  templateUrl: './edit-playlist.page.html',
  styleUrls: ['./edit-playlist.page.scss'],
  standalone: true,
  imports: [
    IonReorderGroup,
    IonModal,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
    IonList,
    IonItem,
    SongItemComponent,
    IonButtons,
    IonButton,
  ],
})
export class EditPlaylistPage implements OnInit {
  playlistId: string | null = null;
  allSongs: Song[] = [];
  selectedSongIds: Set<string> = new Set();
  isLoading = false;
  searchQuery: string = '';
  filteredSongs: Song[] = [];
  detailList: Song[] = [];

  constructor(
    private route: ActivatedRoute,
    private playlistService: PlaylistService,
    private databaseService: DatabaseService,
    private alertController: AlertController,
    private router: Router,
    private location: Location,
    private refreshService: RefreshService
  ) {}

  async ngOnInit() {
    this.playlistId = this.route.snapshot.paramMap.get('playlistId');
    await this.loadSongs();
    await this.loadPlaylistSongs();
    this.filterSongs();
  }

  async loadSongs() {
    this.isLoading = true;
    try {
      this.allSongs = await this.databaseService.getAllSongs();
    } catch (e) {
      this.allSongs = [];
    }
    this.isLoading = false;
  }

  async loadPlaylistSongs() {
    if (!this.playlistId) return;
    const playlist = await this.playlistService.getPlaylistById(
      this.playlistId
    );
    if (playlist && playlist.songs) {
      this.selectedSongIds = new Set(playlist.songs.map((s) => s.id));
      this.detailList = [...playlist.songs];
      console.log('Playlist songs loaded:', this.detailList);
    } else {
      this.selectedSongIds = new Set();
      this.detailList = [];
    }
  }

  toggleSong(songId: string, checked: boolean) {
    if (checked) {
      this.selectedSongIds.add(songId);
    } else {
      this.selectedSongIds.delete(songId);
    }
  }

  isSelected(songId: string): boolean {
    return this.selectedSongIds.has(songId);
  }

  async addSelectedSongs() {
    if (!this.playlistId || this.selectedSongIds.size === 0) return;
    const songIds = Array.from(this.selectedSongIds);
    const success = await this.playlistService.addSongsToPlaylist(
      this.playlistId,
      songIds
    );
    const alert = await this.alertController.create({
      mode: 'ios',
      header: success ? 'Thành công' : 'Lỗi',
      message: success
        ? 'Đã thêm bài hát vào playlist!'
        : 'Không thể thêm bài hát. Vui lòng thử lại.',
      buttons: ['OK'],
    });
    await alert.present();
    if (success) {
      this.router.navigate(['/playlists']);
    }
  }

  async onSongCheckboxChange(songId: string, checked: boolean) {
    if (!this.playlistId) return;

    // Optimistic update UI trước
    if (checked) {
      this.selectedSongIds.add(songId);
      // Tìm song data từ nguồn hiện có (searchResults, etc.)
      const songData = this.findSongData(songId);
      if (songData) {
        this.detailList.push(songData);
      }
    } else {
      this.selectedSongIds.delete(songId);
      this.detailList = this.detailList.filter((song) => song.id !== songId);
    }

    try {
      // Cập nhật server
      if (checked) {
        await this.playlistService.addSongToPlaylist(this.playlistId, songId);
      } else {
        await this.playlistService.removeSongFromPlaylist(
          this.playlistId,
          songId
        );
      }

      this.refreshService.triggerRefresh();
    } catch (error) {
      // Rollback nếu lỗi
      if (checked) {
        this.selectedSongIds.delete(songId);
        this.detailList = this.detailList.filter((song) => song.id !== songId);
      } else {
        this.selectedSongIds.add(songId);
        const songData = this.findSongData(songId);
        if (songData) {
          this.detailList.push(songData);
        }
      }
      console.error('Error updating playlist:', error);
    }
  }

  // Helper method
  private findSongData(songId: string) {
    // Tìm từ searchResults hoặc nguồn data khác
    return (
      this.filteredSongs?.find((song) => song.id === songId) ||
      this.allSongs?.find((song) => song.id === songId)
    );
  }

  onSearchInput(event: any) {
    this.filterSongs();
  }

  clearSearch() {
    this.searchQuery = '';
    this.filterSongs();
  }

  filterSongs() {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.filteredSongs = this.allSongs;
      return;
    }
    this.filteredSongs = this.allSongs.filter((song) => {
      const title = (song.title || '').toLowerCase();
      const artist = (song.artist || '').toLowerCase();
      const keywords = (song.keywords || []).join(' ').toLowerCase();
      return (
        title.includes(query) ||
        artist.includes(query) ||
        keywords.includes(query)
      );
    });
  }

  onBack() {
    this.location.back();
  }

  async onIonReorder(event: any) {
    const from = event.detail.from;
    const to = event.detail.to;
    const movedSong = this.detailList.splice(from, 1)[0];
    this.detailList.splice(to, 0, movedSong);
    event.detail.complete();

    // Lưu lại thứ tự mới vào service/database
    if (this.playlistId) {
      const newOrderIds = this.detailList.map((song) => song.id);
      await this.playlistService.reorderSongsInPlaylist(
        this.playlistId,
        newOrderIds
      );
    }
  }
}
