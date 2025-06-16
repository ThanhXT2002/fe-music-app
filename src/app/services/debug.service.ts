import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class DebugService {

  initEruda(): void {
    // Double check - chỉ load khi là native và development
    if (!Capacitor.isNativePlatform()) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/eruda';
      script.onload = () => {
        (window as any).eruda?.init();
      };
      document.head.appendChild(script);
    }
  }
}
