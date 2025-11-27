'use client';

import { useState, useEffect } from 'react';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Copy } from 'lucide-react';
import { getAllProjectCode } from '@/app/actions/dev-actions';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';

export default function CodeDumpDialog() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    getAllProjectCode()
      .then(fullCode => {
        setCode(fullCode);
      })
      .catch(error => {
        console.error('Failed to get project code:', error);
        setCode('Erro ao carregar o código do projeto.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      toast({
        title: 'Copiado!',
        description: 'Todo o código do projeto foi copiado para a área de transferência.',
      });
    }, () => {
      toast({
        variant: 'destructive',
        title: 'Falha ao Copiar',
        description: 'Não foi possível copiar o código. Por favor, copie manualmente.',
      });
    });
  };

  return (
    <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col p-4">
      <DialogHeader className='px-2'>
        <DialogTitle className='flex items-center justify-between'>
          Exportação de Código-Fonte Completo
          <Button onClick={handleCopy} size="sm" disabled={isLoading}>
            <Copy className='mr-2 h-4 w-4' />
            Copiar Tudo
          </Button>
        </DialogTitle>
        <DialogDescription>
          O conteúdo de todos os arquivos relevantes do projeto está abaixo.
        </DialogDescription>
      </DialogHeader>
      
      <div className="flex-1 min-h-0 relative mt-2">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Lendo todos os arquivos do projeto...</p>
          </div>
        ) : (
          <ScrollArea className="h-full border rounded-md">
            <pre className="text-xs p-4">
              <code>{code}</code>
            </pre>
          </ScrollArea>
        )}
      </div>
    </DialogContent>
  );
}
