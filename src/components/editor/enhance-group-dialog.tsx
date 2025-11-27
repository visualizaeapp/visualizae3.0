'use client';

import { useState, useMemo } from 'react';
import { useEditor } from '@/hooks/use-editor-store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import type { Layer } from '@/types';
import { enhanceGroupWithReferenceAction } from '@/app/actions';

export default function EnhanceGroupDialog() {
  const { enhanceGroupData, setEnhanceGroupData, layers, addLayerInPlace } = useEditor();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [prompt, setPrompt] = useState('Enhance this image to 4k resolution, using the other image as a style reference.');
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [referenceGroupId, setReferenceGroupId] = useState<string | null>(null);
  const { toast } = useToast();

  const groupedLayers = useMemo(() => {
    const groups: Record<string, { name: string; layers: Layer[] }> = {};
    layers.forEach(layer => {
        const groupKey = layer.variations[0]?.generationData?.originalLayerName;
        if (groupKey) {
            if (!groups[groupKey]) {
                const groupSize = layers.filter(l => l.variations[0]?.generationData?.originalLayerName === groupKey).length;
                groups[groupKey] = {
                    name: `${groupKey} (${groupSize} camadas)`,
                    layers: [],
                };
            }
            groups[groupKey].layers.push(layer);
        }
    });
    return groups;
  }, [layers]);

  const groupOptions = Object.keys(groupedLayers);

  const handleClose = () => {
    if (isLoading) return;
    setEnhanceGroupData({ isOpen: false });
    setTargetGroupId(null);
    setReferenceGroupId(null);
    setProgress(0);
  };

  const handleEnhance = async () => {
    if (!targetGroupId || !referenceGroupId || !prompt) {
      toast({
        variant: 'destructive',
        title: 'Faltam informações',
        description: 'Por favor, selecione os grupos e forneça um prompt.',
      });
      return;
    }

    if (targetGroupId === referenceGroupId) {
      toast({
        variant: 'destructive',
        title: 'Seleção inválida',
        description: 'O grupo alvo e o grupo de referência não podem ser os mesmos.',
      });
      return;
    }

    setIsLoading(true);
    setProgress(10); // Initial progress

    try {
      const targetLayers = groupedLayers[targetGroupId].layers;
      const referenceLayers = groupedLayers[referenceGroupId].layers;

      if (targetLayers.length !== referenceLayers.length) {
        throw new Error('Os grupos alvo e de referência devem ter o mesmo número de camadas.');
      }
      
      const targetImages = targetLayers.map(l => l.variations[l.activeVariationIndex].dataUrl);
      const referenceImages = referenceLayers.map(l => l.variations[l.activeVariationIndex].dataUrl);
      
      setProgress(30);

      const result = await enhanceGroupWithReferenceAction({
        prompt,
        targetImages,
        referenceImages,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.enhancedImages && result.enhancedImages.length > 0) {
        result.enhancedImages.forEach((image, index) => {
          const originalLayer = targetLayers[index];
          const activeVariation = originalLayer.variations[originalLayer.activeVariationIndex];
          const newGroupName = `Aprimorado: ${targetGroupId}`;

          const selection = {
              x: originalLayer.x,
              y: originalLayer.y,
              width: activeVariation.width,
              height: activeVariation.height,
              visible: true,
          };
          
          const generationData = {
              type: 'variation' as const,
              prompt: `Aprimorado: ${originalLayer.name}`,
              originalDataUrl: activeVariation.dataUrl,
              originalLayerName: newGroupName,
          };

          addLayerInPlace(
            [{ dataUrl: image, generationData }],
            selection,
            `Aprimorado: ${originalLayer.name}`,
          );
        });

        setProgress(100);
        
        toast({
          title: 'Grupo aprimorado!',
          description: 'Suas imagens foram geradas com sucesso.',
        });
        handleClose();
      } else {
        throw new Error('O aprimoramento não retornou nenhuma imagem.');
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível aprimorar o grupo.';
      toast({ variant: 'destructive', title: 'Erro de aprimoramento', description: errorMessage });
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  return (
    <Dialog open={enhanceGroupData.isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Aprimorar Grupo com Referência</DialogTitle>
          <DialogDescription>
            Use as imagens de um grupo como referência de estilo para aprimorar as imagens de outro grupo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt de Aprimoramento</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Aprimore esta imagem para resolução 4k, mantendo o estilo da imagem de referência."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-group">Grupo Alvo</Label>
              <Select onValueChange={setTargetGroupId} value={targetGroupId || undefined}>
                <SelectTrigger id="target-group">
                  <SelectValue placeholder="Selecione o grupo a ser aprimorado" />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.map(id => (
                    <SelectItem key={id} value={id} disabled={id === referenceGroupId}>{groupedLayers[id].name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference-group">Grupo de Referência</Label>
              <Select onValueChange={setReferenceGroupId} value={referenceGroupId || undefined}>
                <SelectTrigger id="reference-group">
                  <SelectValue placeholder="Selecione o grupo de referência" />
                </SelectTrigger>
                <SelectContent>
                  {groupOptions.map(id => (
                    <SelectItem key={id} value={id} disabled={id === targetGroupId}>{groupedLayers[id].name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
           {isLoading && (
            <div className="space-y-2">
                <Label>Progresso</Label>
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">Aprimorando imagens... isso pode levar um momento.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleEnhance} disabled={isLoading || !targetGroupId || !referenceGroupId}>
            <Wand2 className="mr-2 h-4 w-4" />
            {isLoading ? 'Aprimorando...' : 'Iniciar Aprimoramento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
