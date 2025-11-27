
'use client';

import { signOut } from 'firebase/auth';
import { LogOut, ExternalLink, Sparkles, Crown, Settings, Bot, FileCode } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useParams } from 'next/navigation';

import { useAuth } from '@/firebase/provider';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from './user-avatar';
import { GoogleIcon } from '../icons';
import { getLatestBuildInfo, type BuildInfo } from '@/app/actions/build-actions';
import { createBillingPortalSession } from '@/app/actions/stripe-actions';
import { useToast } from '@/hooks/use-toast';
import { firebaseConfig } from '@/firebase/config';
import { useAuthActions } from '@/hooks/use-auth-actions';
import { PLANS } from '@/lib/stripe-plans';
import { Dialog, DialogTrigger } from '../ui/dialog';
import DevChatDialog from '../dev/dev-chat-dialog';
import CodeDumpDialog from '../dev/code-dump-dialog';
import { useEditor } from '@/hooks/use-editor-store';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export function UserButton() {
  const { user } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const { setIsPricingDialogOpen } = useEditor();
  const params = useParams();
  const projectId = typeof params.projectId === 'string' ? params.projectId : '';
  const [isDevChatOpen, setIsDevChatOpen] = useState(false);
  const [isCodeDumpOpen, setIsCodeDumpOpen] = useState(false);
  const isDeveloper = user?.email === 'visualizaeapp@gmail.com';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      getLatestBuildInfo().then(setBuildInfo).catch(err => {
        console.warn("Não foi possível buscar informações de build (esperado em ambiente de desenvolvimento local).", err);
        setBuildInfo(null);
      });
    }
  }, []);

  const handleSignIn = async () => {
    if (!auth) {
      console.error("Firebase Auth não inicializado. Não é possível fazer login.");
      toast({
        variant: 'destructive',
        title: 'Erro de Configuração',
        description: 'O serviço de autenticação não está disponível. Tente recarregar a página.',
      });
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Erro ao fazer login com o Google:', error.code, error.message);
      if (error.code === 'auth/popup-blocked') {
        toast({
          variant: 'destructive',
          title: 'Popup de Login Bloqueado',
          description: 'Por favor, habilite os popups para este site nas configurações do seu navegador e tente novamente.',
          duration: 10000,
        });
      } else if (error.code === 'auth/unauthorized-domain') {
        const authSettingsUrl = `https://console.firebase.google.com/u/0/project/${firebaseConfig.projectId}/authentication/settings`;
        toast({
          variant: 'destructive',
          title: 'Domínio não autorizado',
          description: (
            <div>
              <p>O domínio do aplicativo não está na lista de permissões do Firebase.</p>
              <a
                href={authSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm mt-2 underline"
              >
                Adicionar domínio no Firebase <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ),
          duration: 20000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Falha no Login',
          description: 'Não foi possível fazer login com o Google. Verifique o console para mais detalhes.',
        });
      }
    }
  };

  const handleSignOut = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Erro ao fazer logout', error);
        toast({
          variant: 'destructive',
          title: 'Falha no Logout',
          description: 'Não foi possível sair. Por favor, tente novamente.',
        });
      }
    }
  };

  const handleManageSubscription = async () => {
    if (!user?.stripeCustomerId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'ID de cliente do Stripe não encontrado. Por favor, faça login novamente.',
      });
      return;
    }
    if (!projectId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'ID do projeto não encontrado. Não é possível redirecionar.',
      });
      return;
    }
    const { error } = await createBillingPortalSession(user.stripeCustomerId, projectId);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao abrir o portal',
        description: error,
      });
    }
  };

  if (user === undefined) {
    return <Skeleton className="h-8 w-8 rounded-md" />;
  }

  if (!user) {
    return (
      <Button onClick={handleSignIn} variant="outline" size="icon" className="h-8 w-8" aria-label="Fazer login com o Google">
        <GoogleIcon className="h-4 w-4" />
      </Button>
    );
  }

  const activePlan = user.stripePriceId ? PLANS.find(p => p.priceId === user.stripePriceId) : null;
  const planName = isDeveloper ? 'Desenvolvedor' : (activePlan ? activePlan.name.replace(' Plan', '') : 'Período de Teste');

  return (
    <>
      <Dialog open={isDevChatOpen} onOpenChange={setIsDevChatOpen}>
        <Dialog open={isCodeDumpOpen} onOpenChange={setIsCodeDumpOpen}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-md p-0">
                <UserAvatar user={user} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  <div className="flex justify-between items-center text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Créditos: {isDeveloper ? '∞' : user.credits}
                    </span>
                    <span className="font-semibold text-primary">{planName}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isDeveloper ? (
                <>
                  <DialogTrigger asChild onSelect={() => setIsDevChatOpen(true)}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Bot className="mr-2 h-4 w-4" />
                      <span>Conversar com o Dev</span>
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogTrigger asChild onSelect={() => setIsCodeDumpOpen(true)}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <FileCode className="mr-2 h-4 w-4" />
                      <span>Exportar Código</span>
                    </DropdownMenuItem>
                  </DialogTrigger>
                </>
              ) : user.stripeSubscriptionId && user.stripeCustomerId ? (
                <DropdownMenuItem onSelect={handleManageSubscription} disabled={!user.stripeCustomerId}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Gerenciar Assinatura</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setIsPricingDialogOpen(true)}>
                  <Crown className="mr-2 h-4 w-4" />
                  <span>Seja Pro!</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="font-normal text-center text-xs text-muted-foreground">
                Criado por Fernando Castilho.
              </DropdownMenuLabel>
              {buildInfo ? (
                <>
                  <DropdownMenuItem disabled className="text-xs justify-center">
                    <span>Revisão {buildInfo.revisionNumber} - {buildInfo.commitHash.substring(0, 7)}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled className="text-xs justify-center -mt-2">
                    <span>{buildInfo.timestamp}</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem disabled className="text-xs justify-center">
                  <span>Revisao 00 - 31/10/2025</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {isCodeDumpOpen && <CodeDumpDialog />}
        </Dialog>
        {isDevChatOpen && <DevChatDialog />}
      </Dialog>
    </>
  );
}
