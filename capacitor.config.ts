import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tranxuanthanhtxt.MusicApp',
  appName: 'XTMusic',
  webDir: 'www',
  plugins: {
    SafeArea: {
      enabled: true,
      customColorsForSystemNavigation: true
    },    SplashScreen: {
      launchShowDuration: 5000, // Tăng lên 5 giây
      launchAutoHide: false,
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
