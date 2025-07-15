import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnInit } from '@angular/core';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { ModalController, IonicModule } from '@ionic/angular';
import { DownloadService } from 'src/app/services/download.service';

@Component({
  selector: 'app-btn-add-playlist',
  imports: [CommonModule,IonicModule],
  templateUrl: './btn-add-playlist.component.html',
  styleUrls: ['./btn-add-playlist.component.scss'],
})
export class BtnAddPlaylistComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private downloadService = inject(DownloadService);
  @Input() songId!: string;

  constructor() {}

ngOnInit() {

}

  isDownloaded(): boolean {
    return this.downloadService.isSongDownloaded(this.songId);
  }

  async toggleAddPlaylist() {

    if (!this.songId) return
    try {
      // Import động component modal danh sách playlist
      const { PlaylistSelectModalComponent } = await import(
        '../playlist-select-modal/playlist-select-modal.component'
      );
      const modal = await this.modalCtrl.create({
        component: PlaylistSelectModalComponent,
        componentProps: {
          songId: this.songId
        },
        presentingElement: undefined,
        breakpoints: [0, 0.6, 1],
        initialBreakpoint: 0.6,
        handle: true,
        backdropDismiss: true,
        mode: 'ios',
      });
      await modal.present();
    } catch (error) {
      console.error('Error opening playlist select modal:', error);
    }
  }
}
