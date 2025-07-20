const fs = require('fs');
const path = require('path');

const envDir = './src/environments';
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
}

// Development environment file (default values)
const devEnvContent = `export const environment = {
  production: false,
  apiUrl: '${process.env.DEV_API_URL || ''}',
  appVersion: require('../../package.json').version,
  firebaseConfig: {
    apiKey: '${process.env.FIREBASE_API_KEY || ''}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN || ''}',
    projectId: '${process.env.FIREBASE_PROJECT_ID || ''}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET || ''}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}',
    appId: '${process.env.FIREBASE_APP_ID || ''}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || ''}',
  },
  appName: 'XTMusic',
  emailSupport: 'tranxuanthanhtxt2002@gmail.com',
  fbAppId: '${process.env.FB_APP_ID || ''}',
};`;

// Production environment file
const prodEnvContent = `export const environment = {
  production: true,
  apiUrl: '${process.env.API_URL || ''}',
  appVersion: require('../../package.json').version,
  firebaseConfig: {
    apiKey: '${process.env.FIREBASE_API_KEY || ''}',
    authDomain: '${process.env.FIREBASE_AUTH_DOMAIN || ''}',
    projectId: '${process.env.FIREBASE_PROJECT_ID || ''}',
    storageBucket: '${process.env.FIREBASE_STORAGE_BUCKET || ''}',
    messagingSenderId: '${process.env.FIREBASE_MESSAGING_SENDER_ID || ''}',
    appId: '${process.env.FIREBASE_APP_ID || ''}',
    measurementId: '${process.env.FIREBASE_MEASUREMENT_ID || ''}',
  },
  appName: 'XTMusic',
  emailSupport: 'tranxuanthanhtxt2002@gmail.com',
  fbAppId: '${process.env.FB_APP_ID || ''}',
};`;

// Write both environment files
fs.writeFileSync('./src/environments/environment.ts', devEnvContent);
fs.writeFileSync('./src/environments/environment.prod.ts', prodEnvContent);
