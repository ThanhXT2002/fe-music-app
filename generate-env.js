const fs = require('fs');
const path = require('path');

const envDir = './src/environments';
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Development environment file (default values)
const devEnvContent = `export const environment = {
  production: false,
  apiUrl: '${process.env.DEV_API_URL || 'http://localhost:8000/api'}',
  appVersion: require('../../package.json').version,
  firebaseConfig: {
    apiKey: '${process.env.FIREBASE_API_KEY || 'AIzaSyDbBfc6kNnVILMIQsYN_q83HVDDwNrFBuo'}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN || 'txt-system-90788.firebaseapp.com'}',
    projectId: '${process.env.FIREBASE_PROJECT_ID || 'txt-system-90788'}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET || 'txt-system-90788.firebasestorage.app'}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID || '403716398920'}',
    appId: '${process.env.FIREBASE_APP_ID || '1:403716398920:web:daf2be700aa20f9cba5d7d'}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || 'G-TVYQ5L8G7B'}',
  },
  appName: 'XTMusic',
  emailSupport: 'tranxuanthanhtxt2002@gmail.com',
  fbAppId: '24147476401529487',
};`;

// Production environment file
const prodEnvContent = `export const environment = {
  production: true,
  apiUrl: '${process.env.API_URL || 'http://api-music.tranxuanthanh.vn/api/v3'}',
  appVersion: require('../../package.json').version,
  firebaseConfig: {
    apiKey: '${process.env.FIREBASE_API_KEY || 'AIzaSyDbBfc6kNnVILMIQsYN_q83HVDDwNrFBuo'}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN || 'txt-system-90788.firebaseapp.com'}',
    projectId: '${process.env.FIREBASE_PROJECT_ID || 'txt-system-90788'}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET || 'txt-system-90788.firebasestorage.app'}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID || '403716398920'}',
    appId: '${process.env.FIREBASE_APP_ID || '1:403716398920:web:daf2be700aa20f9cba5d7d'}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || 'G-TVYQ5L8G7B'}',
  },
  appName: 'XTMusic',
  emailSupport: 'tranxuanthanhtxt2002@gmail.com',
  fbAppId: '24147476401529487',
};`;

// Write both environment files
fs.writeFileSync('./src/environments/environment.ts', devEnvContent);
fs.writeFileSync('./src/environments/environment.prod.ts', prodEnvContent);
