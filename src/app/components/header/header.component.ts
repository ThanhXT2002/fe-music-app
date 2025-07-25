import { Component, OnInit, ViewChild } from '@angular/core';
import { IonHeader, IonModal, IonContent,IonNav } from "@ionic/angular/standalone";
import { RouterLink, Router } from '@angular/router';
import { SearchPage } from 'src/app/pages/search/search.page';
import { Location } from '@angular/common';
import { ModalController } from '@ionic/angular';
@Component({
  selector: 'app-header',
  imports: [  IonHeader, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
    @ViewChild('navSearch') private navSearch!: IonNav;

  constructor(
    private router: Router,
    private modalCtrl: ModalController,

  ) { }

  ngOnInit() {}


  async toggleFindSongByAudio() {
    try {
      // Import động component modal danh sách playlist
      const { FindInforSongWithFileComponent } = await import(
        '../find-infor-song-with-file/find-infor-song-with-file.component'
      );
      const modal = await this.modalCtrl.create({
        component: FindInforSongWithFileComponent,
        presentingElement: undefined,
        breakpoints: [0, 0.9],
        handle: true,
        backdropDismiss: true,
        mode: 'ios',
      });
      await modal.present();
    } catch (error) {
      console.error('Error opening playlist select modal:', error);
    }
  }

  navToSearch(){
    // Lưu url hiện tại vào localStorage
    localStorage.setItem('back-search', this.router.url);
    this.router.navigate(['/search']);
  }
}
