import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { IonContent } from "@ionic/angular/standalone";

@Component({
  selector: 'app-find-infor-song-with-file',
  imports: [IonContent],
  templateUrl: './find-infor-song-with-file.component.html',
  styleUrls: ['./find-infor-song-with-file.component.scss'],
})
export class FindInforSongWithFileComponent  implements OnInit {

  constructor(private modalCtrl: ModalController) { }

  ngOnInit() {}
  closeModal() {
    this.modalCtrl.dismiss();
  }
}
