'use client';
import { useContext } from 'react';
import { EditorContext } from '@/components/editor/editor-provider';
import type { EditorContextType } from '@/types';

export const useEditor = (): Omit<EditorContextType, 'setApiKey' | 'getApiKey'> => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }

  return context;
};
