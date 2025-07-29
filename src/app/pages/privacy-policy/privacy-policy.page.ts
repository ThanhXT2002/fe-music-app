import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DragBackComponent } from "src/app/components/drag-back/drag-back.component";

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.page.html',
  styleUrls: ['./privacy-policy.page.scss'],
  standalone: true,
  imports: [ CommonModule, FormsModule, RouterModule, DragBackComponent]
})
export class PrivacyPolicyPage implements OnInit {

  constructor(  ) { }

  ngOnInit() {

  }


}
