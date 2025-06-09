import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tranxuanthanhtxt.MusicApp',
  appName: 'XTMusic',
  webDir: 'www',
  plugins: {
    SafeArea: {
      enabled: true,
      customColorsForSystemNavigation: true
    },
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: "#ffffff",
      showSpinner: false,
      androidSpinnerStyle: "small",
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
