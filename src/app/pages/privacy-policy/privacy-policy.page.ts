import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonToolbar, IonButtons, IonButton, IonTitle } from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { DragBackComponent } from "src/app/components/drag-back/drag-back.component";

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  standalone: true,
  imports: [IonTitle, IonButton, IonButtons, IonToolbar, IonHeader, IonContent, CommonModule, FormsModule, RouterModule, DragBackComponent]
})
export class PrivacyPolicyPage implements OnInit {

  constructor(  private location: Location) { }

  ngOnInit() {


  }


  onBack() {
    this.location.back();
  }

}
