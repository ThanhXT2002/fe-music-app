import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonFooter, IonToolbar } from '@ionic/angular/standalone';
import { Platform } from '@ionic/angular';
import { CommonModule } from '@angular/common';

/**
 * Component thanh điều hướng chính nằm cố định ở mép dưới thiết bị (Bottom Navigation Bar).
 *
 * Chức năng:
 * - Chứa các Tab để người dùng chuyển đổi qua lại giữa các luồng chức năng lõi (Home, Library, Downloader, Vv).
 * - Cung cấp khả năng tự động canh lề an toàn nhằm tránh đè lên thanh Home bar (tai thỏ) của thiết bị iOS.
 */
@Component({
  selector: 'app-navbar-bottom',
  imports: [IonFooter, IonToolbar, RouterLinkActive, CommonModule, RouterLink],
  templateUrl: './navbar-bottom.component.html',
  styleUrls: ['./navbar-bottom.component.scss'],
})
export class NavbarBottomComponent {
  // ─────────────────────────────────────────────────────────
  // Properties 
  // ─────────────────────────────────────────────────────────
  /** 
   * Class CSS tùy chỉnh bù trừ 75px.
   * Áp dụng bắt buộc trên nền tảng web iOS/PWA để phòng tránh Home Indicator che mất nút bấm. 
   */
  hTookbar: string =
    this.platform.is('ios') && this.platform.is('pwa') ? 'h-[75px]' : '';

  /** Bộ cấu hình hiển thị cho các nút tab gồm Link trỏ đến, icon và Label */
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

  // ─────────────────────────────────────────────────────────
  // Constructor
  // ─────────────────────────────────────────────────────────
  constructor(private platform: Platform) {}
}
