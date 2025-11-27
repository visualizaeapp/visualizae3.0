'use client';

import React, { createContext, useContext } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import type { User } from '@/types';

export interface FirebaseContextState {
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
  user: User | null;
  isUserLoading: boolean;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export function useFirebaseInternal() {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebaseInternal must be used within a FirebaseProvider.');
    }
    return context;
}

export const useAuth = (): Auth | null => useFirebaseInternal().auth;
export const useFirestore = (): Firestore | null => useFirebaseInternal().firestore;
export const useFirebaseApp = (): FirebaseApp | null => useFirebaseInternal().firebaseApp;
