'use client';

import { createContext, useCallback, ReactNode, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import PricingDialog from '@/components/pricing/pricing-dialog';
import { Dialog } from '@/components/ui/dialog';

interface AuthActions {
  handleSignIn: () => Promise<void>;
  isPricingDialogOpen: boolean;
  setIsPricingDialogOpen: (isOpen: boolean) => void;
}

export const AuthActionsContext = createContext<AuthActions | undefined>(undefined);

export function AuthActionsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { toast } = useToast();
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (auth) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (error: any) {
        console.error('Erro ao fazer login com o Google:', error.code, error.message);
        // A notificação de erro foi removida a pedido do usuário.
      }
    } else {
      console.error("Firebase Auth não inicializado. Não é possível fazer login.");
    }
  }, [auth, toast]);

  return (
    <AuthActionsContext.Provider value={{ handleSignIn, isPricingDialogOpen, setIsPricingDialogOpen }}>
        <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
            {children}
            <PricingDialog />
        </Dialog>
    </AuthActionsContext.Provider>
  );
}
