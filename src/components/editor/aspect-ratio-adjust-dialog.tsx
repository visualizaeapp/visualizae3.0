
'use client';

import { useState, useEffect, useRef } from 'react';
import { useEditor } from '@/hooks/use-editor-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Wand2, Crop, AlertTriangle, Image as ImageIcon, Sparkles } from 'lucide-react';
import { Slider } from '../ui/slider';
import { generateVariationAction } from '@/app/actions';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { AspectRatio } from '@/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { PROMPT_CATEGORIES } from '@/lib/prompts';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { resizeImage, resizeToClosestStandard } from '@/lib/utils/image';

const getCroppedImageDataUrl = (image: HTMLImageElement, targetRatioValue: number, cropOffset: number): Promise<string> => {
  return new Promise((resolve) => {
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return resolve('');

    const originalRatio = image.naturalWidth / image.naturalHeight;
    let sWidth = image.naturalWidth;
    let sHeight = image.naturalHeight;
    let sx = 0;
    let sy = 0;

    if (originalRatio > targetRatioValue) { // Crop width
      sWidth = image.naturalHeight * targetRatioValue;
      const offsetRange = image.naturalWidth - sWidth;
      // Map cropOffset (-50 to 50) to the slidable range (0 to offsetRange)
      sx = (cropOffset + 50) / 100 * offsetRange;
    } else { // Crop height
      sHeight = image.naturalWidth / targetRatioValue;
      const offsetRange = image.naturalHeight - sHeight;
      // Map cropOffset (-50 to 50) to the slidable range (0 to offsetRange)
      sy = (cropOffset + 50) / 100 * offsetRange;
    }

    tempCanvas.width = sWidth;
    tempCanvas.height = sHeight;
    ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
    resolve(tempCanvas.toDataURL());
  });
};

export default function AspectRatioAdjustDialog() {
  const { aspectRatioData, setAspectRatioData, addVariationToLayer, isProMode } = useEditor();
  const [isLoading, setIsLoading] = useState(false);
  const [cropOffset, setCropOffset] = useState(0); // Range -50 to 50
  const [originalDims, setOriginalDims] = useState<{ width: number, height: number } | null>(null);
  const [prompt, setPrompt] = useState('');
  const { toast } = useToast();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  const isOpen = !!aspectRatioData;
  // Correctly get initialDataUrl from the source
  const initialDataUrl = aspectRatioData?.source.type === 'layer'
    ? aspectRatioData.source.layer.variations[aspectRatioData.source.layer.activeVariationIndex].dataUrl
    : aspectRatioData?.source.initialDataUrl;

  useEffect(() => {
    if (isOpen) {
      if (initialDataUrl) {
        const img = new window.Image();
        img.src = initialDataUrl;
        img.onload = () => {
          setOriginalDims({ width: img.naturalWidth, height: img.naturalHeight });
          // Force re-render to ensure imageContainerRef is available for calculations
          setTimeout(() => setForceUpdate(Date.now()), 0);
        };
      }

      const handleResize = () => setForceUpdate(Date.now());
      window.addEventListener('resize', handleResize);

      if (aspectRatioData?.source.type === 'layer') {
        const layer = aspectRatioData.source.layer;
        const lastPrompt = [...layer.variations].reverse().find(v => v.generationData?.prompt)?.generationData?.prompt;
        setPrompt(lastPrompt || '');
      } else {
        setPrompt('');
      }

      return () => window.removeEventListener('resize', handleResize);

    } else {
      setOriginalDims(null);
      setCropOffset(0);
      setPrompt('');
    }
  }, [isOpen, initialDataUrl, aspectRatioData]);

  const handleQuickPromptSelect = (value: string) => {
    if (value === 'none') return;
    setPrompt(prev => prev ? `${prev.trim().length > 0 ? prev.trim() + ', ' : ''}${value}` : value);
  };

  const handleAction = async (shouldCrop: boolean) => {
    if (!aspectRatioData) return;

    setIsLoading(true);

    try {
      const { source, targetRatio, onConfirm } = aspectRatioData;
      const sourceDataUrl = initialDataUrl;

      if (!sourceDataUrl) throw new Error("Nenhuma imagem de origem encontrada.");

      const originalImageElement = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new window.Image();
        image.crossOrigin = 'anonymous';
        image.src = sourceDataUrl;
        image.onload = () => resolve(image);
        image.onerror = reject;
      });

      let preResizeImage: string;

      if (shouldCrop) {
        preResizeImage = await getCroppedImageDataUrl(originalImageElement, targetRatio.ratio, cropOffset);
      } else {
        preResizeImage = sourceDataUrl;
      }

      if (source.type === 'initial-background' && onConfirm) {
        // ALWAYS RESIZE TO STANDARD
        const { dataUrl: finalImage, width: finalWidth, height: finalHeight } = await resizeToClosestStandard(preResizeImage, isProMode);
        onConfirm({ dataUrl: finalImage, width: finalWidth, height: finalHeight });

      } else if (source.type === 'layer') {

        const { dataUrl: imageForUpscale, width: upscaledWidth, height: upscaledHeight } = await resizeToClosestStandard(preResizeImage, isProMode);
        const result = await generateVariationAction({ prompt, imageToEdit: imageForUpscale, isProMode });

        if (result.error) {
          throw new Error(result.error);
        }
        if (!result.image) throw new Error('AI generation failed to return an image.');

        const targetVariation = source.layer.variations[source.layer.activeVariationIndex];
        const resizedResult = await resizeImage(result.image, targetVariation.width, targetVariation.height);

        addVariationToLayer(source.layer.id, resizedResult, {
          type: 'variation',
          prompt: prompt || 'Variation',
          originalDataUrl: sourceDataUrl,
          upscaledResolution: { width: upscaledWidth, height: upscaledHeight },
          generationResolution: { width: result.width ?? 0, height: result.height ?? 0 },
        });

        toast({ title: 'Variação criada!', description: 'Sua imagem foi gerada com sucesso.' });
      }

      handleClose();

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido.";
      toast({ variant: 'destructive', title: 'Erro', description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setAspectRatioData(null);
  };

  if (!isOpen || !aspectRatioData || !aspectRatioData.targetRatio || !originalDims) {
    return null;
  }

  const { width, height } = originalDims;
  const originalRatioValue = width / height;
  const targetRatio = aspectRatioData.targetRatio;
  const isWidthCrop = originalRatioValue > targetRatio.ratio;
  const isInitialBackground = aspectRatioData.source.type === 'initial-background';

  if (!initialDataUrl) return null;

  let croppedWidth, croppedHeight;
  if (isWidthCrop) {
    croppedWidth = height * targetRatio.ratio;
    croppedHeight = height;
  } else {
    croppedWidth = width;
    croppedHeight = width / targetRatio.ratio;
  }

  const isVerticalLayout = targetRatio.ratio < 0.8;

  const getRenderedImageRect = () => {
    if (!imageContainerRef.current || !originalDims.width || !originalDims.height) return { x: 0, y: 0, width: 0, height: 0 };

    const { naturalWidth, naturalHeight } = originalDims;
    const { clientWidth: containerWidth, clientHeight: containerHeight } = imageContainerRef.current;

    const imageAspectRatio = naturalWidth / naturalHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    let renderWidth, renderHeight, x, y;

    if (imageAspectRatio > containerAspectRatio) {
      renderWidth = containerWidth;
      renderHeight = containerWidth / imageAspectRatio;
      x = 0;
      y = (containerHeight - renderHeight) / 2;
    } else {
      renderHeight = containerHeight;
      renderWidth = containerHeight * imageAspectRatio;
      x = (containerWidth - renderWidth) / 2;
      y = 0;
    }
    return { x, y, width: renderWidth, height: renderHeight };
  }

  const renderedImageRect = getRenderedImageRect();

  let leftCurtainStyle: React.CSSProperties = { display: 'none' };
  let rightCurtainStyle: React.CSSProperties = { display: 'none' };
  let topCurtainStyle: React.CSSProperties = { display: 'none' };
  let bottomCurtainStyle: React.CSSProperties = { display: 'none' };

  if (isWidthCrop) {
    const cropBoxWidth = renderedImageRect.height * targetRatio.ratio;
    const slidableWidth = renderedImageRect.width - cropBoxWidth;
    const currentOffset = (cropOffset + 50) / 100 * slidableWidth;

    leftCurtainStyle = {
      position: 'absolute',
      left: `${renderedImageRect.x}px`,
      top: `${renderedImageRect.y}px`,
      height: `${renderedImageRect.height}px`,
      width: `${currentOffset}px`,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRight: '2px solid hsl(var(--primary))'
    };
    rightCurtainStyle = {
      position: 'absolute',
      right: `${renderedImageRect.x}px`,
      top: `${renderedImageRect.y}px`,
      height: `${renderedImageRect.height}px`,
      width: `${slidableWidth - currentOffset}px`,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderLeft: '2px solid hsl(var(--primary))'
    };

  } else { // Height crop
    const cropBoxHeight = renderedImageRect.width / targetRatio.ratio;
    const slidableHeight = renderedImageRect.height - cropBoxHeight;
    const currentOffset = (cropOffset + 50) / 100 * slidableHeight;

    topCurtainStyle = {
      position: 'absolute',
      top: `${renderedImageRect.y}px`,
      left: `${renderedImageRect.x}px`,
      width: `${renderedImageRect.width}px`,
      height: `${currentOffset}px`,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderBottom: '2px solid hsl(var(--primary))'
    };
    bottomCurtainStyle = {
      position: 'absolute',
      bottom: `${renderedImageRect.y}px`,
      left: `${renderedImageRect.x}px`,
      width: `${renderedImageRect.width}px`,
      height: `${slidableHeight - currentOffset}px`,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderTop: '2px solid hsl(var(--primary))'
    };
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl flex flex-col h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-amber-500" />
            Ajustar Proporção para Padrão
          </DialogTitle>
          <DialogDescription>
            {isInitialBackground
              ? `Para começar, a sua imagem de fundo de ${width}x${height}px (Proporção: ${originalRatioValue.toFixed(2)}) não corresponde a uma proporção padrão. Para melhores resultados, você pode recortá-la para a proporção padrão mais próxima: ${targetRatio.name} (${croppedWidth.toFixed(0)}x${croppedHeight.toFixed(0)}px, Proporção: ${targetRatio.ratio.toFixed(2)}). Ou, se preferir, pode usar a imagem original sem recortar.`
              : `A imagem original de ${width}x${height}px (Proporção: ${originalRatioValue.toFixed(2)}) não corresponde a uma proporção padrão. Para um melhor resultado, a imagem pode ser cortada para ${croppedWidth.toFixed(0)}x${croppedHeight.toFixed(0)}px (Proporção: ${targetRatio.ratio.toFixed(2)}). Se gerar sem cortar, o resultado será redimensionado para as dimensões originais, o que pode causar distorção.`
            }
          </DialogDescription>
        </DialogHeader>

        <div className={cn(
          "flex-1 my-4 flex justify-center items-center gap-4 overflow-hidden min-h-0",
          isVerticalLayout ? "flex-row" : "flex-col",
        )}>
          <div ref={imageContainerRef} className="relative w-full h-full flex-1 flex items-center justify-center bg-muted/30 rounded-md">
            <Image
              key={initialDataUrl}
              src={initialDataUrl}
              alt="Preview da camada"
              fill
              className="object-contain"
            />
            <div style={leftCurtainStyle}></div>
            <div style={rightCurtainStyle}></div>
            <div style={topCurtainStyle}></div>
            <div style={bottomCurtainStyle}></div>
          </div>
          <div className={cn(
            "flex items-center justify-center gap-2",
            isVerticalLayout ? "flex-col h-full py-4" : "flex-row w-full pt-4",
            isVerticalLayout ? "w-20" : "max-w-[400px]"
          )}>
            <span className="text-xs text-muted-foreground">{isWidthCrop ? 'Posição Horizontal' : 'Posição Vertical'}</span>
            <Slider
              orientation={isVerticalLayout ? 'vertical' : 'horizontal'}
              value={[cropOffset]}
              onValueChange={(v) => setCropOffset(v[0])}
              min={-50}
              max={50}
              step={1}
              className={cn(isVerticalLayout && "h-full")}
              inverted={isVerticalLayout}
            />
          </div>
        </div>

        {!isInitialBackground && (
          <div className='space-y-2'>
            <Label htmlFor="aspect-ratio-prompt">Prompt</Label>
            <div className="relative">
              <Textarea
                id="aspect-ratio-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={"Ex: um gato com um chapéu de mago"}
                className="pr-10"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {Object.entries(PROMPT_CATEGORIES).map(
                    ([category, prompts]) => (
                      <DropdownMenuGroup key={category}>
                        <DropdownMenuLabel>{category}</DropdownMenuLabel>
                        {prompts.map((p) => (
                          <DropdownMenuItem
                            key={p.name}
                            onSelect={() => handleQuickPromptSelect(p.value)}
                          >
                            {p.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 shrink-0">
          {isInitialBackground ? (
            <Button variant="outline" onClick={() => handleAction(false)} disabled={isLoading}>
              <ImageIcon className="mr-2 h-4 w-4" />
              {isLoading ? 'Processando...' : 'Usar Imagem Original'}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => handleAction(false)} disabled={isLoading}>
              <Wand2 className="mr-2 h-4 w-4" />
              {isLoading ? 'Gerando...' : 'Gerar Sem Corte'}
            </Button>
          )}
          <Button onClick={() => handleAction(true)} disabled={isLoading}>
            <Crop className="mr-2 h-4 w-4" />
            {isLoading ? 'Processando...' : isInitialBackground ? 'Confirmar Corte e Criar Fundo' : 'Confirmar Corte e Criar Variação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
