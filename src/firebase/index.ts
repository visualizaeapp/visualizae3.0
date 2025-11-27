import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { type Auth, getAuth, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { type Firestore, getFirestore } from 'firebase/firestore';

// Polyfill localStorage for SSR environments
if (typeof window === 'undefined') {
  // @ts-ignore
  global.localStorage = {
    getItem: () => null,
    setItem: () => { },
    removeItem: () => { },
    clear: () => { },
    key: () => null,
    length: 0
  };
}

// Singleton para garantir que o Firebase seja inicializado apenas uma vez.
let firebaseApp: FirebaseApp | null = null;
let auth: Auth | null = null;
let firestore: Firestore | null = null;

export function initializeFirebaseServices() {
  // Only initialize on the client side
  if (typeof window === 'undefined') {
    return { firebaseApp: null, auth: null, firestore: null };
  }

  if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    firebaseApp = app;
    auth = getAuth(app);
    firestore = getFirestore(app);

    // Set in-memory persistence to avoid localStorage issues
    setPersistence(auth, inMemoryPersistence).catch((error) => {
      console.error('Failed to set Firebase Auth persistence:', error);
    });
  } else {
    const app = getApp();
    firebaseApp = app;
    auth = getAuth(app);
    firestore = getFirestore(app);
  }
  return { firebaseApp, auth, firestore };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';
