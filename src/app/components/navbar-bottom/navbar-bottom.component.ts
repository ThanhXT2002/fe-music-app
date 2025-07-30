import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonFooter, IonToolbar } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar-bottom',
  imports: [IonFooter, IonToolbar, RouterLinkActive, CommonModule, RouterLink],
  templateUrl: './navbar-bottom.component.html',
  styleUrls: ['./navbar-bottom.component.scss'],
})
export class NavbarBottomComponent {
  hTookbar: string =
    this.platform.is('ios') && this.platform.is('pwa') ? 'h-[75px]' : '';

  tabs = [
    {
      link: '/',
      icon: 'fa-house',
      label: 'Trang chủ',
    },
    {
      link: '/list',
      icon: 'fa-list',
      label: 'Danh sách',
    },
    {
      link: '/playlists',
      icon: 'fa-wave-square',
      label: 'Playlist',
    },
    {
      link: '/downloads',
      icon: 'fa-download',
      label: 'Tải xuống',
    },
    {
      link: '/settings',
      icon: 'fa-user-gear',
      label: 'Cài đặt',
    },
  ];

  constructor(private platform: Platform) {}
}
