'use client';

import React from 'react';
import { useEditor } from '@/hooks/use-editor-store';
import { Button } from '@/components/ui/button';
import { StopCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RecordingCropArea() {
  const { isRecording, setIsRecording, recordingCropArea, zoom, offset } = useEditor();

  if (!isRecording || !recordingCropArea) {
    return null;
  }

  const handleStop = () => {
    setIsRecording(false);
  }

  const displayX = (recordingCropArea.x * zoom) + offset.x;
  const displayY = (recordingCropArea.y * zoom) + offset.y;
  const displayWidth = recordingCropArea.width * zoom;
  const displayHeight = recordingCropArea.height * zoom;

  return (
    <>
      <div
        className="absolute pointer-events-none border-2 border-dashed border-red-500 box-border z-40"
        style={{
          left: `${displayX}px`,
          top: `${displayY}px`,
          width: `${displayWidth}px`,
          height: `${displayHeight}px`,
        }}
      />
      <div
        className="absolute z-50 flex items-center gap-2 bottom-4 left-1/2 -translate-x-1/2"
      >
        <Button variant="destructive" size="sm" onClick={handleStop} className="shadow-2xl">
          <StopCircle className="mr-2 h-4 w-4" />
          Parar Gravação
        </Button>
      </div>
    </>
  );
}
