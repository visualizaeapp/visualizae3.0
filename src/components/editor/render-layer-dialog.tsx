

'use client';

import { useState, useEffect, useRef } from 'react';
import { useEditor } from '@/hooks/use-editor-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Image from 'next/image';
import { Wand2, X, Upload, ChevronLeft, ChevronRight, Sparkles, Layers, BrainCircuit, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PROMPT_CATEGORIES } from '@/lib/prompts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import type { AspectRatio, LayerVariation, Selection } from '@/types';
import { cn } from '@/lib/utils';
import { ASPECT_RATIOS } from '@/lib/consts';
import { useUser } from '@/firebase';
import { useAuthActions } from '@/hooks/use-auth-actions';
import { describeImageAction } from '@/app/actions';
import { resizeImage, resizeToClosestStandard } from '@/lib/utils/image';

const ReferenceSlot = ({
  index,
  referenceData,
  onReferenceChange,
  isSelected,
  onSelect,
  className,
}: {
  index: number;
  referenceData: string | null;
  onReferenceChange: (index: number, data: string | null) => void;
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
}) => {
  const { layers } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onReferenceChange(index, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const allLayers = layers;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative group h-14 min-w-20 flex-shrink-0 rounded-md border-2 border-dashed flex items-center justify-center text-center text-muted-foreground transition-all cursor-pointer",
        isSelected ? "border-primary" : "border-border",
        className
      )}
    >
      {referenceData ? (
        <>
          <Image src={referenceData} alt={`Referência ${index + 1}`} fill className="object-cover rounded-sm" />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 z-20"
            onClick={(e) => {
              e.stopPropagation();
              onReferenceChange(index, null);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <div className="flex items-center justify-center gap-2 w-full px-2">
          <Select
            onValueChange={(val) => {
              const layer = allLayers.find(l => l.id === val);
              if (layer) {
                onReferenceChange(index, layer.variations[layer.activeVariationIndex].dataUrl);
              }
            }}
          >
            <SelectTrigger className="h-7 w-7 text-xs px-1">
              <Layers className="h-4 w-4" />
            </SelectTrigger>
            <SelectContent>
              {allLayers.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  <div className="flex items-center gap-2">
                    <div className="relative w-5 h-5 rounded-sm overflow-hidden flex-shrink-0">
                      <Image src={l.variations[l.activeVariationIndex].dataUrl} alt={l.name} fill sizes="20px" className="object-cover" />
                    </div>
                    <span className="truncate">{l.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-7 w-7 text-xs px-1" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            <Upload className="h-4 w-4" />
          </Button>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
};


export default function RenderLayerDialog() {
  const { renderLayerData, setRenderLayerData, addGenerationJob, layers, generationCount, setGenerationCount, canGenerate } = useEditor();
  const { user } = useUser();
  const { setIsPricingDialogOpen, handleSignIn } = useAuthActions();
  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState<(string | null)[]>([null, null, null]);
  const [variationCycleIndex, setVariationCycleIndex] = useState(0);
  const [selectedRefIndex, setSelectedRefIndex] = useState<number | null>(null);
  const { toast } = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [previewImageDims, setPreviewImageDims] = useState<{ width: number; height: number } | null>(null);
  const [isDescribing, setIsDescribing] = useState(false);

  const isOpen = !!renderLayerData;
  const targetLayer = renderLayerData?.layerId ? layers.find(l => l.id === renderLayerData.layerId) : null;

  useEffect(() => {
    if (isOpen && targetLayer) {
      setVariationCycleIndex(targetLayer.activeVariationIndex);

      const lastVariationWithRefs = [...targetLayer.variations].reverse().find(v => v.generationData?.referenceImages && v.generationData.referenceImages.length > 0);

      if (targetLayer.activeVariationIndex > 0) {
        const lastVariationWithPrompt = [...targetLayer.variations].reverse().find(v => v.generationData?.prompt);
        const promptToSet = lastVariationWithPrompt?.generationData?.prompt || '';
        const isBackgroundPrompt = promptToSet.match(/^Lay \d+$/);
        setPrompt(isBackgroundPrompt ? '' : promptToSet);
      } else {
        setPrompt('');
      }

      const refsToSet = lastVariationWithRefs?.generationData?.referenceImages || [];
      const newReferences = [null, null, null];
      refsToSet.forEach((ref, index) => {
        if (index < 3) newReferences[index] = ref;
      });
      setReferences(newReferences);
      setSelectedRefIndex(0);
    }
  }, [isOpen, targetLayer]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (selectedRefIndex === null) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target?.result as string;
              handleReferenceChange(selectedRefIndex, dataUrl);

              const nextEmptyIndex = references.findIndex((ref, idx) => idx > selectedRefIndex && ref === null);
              if (nextEmptyIndex !== -1) {
                setSelectedRefIndex(nextEmptyIndex);
              } else {
                const firstEmptyIndex = references.findIndex(ref => ref === null);
                setSelectedRefIndex(firstEmptyIndex !== -1 ? firstEmptyIndex : null);
              }
            };
            reader.readAsDataURL(blob);
          }
          event.preventDefault();
          return;
        }
      }
    };

    const dialogNode = dialogRef.current;
    if (dialogNode) {
      dialogNode.addEventListener('paste', handlePaste);
    }
    return () => {
      if (dialogNode) {
        dialogNode.removeEventListener('paste', handlePaste);
      }
    };
  }, [selectedRefIndex, references]);

  const handleDisplayChange = (direction: 'next' | 'prev') => {
    if (!targetLayer) return;

    const totalItems = targetLayer.variations.length;

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (variationCycleIndex + 1) % totalItems;
    } else {
      nextIndex = (variationCycleIndex - 1 + totalItems) % totalItems;
    }

    setVariationCycleIndex(nextIndex);
  };

  const handleReferenceChange = (index: number, data: string | null) => {
    setReferences(prev => {
      const newRefs = [...prev];
      newRefs[index] = data;
      return newRefs;
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetLayer) {
      toast({ variant: 'destructive', title: 'Erro Interno', description: 'Dados de renderização não encontrados.' });
      return;
    }

    if (!user) {
      toast({ title: 'Faça o login para continuar', description: 'Você precisa estar logado para gerar imagens.', variant: 'destructive', action: <Button onClick={handleSignIn}>Fazer Login</Button> });
      return;
    }

    const isInfiniteUser = user.email === 'visualizaeapp@gmail.com';

    if (!isInfiniteUser && user.credits <= 0) {
      toast({ title: 'Ops! Seus créditos se esgotaram.', description: 'Para continuar criando, por favor, assine um de nossos planos.' });
      setIsPricingDialogOpen(true);
      return;
    }

    if (!prompt && !references.some(r => r)) {
      toast({ variant: 'destructive', title: 'Faltando informações', description: 'É necessário um prompt ou uma imagem de referência.' });
      return;
    }

    const activeRefs = references.filter(r => r !== null) as string[];
    const totalJobs = generationCount * (activeRefs.length > 0 ? 1 : 1);

    if (!isInfiniteUser && user.credits < totalJobs) {
      toast({ variant: 'destructive', title: 'Créditos Insuficientes', description: `Você precisa de ${totalJobs} créditos, mas só tem ${user.credits}.` });
      return;
    }

    const isUpscale = prompt.includes('A imagem fornecida é uma');

    for (let i = 0; i < generationCount; i++) {
      const variedPrompt = generationCount > 1 ? `${prompt} (variação ${i + 1})` : prompt;
      addGenerationJob({
        layerId: targetLayer.id,
        sourceVariationIndex: variationCycleIndex,
        prompt: variedPrompt,
        referenceImages: activeRefs,
        jobIndexInBatch: i,
        totalJobsInBatch: generationCount,
        type: isUpscale ? 'smart-fill' : 'variation',
      });
    }

    handleClose();
  };

  const handleClose = () => {
    setRenderLayerData(null);
  };

  const getDisplayText = () => {
    if (!targetLayer) return 'Imagem de origem';

    const hasBuiltInOriginal = targetLayer.variations[0]?.generationData?.type === 'render-crop' || targetLayer.variations[0]?.generationData?.type === 'split';

    if (hasBuiltInOriginal) {
      return variationCycleIndex === 0 ? "Original" : `Variação ${variationCycleIndex}`;
    }

    return `Variação ${variationCycleIndex + 1}`;
  };

  const canNavigate = targetLayer && targetLayer.variations.length > 1;

  const currentDisplayImage = targetLayer ? targetLayer.variations[variationCycleIndex]?.dataUrl : undefined;

  const handleQuickPromptSelect = async (action: string) => {
    if (action === 'smart-upscale') {
      if (!currentDisplayImage) return;
      setIsDescribing(true);
      try {
        const { description } = await describeImageAction({ imageToDescribe: currentDisplayImage });

        const finalPrompt = `A imagem fornecida é uma ${description || '[descrição da seleção]'} de baixa resolução. Por favor, aumente a resolução da imagem para uma imagem de alta resolução e perfeitamente detalhada.

NÃO adicione nenhum elemento ou renderize fora do assunto da imagem de referência fornecida. A imagem resultante deve ser uma versão mais clara e de maior resolução da entrada, e nada mais, e corresponder em formas e cores.

No entanto, se o conteúdo da imagem não puder ser determinado, você tem a liberdade de ser criativo e adicionar objetos ou texturas que correspondam às formas e cores da imagem.`;
        setPrompt(finalPrompt);

      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Erro ao Descrever Imagem', description: e.message });
      } finally {
        setIsDescribing(false);
      }
    } else {
      setPrompt(prev => prev ? `${prev.trim().length > 0 ? prev.trim() + ', ' : ''}${action}` : action);
    }
  };

  const isRenderButtonDisabled = (!prompt && !references.some(ref => ref)) || isDescribing;

  useEffect(() => {
    if (currentDisplayImage) {
      const img = new window.Image();
      img.src = currentDisplayImage;
      img.onload = () => {
        setPreviewImageDims({ width: img.width, height: img.height });
      };
    } else {
      setPreviewImageDims(null);
    }
  }, [currentDisplayImage, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        ref={dialogRef}
        className="w-[80vw] h-[80vh] max-w-6xl flex flex-col"
        onClick={() => setSelectedRefIndex(null)}
      >
        <DialogHeader>
          <DialogTitle>Renderizar Camada</DialogTitle>
          <DialogDescription className="hidden md:block">Use IA para gerar uma nova camada. Forneça um prompt e, opcionalmente, imagens de referência.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 relative bg-muted/30">
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div
                className={cn(
                  "relative bg-muted/30",
                )}
                style={{
                  aspectRatio: previewImageDims ? previewImageDims.width / previewImageDims.height : 1,
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
              >
                {currentDisplayImage ? (
                  <Image
                    key={currentDisplayImage}
                    src={currentDisplayImage}
                    alt="Imagem de origem"
                    width={previewImageDims?.width || 512}
                    height={previewImageDims?.height || 512}
                    className="object-contain w-auto h-auto max-w-full max-h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground p-8">Nenhuma imagem selecionada</div>
                )}
              </div>
            </div>
            {canNavigate && (
              <>
                <Button type="button" size="icon" variant="ghost" className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-card/50 hover:bg-card/90" onClick={() => handleDisplayChange('prev')}> <ChevronLeft className='h-4 w-4' /> </Button>
                <Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-card/50 hover:bg-card/90" onClick={() => handleDisplayChange('next')}> <ChevronRight className='h-4 w-4' /> </Button>
              </>
            )}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-card/80 px-3 py-1 rounded-md text-xs font-semibold">
              {getDisplayText()}
            </div>
          </div>

          <div className="pt-4">
            <form onSubmit={handleGenerate} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium text-muted-foreground hidden md:block">Referências (opcional):</p>
                {references.map((refData, index) => (
                  <ReferenceSlot
                    key={index}
                    index={index}
                    referenceData={refData}
                    onReferenceChange={handleReferenceChange}
                    isSelected={selectedRefIndex === index}
                    onSelect={() => setSelectedRefIndex(index)}
                  />
                ))}
              </div>
              <div className="flex flex-col md:flex-row items-stretch gap-2">
                <div className="relative flex-1">
                  <Textarea
                    id="render-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="h-14 min-h-[56px] w-full resize-none pr-10 font-body"
                    placeholder={"Ex: um gato com um chapéu de mago"}
                    autoFocus
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                        {isDescribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Ações Inteligentes</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => handleQuickPromptSelect('smart-upscale')}>
                          <BrainCircuit className="mr-2 h-4 w-4" />
                          Aumentar Resolução
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      {Object.entries(PROMPT_CATEGORIES).map(([category, prompts]) => (
                        <DropdownMenuGroup key={category}>
                          <DropdownMenuLabel>{category}</DropdownMenuLabel>
                          {prompts.map(p => (
                            <DropdownMenuItem key={p.name} onSelect={() => handleQuickPromptSelect(p.value)}>
                              {p.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={generationCount.toString()} onValueChange={(v) => setGenerationCount(parseInt(v))}>
                    <SelectTrigger className="h-14 w-auto px-3" aria-label="Quantidade de Gerações">
                      <SelectValue placeholder="Número de variações" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map(num => (
                        <SelectItem key={num} value={num.toString()}>
                          {`${num} ${num > 1 ? 'Variações' : 'Variação'}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="submit"
                    disabled={isRenderButtonDisabled}
                    className="h-14 flex-1 md:w-20 flex items-center justify-center shrink-0"
                  >
                    <Wand2 className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
