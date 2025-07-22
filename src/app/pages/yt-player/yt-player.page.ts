import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { YtPlayerService } from '../../services/yt-player.service';
import { Song } from '../../interfaces/song.interface';

@Component({
  selector: 'app-yt-player',
  templateUrl: './yt-player.page.html',
  styleUrls: ['./yt-player.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class YtPlayerPage implements OnInit {
  @ViewChild('ytIframe', { static: false }) ytIframe?: ElementRef<HTMLIFrameElement>;

  videoId: string = '';
  playlist: Song[] = [];
  currentIndex: number = 0;
  currentSong: Song | null = null;
  isPlaying: boolean = true;
  safeVideoUrl: SafeResourceUrl = '';

  constructor(
    private route: ActivatedRoute,
    private ytPlayerService: YtPlayerService,
    private sanitizer: DomSanitizer,
    private router: Router ,
  ) {}

  ngOnInit() {
    // Lấy videoId từ route
    this.route.paramMap.subscribe(params => {
      this.videoId = params.get('videoId') || '';
      // Lấy playlist và index hiện tại từ service
      this.playlist = this.ytPlayerService['playlistSubject'].getValue();
      this.currentIndex = this.playlist.findIndex(s => s.id === this.videoId);
      this.currentSong = this.playlist[this.currentIndex] || null;
      this.isPlaying = true;
      this.updateSafeUrl();
    });
  }

  updateSafeUrl() {
    this.safeVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${this.videoId}?autoplay=1&enablejsapi=1`);
  }

  // Điều khiển phát nhạc
  play() {
    this.isPlaying = true;
    this.ytPlayerService.play();
    this.updateSafeUrl();
  }

  pause() {
    this.isPlaying = false;
    this.ytPlayerService.pause();
    // Không reload iframe, chỉ cập nhật trạng thái
  }

  next() {
    if (this.currentIndex < this.playlist.length - 1) {
      this.currentIndex++;
      this.currentSong = this.playlist[this.currentIndex];
      this.videoId = this.currentSong.id;
      this.isPlaying = true;
      this.ytPlayerService.goToSong(this.currentIndex);
      this.updateSafeUrl();
    }
  }

  previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentSong = this.playlist[this.currentIndex];
      this.videoId = this.currentSong.id;
      this.isPlaying = true;
      this.ytPlayerService.goToSong(this.currentIndex);
      this.updateSafeUrl();
    }
  }


  onIframeEnded() {
    this.next();
  }


  getCurrentSongInfo() {
    return this.currentSong;
  }

  getPlaylist() {
    return this.playlist;
  }

  getPlayerState() {
    return this.isPlaying ? 'playing' : 'paused';
  }

  handleBack(){
    this.router.navigate(['/search']);
  }
}
