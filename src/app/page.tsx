'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLogo } from '@/components/icons';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      const newProjectId = crypto.randomUUID();
      router.push(`/editor/${newProjectId}`);
    }, 1500); // Wait for 1.5 seconds before redirecting

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center p-4">
      <div className="flex animate-fade-in-out items-center gap-4">
        <div className="w-16 h-16 md:w-20 md:h-20">
            <AppLogo />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
          Visualizae
        </h1>
      </div>
    </div>
  );
}
