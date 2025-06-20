import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tranxuanthanhtxt.MusicApp',
  appName: 'XTMusic',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'https://i.ytimg.com',
      'https://img.youtube.com']
  },  plugins: {
    Keyboard: {
      resize: "none",
      resizeOnFullScreen: false
    },
    StatusBar: {
      style: "default"
    },
    SafeArea: {
      enabled: true,
      customColorsForSystemNavigation: true,
    },
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Filesystem: {
      androidRequestWriteExternalStoragePermission: true,
      androidRequestReadExternalStoragePermission: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav",
    }
  },
};

export default config;
