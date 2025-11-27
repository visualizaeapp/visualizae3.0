
'use client';

import { UserButton } from '@/components/auth/user-button';
import ToolOptionsMessage from './tool-options-message';
import Link from 'next/link';
import { AppLogo } from '../icons';
import ThemeToggleButton, { Theme } from './theme-toggle-button';
import FullscreenButton from './fullscreen-button';
import { useEditor } from '@/hooks/use-editor-store';
import { Film, Loader, Banana } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUser } from '@/firebase';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { ClientOnly } from './client-only';


const MobileGenerationIndicator = () => {
  const { generationJobs } = useEditor();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const activeJob = generationJobs.find(job => job.status === 'generating');
  if (!activeJob) return null;

  const jobIndex = activeJob.jobIndexInBatch ?? 0;
  const totalJobs = activeJob.totalJobsInBatch ?? 1;

  return (
    <div className="flex items-center gap-2 text-sm text-primary font-semibold animate-pulse">
      <Loader className="h-4 w-4 animate-spin" />
      <span>{jobIndex + 1}/{totalJobs}</span>
    </div>
  );
};

export default function Header({ projectId, onThemeChange }: { projectId: string, onThemeChange: (theme: Theme) => void }) {
  const { user, isUserLoading } = useUser();
  const { setIsRecordingSetupOpen, isProMode, setIsProMode } = useEditor();
  const isDeveloper = user?.email === 'visualizaeapp@gmail.com';

  return (
    // This header is now only for mobile/tablet portrait view.
    // Desktop and landscape views are handled in the main layout.
    <header className="flex h-14 items-center justify-between border-b border-border px-4 shrink-0 gap-4 lg:hidden landscape:hidden">
      <div className='flex items-center gap-3'>
        <Link href="/" className="flex items-center gap-3">
          <AppLogo className="h-6 w-auto" />
          <h1 className="text-xl font-semibold font-headline tracking-wide text-primary">
            Visualizae
          </h1>
        </Link>
        <ClientOnly>
          <MobileGenerationIndicator />
        </ClientOnly>
      </div>
      <div className="flex justify-end items-center gap-2">
        <ClientOnly>
          <Button
            variant={isProMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsProMode(!isProMode)}
            className="gap-2 h-8"
          >
            {isProMode ? (
              <>
                <Banana className="h-4 w-4" />
                <span>Pro 4.2MP</span>
              </>
            ) : (
              <>
                <Banana className="h-4 w-4" />
                <span>Nano 1.1MP</span>
              </>
            )}
          </Button>
        </ClientOnly>
        <TooltipProvider>
          {!isUserLoading && isDeveloper && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsRecordingSetupOpen(true)}
                >
                  <Film className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Gravar Vídeo</p>
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
        <FullscreenButton />
        <ThemeToggleButton onThemeChange={onThemeChange} />
        <UserButton />
      </div>
    </header>
  );
}
