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
],
})
export class PwaGuidePage implements AfterViewInit, OnDestroy {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  private scrollListener?: () => void;

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
  }

  ngOnDestroy() {
    if (this.scrollListener) this.scrollListener();
  }
}
