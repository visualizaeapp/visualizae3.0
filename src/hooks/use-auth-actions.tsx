'use client';

import { AuthActionsContext } from '@/providers/auth-provider';
import { useContext } from 'react';

export const useAuthActions = () => {
  const context = useContext(AuthActionsContext);
  if (context === undefined) {
    throw new Error('useAuthActions must be used within an AuthActionsProvider');
  }
  return context;
};
