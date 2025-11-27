

'use client';

import { AlertCircle, Check, RefreshCw, X, Save, LayoutGrid, ChevronLeft, ChevronRight, Folder } from 'lucide-react';
import { useEditor } from '@/hooks/use-editor-store';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import React, { useRef, useLayoutEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

const DivisionToolOptions = () => {
    const { divisionTool, generateDivisionSuggestions, setDivisionOverlap, saveCurrentDivisionLayout, validDivisionCounts } = useEditor();

    const handleCycleSuggestion = () => {
        generateDivisionSuggestions(divisionTool.divisions, 1);
    }
    
    const handleDivisionCountChange = (direction: 'increment' | 'decrement') => {
        const { divisions, overlap } = divisionTool;
        const currentIndex = validDivisionCounts.indexOf(divisions);
        let nextIndex;

        if (direction === 'increment') {
            nextIndex = Math.min(validDivisionCounts.length - 1, currentIndex + 1);
        } else {
            nextIndex = Math.max(0, currentIndex - 1);
        }
        
        const newCount = validDivisionCounts[nextIndex];
        if (newCount !== undefined) {
             generateDivisionSuggestions(newCount, 0, overlap);
        }
    }
    
    const overlapOptions = [0, 10, 20];
    const isDecrementDisabled = validDivisionCounts.length === 0 || divisionTool.divisions <= (validDivisionCounts[0] || 2);
    const isIncrementDisabled = validDivisionCounts.length === 0 || divisionTool.divisions >= (validDivisionCounts[validDivisionCounts.length - 1] || 9);

    return (
      <TooltipProvider>
        <div className="flex items-center gap-2">
             <div className="flex items-center gap-1">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => handleDivisionCountChange('decrement')}
                            disabled={isDecrementDisabled}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Menos Camadas</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-1 px-2 text-sm font-medium">
                            <LayoutGrid className="h-4 w-4" />
                            <span>{divisionTool.divisions}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Número de Camadas</p></TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8" 
                            onClick={() => handleDivisionCountChange('increment')}
                            disabled={isIncrementDisabled}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Mais Camadas</p></TooltipContent>
                </Tooltip>
            </div>
            
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCycleSuggestion}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Próximo Layout</p></TooltipContent>
            </Tooltip>
            
            <Separator orientation='vertical' className='h-6' />
            
            <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                 {overlapOptions.map(opt => (
                    <Tooltip key={opt}>
                        <TooltipTrigger asChild>
                            <Button 
                                variant={divisionTool.overlap === opt ? 'secondary' : 'ghost'}
                                size="sm"
                                className='h-7 px-3 text-xs'
                                onClick={() => setDivisionOverlap(opt)}
                            >
                                {opt}%
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Sobreposição de {opt}%</p></TooltipContent>
                    </Tooltip>
                 ))}
            </div>

            <Separator orientation='vertical' className='h-6' />
            
             <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={saveCurrentDivisionLayout}>
                        <Save className="mr-2 h-4 w-4"/>
                        Salvar
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Salvar layout de divisão atual</p></TooltipContent>
            </Tooltip>
        </div>
      </TooltipProvider>
    )
}

export default function ToolOptionsMessage() {
  const { tool, message, selection, divisionTool } = useEditor();
  const [isTruncated, setIsTruncated] = useState(false);
  const textMeasureRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useLayoutEffect(() => {
    const checkTruncation = () => {
      if (textMeasureRef.current && containerRef.current && message) {
        // Render the full text invisibly to measure its actual width
        textMeasureRef.current.textContent = message.text || '';
        const isCurrentlyTruncated = textMeasureRef.current.scrollWidth > containerRef.current.clientWidth;
        if (isCurrentlyTruncated !== isTruncated) {
          setIsTruncated(isCurrentlyTruncated);
        }
      }
    };
    
    checkTruncation();
    const resizeObserver = new ResizeObserver(checkTruncation);
    if(containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [message, isTruncated]);

  if (divisionTool.isActive) {
    return <DivisionToolOptions />;
  }

  // Determine the message to display
  let currentMessage: { text: string; level: 'info' | 'warning' | 'danger'; } | null = null;
  let showMessage = false;

  if (tool === 'rectangle') {
      if(message) {
        currentMessage = message;
        showMessage = true;
      } else if (!message && !selection.visible) {
        currentMessage = { text: 'Arraste para criar uma seleção.', level: 'info' };
        showMessage = true;
      }
  }

  const isQualityWarning = message?.level === 'warning';

  if (showMessage && currentMessage) {
    return (
        <TooltipProvider>
            <div className="flex items-center gap-2">
                <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
                    {/* Hidden element for measuring full text width */}
                    <span ref={textMeasureRef} className="absolute invisible whitespace-nowrap text-sm">{currentMessage.text}</span>

                    <Tooltip open={(isQualityWarning && isTruncated) ? undefined : false}>
                        <TooltipTrigger asChild>
                        <div className="w-full px-2 text-center text-sm truncate">
                            <span
                            className={cn(
                                "flex items-center justify-center gap-2",
                                currentMessage.level === 'info' && "text-primary",
                                currentMessage.level === 'warning' && "text-[hsl(var(--warning))]",
                                currentMessage.level === 'danger' && "text-destructive",
                            )}
                            >
                            {(currentMessage.level !== 'info' || (isQualityWarning && isTruncated)) && <AlertCircle className="h-4 w-4 shrink-0" />}
                            <span className="truncate">{(isQualityWarning && isTruncated) ? "Qualidade Reduzida" : currentMessage.text}</span>
                            </span>
                        </div>
                        </TooltipTrigger>
                        <TooltipContent>
                        <p>{currentMessage.text}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </TooltipProvider>
    );
  }

  return <div className="h-full w-full min-w-0">&nbsp;</div>;
};
