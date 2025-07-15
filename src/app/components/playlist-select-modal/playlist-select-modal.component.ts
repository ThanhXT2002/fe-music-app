import { Component, OnInit, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalController, AlertController } from '@ionic/angular';
import { PlaylistService } from 'src/app/services/playlist.service';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Playlist } from 'src/app/interfaces/playlist.interface';
import { CommonModule } from '@angular/common';
import { RefreshService } from 'src/app/services/refresh.service';
import { IonContent, IonList } from "@ionic/angular/standalone";

@Component({
  selector: 'app-playlist-select-modal',
  templateUrl: './playlist-select-modal.component.html',
  styleUrls: ['./playlist-select-modal.component.scss'],
  standalone: true,
  imports: [IonList, IonContent, FormsModule, CommonModule],
})
export class PlaylistSelectModalComponent implements OnInit {
  @Input() songId!: string;
  playlists: Playlist[] = [];
  loading = false;


  constructor(
    private modalCtrl: ModalController,
    private playlistService: PlaylistService,
    private alertController: AlertController,
    private refreshService: RefreshService
  ) {}

  async ngOnInit() {
    await this.loadPlaylists();
    // this.refreshService.triggerRefresh();
  }

  async loadPlaylists() {
    this.loading = true;
    // Lấy tất cả playlist do người dùng tạo
    this.playlists = (await this.playlistService.getPlaylistsByType('user')) || [];
    this.loading = false;
  }

  isSongInPlaylist(playlist: Playlist): boolean {
    if (!this.songId) return false;
    return playlist.songs?.some(s => s.id === this.songId);
  }

  async onTogglePlaylist(playlist: Playlist, checked: boolean) {
    if (!this.songId) return;
    if (checked) {
      await this.playlistService.addSongToPlaylist(playlist.id, this.songId);
    } else {
      await this.playlistService.removeSongFromPlaylist(playlist.id, this.songId);
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
