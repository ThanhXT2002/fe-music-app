import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tranxuanthanhtxt.MusicApp',
  appName: 'XTMusic',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SafeArea: {
      enabled: true,
      customColorsForSystemNavigation: true
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      androidSpinnerStyle: "small",
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
