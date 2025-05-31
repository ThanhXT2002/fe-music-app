export const environment = {
  production: true,
  apiUrl: process.env['API_URL'] || 'https://music-app-api.tranxuanthanh.vn/api/v1',
  firebaseConfig: {
    apiKey: process.env['FIREBASE_API_KEY'] || 'AIzaSyDbBfc6kNnVILMIQsYN_q83HVDDwNrFBuo',
    authDomain: process.env['FIREBASE_AUTH_DOMAIN'] || 'txt-system-90788.firebaseapp.com',
    projectId: process.env['FIREBASE_PROJECT_ID'] || 'txt-system-90788',
    storageBucket: process.env['FIREBASE_STORAGE_BUCKET'] || 'txt-system-90788.firebasestorage.app',
    messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID'] || '403716398920',
    appId: process.env['FIREBASE_APP_ID'] || '1:403716398920:web:daf2be700aa20f9cba5d7d',
    measurementId: process.env['FIREBASE_MEASUREMENT_ID'] || 'G-TVYQ5L8G7B',
  },
};
