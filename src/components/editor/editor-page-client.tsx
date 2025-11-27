
'use client';

import React, { useEffect, useState, useRef } from 'react';
import CanvasArea from '@/components/editor/canvas/canvas-area';
import RightPanel from '@/components/editor/right-panel';
import Toolbar from '@/components/editor/toolbar';
import Header from '@/components/layout/header';
import AspectRatioAdjustDialog from '@/components/editor/aspect-ratio-adjust-dialog';
import EnhanceGroupDialog from '@/components/editor/enhance-group-dialog';
import RenderLayerDialog from '@/components/editor/render-layer-dialog';
import SelectionActions from '@/components/editor/selection-actions';
import MobileLayersPanel from '@/components/editor/mobile-layers-panel';
import { useEditor } from '@/hooks/use-editor-store';
import ToolOptionsMessage from '@/components/layout/tool-options-message';
import Link from 'next/link';
import { AppLogo } from '@/components/icons';
import { UserButton } from '@/components/auth';
import ThemeToggleButton from '@/components/layout/theme-toggle-button';
import type { Theme } from '@/components/layout/theme-toggle-button';
import { Button } from '@/components/ui/button';
import { Film, Loader, CheckCircle, AlertTriangle, Banana } from 'lucide-react';
import { Toast, ToastProvider, ToastViewport, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { Progress } from '@/components/ui/progress';
import FullscreenButton from '@/components/layout/fullscreen-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { syncStripeSubscription } from '@/app/actions/stripe-actions';
import { useToast } from '@/hooks/use-toast';
import ScreenRecorder from '@/components/editor/screen-recorder';
import RecordingSetupDialog from '@/components/editor/recording-setup-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ToolOptions from '@/components/editor/tool-options';


const GenerationToastController = () => {
  const { generationJobs } = useEditor();
  const isMobile = useIsMobile();

  // On mobile, the indicator is in the header, not a toast.
  if (isMobile) return null;

  const activeJob = generationJobs.find(job => job.status === 'generating');
  const lastCompletedJob = generationJobs.find(job => job.status === 'completed' && !job.isShown);
  const lastErrorJob = generationJobs.find(job => job.status === 'error' && !job.isShown);

  const jobToShow = activeJob || lastCompletedJob || lastErrorJob;

  if (!jobToShow) return null;

  let title = '';
  let icon = <Loader className="h-5 w-5 animate-spin text-primary" />;

  const getVariationNumber = () => {
    if (jobToShow.totalJobsInBatch && jobToShow.totalJobsInBatch > 1) {
      return jobToShow.jobIndexInBatch !== undefined ? jobToShow.jobIndexInBatch + 1 : null;
    }
    return null;
  };

  const variationNumber = getVariationNumber();

  switch (jobToShow.status) {
    case 'generating':
      title = variationNumber
        ? `Gerando Variação ${variationNumber}...`
        : 'Gerando Variação...';
      icon = <Loader className="h-5 w-5 animate-spin text-primary" />;
      break;
    case 'completed':
      title = variationNumber
        ? `Variação ${variationNumber} Criada!`
        : 'Variação Criada!';
      icon = <CheckCircle className="h-5 w-5 text-green-500" />;
      break;
    case 'error':
      title = variationNumber
        ? `Falha na Variação ${variationNumber}`
        : 'Falha na Geração';
      icon = <AlertTriangle className="h-5 w-5 text-destructive" />;
      break;
  }

  return (
    <Toast key={jobToShow.id} duration={jobToShow.status === 'completed' || jobToShow.status === 'error' ? 5000 : Infinity}>
      <div className="flex items-center gap-3 w-full">
        {icon}
        <div className='flex-1 space-y-1'>
          <ToastTitle>{title}</ToastTitle>
          {jobToShow.status === 'generating' && jobToShow.progress > 0 && <Progress value={jobToShow.progress} className="h-1.5" />}
          {jobToShow.status === 'error' && <ToastDescription className='text-xs text-destructive truncate'>{jobToShow.error}</ToastDescription>}
        </div>
      </div>
    </Toast>
  );
};


// This component contains all the original client-side logic and UI.
export default function EditorPageClient({ projectId }: { projectId: string }) {
  const {
    centerAndZoom,
    backgroundLayer,
    setSelectedLayerIds,
    setSelection,
    setIsSelectionActionMenuVisible,
    setSelectionDivisionPreview,
    setLassoPoints,
    setIsRecordingSetupOpen,
    isRecording,
    isProMode,
    setIsProMode,
  } = useEditor();
  const [theme, setTheme] = useState<Theme>('light');
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const { user, isUserLoading } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    // We only want to run sync if there's a session ID, a user, and we aren't already syncing.
    if (sessionId && user && !isUserLoading && isSyncing) {
      const handleSync = async () => {
        const { id } = toast({
          title: 'Sincronizando sua assinatura...',
          description: 'Aguarde enquanto atualizamos seus dados.',
          duration: Infinity,
        });

        const result = await syncStripeSubscription(sessionId, user.uid);

        toast({
          id,
          title: result.success ? 'Assinatura Ativada!' : 'Falha na Sincronização',
          description: result.success ? 'Seu plano e créditos foram atualizados com sucesso.' : result.error,
          variant: result.success ? 'default' : 'destructive',
          duration: 5000,
        });

        // Clean up URL and state
        router.replace(`/editor/${projectId}`, { scroll: false });
        setIsSyncing(false);
      };
      handleSync();
    } else if (!isUserLoading && !sessionId) {
      // If there's no session_id and user is loaded, we can stop the sync check.
      setIsSyncing(false);
    }
  }, [searchParams, user, isUserLoading, router, projectId, toast, isSyncing]);



  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    const isClickInCanvas = canvasContainerRef.current && canvasContainerRef.current.contains(target);
    const isClickInRightPanel = rightPanelRef.current && rightPanelRef.current.contains(target);

    // Only deselect if the click is outside both the canvas container and the right panel.
    if (!isClickInCanvas && !isClickInRightPanel) {
      setSelectedLayerIds([]);
      setSelection(prev => ({ ...prev, visible: false }));
      setIsSelectionActionMenuVisible(false);
      setSelectionDivisionPreview({ isActive: false, rects: [] });
      setLassoPoints([]);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependencies are stable and don't need to be listed.


  useEffect(() => {
    const handleResize = () => {
      if (backgroundLayer) {
        const activeVariation = backgroundLayer.variations[backgroundLayer.activeVariationIndex];
        if (activeVariation) {
          centerAndZoom(activeVariation.width, activeVariation.height, backgroundLayer.x, backgroundLayer.y);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial center and zoom
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [centerAndZoom, backgroundLayer]);

  useEffect(() => {
    const handleOrientationChange = () => {
      // Check if the screen orientation API is available
      if (window.screen && window.screen.orientation) {
        const isLandscape = window.screen.orientation.type.startsWith('landscape');

        if (isLandscape && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
          });
        } else if (!isLandscape && document.fullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
      }
    };

    // Listen for orientation changes
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    } else {
      // Fallback for older browsers
      window.addEventListener('orientationchange', handleOrientationChange);
    }

    return () => {
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      } else {
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };
  }, []);

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <ToastProvider>
        <Header projectId={projectId} onThemeChange={setTheme} />
        {/* Top bar for desktop */}
        <header className="h-12 flex-shrink-0 px-6 hidden lg:flex items-center border-b border-border bg-card">
          <Link href="/" className="flex items-center gap-3 mr-auto">
            <AppLogo className="h-6 w-auto" />
            <h1 className="text-xl font-semibold font-headline tracking-wide text-primary">
              Visualizae 3.0
            </h1>
          </Link>
          <div className="flex-1 flex items-center min-w-0">
            <ToolOptionsMessage />
          </div>
          <div className="w-auto flex items-center justify-end pl-4 gap-2">
            <TooltipProvider>
              {!isUserLoading && user?.email === 'visualizaeapp@gmail.com' && (
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
                    <p>Gravar Video</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
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
            <FullscreenButton />
            <ThemeToggleButton onThemeChange={setTheme} />
            <UserButton />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 flex gap-4 overflow-hidden p-4 pt-4">
            <div
              ref={canvasContainerRef}
              className="flex-1 h-full w-full flex flex-col rounded-lg border border-border bg-card overflow-hidden landscape:flex-row"
            >
              <MobileLayersPanel />
              <div className="flex-1 relative">
                <CanvasArea theme={theme} />
                <SelectionActions />
                <ToolOptions />
              </div>
              <Toolbar />
            </div>
            <div ref={rightPanelRef} className="h-full w-80 flex-col flex-shrink-0 hidden lg:flex rounded-lg border border-border bg-card overflow-hidden">
              <RightPanel />
            </div>
          </main>
        </div>
        <AspectRatioAdjustDialog />
        <EnhanceGroupDialog />
        <RenderLayerDialog />
        <ScreenRecorder isRecording={isRecording} />
        <RecordingSetupDialog />
        <GenerationToastController />
        <ToastViewport />
      </ToastProvider>
    </div >
  );
}
