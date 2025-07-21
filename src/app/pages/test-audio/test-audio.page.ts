import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonLabel, IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-test-audio',
  templateUrl: './test-audio.page.html',
  styleUrls: ['./test-audio.page.scss'],
  standalone: true,
  imports: [IonButton, IonLabel, IonItem, IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class TestAudioPage implements OnInit {

  audioUrl: string = '';
  @ViewChild('audioPlayer', { static: false }) audioPlayer!: ElementRef<HTMLAudioElement>;

  playAudio() {
    if (this.audioPlayer && this.audioUrl) {
      this.audioPlayer.nativeElement.src = this.audioUrl;
      this.audioPlayer.nativeElement.load();
      this.audioPlayer.nativeElement.play();
    }
  }

  ngOnInit(): void {

  }

}
