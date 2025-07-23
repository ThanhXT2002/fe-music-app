
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../services/loading.service';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LottieComponent } from "ngx-lottie";

@Component({
  selector: 'app-loading',
  templateUrl: './loading.component.html',
  styleUrls: ['./loading.component.scss'],
  imports: [CommonModule, LottieComponent],
})
export class LoadingComponent {
  // Path to animation JSON
  animationPath = 'assets/animations/ripple-loading-animation.json';

  constructor(public loadingService: LoadingService) {}

  // Expose loading state for template
  get loading() {
    return this.loadingService.loading();
  }
}
