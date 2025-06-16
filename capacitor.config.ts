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
    },    Filesystem: {
      // Disable external storage permissions for Directory.Cache usage
      androidRequestWriteExternalStoragePermission: false,
      androidRequestReadExternalStoragePermission: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav",
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      iosKeychainPrefix: 'xtmusic-app',
      iosBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric login for capacitor sqlite',
      },
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false,
        biometricTitle: 'Biometric login for capacitor sqlite',
        biometricSubTitle: 'Log in using your biometric',
      },
      electronIsEncryption: false,
      electronWindowsLocation: 'C:\\ProgramData\\CapacitorDatabases',
      electronMacLocation: '/Volumes/Development_Lacie/Development/Databases',
      electronLinuxLocation: 'Databases',
    },
  },
};

export default config;
