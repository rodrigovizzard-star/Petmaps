import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase SDK
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const isFirebaseConfigured = !!firebaseConfig.apiKey && 
  firebaseConfig.apiKey.startsWith('AIza');

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Messaging can fail in some environments (like iframes or unsupported browsers)
let messagingInstance = null;
if (typeof window !== 'undefined') {
  try {
    messagingInstance = getMessaging(app);
  } catch (error) {
    console.warn('Firebase Messaging not supported in this environment:', error);
  }
}

export const messaging = messagingInstance as any;

export { firebaseConfig, isFirebaseConfigured };
