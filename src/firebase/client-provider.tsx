
'use client';

import React, { type ReactNode, useState, useEffect, useMemo } from 'react';
import { FirebaseContext } from '@/firebase/provider';
import { initializeFirebaseServices } from '@/firebase';
import { type Auth, type User as FirebaseUser } from 'firebase/auth';
import { type Firestore, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { type FirebaseApp } from 'firebase/app';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { type User } from '@/types';
import { FirestorePermissionError } from './errors';
import { errorEmitter } from './error-emitter';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [services, setServices] = useState<{
    firebaseApp: FirebaseApp | null;
    auth: Auth | null;
    firestore: Firestore | null;
  }>({ firebaseApp: null, auth: null, firestore: null });

  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  // Initialize Firebase services only once, and only on the client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initializedServices = initializeFirebaseServices();
    setServices(initializedServices);
  }, []);

  const { auth, firestore } = services;

  // Manage authentication state and user data from Firestore.
  useEffect(() => {
    if (!auth || !firestore) {
      setIsUserLoading(!auth); // If auth is null, we stop loading.
      return;
    }

    const unsubscribeAuth = auth.onAuthStateChanged(firebaseUser => {
      if (firebaseUser) {
        const userRef = doc(firestore, 'users', firebaseUser.uid);

        // Listen for changes on the main user document
        const unsubscribeUser = onSnapshot(userRef,
          (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data();
              const userData: User = {
                ...data,
                uid: firebaseUser.uid,
                // Make sure to handle Firestore Timestamps
                stripeCurrentPeriodEnd: data.stripeCurrentPeriodEnd?.toDate(),
              } as User;

              if (data.displayName !== firebaseUser.displayName || data.photoURL !== firebaseUser.photoURL) {
                updateDoc(userRef, {
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                }).catch(e => console.error("Failed to update user's latest profile info", e));
              }

              setUser(userData);
            } else {
              // Create new user document if it doesn't exist
              const newUser: Omit<User, 'uid'> = {
                displayName: firebaseUser.displayName,
                email: firebaseUser.email,
                photoURL: firebaseUser.photoURL,
                credits: 20,
                renderCount: 0,
                theme: 'dark', // Default theme
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                stripePriceId: null,
                stripeCurrentPeriodEnd: null,
              };
              setDoc(userRef, newUser).catch((error) => {
                console.error("Error creating user document:", error);
                const contextualError = new FirestorePermissionError({
                  path: userRef.path,
                  operation: 'create',
                  requestResourceData: newUser,
                });
                errorEmitter.emit('permission-error', contextualError);
              });
            }
            setIsUserLoading(false);
          },
          (error) => {
            console.error("Error fetching user profile:", error);
            const contextualError = new FirestorePermissionError({ path: userRef.path, operation: 'get' });
            errorEmitter.emit('permission-error', contextualError);
            setUser(null);
            setIsUserLoading(false);
          }
        );

        return () => {
          unsubscribeUser();
        };
      } else {
        setUser(null);
        setIsUserLoading(false);
      }
    });

    return () => unsubscribeAuth(); // Cleanup auth listener
  }, [auth, firestore]);

  const contextValue = useMemo(() => ({
    ...services,
    user,
    isUserLoading,
  }), [services, user, isUserLoading]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
}
