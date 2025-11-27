
'use client';

import React from 'react';
import { useEditor } from '@/hooks/use-editor-store';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Circle, Square, Lasso, RectangleHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tool } from '@/types';

export default function ToolOptions() {
  const { 
    tool, 
    activateTool,
    eraserSize, 
    setEraserSize, 
    eraserOpacity, 
    setEraserOpacity,
    brushSize,
    setBrushSize,
    brushOpacity,
    setBrushOpacity
  } = useEditor();

  const isEraserFamily = tool.startsWith('eraser');
  const isBrushFamily = tool.startsWith('brush');

  if (!isEraserFamily && !isBrushFamily) {
    return null;
  }
  
  const family = isEraserFamily ? 'eraser' : 'brush';
  const size = isEraserFamily ? eraserSize : brushSize;
  const setSize = isEraserFamily ? setEraserSize : setBrushSize;
  const opacity = isEraserFamily ? eraserOpacity : brushOpacity;
  const setOpacity = isEraserFamily ? setEraserOpacity : setBrushOpacity;

  const toolOptions = [
    { value: `${family}`, label: 'Circular', icon: Circle },
    { value: `${family}-square`, label: 'Quadrada', icon: Square },
    { value: `${family}-polygon`, label: 'Poligonal', icon: Lasso },
    { value: `${family}-rectangle`, label: 'Retangular', icon: RectangleHorizontal }
  ];

  return (
    <div 
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30"
        onClick={(e) => e.stopPropagation()} // Impede que o clique feche o painel
    >
      <div className="flex items-center gap-4 bg-card/80 backdrop-blur-md p-3 rounded-lg border shadow-lg">
        <TooltipProvider>
          <ToggleGroup
            type="single"
            value={tool}
            onValueChange={(value: Tool) => value && activateTool(value)}
            className="flex items-center gap-1"
          >
            {toolOptions.map(option => (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value={option.value as Tool} aria-label={option.label} className="h-9 w-9 p-0">
                    <option.icon className="h-5 w-5" />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{option.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>

          <div className="flex items-center gap-3 w-40">
            <Label htmlFor="tool-size" className="text-xs shrink-0">Tamanho</Label>
            <Slider
              id="tool-size"
              value={[size]}
              onValueChange={(v) => setSize(v[0])}
              min={10}
              max={200}
              step={2}
            />
          </div>
          
          <div className="flex items-center gap-3 w-40">
            <Label htmlFor="tool-opacity" className="text-xs shrink-0">Opacidade</Label>
            <Slider
              id="tool-opacity"
              value={[opacity]}
              onValueChange={(v) => setOpacity(v[0])}
              min={1}
              max={100}
              step={1}
            />
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
