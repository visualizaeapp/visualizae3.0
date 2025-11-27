'use client';

import { useFirebaseInternal } from '@/firebase/provider';
import { User } from '@/types';

interface UseUserReturn {
  user: User | null;
  isUserLoading: boolean;
}

export function useUser(): UseUserReturn {
  const { user, isUserLoading } = useFirebaseInternal();
  return { user, isUserLoading };
}
