

'use client';

import { useEditor } from '@/hooks/use-editor-store';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Trash2, Layers, Settings2, SlidersHorizontal, Info, RefreshCcw, Download, Pin, ChevronLeft, ChevronRight, Folder, FolderOpen, LayoutGrid, Sparkles, Wand2, Sun, Contrast, Droplets, Percent, Combine, GripVertical, RotateCcw, Crop, Feather } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { Layer, LayerVariation } from '@/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../ui/dialog';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '../ui/alert-dialog';
import { useAuthActions } from '@/hooks/use-auth-actions';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { resizeToClosestStandard } from '@/lib/utils/image';

export const LayerInfoModal = ({ layer }: { layer: Layer }) => {
    const { updateLayer, deleteVariationFromLayer } = useEditor();
    const [isDownloading, setIsDownloading] = useState(false);

    const activeVariation = layer.variations[layer.activeVariationIndex];
    if (!activeVariation) return null;

    const { prompt, timestamp, selection, referenceImages, upscaledResolution, generationResolution } = activeVariation.generationData || {};
    const originalDataUrl = activeVariation.generationData?.originalDataUrl;

    const [originalDims, setOriginalDims] = useState<{ width: number, height: number } | null>(null);

    useEffect(() => {
        if (originalDataUrl) {
            const img = new window.Image();
            img.src = originalDataUrl;
            img.onload = () => {
                setOriginalDims({ width: img.naturalWidth, height: img.naturalHeight });
            };
        } else {
            setOriginalDims(null);
        }
    }, [originalDataUrl]);

    const handleVariationChange = (direction: 'next' | 'prev') => {
        const newIndex = direction === 'next'
            ? (layer.activeVariationIndex + 1) % layer.variations.length
            : (layer.activeVariationIndex - 1 + layer.variations.length) % layer.variations.length;
        updateLayer(layer.id, { activeVariationIndex: newIndex });
    };

    const handleDelete = () => {
        if (layer.variations.length <= 1) return;
        deleteVariationFromLayer(layer.id, layer.activeVariationIndex);
    };

    const handleDownload = (url: string, name: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadUpscaled = async () => {
        if (!originalDataUrl) return;
        setIsDownloading(true);
        try {
            const { dataUrl } = await resizeToClosestStandard(originalDataUrl, activeVariation.generationData?.isProMode);
            handleDownload(dataUrl, `${layer.name}-step2-upscaled.png`);
        } catch (e) {
            console.error(e);
        } finally {
            setIsDownloading(false);
        }
    };

    const hasBuiltInOriginal = layer.variations[0]?.generationData?.type === 'render-crop' || layer.variations[0]?.generationData?.type === 'split';

    const getDisplayText = (index: number) => {
        if (hasBuiltInOriginal) {
            return index === 0 ? "Original" : `Variação ${index}`;
        }
        return `Variação ${index + 1}`;
    };

    return (
        <DialogContent className="max-w-4xl w-[90vw] bg-card max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Informações da Camada - {layer.name}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow flex flex-col md:flex-row gap-6 min-h-0">
                <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {originalDataUrl && (
                            <div className='space-y-2'>
                                <Label className="text-muted-foreground">1. Imagem de Origem</Label>
                                <div className="relative aspect-square bg-muted/30 rounded-md overflow-hidden border">
                                    <Image src={originalDataUrl} alt="Imagem de entrada" fill className="object-contain" />
                                </div>
                                {originalDims && (
                                    <p className="text-xs text-center text-muted-foreground">
                                        Dimensões: {originalDims.width} x {originalDims.height} px
                                    </p>
                                )}
                            </div>
                        )}
                        <div className='space-y-2'>
                            <Label className="text-muted-foreground">4. Resultado no Canvas</Label>
                            <div className="relative aspect-square bg-muted/30 rounded-md overflow-hidden border">
                                <Image src={activeVariation.dataUrl} alt="Imagem gerada" fill className="object-contain" />
                                {layer.variations.length > 1 && (
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-card/80 p-1 rounded-md flex items-center gap-2">
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleVariationChange('prev')}> <ChevronLeft className='h-4 w-4' /> </Button>
                                        <span className="text-xs font-bold">{getDisplayText(layer.activeVariationIndex)}</span>
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleVariationChange('next')}> <ChevronRight className='h-4 w-4' /> </Button>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-center text-muted-foreground">
                                Dimensões: {Math.round(activeVariation.width)} x {Math.round(activeVariation.height)} px
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 space-y-4">
                        {prompt && (
                            <div className='space-y-2'>
                                <Label>{activeVariation.generationData?.type === 'crop' ? 'Ação Realizada' : 'Prompt Usado'}</Label>
                                <p className="p-2 rounded-md bg-background border text-sm break-words whitespace-pre-wrap">
                                    {prompt || "N/A"}
                                </p>
                            </div>
                        )}
                        {referenceImages && referenceImages.length > 0 && (
                            <div className="space-y-2">
                                <Label>Imagens de Referência</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {referenceImages.map((ref, index) => (
                                        <div key={index} className="relative aspect-square bg-muted/30 rounded-md overflow-hidden border">
                                            <Image src={ref} alt={`Referência ${index + 1}`} fill className="object-contain" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="text-sm text-muted-foreground space-y-1 font-mono mt-4 border-t pt-2">
                            <p className="mb-2"><span className='font-bold text-foreground'>Modelo:</span> {activeVariation.generationData?.model || (activeVariation.generationData?.isProMode ? 'Gemini 3 Pro (Pro Mode)' : 'Gemini 2.5 Flash (Nano Mode)')}</p>

                            {originalDims && (
                                <div className="flex items-center gap-2">
                                    <p><span className='font-bold text-foreground'>1. Recorte Original:</span> {originalDims.width} x {originalDims.height} px (Ratio: {(originalDims.width / originalDims.height).toFixed(2)})</p>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => originalDataUrl && handleDownload(originalDataUrl, `${layer.name}-step1-original.png`)} title="Baixar Original">
                                        <Download className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}

                            {upscaledResolution ? (
                                <div className="flex items-center gap-2">
                                    <p><span className='font-bold text-foreground'>2. Enviado para IA (Upscaled):</span> {upscaledResolution.width} x {upscaledResolution.height} px (Ratio: {(upscaledResolution.width / upscaledResolution.height).toFixed(2)})</p>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleDownloadUpscaled} disabled={isDownloading} title="Baixar Upscaled">
                                        {isDownloading ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                                    </Button>
                                </div>
                            ) : (
                                <p><span className='font-bold text-foreground'>2. Enviado para IA:</span> (Sem redimensionamento)</p>
                            )}

                            {generationResolution ? (
                                <div className="flex items-center gap-2">
                                    <p><span className='font-bold text-foreground'>3. Retorno da IA:</span> {generationResolution.width} x {generationResolution.height} px (Ratio: {(generationResolution.width / generationResolution.height).toFixed(2)})</p>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleDownload(activeVariation.dataUrl, `${layer.name}-step3-ai-result.png`)} title="Baixar Resultado IA">
                                        <Download className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <p><span className='font-bold text-foreground'>3. Retorno da IA:</span> {Math.round(activeVariation.width)} x {Math.round(activeVariation.height)} px (Ratio: {(activeVariation.width / activeVariation.height).toFixed(2)})</p>
                                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleDownload(activeVariation.dataUrl, `${layer.name}-step3-ai-result.png`)} title="Baixar Resultado IA">
                                        <Download className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}

                            <p>
                                <span className='font-bold text-foreground'>4. Resultado Final (Pixels):</span> {Math.round(activeVariation.width)} x {Math.round(activeVariation.height)} px
                                <span className='ml-2 text-xs text-muted-foreground'>(Exibido: {Math.round(activeVariation.width * (activeVariation.transform.scaleX / 100))} x {Math.round(activeVariation.height * (activeVariation.transform.scaleY / 100))} px)</span>
                            </p>

                            {timestamp && <p className='text-muted-foreground mt-2 text-xs'><span className='font-bold'>Gerado em:</span> {new Date(timestamp).toLocaleString('pt-BR')}</p>}
                        </div>
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter className="mt-4 shrink-0">
                <DialogClose asChild>
                    <Button type="button">Fechar</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    )
}

export const LayerAdjustments = ({ layer }: { layer: Layer }) => {
    const { updateVariation } = useEditor();

    const activeVariation = layer.variations[layer.activeVariationIndex];
    if (!activeVariation) return null;

    const handleValueChange = (prop: keyof Omit<LayerVariation, 'dataUrl' | 'width' | 'height' | 'generationData' | 'transform'>, value: number) => {
        updateVariation(layer.id, layer.activeVariationIndex, { [prop]: value });
    };

    const handleTransformChange = (prop: keyof LayerVariation['transform'], value: number) => {
        updateVariation(layer.id, layer.activeVariationIndex, {
            transform: { ...activeVariation.transform, [prop]: value },
        });
    };

    const adjustmentControls = [
        { id: 'opacity', label: 'Opacidade', icon: Percent, prop: 'opacity' as const, value: activeVariation.opacity, max: 100 },
        { id: 'brightness', label: 'Brilho', icon: Sun, prop: 'brightness' as const, value: activeVariation.brightness, max: 200 },
        { id: 'contrast', label: 'Contraste', icon: Contrast, prop: 'contrast' as const, value: activeVariation.contrast, max: 200 },
        { id: 'saturate', label: 'Saturação', icon: Droplets, prop: 'saturate' as const, value: activeVariation.saturate, max: 200 }
    ];

    return (
        <div className="flex items-center justify-between gap-1 px-2">
            {adjustmentControls.map(control => (
                <Popover key={control.id}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="h-7 w-7" title={control.label}>
                                    <control.icon className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p>{control.label}</p></TooltipContent>
                    </Tooltip>
                    <PopoverContent className="w-56">
                        <div className="space-y-2">
                            <Label htmlFor={`${control.id}-${layer.id}`} className="text-xs">{control.label}</Label>
                            <Slider
                                id={`${control.id}-${layer.id}`}
                                value={[control.value]}
                                onValueChange={(v) => handleValueChange(control.prop, v[0])}
                                max={control.max}
                                step={1}
                            />
                        </div>
                    </PopoverContent>
                </Popover>
            ))}
            <Popover>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="h-7 w-7" title="Transformação">
                                <Settings2 className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>Transformação</p></TooltipContent>
                </Tooltip>
                <PopoverContent className="w-60">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor={`offset-x-${layer.id}`} className="text-xs">Posição X</Label>
                            <Slider
                                id={`offset-x-${layer.id}`}
                                value={[activeVariation.transform.offsetX]}
                                onValueChange={(v) => handleTransformChange('offsetX', v[0])}
                                min={-100}
                                max={100}
                                step={0.1}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`offset-y-${layer.id}`} className="text-xs">Posição Y</Label>
                            <Slider
                                id={`offset-y-${layer.id}`}
                                value={[activeVariation.transform.offsetY]}
                                onValueChange={(v) => handleTransformChange('offsetY', v[0])}
                                min={-100}
                                max={100}
                                step={0.1}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`scale-x-${layer.id}`} className="text-xs">Escala X</Label>
                            <Slider
                                id={`scale-x-${layer.id}`}
                                value={[activeVariation.transform.scaleX]}
                                onValueChange={(v) => handleTransformChange('scaleX', v[0])}
                                min={95}
                                max={105}
                                step={0.1}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`scale-y-${layer.id}`} className="text-xs">Escala Y</Label>
                            <Slider
                                id={`scale-y-${layer.id}`}
                                value={[activeVariation.transform.scaleY]}
                                onValueChange={(v) => handleTransformChange('scaleY', v[0])}
                                min={95}
                                max={105}
                                step={0.1}
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

const LayerVariationsControl = ({ layer }: { layer: Layer }) => {
    const { updateLayer, deleteVariationFromLayer, updateVariation } = useEditor();
    const canDelete = layer.variations.length > 1;
    const canNavigate = layer.variations.length > 1;
    const { toast } = useToast();

    const handleVariationChange = (direction: 'next' | 'prev') => {
        if (!canNavigate) return;
        const newIndex = direction === 'next'
            ? (layer.activeVariationIndex + 1) % layer.variations.length
            : (layer.activeVariationIndex - 1 + layer.variations.length) % layer.variations.length;

        updateLayer(layer.id, { activeVariationIndex: newIndex });
    };

    const handleDeleteVariation = () => {
        if (!canDelete) return;
        deleteVariationFromLayer(layer.id, layer.activeVariationIndex);
    };

    const handleDownloadVariation = () => {
        const activeVariation = layer.variations[layer.activeVariationIndex];
        if (!activeVariation) return;

        const link = document.createElement('a');
        link.href = activeVariation.dataUrl;
        link.download = `${layer.name}-variation-${layer.activeVariationIndex}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleReset = () => {
        updateVariation(layer.id, layer.activeVariationIndex, {
            opacity: 100,
            brightness: 100,
            contrast: 100,
            saturate: 100,
            transform: { offsetX: 0, offsetY: 0, scaleX: 100, scaleY: 100 },
        });
        toast({ title: "Ajustes Restaurados", description: `Os ajustes da ${layer.name} foram redefinidos para o padrão.` });
    };

    const hasBuiltInOriginal = layer.variations[0]?.generationData?.type === 'render-crop' || layer.variations[0]?.generationData?.type === 'split';

    const getDisplayText = (index: number) => {
        if (hasBuiltInOriginal) {
            return index === 0 ? "Original" : `Variação ${index}`;
        }
        return `Variação ${index + 1}`;
    };

    return (
        <div className="flex items-center justify-between gap-2 p-1 px-2 bg-background rounded-md flex-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleVariationChange('prev')} disabled={!canNavigate}> <ChevronLeft className='h-4 w-4' /> </Button>
            <span className="text-xs font-bold text-muted-foreground flex-1 text-center">{getDisplayText(layer.activeVariationIndex)}</span>
            <div className="flex items-center">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleVariationChange('next')} disabled={!canNavigate}> <ChevronRight className='h-4 w-4' /> </Button>
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
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" title="Excluir Variação" disabled={!canDelete}>
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

const LayerItem = ({ layer, index, isBackground = false }: { layer: Layer; index: number; isBackground?: boolean }) => {
    const {
        layers, selectedLayerIds, setSelectedLayerIds, toggleLayerVisibility,
        openCollapsibleId, setOpenCollapsibleId, deleteLayer, setRenderLayerData,
        addLayerInPlace, isBackgroundResizeMode, setIsBackgroundResizeMode,
        featherEditMode, setFeatherEditMode, updateVariation,
        applyFeathering
    } = useEditor();
    const { user } = useUser();
    const { setIsPricingDialogOpen, handleSignIn } = useAuthActions();
    const { toast } = useToast();

    const activeVariation = layer.variations[layer.activeVariationIndex];
    if (!activeVariation) return null;

    const isSelected = selectedLayerIds.includes(layer.id);
    const isFeatherEditing = featherEditMode.layerId === layer.id;

    const handleOpenChange = (isOpen: boolean) => {
        setOpenCollapsibleId(isOpen ? layer.id : null);
        if (isOpen) {
            setSelectedLayerIds([layer.id]);
        }
    };

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
            setSelectedLayerIds(prev =>
                prev.includes(layer.id) ? prev.filter(id => id !== layer.id) : [...prev, layer.id]
            );
        } else {
            if (openCollapsibleId === layer.id && !isBackground) {
                setOpenCollapsibleId(null);
            } else {
                setSelectedLayerIds([layer.id]);
                if (!isBackground) {
                    setOpenCollapsibleId(layer.id);
                }
            }
        }
    }

    const handleRenderClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!user) {
            toast({
                title: 'Faça o login para continuar',
                description: 'Você precisa estar logado para gerar imagens.',
                variant: 'destructive',
                action: <Button onClick={handleSignIn}>Fazer Login</Button>
            });
            return;
        }

        if (user.credits <= 0) {
            toast({
                title: 'Ops! Seus créditos se esgotaram.',
                description: 'Para continuar criando, por favor, assine um de nossos planos.',
            });
            setIsPricingDialogOpen(true);
            return;
        }

        if (layer.isBackground) {
            // Create a new layer from the background
            const newLayerName = `Lay ${layers.filter(l => !l.isBackground).length + 1}`;
            const newLayer = addLayerInPlace(
                [{
                    dataUrl: activeVariation.dataUrl,
                    width: activeVariation.width,
                    height: activeVariation.height,
                    generationData: {
                        type: 'variation',
                        prompt: 'Gerado a partir do fundo',
                        originalDataUrl: activeVariation.dataUrl,
                    }
                }],
                { x: layer.x, y: layer.y, width: activeVariation.width, height: activeVariation.height, visible: true },
                newLayerName
            );
            setRenderLayerData({ layerId: newLayer.id });
        } else {
            setRenderLayerData({ layerId: layer.id });
        }
    };

    const handleResizeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsBackgroundResizeMode(prev => !prev);
    }

    const handleFeatherClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFeatherEditing) {
            setFeatherEditMode({ layerId: null });
        } else {
            if (!activeVariation.originalDataUrlForFeather) {
                updateVariation(layer.id, layer.activeVariationIndex, {
                    originalDataUrlForFeather: activeVariation.dataUrl
                });
            }
            const defaultFeather = activeVariation.feather || { top: 10, right: 10, bottom: 10, left: 10 };
            applyFeathering(layer.id, layer.activeVariationIndex, defaultFeather);
            setFeatherEditMode({ layerId: layer.id });
        }
    };

    const renderButton = (
        <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRenderClick}
        >
            <Wand2 className="h-4 w-4" />
        </Button>
    );

    const resizeButton = (
        <Button
            variant={isBackgroundResizeMode ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={handleResizeClick}
        >
            <Crop className="h-4 w-4" />
        </Button>
    );

    const featherButton = (
        <Button
            variant={isFeatherEditing ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={handleFeatherClick}
        >
            <Feather className="h-4 w-4" />
        </Button>
    );

    const content = (
        <Collapsible
            open={!isBackground && openCollapsibleId === layer.id && selectedLayerIds.length === 1}
            onOpenChange={isBackground ? undefined : handleOpenChange}
            className={cn(
                'rounded-md transition-colors group',
                isSelected && !isBackground ? 'bg-primary/20' : 'hover:bg-muted/50'
            )}
        >
            <div className="flex items-center space-x-2 p-2" onClick={handleSelect}>
                <div className="flex flex-1 items-center space-x-2 cursor-pointer min-w-0">
                    <div className="relative w-10 h-10 rounded-sm overflow-hidden bg-muted flex-shrink-0">
                        <Image src={activeVariation.dataUrl} alt={layer.name} fill sizes="40px" className="object-cover" />
                    </div>
                    <p className="text-sm truncate flex-1">{layer.name}</p>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                    <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                            {renderButton}
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Renderizar Variação</p>
                        </TooltipContent>
                    </Tooltip>
                    {isBackground ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {resizeButton}
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Redimensionar Fundo (Outpainting)</p>
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                {featherButton}
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Suavizar Bordas</p></TooltipContent>
                        </Tooltip>
                    )}
                    <Dialog>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>Informações da Camada</p></TooltipContent>
                        </Tooltip>
                        <LayerInfoModal layer={layer} />
                    </Dialog>
                    {!isBackground && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}>
                                        {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Alternar Visibilidade</p></TooltipContent>
                            </Tooltip>
                            <AlertDialog>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p>Excluir Camada</p></TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Excluir camada?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação não pode ser desfeita. Isso excluirá permanentemente a camada e todas as suas variações.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteLayer(layer.id)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                </div>
            </div>
            {!isBackground && (
                <CollapsibleContent className="pb-2 pt-0 space-y-2">
                    <div className="flex items-center justify-between gap-2 px-2">
                        <LayerVariationsControl layer={layer} />
                    </div>
                    <LayerAdjustments layer={layer} />
                </CollapsibleContent>
            )}
        </Collapsible>
    );

    if (isBackground) return content;

    return (
        <Draggable draggableId={layer.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={cn(
                        'rounded-md',
                        snapshot.isDragging && "opacity-80 shadow-lg"
                    )}
                >
                    {content}
                </div>
            )}
        </Draggable>
    );
}


export default function LayersPanel() {
    const {
        layers, openCollapsibleId, setOpenCollapsibleId, selectedLayerIds, mergeLayers, reorderLayers
    } = useEditor();

    const backgroundLayer = layers.find(l => l.isBackground);
    const normalLayers = layers.filter(l => !l.isBackground);

    useEffect(() => {
        if (selectedLayerIds.length !== 1) {
            setOpenCollapsibleId(null);
        } else {
            const layerExists = layers.some(l => l.id === selectedLayerIds[0]);
            if (layerExists && !layers.find(l => l.id === selectedLayerIds[0])?.isBackground) {
                setOpenCollapsibleId(selectedLayerIds[0]);
            } else {
                setOpenCollapsibleId(null);
            }
        }
    }, [selectedLayerIds, setOpenCollapsibleId, layers]);

    const onDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination) return;
        reorderLayers(source.index, destination.index);
    }

    const hasAnyLayerAtAll = layers.length > 0;
    const reversedLayers = useMemo(() => [...normalLayers].reverse(), [normalLayers]);

    return (
        <TooltipProvider>
            <div className="p-4 h-full flex flex-col">
                <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="text-lg font-semibold font-headline">Camadas</h3>
                    {selectedLayerIds.length > 1 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Combine className="mr-2 h-4 w-4" />
                                    Mesclar {selectedLayerIds.length}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Mesclar Camadas?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Isso irá mesclar as {selectedLayerIds.length} camadas selecionadas em uma única camada. As camadas originais serão removidas. Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={mergeLayers}>Mesclar Camadas</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>

                <div className="flex-grow flex flex-col min-h-0">
                    <ScrollArea className="flex-grow pr-1">
                        <div className="space-y-1">
                            {!hasAnyLayerAtAll ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4 rounded-lg border-2 border-dashed">
                                    <Layers className="h-10 w-10 mb-2" />
                                    <p className="text-sm">Nenhuma camada ainda.</p>
                                    <p className="text-xs">Use a ferramenta de retângulo para criar novas camadas.</p>
                                </div>
                            ) : (
                                <DragDropContext onDragEnd={onDragEnd}>
                                    <Droppable droppableId="layers">
                                        {(provided) => (
                                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                                                {reversedLayers.map((layer, index) => (
                                                    <LayerItem key={layer.id} layer={layer} index={index} />
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {backgroundLayer && (
                    <>
                        <Separator className="my-2" />
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold px-2 mb-2 text-muted-foreground">Fundo</h4>
                        </div>
                        <ScrollArea className="max-h-56 pr-1">
                            <div className="space-y-1">
                                <LayerItem layer={backgroundLayer} index={0} isBackground />
                            </div>
                        </ScrollArea>
                    </>
                )}
            </div>
        </TooltipProvider>
    );
}
