import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'xtmusic.tranxuanthanhtxt.com',
  appName: 'XTMusic',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    allowNavigation: [
      'https://app-music.tranxuanthanhtxt.com', // API chính
      'http://localhost:4800',                 // API local
      'https://i.ytimg.com',                   // Hình ảnh từ YouTube
      'https://img.youtube.com',               // Hình ảnh từ YouTube
    ],
  },
  plugins: {
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#ffffff',
      overlaysWebView: true,
    },
    SafeArea: {
      enabled: false,
      customColorsForSystemNavigation: false,
    },
    SplashScreen: {
      launchShowDuration: 1000,
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
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav',
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
