import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-oops-404',
  templateUrl: './oops-404.page.html',
  styleUrls: ['./oops-404.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink]
})
export class Oops404Page implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
