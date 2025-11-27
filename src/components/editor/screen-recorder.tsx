

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '@/hooks/use-editor-store';
import { Button } from '@/components/ui/button';
import { X, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Layer, RecordingCropArea, LayerVariation, Selection, Scene } from '@/types';
import { animateScene, loadImage } from '@/lib/utils/video';


const GlobalVideoIndicator = () => {
  const { isProcessingVideo, videoStatusMessage } = useEditor();
  if (!isProcessingVideo) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-card p-3 rounded-lg shadow-lg border">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm font-medium">{videoStatusMessage}</p>
      </div>
    </div>
  )
}

const VideoResultPanel = () => {
  const { recordedVideoBlob, setRecordedVideoBlob, targetLayerIdForRecording, layers } = useEditor();

  if (!recordedVideoBlob) return null;

  const handleDownload = () => {
    if (recordedVideoBlob) {
      const url = URL.createObjectURL(recordedVideoBlob.blob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = url;
      const layer = targetLayerIdForRecording ? layers.find(l => l.id === targetLayerIdForRecording) : null;
      const extension = recordedVideoBlob.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const fileName = layer ? `visualizae-processo-${layer.name}.${extension}` : `visualizae-projeto.${extension}`;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
      setRecordedVideoBlob(null);
    }
  };

  const handleClose = () => {
    setRecordedVideoBlob(null);
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-card p-2 rounded-lg shadow-lg border">
        <p className="text-sm font-medium">Vídeo Gerado!</p>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleClose}>
          <X className="h-4 w-4" />
        </Button>
        <Button size="icon" className="h-8 w-8" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}


interface ScreenRecorderProps {
  isRecording: boolean;
}

export default function ScreenRecorder({ isRecording }: ScreenRecorderProps) {
  const {
    setIsRecording,
    layers,
    setIsProcessingVideo,
    setVideoStatusMessage,
    setRecordedVideoBlob,
    backgroundLayer,
    rectangleThickness,
    promptFontSize,
    videoScript,
    videoFPS,
  } = useEditor();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const { toast } = useToast();

  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const allLayersWithImagesRef = useRef<({ layer: Layer, images: (HTMLImageElement | null)[] })[]>([]);


  const startRecordingProcess = async () => {
    setIsProcessingVideo(true);
    animationFrameId.current = null; // Ensure clean state
    const recordedChunks: Blob[] = [];

    try {
      setVideoStatusMessage('Carregando imagens...');
      allLayersWithImagesRef.current = await Promise.all(
        layers.map(async (l) => ({
          layer: l,
          images: await Promise.all(l.variations.map((v) => loadImage(v.dataUrl))),
        }))
      );

      if (videoScript.length === 0) {
        toast({ variant: 'destructive', title: 'Roteiro vazio', description: 'O roteiro do vídeo não pôde ser gerado.' });
        throw new Error("Roteiro do vídeo está vazio.");
      }

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          toast({ variant: 'destructive', title: 'Formato de vídeo não suportado', description: 'Seu navegador não suporta a gravação em WebM ou MP4.' });
          throw new Error('Nenhum formato de vídeo suportado encontrado.');
        }
      }

      let videoWidth: number, videoHeight: number;
      if (backgroundLayer) {
        videoWidth = backgroundLayer.variations[0].width;
        videoHeight = backgroundLayer.variations[0].height;
      } else {
        throw new Error("Fundo não encontrado para definir as dimensões do vídeo.");
      }

      if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement('canvas');
      offscreenCanvasRef.current.width = videoWidth;
      offscreenCanvasRef.current.height = videoHeight;
      const ctx = offscreenCanvasRef.current.getContext('2d');
      if (!ctx) throw new Error('Não foi possível obter o contexto 2D do canvas.');

      const stream = (offscreenCanvasRef.current as any).captureStream(videoFPS);
      const videoTrack = stream.getVideoTracks()[0];

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunks.push(event.data); };

      recorder.onstop = () => {
        if (recordedChunks.length > 0) {
          setRecordedVideoBlob({ blob: new Blob(recordedChunks, { type: mimeType }), mimeType });
        } else {
          console.warn("Gravação finalizada sem dados.");
        }
        setIsProcessingVideo(false);
        setVideoStatusMessage('');
        setIsRecording(false);
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
      };

      recorder.start();

      const totalDuration = videoScript.reduce((acc, scene) => acc + scene.duration, 0);
      setVideoStatusMessage(`Gravando ${videoScript.length} cenas (${(totalDuration / 1000).toFixed(1)}s)...`);

      let startTime: number | null = null;

      const renderLoop = (timestamp: number) => {
        if (startTime === null) startTime = timestamp;
        const elapsedTime = timestamp - startTime;

        // Determine which scene and time within the scene to render
        let cumulativeTime = 0;
        let currentScene: Scene | null = null;
        let timeInScene = 0;

        for (const scene of videoScript) {
          const sceneEndTime = cumulativeTime + scene.duration;
          if (elapsedTime < sceneEndTime) {
            currentScene = scene;
            timeInScene = elapsedTime - cumulativeTime;
            break;
          }
          cumulativeTime = sceneEndTime;
        }

        if (elapsedTime >= totalDuration || !currentScene) {
          // Ensure the last frame is rendered
          const lastScene = videoScript[videoScript.length - 1];
          animateScene(ctx, lastScene, lastScene.duration, allLayersWithImagesRef.current, null, { rectangleThickness, promptFontSize });

          // Add a small delay before stopping to ensure the last frame is captured, especially at high FPS.
          setTimeout(() => {
            if (videoTrack.readyState === 'live') {
              videoTrack.stop();
            }
            if (mediaRecorderRef.current?.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
          }, 100);

          animationFrameId.current = null;
          return;
        }

        if (currentScene) {
          animateScene(ctx, currentScene, timeInScene, allLayersWithImagesRef.current, null, { rectangleThickness, promptFontSize });
        }

        animationFrameId.current = requestAnimationFrame(renderLoop);
      };

      animationFrameId.current = requestAnimationFrame(renderLoop);

    } catch (error) {
      console.error('Falha ao gerar vídeo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      toast({ variant: 'destructive', title: 'Erro na Geração do Vídeo', description: errorMessage });
      setIsProcessingVideo(false);
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (isRecording) {
      startRecordingProcess();
    }

    // Cleanup function
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);


  return (
    <>
      <GlobalVideoIndicator />
      <VideoResultPanel />
    </>
  );
}
