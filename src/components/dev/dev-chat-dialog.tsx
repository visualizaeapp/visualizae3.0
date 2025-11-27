
'use client';

import { useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { devChatAction } from '@/app/actions/ai-actions';
import { UserAvatar } from '@/components/auth/user-avatar';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/icons';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function DevChatDialog() {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', text: input };
    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const result = await devChatAction({ message: input, history: newMessages.slice(0, -1) });

      if (result.error || !result.reply) {
        throw new Error(result.error || 'A IA não retornou uma resposta.');
      }

      const modelMessage: Message = { role: 'model', text: result.reply };
      setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
      const errorMessage: Message = { role: 'model', text: 'Desculpe, ocorreu um erro ao contatar a IA.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent className="max-w-2xl w-[90vw] h-[70vh] flex flex-col p-0">
      <DialogHeader className='p-6 pb-2'>
        <DialogTitle className='flex items-center gap-2'>
          <Bot />
          Assistente de Desenvolvimento
        </DialogTitle>
        <DialogDescription>
          Converse com uma IA especialista sobre o código do Visualizae.
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="flex-1 px-6">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'model' && (
                <div className='w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0'>
                  <Sparkles className='h-5 w-5 text-primary-foreground' />
                </div>
              )}
              <div
                className={cn(
                  'max-w-sm rounded-lg px-4 py-2 text-sm whitespace-pre-wrap',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                {message.text}
              </div>
              {message.role === 'user' && user && (
                <div className='flex-shrink-0'>
                  <UserAvatar user={user} />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3 justify-start">
              <div className='w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0'>
                <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2 text-sm">
                Digitando...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <DialogFooter className='p-6 pt-2'>
        <div className="flex items-center w-full gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre a estrutura do código, funcionalidades, etc."
            className="flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
