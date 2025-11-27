'use client';

import { useState, useEffect, useRef } from 'react';
import type { DocumentReference, DocumentData, DocumentSnapshot } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface UseDocReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

// Function to check if two document references are equal.
const refsEqual = (r1: DocumentReference | null, r2: DocumentReference | null): boolean => {
  if (!r1 || !r2) return r1 === r2;
  return r1.path === r2.path;
};

export function useDoc<T extends DocumentData>(
  docRef: DocumentReference<T> | null
): UseDocReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const ref = useRef<DocumentReference<T> | null>(docRef);

  // Deep comparison to see if ref has actually changed.
  if (!refsEqual(ref.current, docRef)) {
    ref.current = docRef;
  }

  useEffect(() => {
    if (!ref.current) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      ref.current,
      (snapshot: DocumentSnapshot<T>) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null); // Document doesn't exist
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useDoc onSnapshot error:", err);
        const permissionError = new FirestorePermissionError({
          path: ref.current!.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
        setData(null);
      }
    );

    return () => unsubscribe();
  }, [ref.current]); // Only re-run the effect if the ref changes

  return { data, loading, error };
}
