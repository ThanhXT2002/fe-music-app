import { Injectable } from '@angular/core';
import { IonModal } from '@ionic/angular/standalone';

@Injectable({
  providedIn: 'root'
})
export class GlobalPlaylistModalService {

  private modal?: IonModal;

  setModal(modal: IonModal) {
    this.modal = modal;
  }

  async open() {
    await this.modal?.present();
  }

  async close() {
    await this.modal?.dismiss();
  }
}
