'use client';

import { useState, useEffect, useRef } from 'react';
import type { Query, DocumentData, QuerySnapshot } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface UseCollectionReturn<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
}

// Function to check if two queries are equal.
// This is important to prevent re-subscribing on every render.
const queriesEqual = (q1: Query | null, q2: Query | null): boolean => {
  if (!q1 || !q2) return q1 === q2;
  return (
    'path' in q1 && 'path' in q2 && (q1 as any).path === (q2 as any).path &&
    JSON.stringify((q1 as any)._query) === JSON.stringify((q2 as any)._query)
  );
};


export function useCollection<T extends DocumentData>(
  query: Query<T> | null
): UseCollectionReturn<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const queryRef = useRef<Query<T> | null>(query);

  // Deep comparison to see if query has actually changed.
  if (!queriesEqual(queryRef.current, query)) {
    queryRef.current = query;
  }

  useEffect(() => {
    // If the query is null or undefined, don't do anything.
    if (!queryRef.current) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      queryRef.current,
      (snapshot: QuerySnapshot<T>) => {
        const result = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setData(result);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useCollection onSnapshot error:", err);
        const permissionError = new FirestorePermissionError({
          path: ('path' in queryRef.current!) ? (queryRef.current as any).path : 'unknown',
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(permissionError);
        setLoading(false);
        setData(null);
      }
    );

    // Unsubscribe from the listener when the component unmounts
    return () => unsubscribe();
  }, [queryRef.current]); // Only re-run the effect if the query reference changes

  return { data, loading, error };
}