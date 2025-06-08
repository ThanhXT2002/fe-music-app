import { Injectable } from '@angular/core';
import { SafeArea } from 'capacitor-plugin-safe-area';

@Injectable({ providedIn: 'root' })
export class SafeAreaService {
  async applyToContent() {
    const result = await SafeArea.getSafeAreaInsets();
    const content = document.querySelector('ion-app');
    if (content) {
      content.style.setProperty('--padding-top', `${result.insets.top}px`);
      content.style.setProperty('--padding-bottom', `${result.insets.bottom}px`);
      content.style.setProperty('--padding-left', `${result.insets.left}px`);
      content.style.setProperty('--padding-right', `${result.insets.right}px`);
    }
  }
}
