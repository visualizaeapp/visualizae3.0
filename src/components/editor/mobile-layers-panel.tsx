

'use client';

import { useState } from 'react';
import { useEditor } from '@/hooks/use-editor-store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '../ui/alert-dialog';
import { Dialog, DialogTrigger } from '../ui/dialog';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import Image from 'next/image';
import { Eye, EyeOff, Info, Layers, SlidersHorizontal, Trash2, Wand2, ChevronLeft, ChevronRight, RotateCcw, Crop, Download, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LayerInfoModal, LayerAdjustments } from './layers-panel';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import type { Layer } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useAuthActions } from '@/hooks/use-auth-actions';
import { useUser } from '@/firebase';

const LayerVariationsControl = ({ layer }: { layer: Layer}) => {
    const { updateLayer, deleteVariationFromLayer, updateVariation } = useEditor();
    const canDelete = layer.variations.length > 1;
    const canNavigate = layer.variations.length > 1;
    const { toast } = useToast();

    const handleVariationChange = (e: React.MouseEvent, direction: 'next' | 'prev') => {
        e.stopPropagation();
        if (!canNavigate) return;
        const newIndex = direction === 'next' 
            ? (layer.activeVariationIndex + 1) % layer.variations.length
            : (layer.activeVariationIndex - 1 + layer.variations.length) % layer.variations.length;
        
        updateLayer(layer.id, { activeVariationIndex: newIndex });
    };

    const handleDeleteVariation = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canDelete) return;
        deleteVariationFromLayer(layer.id, layer.activeVariationIndex);
    };

    const handleDownloadVariation = (e: React.MouseEvent) => {
        e.stopPropagation();
        const activeVariation = layer.variations[layer.activeVariationIndex];
        if (!activeVariation) return;

        const link = document.createElement('a');
        link.href = activeVariation.dataUrl;
        link.download = `${layer.name}-variation-${layer.activeVariationIndex}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleReset = (e: React.MouseEvent) => {
      e.stopPropagation();
      updateVariation(layer.id, layer.activeVariationIndex, {
        opacity: 100,
        brightness: 100,
        contrast: 100,
        saturate: 100,
        transform: {
          offsetX: 0,
          offsetY: 0,
          scaleX: 100,
          scaleY: 100,
        },
      });
      toast({ title: "Ajustes Restaurados", description: `Os ajustes da ${layer.name} foram redefinidos.` });
    }

    const hasBuiltInOriginal = layer.variations[0]?.generationData?.type === 'render-crop' || layer.variations[0]?.generationData?.type === 'split';

    const getDisplayText = (index: number) => {
        if (hasBuiltInOriginal) {
            return index === 0 ? "Original" : `Variação ${index}`;
        }
        return `Variação ${index + 1}`;
    };

    return (
        <div className="flex items-center justify-between gap-2 p-1 px-2 bg-background rounded-md w-full">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => handleVariationChange(e, 'prev')} disabled={!canNavigate}> <ChevronLeft className='h-4 w-4'/> </Button>
            <span className="text-xs font-bold text-muted-foreground flex-1 text-center">{getDisplayText(layer.activeVariationIndex)}</span>
            <div className="flex items-center">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => handleVariationChange(e, 'next')} disabled={!canNavigate}> <ChevronRight className='h-4 w-4'/> </Button>
                 <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleReset}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>Restaurar Padrões</p>
                  </TooltipContent>
                </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDownloadVariation}>
                            <Download className="h-3 w-3" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Baixar Variação</p></TooltipContent>
                </Tooltip>
                 <AlertDialog>
                    <AlertDialogTrigger asChild disabled={!canDelete}>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" title="Excluir Variação" disabled={!canDelete} onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Excluir a {getDisplayText(layer.activeVariationIndex)}?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação excluirá permanentemente a <b>{getDisplayText(layer.activeVariationIndex)}</b> da camada <b>&quot;{layer.name}&quot;</b>. A ação não pode ser desfeita.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteVariation}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default function MobileLayersPanel() {
  const { layers, toggleLayerVisibility, deleteLayer, setRenderLayerData, selectedLayerIds, setSelectedLayerIds, isBackgroundResizeMode, setIsBackgroundResizeMode, setIsRecordingSetupOpen, setTargetLayerIdForRecording } = useEditor();
  const { user } = useUser();
  const { setIsPricingDialogOpen, handleSignIn } = useAuthActions();
  const { toast } = useToast();

  const [popoverOpen, setPopoverOpen] = useState<Record<string, boolean>>({});

  const allLayers = [...layers].reverse();

  const handleRenderClick = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();

    if (!user) {
        toast({ title: 'Faça login para continuar', description: 'Você precisa estar logado para gerar imagens.', variant: 'destructive', action: <Button onClick={handleSignIn}>Fazer Login</Button> });
        return;
    }
    if (user.credits <= 0) {
        toast({ title: 'Ops! Seus créditos se esgotaram.', description: 'Para continuar criando, assine um de nossos planos.' });
        setIsPricingDialogOpen(true);
        return;
    }

    setRenderLayerData({ layerId: layerId });
  };
  
  const handleResizeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBackgroundResizeMode(prev => !prev);
  }
  
  const handleSelect = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    const isAlreadySelected = selectedLayerIds.includes(layerId);
    
    // Toggle popover if it's already selected
    if (isAlreadySelected) {
      setPopoverOpen(prev => ({ ...prev, [layerId]: !prev[layerId] }));
    } else {
      // Close all other popovers
      const newPopoverState: Record<string, boolean> = {};
      newPopoverState[layerId] = true;
      setPopoverOpen(newPopoverState);
      setSelectedLayerIds([layerId]);
    }
  }
  
  const handleVisibilityClick = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    toggleLayerVisibility(layerId);
  }
  
  const handleDeleteClick = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    deleteLayer(layerId);
  }

  return (
    <TooltipProvider>
      <div className="lg:hidden border-b landscape:border-b-0 landscape:border-r border-border bg-card p-2">
        {allLayers.length === 0 ? (
          <div className="flex h-14 landscape:h-full landscape:w-14 items-center justify-center text-muted-foreground text-sm gap-2 landscape:flex-col">
            <Layers className="h-4 w-4" />
            <span className="landscape:hidden">Nenhuma camada</span>
          </div>
        ) : (
          <ScrollArea className="whitespace-nowrap landscape:h-full landscape:w-14" orientation='vertical'>
              <div className="flex w-max landscape:w-full landscape:flex-col space-x-2 landscape:space-x-0 landscape:space-y-2 items-center h-full">
                  {allLayers.map(layer => {
                  const activeVariation = layer.variations[layer.activeVariationIndex];
                  if (!activeVariation) return null;

                  return (
                      <Popover key={layer.id} open={popoverOpen[layer.id]} onOpenChange={(isOpen) => setPopoverOpen(prev => ({...prev, [layer.id]: isOpen}))}>
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                  <div
                                      onClick={(e) => handleSelect(e, layer.id)}
                                      className={cn(
                                          'relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex-shrink-0',
                                          selectedLayerIds.includes(layer.id) ? 'border-primary' : 'border-border',
                                          !layer.visible && !layer.isBackground && 'opacity-50'
                                      )}
                                  >
                                      <Image src={activeVariation.dataUrl} alt={layer.name} fill className="object-cover" />
                                  </div>
                              </PopoverTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="landscape:side-right"><p>{layer.name}</p></TooltipContent>
                      </Tooltip>
                      <PopoverContent side="bottom" className="landscape:side-right w-64 p-2" align="center" onCloseAutoFocus={(e) => e.preventDefault()}>
                          <div className="flex flex-col items-center gap-2">
                              {/* Row 1: Actions */}
                              <div className="flex justify-around w-full">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleRenderClick(e, layer.id)}><Wand2 className="h-4 w-4"/></Button>
                                  {layer.isBackground ? (
                                    <Button variant={isBackgroundResizeMode ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={handleResizeClick}>
                                      <Crop className="h-4 w-4"/>
                                    </Button>
                                  ) : null}
                                  <Dialog>
                                      <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}><Info className="h-4 w-4"/></Button></DialogTrigger>
                                      <LayerInfoModal layer={layer} />
                                  </Dialog>
                                  {!layer.isBackground && (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => handleVisibilityClick(e, layer.id)}>{layer.visible ? <Eye className="h-4 w-4"/> : <EyeOff className="h-4 w-4"/>}</Button>
                                      <AlertDialog>
                                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                          <AlertDialogContent>
                                              <AlertDialogHeader><AlertDialogTitle>Excluir camada?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isso excluirá permanentemente a camada e todas as suas variações.</AlertDialogDescription></AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteClick(e, layer.id); }}>Excluir</AlertDialogAction>
                                              </AlertDialogFooter>
                                          </AlertDialogContent>
                                      </AlertDialog>
                                    </>
                                  )}
                              </div>
                              
                              {!layer.isBackground && (
                                <>
                                  <Separator className="my-1 w-full" />
                                  <LayerVariationsControl layer={layer} />
                                  <Separator className="my-1 w-full" />
                                  <LayerAdjustments layer={layer} />
                                </>
                              )}

                          </div>
                      </PopoverContent>
                      </Popover>
                  );
                  })}
              </div>
              <ScrollBar orientation="horizontal" className="landscape:hidden" />
              <ScrollBar orientation="vertical" className="hidden landscape:block" />
          </ScrollArea>
        )}
      </div>
    </TooltipProvider>
  );
}
