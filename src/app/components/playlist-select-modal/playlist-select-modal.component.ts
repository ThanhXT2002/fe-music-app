import { Component, OnInit, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalController, AlertController } from '@ionic/angular';
import { PlaylistService } from 'src/app/services/playlist.service';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Playlist } from 'src/app/interfaces/playlist.interface';
import { CommonModule } from '@angular/common';
import { RefreshService } from 'src/app/services/refresh.service';

@Component({
  selector: 'app-playlist-select-modal',
  templateUrl: './playlist-select-modal.component.html',
  styleUrls: ['./playlist-select-modal.component.scss'],
  standalone: true,
  imports: [FormsModule, CommonModule],
})
export class PlaylistSelectModalComponent implements OnInit {
  playlists: Playlist[] = [];
  currentSongId: string | null = null;
  loading = false;


  constructor(
    private modalCtrl: ModalController,
    private playlistService: PlaylistService,
    private audioPlayerService: AudioPlayerService,
    private alertController: AlertController,
    private refreshService: RefreshService
  ) {}

  async ngOnInit() {
    this.currentSongId = this.audioPlayerService.currentSong()?.id || null;
    await this.loadPlaylists();
    this.refreshService.triggerRefresh();
  }

  async loadPlaylists() {
    this.loading = true;
    // Lấy tất cả playlist do người dùng tạo
    this.playlists = (await this.playlistService.getPlaylistsByType('user')) || [];
    this.loading = false;
  }

  isSongInPlaylist(playlist: Playlist): boolean {
    if (!this.currentSongId) return false;
    return playlist.songs?.some(s => s.id === this.currentSongId);
  }

  async onTogglePlaylist(playlist: Playlist, checked: boolean) {
    if (!this.currentSongId) return;
    if (checked) {
      // Thêm bài hát vào playlist
      await this.playlistService.addSongToPlaylist(playlist.id, this.currentSongId);
    } else {
      // Xóa bài hát khỏi playlist
      await this.playlistService.removeSongFromPlaylist(playlist.id, this.currentSongId);
    }
    await this.loadPlaylists();
    this.refreshService.triggerRefresh();
  }


  async showCreatePlaylistAlert() {
    const alert = await this.alertController.create({
      mode: 'ios',
      header: 'Tạo Playlist Mới',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Tên playlist',
          attributes: { required: true },
        },
      ],
      buttons: [
        { text: 'Hủy', role: 'cancel' },
        {
          text: 'Lưu',
          handler: async (data) => {
            if (data.name && data.name.trim()) {
              await this.createArtistPlaylist(data.name.trim());
              return true;
            }
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  private async createArtistPlaylist(name: string) {
    await this.playlistService.createArtistPlaylist({ name });
    await this.loadPlaylists();
  }



  close() {
    this.modalCtrl.dismiss();
  }
}
