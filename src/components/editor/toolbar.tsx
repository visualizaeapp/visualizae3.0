

'use client';

import {
  RectangleHorizontal,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Frame,
  Download,
  Info,
  Eraser,
  Brush,
  LayoutGrid,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEditor } from '@/hooks/use-editor-store';
import { cn } from '@/lib/utils';
import type { Layer } from '@/types';
import React, { useRef, useState, useEffect } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '../ui/dropdown-menu';
import { Dialog, DialogTrigger } from '../ui/dialog';
import AspectRatioInfoDialog from '../editor/aspect-ratio-info-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
} from '../ui/alert-dialog';

const actionTools: { name: string, label: string, icon: React.ElementType }[] = [
    { name: 'zoom-in', label: 'Aumentar Zoom', icon: ZoomIn },
    { name: 'zoom-out', label: 'Diminuir Zoom', icon: ZoomOut },
];

const UndoButton = () => {
    const { undo, undoLongPress, history, historyIndex } = useEditor();

    const canUndo = historyIndex > 0;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={undo}
                    disabled={!canUndo}
                >
                    <Undo2 className="h-5 w-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="landscape:side-left">
                <p>Desfazer</p>
            </TooltipContent>
        </Tooltip>
    );
};

const RedoButton = () => {
    const { redo, redoLongPress, history, historyIndex } = useEditor();

    const canRedo = historyIndex < history.length - 1;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={redo}
                    disabled={!canRedo}
                >
                    <Redo2 className="h-5 w-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="landscape:side-left">
                <p>Refazer</p>
            </TooltipContent>
        </Tooltip>
    );
};


export default function Toolbar() {
  const { 
    tool,
    activateTool,
    getCanvasDataUrl,
    setZoom,
    setOffset,
    layers,
    selectedLayerIds,
    canvasRef,
    savedDivisionLayouts,
    loadDivisionLayout,
  } = useEditor();
  const [isExporting, setIsExporting] = useState(false);
  const [exportDimensions, setExportDimensions] = useState<{ width: number, height: number } | null>(null);
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
        setHostname(window.location.host);
    }
  }, []);
  
  const handleInfoButtonMouseDown = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowDebugDialog(true);
    }, 3000); // 3 seconds
  };

  const handleInfoButtonMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };


  const handleDownloadAction = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = async (format: 'png' | 'jpeg', scale: number) => {
    setIsExporting(true);
    const { dataUrl } = await getCanvasDataUrl(true, `image/${format}`, undefined, scale);
    if (dataUrl) handleDownloadAction(dataUrl, `visualizae-export.${format}`);
    setIsExporting(false);
  };
  
  const handleActionClick = (action: string) => {
    switch (action) {
      case 'zoom-in':
        setZoom((prev) => Math.min(prev * 1.2, 10));
        break;
      case 'zoom-out':
        setZoom((prev) => Math.max(prev / 1.2, 0.1));
        break;
      case 'center':
        const activeBg = layers.find((l) => l.isBackground && l.visible);
        const allLayers = activeBg
          ? [activeBg, ...layers.filter((l) => !l.isBackground)]
          : layers;
        let targetLayer: Layer | null | undefined =
          selectedLayerIds.length > 0
            ? allLayers.find((l) => l.id === selectedLayerIds[0])
            : activeBg || layers[0];

        const canvas = canvasRef.current;
        const container = canvas?.parentElement;

        if (targetLayer && container) {
          const activeVariation =
            targetLayer.variations[targetLayer.activeVariationIndex];
          if (!activeVariation) return;

          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          const layerWidth = activeVariation.width;
          const layerHeight = activeVariation.height;

          if (layerWidth === 0 || layerHeight === 0) return;

          const scaleX = containerWidth / layerWidth;
          const scaleY = containerHeight / layerHeight;
          const newZoom = Math.min(scaleX, scaleY) * 0.9;

          const newOffsetX =
            (containerWidth - layerWidth * newZoom) / 2 - targetLayer.x * newZoom;
          const newOffsetY =
            (containerHeight - layerHeight * newZoom) / 2 - targetLayer.y * newZoom;

          setZoom(newZoom);
          setOffset({ x: newOffsetX, y: newOffsetY });
        } else if (container) {
          setZoom(1);
          setOffset({ x: container.clientWidth / 2, y: container.clientHeight / 2 });
        }
        break;
      default:
        console.log('Ação não implementada:', action);
    }
  };

  const onOpenDownloadMenu = async (open: boolean) => {
    if (open) {
      setIsExporting(true); // Show loading state while calculating
      const { bounds } = await getCanvasDataUrl(
        true,
        'image/png',
        undefined,
        1,
        true
      );
      setExportDimensions(
        bounds.width > 0 ? { width: Math.round(bounds.width), height: Math.round(bounds.height) } : null
      );
      setIsExporting(false);
    } else {
      setExportDimensions(null);
    }
  };
  
  return (
    <aside className="border-t lg:border-t-0 landscape:border-t-0 landscape:border-l border-border p-2 bg-card flex items-center lg:items-start landscape:items-start justify-center">
      <TooltipProvider>
        <div className="flex items-center justify-center gap-1 landscape:flex-col landscape:h-full landscape:justify-center lg:flex-col lg:h-full lg:justify-center">
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', tool === 'rectangle' && 'bg-primary/20 text-primary')}
                onClick={() => activateTool('rectangle')}
              >
                <RectangleHorizontal className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="landscape:side-left">
              <p>Seleção Retangular</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-8 w-8', tool === 'division' && 'bg-primary/20 text-primary')}
                  >
                    <LayoutGrid className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="landscape:side-left">
                <p>Modo de Divisão</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="left" align="start">
               <DropdownMenuItem onSelect={() => activateTool('division')}>
                Ativar Modo de Divisão
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Leiautes Salvos</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {savedDivisionLayouts.length > 0 ? (
                savedDivisionLayouts.map((layout, index) => (
                  <DropdownMenuItem key={index} onSelect={() => loadDivisionLayout(index)}>
                    Leiaute {index + 1} ({layout.length} retângulos)
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>Nenhum leiaute salvo</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Separator orientation="vertical" className="h-6 lg:h-auto lg:w-6 lg:my-1 landscape:h-auto landscape:w-6 landscape:my-1" />

          <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-8 w-8', (tool === 'eraser') && 'bg-primary/20 text-primary')}
                    onClick={() => activateTool('eraser')}
                >
                    <Eraser className="h-5 w-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="landscape:side-left">
              <p>Borracha</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', tool === 'brush' && 'bg-primary/20 text-primary')}
                onClick={() => activateTool('brush')}
              >
                <Brush className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="landscape:side-left">
              <p>Pincel de Restauração</p>
            </TooltipContent>
          </Tooltip>
          
          <Separator orientation="vertical" className="h-6 lg:h-auto lg:w-6 lg:my-1 landscape:h-auto landscape:w-6 landscape:my-1" />

          <div className="flex items-center landscape:flex-col lg:flex-col gap-1">
              <UndoButton />
              <RedoButton />
          </div>
          
          <Separator orientation="vertical" className="h-6 lg:h-auto lg:w-6 lg:my-1 landscape:h-auto landscape:w-6 landscape:my-1" />
          
          <div className="hidden items-center landscape:flex-col lg:flex-col gap-1 lg:flex">
              {actionTools.map((t) => (
                  <Tooltip key={t.name}>
                      <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleActionClick(t.name)}>
                          <t.icon className="h-5 w-5" />
                      </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="landscape:side-left"><p>{t.label}</p></TooltipContent>
                  </Tooltip>
              ))}
          </div>

          <div className="flex items-center landscape:flex-col lg:flex-col gap-1">
              <Tooltip>
                  <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleActionClick('center')}>
                      <Frame className="h-5 w-5" />
                  </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="landscape:side-left">
                    <p>Centralizar na Tela</p>
                  </TooltipContent>
              </Tooltip>
          </div>
          
          <Separator orientation="vertical" className="h-6 lg:h-auto lg:w-6 lg:my-1 landscape:h-auto landscape:w-6 landscape:my-1" />
          
          <div className="flex items-center landscape:flex-col lg:flex-col gap-1">
              <DropdownMenu onOpenChange={onOpenDownloadMenu}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isExporting}>
                                <Download className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="landscape:side-left">
                      <p>Baixar Imagem</p>
                    </TooltipContent>
                </Tooltip>
                  <DropdownMenuContent side="top" className="landscape:side-left">
                  {isExporting ? (
                    <DropdownMenuItem disabled>Calculando...</DropdownMenuItem>
                  ) : exportDimensions ? (
                    <>
                      <DropdownMenuItem onClick={() => handleExport('png', 1)}>
                        Baixar PNG {exportDimensions.width}x{exportDimensions.height}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('jpeg', 1)}>
                        Baixar JPG {exportDimensions.width}x{exportDimensions.height}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleExport('png', 0.5)}>
                        Baixar PNG {Math.round(exportDimensions.width / 2)}x{Math.round(exportDimensions.height / 2)}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('jpeg', 0.5)}>
                        Baixar JPG {Math.round(exportDimensions.width / 2)}x{Math.round(exportDimensions.height / 2)}
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem disabled>Nenhum conteúdo para baixar</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

                <Dialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild
                        onMouseDown={handleInfoButtonMouseDown}
                        onMouseUp={handleInfoButtonMouseUp}
                        onMouseLeave={handleInfoButtonMouseUp}
                        onTouchStart={handleInfoButtonMouseDown}
                        onTouchEnd={handleInfoButtonMouseUp}
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Info className="h-5 w-5" />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="landscape:side-left">
                    <p>Padrões de Proporção (Segure para depurar)</p>
                  </TooltipContent>
                </Tooltip>
                <AspectRatioInfoDialog />
              </Dialog>
          </div>
        </div>

        <AlertDialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Problema: Login no Google</AlertDialogTitle>
                </AlertDialogHeader>
                <div className="text-sm text-muted-foreground text-left space-y-4 pt-2">
                    {hostname && (
                        <div>
                            <div className="font-semibold text-foreground">Ambiente Atual:</div>
                            <p className="font-mono text-xs bg-muted p-2 rounded-md mt-1 break-all">
                                {hostname}
                            </p>
                        </div>
                    )}
                    <div>
                        <div className="font-semibold text-foreground">Verificar:</div>
                        <ul className="list-disc pl-5 mt-1 space-y-2 text-sm">
                            <li>`npm run dev` (procurar erros no terminal)</li>
                            <li>
                                <span className='font-semibold'>Google Cloud Console:</span> APIs e Serviços > Tela de permissão OAuth > Clientes > Editar > Adicionar URI com `https://`
                                <p className='font-mono text-xs bg-muted p-2 rounded-md mt-1 break-all'>Ex: https://6000-firebase-studio-1761768992712.cluster-gizzoza7hzhfyxzo5d76y3flkw.cloudworkstations.dev</p>
                            </li>
                            <li>
                                <span className='font-semibold'>Firebase Authentication:</span> Configurações > Domínios autorizados
                                <p className='font-mono text-xs bg-muted p-2 rounded-md mt-1 break-all'>Ex: 9000-firebase-studio-1761768992712.cluster-gizzoza7hzhfyxzo5d76y3flkw.cloudworkstations.dev</p>
                            </li>
                        </ul>
                    </div>
                    <div>
                        <div className="font-semibold text-destructive">IMPORTANTE:</div>
                        <p className="text-sm">Sempre verifique se há trocas de caracteres, como o número `1` pela letra `l`.</p>
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setShowDebugDialog(false)}>Entendi</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </TooltipProvider>
    </aside>
  );
}
