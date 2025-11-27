
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Sparkles, Feather, Waves, Mountain } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc } from 'firebase/firestore';

export type Theme = 'light' | 'dark' | 'nude' | 'ocean' | 'rainbow' | 'stone';

export default function ThemeToggleButton({ onThemeChange }: { onThemeChange?: (theme: Theme) => void }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const { user } = useUser();
  const firestore = useFirestore();

  // Effect to set initial theme from user preference or localStorage
  useEffect(() => {
    let initialTheme: Theme = 'dark'; // Default to dark
    if (user?.theme) {
      initialTheme = user.theme;
    } else {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const savedTheme = window.localStorage.getItem('theme') as Theme | null;
          if (savedTheme) {
            initialTheme = savedTheme;
          }
        }
      } catch (e) {
        console.warn('Failed to access localStorage:', e);
      }
    }
    document.documentElement.className = initialTheme;
    setTheme(initialTheme);
  }, [user]);

  // Effect to notify parent component of theme change
  useEffect(() => {
    onThemeChange?.(theme);
  }, [theme, onThemeChange]);

  const toggleTheme = async () => {
    const themeCycle: Theme[] = ['dark', 'stone', 'rainbow', 'ocean', 'light', 'nude'];
    const currentIndex = themeCycle.indexOf(theme);
    const newTheme = themeCycle[(currentIndex + 1) % themeCycle.length];

    document.documentElement.className = newTheme;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('theme', newTheme);
      }
    } catch (e) {
      console.warn('Failed to save theme to localStorage:', e);
    }

    setTheme(newTheme);

    // Save to Firestore if user is logged in
    if (user && firestore) {
      const userRef = doc(firestore, 'users', user.uid);
      try {
        await updateDoc(userRef, { theme: newTheme });
      } catch (error) {
        console.error("Failed to save theme preference:", error);
      }
    }
  };

  const getIcon = () => {
    if (theme === 'light') return <Sun className="h-4 w-4" />;
    if (theme === 'dark') return <Moon className="h-4 w-4" />;
    if (theme === 'nude') return <Feather className="h-4 w-4" />;
    if (theme === 'ocean') return <Waves className="h-4 w-4" />;
    if (theme === 'stone') return <Mountain className="h-4 w-4" />;
    return <Sparkles className="h-4 w-4" />;
  };

  const getTooltipText = () => {
    const tooltips: Record<Theme, string> = {
      dark: 'Mudar para tema Pedra',
      stone: 'Mudar para tema Espectro',
      rainbow: 'Mudar para tema Oceano',
      ocean: 'Mudar para Tema Índigo',
      light: 'Mudar para Tema Nude',
      nude: 'Mudar para Tema Lua',
    }
    return tooltips[theme];
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={toggleTheme} aria-label="Alterar tema">
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
