
'use client';

import { useEditor } from '@/hooks/use-editor-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Crop, Wand2, LayoutGrid, Check, X, Maximize } from 'lucide-react';
import { useState } from 'react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useAuthActions } from '@/hooks/use-auth-actions';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

export default function SelectionActions() {
  const { 
    selection, 
    zoom, 
    offset, 
    tool, 
    performCrop, 
    isSelectionActionMenuVisible, 
    prepareSelectionSplit, 
    selectionDivisionPreview, 
    confirmSelectionSplit, 
    setSelectionDivisionPreview,
    canGenerate,
    selectAll,
  } = useEditor();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { setIsPricingDialogOpen, handleSignIn } = useAuthActions();
  const { toast } = useToast();

  const handleCrop = async () => {
    setIsLoading('crop');
    await performCrop(false);
    setIsLoading(null);
  };

  const handleRender = async () => {
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

    setIsLoading('render');
    await performCrop(true);
    setIsLoading(null);
  }
  
  const handlePrepareSplit = (numDivisions: number) => {
    prepareSelectionSplit(numDivisions);
  }

  const handleConfirmSplit = async () => {
    setIsLoading('split');
    await confirmSelectionSplit();
    setIsLoading(null);
  }

  const handleCancelSplit = () => {
    setSelectionDivisionPreview({ isActive: false, rects: [] });
  }

  if (!selection.visible || !isSelectionActionMenuVisible || tool !== 'rectangle' || (selection.width === 0 && selection.height === 0)) {
    return null;
  }
  
  const selWidth = Math.abs(selection.width);
  const selHeight = Math.abs(selection.height);
  const selX = selection.width < 0 ? selection.x + selection.width : selection.x;
  const selY = selection.height < 0 ? selection.y + selection.height : selection.y;

  const top = (selY + selHeight) * zoom + offset.y + 10;
  const left = selX * zoom + offset.x;
  const width = selWidth * zoom;
  
  const renderButton = (
    <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleRender} disabled={!!isLoading}>
      {isLoading === 'render' ? 'Renderizando...' : <> <Wand2 className="h-3 w-3" /> Renderizar </>}
    </Button>
  );

  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        transformOrigin: 'top center',
      }}
    >
      <TooltipProvider delayDuration={0}>
        <div className="flex items-center gap-1 p-1 bg-card rounded-lg border shadow-lg">
          {selectionDivisionPreview.isActive ? (
            <>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleCancelSplit} disabled={!!isLoading}>
                 <X className="h-3 w-3" />
                 Cancelar
              </Button>
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleConfirmSplit} disabled={!!isLoading}>
                {isLoading === 'split' ? 'Dividindo...' : <><Check className="h-3 w-3" /> Confirmar Divisão</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleCrop} disabled={!!isLoading}>
                {isLoading === 'crop' ? 'Recortando...' : <> <Crop className="h-3 w-3" /> Recortar </>}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                    {renderButton}
                </TooltipTrigger>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" disabled={!!isLoading}>
                    <LayoutGrid className="h-3 w-3" />
                    Dividir
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center">
                  {[2, 3, 4].map(num => (
                    <DropdownMenuItem key={num} onSelect={() => handlePrepareSplit(num)} disabled={!!isLoading}>
                      Dividir em {num} camadas
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
               <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={selectAll} disabled={!!isLoading}>
                <Maximize className="h-3 w-3" />
                Selecionar Tudo
              </Button>
            </>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}
