import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class DebugService {

  // Remove this line - domain is already included in allowedDomains array
  lockDomains = [
    'app-music.tranxuanthanhtxt.com',
  ];

  // initEruda(): void {
  //   // Double check - chỉ load khi là native và development và domain được phép
  //   if (!Capacitor.isNativePlatform() || !this.isLockDomain()) {
  //     const script = document.createElement('script');
  //     script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  //     script.onload = () => {
  //       (window as any).eruda?.init();
  //     };
  //     document.head.appendChild(script);
  //   }
  // }

  // private isLockDomain(): boolean {
  //   const currentDomain = window.location.origin;
  //   return this.lockDomains.includes(currentDomain);
  // }
}
