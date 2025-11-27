

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '@/hooks/use-editor-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Clapperboard, Loader2, Play, AlertTriangle, Video, Crop, Ruler, Type, Trash2, SlidersHorizontal, Film, StopCircle, Wind, Download, ChevronLeft, ChevronRight, ZoomIn, RectangleHorizontal, Plus, Minus } from 'lucide-react';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Input } from '../ui/input';
import { Slider } from '@/components/ui/slider';

import { useUser } from '@/firebase';
import { useAuthActions } from '@/hooks/use-auth-actions';
import type { Scene, Layer } from '@/types';
import { toast } from '@/hooks/use-toast';
import { animateScene, generateScript, loadImage } from '@/lib/utils/video';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';

const SceneTooltipContent = ({ scene }: { scene: Scene }) => {
  const { layers, backgroundLayer } = useEditor();
  const getLayerName = (layerId: string) => layers.find(l => l.id === layerId)?.name || 'Desconhecida';

  const visibleLayers: string[] = [];
  if (scene.visibilityMap) {
    scene.visibilityMap.forEach((isVisible, layerId) => {
      if (isVisible && layerId !== backgroundLayer?.id) {
        const variationIndex = scene.currentVariationMap.get(layerId);
        visibleLayers.push(`${getLayerName(layerId)} (Variação ${variationIndex ?? 0})`);
      }
    });
  }

  const usedLayers: string[] = [];
  if (scene.type === 'zoom_in') {
    const layerName = scene.layer?.name || 'Desconhecida';
    const variationIndex = scene.currentVariationMap.get(scene.layer.id) ?? 0;
    usedLayers.push(`${layerName} (Variação ${variationIndex})`);
  } else if (scene.type === 'typing') {
    if (scene.prompt) usedLayers.push(`Prompt: "${scene.prompt}"`);
  } else if (scene.type === 'result') {
    const layerName = scene.layerForFade?.name || 'Desconhecida';
    const prevVariation = scene.previousVariationIndex ?? 0;
    const currentVariation = scene.currentVariationMap.get(scene.layerForFade.id) ?? 1;
    usedLayers.push(`${layerName} (Variação ${prevVariation} → ${currentVariation})`);
  }

  return (
    <div className="text-xs space-y-2">
      <div>
        <p className="font-semibold text-foreground">Camadas ligadas:</p>
        {visibleLayers.length > 0 ? (
          <ul className="list-disc pl-4 text-muted-foreground">
            {visibleLayers.map(l => <li key={l}>{l}</li>)}
          </ul>
        ) : (
          <p className="text-muted-foreground pl-4">Nenhuma</p>
        )}
      </div>
      {usedLayers.length > 0 && (
        <div>
          <p className="font-semibold text-foreground">Camadas usadas na cena:</p>
          <ul className="list-disc pl-4 text-muted-foreground">
            {usedLayers.map(l => <li key={l}>{l}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};


export default function RecordingSetupDialog() {
  const {
    isRecordingSetupOpen,
    setIsRecordingSetupOpen,
    targetLayerIdForRecording,
    layers,
    backgroundLayer,
    promptFontSize,
    setPromptFontSize,
    videoScript,
    setVideoScript,
    videoFPS,
    setVideoFPS,
    videoSpeed,
    setVideoSpeed,
    rectangleThickness,
    setRectangleThickness,
    setIsRecording,
    isRecording,
  } = useEditor();
  const { user } = useUser();
  const { handleSignIn, setIsPricingDialogOpen } = useAuthActions();

  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const sceneStartTimeRef = useRef<number>(0);
  const currentSceneIndexRef = useRef<number>(0);
  const allLayersWithImagesRef = useRef<({ layer: Layer, images: (HTMLImageElement | null)[] })[]>([]);
  const isIndividualSceneRecordingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sceneRefs = useRef<(HTMLDivElement | null)[]>([]);


  const hasEnoughContent = layers.filter(l => !l.isBackground).length > 0;
  const isProjectVideo = targetLayerIdForRecording === null;

  useEffect(() => {
    if (highlightedIndex !== null && sceneRefs.current[highlightedIndex]) {
      sceneRefs.current[highlightedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [highlightedIndex]);

  const drawFirstFrame = (script: Scene[], layersWithImages: ({ layer: Layer; images: (HTMLImageElement | null)[] })[]) => {
    if (!previewCanvasRef.current || script.length === 0) return;
    const ctx = previewCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const firstScene = script[0];
    animateScene(ctx, firstScene, 0, layersWithImages, null, { promptFontSize, rectangleThickness });
  };

  useEffect(() => {
    const updateScript = async () => {
      setIsLoading(true);
      try {
        allLayersWithImagesRef.current = await Promise.all(
          layers.map(async (l) => ({
            layer: l,
            images: await Promise.all(l.variations.map((v) => loadImage(v.dataUrl))),
          }))
        );

        if (!backgroundLayer) {
          setVideoScript([]);
          return;
        }

        const genScript = await generateScript(layers, targetLayerIdForRecording, backgroundLayer, videoScript, videoSpeed);
        setVideoScript(genScript);

        if (genScript.length > 0 && previewCanvasRef.current) {
          drawFirstFrame(genScript, allLayersWithImagesRef.current);
        }

      } catch (error) {
        toast({ variant: 'destructive', title: 'Erro ao gerar roteiro', description: error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.' });
      } finally {
        setIsLoading(false);
      }
    };

    if (isRecordingSetupOpen) {
      updateScript();
    } else {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPreviewing(false);
      setHighlightedIndex(null);
    }
  }, [isRecordingSetupOpen, layers, targetLayerIdForRecording, backgroundLayer, setVideoScript, videoSpeed]);


  const handleClose = () => {
    setIsRecordingSetupOpen(false);
  }

  const runPreview = (timestamp: number) => {
    if (!previewCanvasRef.current) return;
    const ctx = previewCanvasRef.current.getContext('2d');
    if (!ctx) return;

    if (sceneStartTimeRef.current === 0) sceneStartTimeRef.current = timestamp;
    let sceneElapsedTime = timestamp - sceneStartTimeRef.current;

    const currentScene = videoScript[currentSceneIndexRef.current];
    setHighlightedIndex(currentSceneIndexRef.current);

    if (!currentScene) {
      setIsPreviewing(false);
      setHighlightedIndex(null);
      currentSceneIndexRef.current = 0;
      sceneStartTimeRef.current = 0;
      if (videoScript.length > 0) {
        drawFirstFrame(videoScript, allLayersWithImagesRef.current);
      } else {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    animateScene(ctx, currentScene, sceneElapsedTime, allLayersWithImagesRef.current, audioRef.current, { promptFontSize, rectangleThickness });

    if (sceneElapsedTime >= currentScene.duration) {
      currentSceneIndexRef.current += 1;
      sceneStartTimeRef.current = timestamp;
    }

    if (!isIndividualSceneRecordingRef.current) {
      animationFrameId.current = requestAnimationFrame(runPreview);
    }
  };

  const handlePreview = () => {
    if (isPreviewing) {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPreviewing(false);
      setHighlightedIndex(null);
      currentSceneIndexRef.current = 0;
      sceneStartTimeRef.current = 0;
      if (videoScript.length > 0) {
        drawFirstFrame(videoScript, allLayersWithImagesRef.current);
      }
    } else {
      if (audioRef.current) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(_ => {
            audioRef.current?.pause();
            setIsPreviewing(true);
            currentSceneIndexRef.current = 0;
            sceneStartTimeRef.current = 0;
            animationFrameId.current = requestAnimationFrame(runPreview);
          }).catch(error => {
            console.warn("Audio autoplay prevented. Starting preview without sound.", error);
            setIsPreviewing(true);
            currentSceneIndexRef.current = 0;
            sceneStartTimeRef.current = 0;
            animationFrameId.current = requestAnimationFrame(runPreview);
          });
        }
      }
    }
  };

  const handleSceneClick = (index: number) => {
    if (isPreviewing && animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      setIsPreviewing(false);
    }

    currentSceneIndexRef.current = index;
    sceneStartTimeRef.current = 0;
    setHighlightedIndex(index);

    if (!previewCanvasRef.current) return;
    const ctx = previewCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const sceneToDraw = videoScript[index];
    if (sceneToDraw) {
      const timeToDraw = sceneToDraw.type === 'typing' ? sceneToDraw.duration : 0;
      animateScene(ctx, sceneToDraw, timeToDraw, allLayersWithImagesRef.current, null, { promptFontSize, rectangleThickness });
    }
  };

  const handleRecord = () => {
    if (!user) {
      toast({ title: 'Faça login para gravar', variant: 'destructive', action: <Button onClick={handleSignIn}>Fazer Login</Button> });
      return;
    }
    if (user.credits <= 0 && user.email !== 'visualizaeapp@gmail.com') {
      toast({ title: 'Créditos insuficientes', description: 'Você precisa de créditos para gravar vídeos.', variant: 'destructive' });
      setIsPricingDialogOpen(true);
      return;
    }
    handleClose();
    setIsRecording(true);
  }

  const handleDurationChange = (index: number, newDurationInSeconds: number) => {
    if (!isNaN(newDurationInSeconds)) {
      setVideoScript(prevScript => {
        const updatedScript = [...prevScript];
        updatedScript[index] = { ...updatedScript[index], duration: newDurationInSeconds * 1000 };
        return updatedScript;
      });
    }
  }

  const handleSpeedChange = (direction: 'increase' | 'decrease') => {
    setVideoScript(prevScript => {
      return prevScript.map(scene => ({
        ...scene,
        duration: direction === 'increase' ? scene.duration * 1.25 : scene.duration / 1.25
      }));
    });
  };

  const handleThicknessChange = (value: number) => {
    setRectangleThickness(value);
    const rectSceneIndex = videoScript.findIndex(s => s.type === 'zoom_in' && s.animationEffect === 'selection_rectangle');
    if (rectSceneIndex !== -1 && previewCanvasRef.current) {
      const scene = videoScript[rectSceneIndex];
      const ctx = previewCanvasRef.current.getContext('2d');
      if (ctx) {
        animateScene(ctx, scene, scene.duration, allLayersWithImagesRef.current, null, { promptFontSize, rectangleThickness: value });
        setHighlightedIndex(rectSceneIndex);
      }
    }
  };

  const handleFontSizeChange = (value: number) => {
    setPromptFontSize(value);
    const typingSceneIndex = videoScript.findIndex(s => s.type === 'typing');
    if (typingSceneIndex !== -1 && previewCanvasRef.current) {
      const scene = videoScript[typingSceneIndex];
      const ctx = previewCanvasRef.current.getContext('2d');
      if (ctx) {
        animateScene(ctx, scene, scene.duration, allLayersWithImagesRef.current, null, { promptFontSize: value, rectangleThickness });
        setHighlightedIndex(typingSceneIndex);
      }
    }
  };

  const handleEffectChange = (index: number, newEffect: 'zoom' | 'selection_rectangle') => {
    setVideoScript(prevScript => {
      const updatedScript = [...prevScript];
      const scene = updatedScript[index];
      if (scene.type === 'zoom_in') {
        updatedScript[index] = { ...scene, animationEffect: newEffect };
      }

      generateScript(layers, targetLayerIdForRecording, backgroundLayer, updatedScript, videoSpeed)
        .then(newFullScript => setVideoScript(newFullScript));

      return updatedScript;
    });
  };

  const handleSceneDelete = (indexToDelete: number) => {
    const newScript = videoScript.filter((_, index) => index !== indexToDelete);
    generateScript(layers, targetLayerIdForRecording, backgroundLayer, newScript, videoSpeed)
      .then(newFullScript => setVideoScript(newFullScript));
  };


  let title = isProjectVideo ? "Gerar Vídeo do Projeto" : `Gerar Vídeo da Camada "${layers.find(l => l.id === targetLayerIdForRecording)?.name}"`;

  const getSceneName = (scene: Scene, index: number): string => {
    const isFinalScene = index === videoScript.length - 1;
    if (index === 0 && scene.type === 'full_canvas_hold') return "Visão Geral";
    if (scene.type === 'zoom_in' && scene.layer) return scene.layer.name || 'Desconhecida';
    if (scene.type === 'typing') return `Prompt`;
    if (scene.type === 'result') return `Resultado: ${scene.layer?.name}`;

    if (scene.type === 'full_canvas_hold') {
      const visibleAnimatedLayers = Array.from(scene.visibilityMap.entries()).filter(([id, visible]) => visible && id !== backgroundLayer?.id);
      const count = visibleAnimatedLayers.length;
      return isFinalScene ? `Final (${count} camadas)` : `Geral (${count} camadas)`;
    }
    return 'Cena';
  };

  const totalDuration = videoScript.reduce((acc, scene) => acc + scene.duration, 0) / 1000;

  return (
    <Dialog open={isRecordingSetupOpen} onOpenChange={handleClose}>
      <DialogContent size="lg">
        <TooltipProvider>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Ajuste o roteiro, visualize o resultado e grave o vídeo final.
            </DialogDescription>
          </DialogHeader>

          <audio ref={audioRef} src="https://firebasestorage.googleapis.com/v0/b/gen-code-buddy-14a52.appspot.com/o/public%2Ftyping-click.mp3?alt=media&token=8d255a6d-2c1b-4158-8833-04e7609208a5" preload="auto"></audio>

          <div className="flex flex-col md:grid md:grid-cols-4 gap-4 min-h-0 flex-1">
            <div className="md:col-span-3 bg-muted/30 rounded-md relative flex items-center justify-center overflow-hidden flex-1 min-h-[200px]">
              <canvas ref={previewCanvasRef} className="max-w-full max-h-full object-contain" width={backgroundLayer?.variations[0].width || 1920} height={backgroundLayer?.variations[0].height || 1080} />
            </div>
            <div className="md:col-span-1 flex flex-col gap-4 min-h-0">
              <ScrollArea className='flex-1 border rounded-lg min-h-0'>
                <div className="p-2 space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center p-4 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando roteiro...
                    </div>
                  ) : videoScript.length > 0 ? (
                    videoScript.map((scene, index) => (
                      <div
                        key={index}
                        ref={el => sceneRefs.current[index] = el}
                        onClick={() => handleSceneClick(index)}
                        className={cn("p-2 rounded-md border text-xs flex flex-col gap-2 cursor-pointer", highlightedIndex === index ? 'bg-primary/20 border-primary' : 'bg-card')}>
                        <div className="flex justify-between items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="font-semibold truncate flex-1">{getSceneName(scene, index)}</p>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <SceneTooltipContent scene={scene} />
                            </TooltipContent>
                          </Tooltip>

                          <div className="flex items-center gap-1 ml-auto">
                            {scene.type === 'zoom_in' && (
                              <ToggleGroup
                                type="single"
                                value={scene.animationEffect}
                                onValueChange={(value) => value && handleEffectChange(index, value as 'zoom' | 'selection_rectangle')}
                                className="justify-start"
                              >
                                <ToggleGroupItem value="zoom" className='h-6 text-xs px-1.5'>
                                  <ZoomIn className='h-3 w-3' />
                                </ToggleGroupItem>
                                <ToggleGroupItem value="selection_rectangle" className='h-6 text-xs px-1.5'>
                                  <RectangleHorizontal className='h-3 w-3' />
                                </ToggleGroupItem>
                              </ToggleGroup>
                            )}
                            <Input
                              type="number"
                              value={(scene.duration / 1000).toFixed(1)}
                              onChange={(e) => handleDurationChange(index, parseFloat(e.target.value))}
                              className="w-16 h-6 text-xs text-right"
                              step="0.1"
                            />
                            <span className="text-muted-foreground">s</span>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6"><Trash2 className="h-3 w-3" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Cena?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação irá remover esta cena do roteiro.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleSceneDelete(index)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground p-4 text-xs">
                      Nenhuma cena gerada.
                    </div>
                  )}
                </div>
              </ScrollArea>
              <ScrollArea className="md:max-h-[280px]">
                <div className="bg-card border rounded-lg p-3 flex flex-col gap-3 pr-5">
                  <div className='flex items-center gap-2'>
                    <Button
                      variant="outline"
                      className="h-9 px-4 flex-1"
                      onClick={handlePreview}
                      disabled={isLoading || videoScript.length === 0}
                    >
                      {isPreviewing ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                      {isPreviewing ? 'Parar' : 'Tocar'}
                    </Button>
                    <div className="text-sm font-medium text-muted-foreground">
                      <span className="text-foreground font-semibold">{totalDuration.toFixed(1)}s</span>
                    </div>
                  </div>
                  <div className='flex flex-col gap-3'>
                    <Label className='text-xs text-muted-foreground'>Ajustes Finos</Label>
                    <div className='grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2 gap-y-2 text-xs'>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className='flex items-center gap-2'>
                            <Wind className='h-4 w-4 text-muted-foreground' />
                            <Label className='shrink-0'>Velocidade:</Label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side='left'><p>Ajusta a duração de todas as cenas</p></TooltipContent>
                      </Tooltip>
                      <div></div>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleSpeedChange('decrease')}><Minus className="h-4 w-4" /></Button>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleSpeedChange('increase')}><Plus className="h-4 w-4" /></Button>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className='flex items-center gap-2'>
                            <Ruler className='h-4 w-4 text-muted-foreground' />
                            <Label htmlFor="rect-thickness" className='shrink-0'>Espessura:</Label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side='left'><p>Espessura do contorno do retângulo</p></TooltipContent>
                      </Tooltip>
                      <Slider id="rect-thickness" value={[rectangleThickness]} onValueChange={(v) => handleThicknessChange(v[0])} min={1} max={16} step={1} />
                      <span className='w-10 text-center col-span-2'>{rectangleThickness}px</span>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className='flex items-center gap-2'>
                            <Type className='h-4 w-4 text-muted-foreground' />
                            <Label htmlFor="prompt-font-size" className='shrink-0'>Fonte:</Label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side='left'><p>Tamanho da fonte do prompt</p></TooltipContent>
                      </Tooltip>
                      <Slider id="prompt-font-size" value={[promptFontSize]} onValueChange={(v) => handleFontSizeChange(v[0])} min={16} max={256} step={4} />
                      <span className='w-10 text-center col-span-2'>{promptFontSize}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className='text-xs text-muted-foreground'>Qualidade do Vídeo</Label>
                    <ToggleGroup
                      type="single"
                      value={videoFPS.toString()}
                      onValueChange={(value) => value && setVideoFPS(parseInt(value))}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="24" className="text-xs h-7 px-2">24 FPS</ToggleGroupItem>
                      <ToggleGroupItem value="30" className="text-xs h-7 px-2">30 FPS</ToggleGroupItem>
                      <ToggleGroupItem value="60" className="text-xs h-7 px-2">60 FPS</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  <Button onClick={handleRecord} disabled={isLoading || isPreviewing}>
                    <Film className="mr-2 h-4 w-4" />
                    Gravar Vídeo
                  </Button>
                </div>
              </ScrollArea>
            </div>
          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
