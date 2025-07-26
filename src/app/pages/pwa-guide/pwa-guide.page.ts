import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { HeaderComponent } from 'src/app/components/header/header.component';
import { NavbarBottomComponent } from 'src/app/components/navbar-bottom/navbar-bottom.component';
import { BenefitCommonComponent } from './components/benefit-common/benefit-common.component';
import { TabAgentComponent } from './components/tab-agent/tab-agent.component';
import { CautionComponent } from "./components/caution/caution.component";
import { Renderer2, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-pwa-guide',
  templateUrl: './pwa-guide.page.html',
  styleUrls: ['./pwa-guide.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BenefitCommonComponent,
    TabAgentComponent,
    CautionComponent
],
})
export class PwaGuidePage implements AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  private scrollListener?: () => void;
  private noteInterval?: any;
  private noteSymbols = ['♪', '♫', '♬', '♩', '♭', '♮'];
  private noteColors = ['#ff00ff', '#00ffff', '#00ff00', '#ffff00', '#8b5cf6', '#f59e42', '#f43f5e', '#38bdf8'];

  constructor(
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngAfterViewInit(): void {
    // Khôi phục vị trí scroll sau reload, đợi 300ms cho DOM render xong
    setTimeout(() => {
      const y = localStorage.getItem('pwaGuideScrollY');
      if (y && this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = +y;
      }
    }, 300);

    // Lưu scroll realtime khi scroll
    const el = this.scrollContainer?.nativeElement;
    if (el) {
      const handler = () => {
        localStorage.setItem('pwaGuideScrollY', el.scrollTop.toString());
      };
      el.addEventListener('scroll', handler);
      this.scrollListener = () => el.removeEventListener('scroll', handler);
    }

    // Music notes effect
    this.startMusicNotes();
  }

  ngOnDestroy() {
    if (this.scrollListener) this.scrollListener();
    if (this.noteInterval) clearInterval(this.noteInterval);
  }

  private startMusicNotes() {
    const container = this.document.querySelector('.music-notes-container');
    if (!container) return;
    // Tạo nhiều nốt nhạc random liên tục
    this.noteInterval = setInterval(() => {
      // Số lượng mỗi lần, random 1-2 nốt/lần
      const count = Math.floor(Math.random() * 2) + 1;
      for (let i = 0; i < count; i++) {
        this.spawnMusicNote(container as HTMLElement);
      }
    }, 400);
  }

  private spawnMusicNote(container: HTMLElement) {
    // Random vị trí theo viewport (cả chiều dọc dài page)
    const scrollY = window.scrollY || this.document.documentElement.scrollTop;
    const pageHeight = Math.max(
      this.document.body.scrollHeight,
      this.document.documentElement.scrollHeight
    );
    const x = Math.random() * window.innerWidth * 0.95;
    const y = Math.random() * (pageHeight - 100) + 20 - scrollY;
    // Random ký tự và màu
    const symbol = this.noteSymbols[Math.floor(Math.random() * this.noteSymbols.length)];
    const color = this.noteColors[Math.floor(Math.random() * this.noteColors.length)];
    // Random size
    const size = Math.random() * 1.2 + 1.2; // 1.2rem - 2.4rem
    // Tạo element
    const note = this.renderer.createElement('div');
    this.renderer.addClass(note, 'music-note');
    note.textContent = symbol;
    this.renderer.setStyle(note, 'left', `${x}px`);
    this.renderer.setStyle(note, 'top', `${y}px`);
    this.renderer.setStyle(note, 'color', color);
    this.renderer.setStyle(note, 'font-size', `${size}rem`);
    // Random animation duration
    const duration = Math.random() * 1.5 + 3.2; // 3.2s - 4.7s
    this.renderer.setStyle(note, 'animation-duration', `${duration}s`);
    this.renderer.appendChild(container, note);
    // Xóa sau khi animation xong
    setTimeout(() => {
      this.renderer.removeChild(container, note);
    }, duration * 1000);
  }
}
