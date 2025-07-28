import {
  AfterViewInit,
  Component,
  effect,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { IonModal, IonNav, ModalController } from '@ionic/angular/standalone';
import { IonicModule, Platform } from '@ionic/angular';
import { CurrentPlaylistComponent } from '../current-playlist/current-playlist.component';
import { CommonModule } from '@angular/common';
import { AudioPlayerService } from 'src/app/services/audio-player.service';
import { Song } from 'src/app/interfaces/song.interface';
import { Subject } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Router } from '@angular/router';
import { PlayerPage } from 'src/app/pages/player/player.page';
import { GlobalPlaylistModalService } from 'src/app/services/global-playlist-modal.service';

@Component({
  selector: 'app-mini-player',
  templateUrl: './mini-player.component.html',
  styleUrls: ['./mini-player.component.scss'],
  standalone: true,
  imports: [CurrentPlaylistComponent, CommonModule, IonicModule],
  providers: [ModalController, GlobalPlaylistModalService],
})
export class MiniPlayerComponent implements OnInit, OnDestroy, AfterViewInit {
  private audioPlayerService = inject(AudioPlayerService);
  private platform = inject(Platform);
  private breakpointObserver = inject(BreakpointObserver);
  private router = inject(Router);
  private playlistModalService = inject(GlobalPlaylistModalService);

  @ViewChild('playerModal', { static: false }) playerModal!: IonModal;
  @ViewChild('navPlayer') private navPlayer!: IonNav;
  @ViewChild('playlistModal', { static: false }) playlistModal!: IonModal;
  private destroy$ = new Subject<void>();

  isPlaying = false;
  progressPercentage = 0;

  currentSong: Song | null = null;

  bottomPosition: string =
    this.platform.is('ios') && this.platform.is('pwa')
      ? 'bottom-[75px]'
      : 'bottom-[--h-bottom-tabs]';

  constructor() {}

  ngOnInit() {}

  ngAfterViewInit() {
    // Set modal reference để service có thể control
    this.playlistModalService.setModal(this.playlistModal);
  }

  private playerStateEffect = effect(() => {
    const state = this.audioPlayerService.playbackState();
    this.currentSong = state.currentSong;
    this.isPlaying = state.isPlaying;

    if (state.duration > 0) {
      this.progressPercentage = (state.currentTime / state.duration) * 100;
    }
  });

onWillPresentPlayer() {
  if (this.navPlayer) {
    this.navPlayer.setRoot(PlayerPage);
  }
}

  async previousSong() {
    await this.audioPlayerService.playPrevious();
  }
  async togglePlayPause() {
    await this.audioPlayerService.togglePlayPause();
  }

  async nextSong() {
    await this.audioPlayerService.playNext();
  }

  onImageError(event: any): void {
    event.target.src = 'assets/images/background.webp';
  }

  openPlayerModal() {
    this.breakpointObserver
      .observe([Breakpoints.Tablet, Breakpoints.Web])
      .subscribe((result) => {
        if (result.matches) {
          // Nếu là tablet trở lên
          this.router.navigate(['/player']);
        } else {
          // Nếu là mobile
          this.playerModal.present();
        }
      });
  }

  openPlaylistModal() {
    this.playlistModal.present();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
