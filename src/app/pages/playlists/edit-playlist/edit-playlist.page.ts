import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonCheckbox, IonList, IonItem, AlertController, IonButtons, IonBackButton } from '@ionic/angular/standalone';
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
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule, IonCheckbox, IonList, IonItem, SongItemComponent, IonButtons, IonBackButton, IonButton]
})
export class EditPlaylistPage implements OnInit {

  playlistId: string | null = null;
    allSongs: Song[] = [];
    selectedSongIds: Set<string> = new Set();
    isLoading = false;
    searchQuery: string = '';
    filteredSongs: Song[] = [];

    constructor(
      private route: ActivatedRoute,
      private playlistService: PlaylistService,
      private databaseService: DatabaseService,
      private alertController: AlertController,
      private router: Router,
      private location: Location,
      private refreshService: RefreshService
    ) { }

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
      const playlist = await this.playlistService.getPlaylistById(this.playlistId);
      if (playlist && playlist.songs) {
        this.selectedSongIds = new Set(playlist.songs.map(s => s.id));
      } else {
        this.selectedSongIds = new Set();
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
      const success = await this.playlistService.addSongsToPlaylist(this.playlistId, songIds);
      const alert = await this.alertController.create({
        mode: 'ios',
        header: success ? 'Thành công' : 'Lỗi',
        message: success ? 'Đã thêm bài hát vào playlist!' : 'Không thể thêm bài hát. Vui lòng thử lại.',
        buttons: ['OK']
      });
      await alert.present();
      if (success) {
        this.router.navigate(['/tabs/playlists']);
      }
    }

    async onSongCheckboxChange(songId: string, checked: boolean) {
      if (!this.playlistId) return;
      if (checked) {
        await this.playlistService.addSongToPlaylist(this.playlistId, songId);
        this.selectedSongIds.add(songId);
      } else {
        await this.playlistService.removeSongFromPlaylist(this.playlistId, songId);
        this.selectedSongIds.delete(songId);
      }
      this.refreshService.triggerRefresh(); // Trigger refresh ngay khi update playlist
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
      this.filteredSongs = this.allSongs.filter(song => {
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

}
