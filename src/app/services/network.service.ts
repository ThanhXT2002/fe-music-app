import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private networkStatus$ = new BehaviorSubject<boolean>(true);

  constructor() {
    this.initializeNetworkListener();
  }

  async initializeNetworkListener() {
    // Get initial network status
    const status = await Network.getStatus();
    this.networkStatus$.next(status.connected);

    // Listen for network changes
    Network.addListener('networkStatusChange', (status) => {
      console.log('Network status changed:', status);
      this.networkStatus$.next(status.connected);
    });
  }

  get isOnline$() {
    return this.networkStatus$.asObservable();
  }

  async isOnline(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch (error) {
      console.error('Error checking network status:', error);
      return true; // Default to true if can't check
    }
  }

  async getNetworkInfo() {
    try {
      return await Network.getStatus();
    } catch (error) {
      console.error('Error getting network info:', error);
      return null;
    }
  }
}
