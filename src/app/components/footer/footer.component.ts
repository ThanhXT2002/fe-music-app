import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class FooterComponent implements OnInit {

  isShowingFooter: boolean = true;

  constructor(private platform: Platform) {
    if(Capacitor.isNativePlatform() || this.platform.is('pwa')) {
      this.isShowingFooter = false
    }
   }

  ngOnInit() {

  }

}
