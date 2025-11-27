'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ASPECT_RATIOS } from '@/lib/consts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';

interface NewCanvasDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (width: number, height: number) => void;
}

const RESOLUTIONS = {
  'hd': 1280,
  'fhd': 1920,
  '2k': 2048,
  '4k': 4096,
};

type ResolutionKey = keyof typeof RESOLUTIONS;

export default function NewCanvasDialog({ isOpen, onOpenChange, onConfirm }: NewCanvasDialogProps) {
  const [selectedRatioName, setSelectedRatioName] = useState<string | null>('Landscape');
  const [resolution, setResolution] = useState<ResolutionKey>('4k');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  const allRatios = [...ASPECT_RATIOS];

  const handleConfirm = () => {
    if (selectedRatioName) {
      const selectedRatio = allRatios.find(r => r.name === selectedRatioName);
      if (selectedRatio) {
        const longSide = RESOLUTIONS[resolution];
        const isHorizontal = orientation === 'horizontal';

        const ratioForCalc = selectedRatio.ratio;
        
        let width, height;
        if (isHorizontal) {
            if (ratioForCalc >= 1) { // Landscape or square
                width = longSide;
                height = Math.round(longSide / ratioForCalc);
            } else { // Portrait
                height = longSide;
                width = Math.round(longSide * ratioForCalc);
            }
        } else { // Vertical
             if (ratioForCalc >= 1) { // Landscape or square
                height = longSide;
                width = Math.round(longSide / ratioForCalc);
            } else { // Portrait
                width = longSide;
                height = Math.round(longSide * ratioForCalc);
            }
        }
        onConfirm(width, height);
      }
    }
  };
  
  const handleTemplateSelect = (name: string) => {
    setSelectedRatioName(name);
  }

  const selectedRatio = selectedRatioName ? allRatios.find(r => r.name === selectedRatioName) : null;
  let previewWidth = 120;
  let previewHeight = 120;
  if (selectedRatio) {
      const isHorizontal = orientation === 'horizontal';
      const ratio = isHorizontal ? selectedRatio.ratio : 1/selectedRatio.ratio;
      previewWidth = ratio >= 1 ? 120 : Math.round(120 * ratio);
      previewHeight = ratio < 1 ? 120 : Math.round(120 / ratio);
  }

  const getFinalDimensions = () => {
     if (selectedRatio) {
        const longSide = RESOLUTIONS[resolution];
        const isHorizontal = orientation === 'horizontal';
        const ratioForCalc = selectedRatio.ratio;
        let width, height;

        if (isHorizontal) {
          if (ratioForCalc >= 1) { width = longSide; height = Math.round(longSide / ratioForCalc); }
          else { height = longSide; width = Math.round(longSide * ratioForCalc); }
        } else { // Vertical
          if (ratioForCalc >= 1) { height = longSide; width = Math.round(longSide / ratioForCalc); }
          else { width = longSide; height = Math.round(longSide * ratioForCalc); }
        }
        return `${width} x ${height}px`;
     }
     return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="flex flex-col h-auto md:h-[70vh]">
        <DialogHeader>
          <DialogTitle>Criar Nova Tela de Pintura</DialogTitle>
          <DialogDescription>
            Escolha uma proporção, orientação e resolução para sua nova tela.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
               <div className='flex items-center gap-2'>
                  <h3 className="text-sm font-medium">Proporção:</h3>
                  <Select value={selectedRatioName || ''} onValueChange={handleTemplateSelect}>
                      <SelectTrigger className="w-auto">
                          <SelectValue placeholder="Selecione uma proporção" />
                      </SelectTrigger>
                      <SelectContent>
                           <ScrollArea className="h-72">
                              {allRatios.map(ratio => (
                                  <SelectItem key={ratio.name} value={ratio.name}>
                                      {`${ratio.name}`}
                                  </SelectItem>
                              ))}
                          </ScrollArea>
                      </SelectContent>
                  </Select>
               </div>
               <div className='flex items-center gap-2'>
                  <h3 className="text-sm font-medium">Orientação:</h3>
                  <Select value={orientation} onValueChange={(v) => setOrientation(v as 'horizontal' | 'vertical')} disabled={!selectedRatioName}>
                      <SelectTrigger className="w-auto">
                          <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                         <SelectItem value="horizontal">Horizontal</SelectItem>
                         <SelectItem value="vertical">Vertical</SelectItem>
                      </SelectContent>
                  </Select>
               </div>
               <div className='flex items-center gap-2'>
                <h3 className="text-sm font-medium">Resolução:</h3>
                <Select value={resolution} onValueChange={(v) => setResolution(v as ResolutionKey)} disabled={!selectedRatioName}>
                    <SelectTrigger className="w-auto">
                        <SelectValue placeholder="Selecione a resolução" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="hd">HD ({RESOLUTIONS['hd']}px)</SelectItem>
                        <SelectItem value="fhd">Full HD ({RESOLUTIONS['fhd']}px)</SelectItem>
                        <SelectItem value="2k">2K ({RESOLUTIONS['2k']}px)</SelectItem>
                        <SelectItem value="4k">4K ({RESOLUTIONS['4k']}px)</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>
             <div className="flex-1 flex items-center justify-center rounded-lg p-4">
                {selectedRatioName && selectedRatio && (
                    <div className="flex flex-col items-center gap-4">
                         <div 
                            className="rounded-sm flex items-center justify-center ring-2 ring-primary"
                            style={{ 
                                width: `${previewWidth}px`, 
                                height: `${previewHeight}px`,
                            }}
                        />
                         <div className="text-center">
                            <p className="font-semibold text-lg">{selectedRatio.name}</p>
                            <p className="text-sm text-muted-foreground">
                               {getFinalDimensions()}
                            </p>
                        </div>
                    </div>
                )}
            </div>
          </div>
        
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!selectedRatioName}>
            Criar Tela
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
