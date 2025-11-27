
'use client';

import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Gem, Sparkles, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createCheckoutSession } from '@/app/actions/stripe-actions';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { PLANS } from '@/lib/stripe-plans';
import { useParams } from 'next/navigation';

type PlanId = (typeof PLANS)[number]['id'];

const plans = [
  {
    id: 'starter' as PlanId,
    name: 'Starter',
    price: '$2.99',
    renders: 50,
    icon: Sparkles,
  },
  {
    id: 'pro' as PlanId,
    name: 'Pro',
    price: '$5.99',
    renders: 150,
    icon: Star,
    isPopular: true,
  },
  {
    id: 'da-vinci' as PlanId,
    name: 'Da Vinci',
    price: '$14.99',
    renders: 400,
    icon: Gem,
  },
];

export default function PricingDialog() {
  const { user } = useUser();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<PlanId | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('pro');
  const params = useParams();
  const projectId = typeof params.projectId === 'string' ? params.projectId : '';


  const handleSubscription = async () => {
    if (!user?.email) {
      toast({
        variant: 'destructive',
        title: 'Você não está logado',
        description: 'Por favor, faça login para assinar um plano.',
      });
      return;
    }
    
    if (!projectId) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'ID do projeto não encontrado. Não é possível iniciar o checkout.',
      });
      return;
    }

    setIsLoading(selectedPlanId);
    
    const result = await createCheckoutSession({ 
      planId: selectedPlanId, 
      userId: user.uid, 
      projectId, 
      userEmail: user.email,
      stripeCustomerId: user.stripeCustomerId,
    });

    if (result?.error) {
      toast({
        variant: 'destructive',
        title: 'Erro no Checkout',
        description: result.error,
      });
      setIsLoading(null);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <DialogContent className="w-[90vw] max-w-4xl flex flex-col">
      <DialogHeader>
        <DialogTitle className="text-center text-3xl font-bold">Torne-se Pro</DialogTitle>
        <DialogDescription className="text-center text-lg text-muted-foreground">
          Escolha o plano perfeito para turbinar sua criatividade.
        </DialogDescription>
      </DialogHeader>
      
      <div className="py-6 flex-1 flex flex-col justify-center">
        <div className="flex w-full space-x-2 md:space-x-4">
          {plans.map((plan) => (
              <Card 
              key={plan.name} 
              className={cn(
                  'flex-1 flex flex-col text-center cursor-pointer transition-all', 
                  selectedPlanId === plan.id && 'border-primary ring-2 ring-primary shadow-lg',
                  plan.isPopular && 'border-primary'
              )}
              onClick={() => setSelectedPlanId(plan.id)}
              >
              {plan.isPopular && (
                  <div className="bg-primary text-primary-foreground text-xs font-bold text-center py-1 rounded-t-lg">
                      MAIS POPULAR
                  </div>
              )}
              <CardHeader className="items-center pb-2 px-2">
                  <CardTitle className="text-base md:text-xl">{plan.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center items-center py-2 px-2">
                  <p className="text-3xl md:text-4xl font-bold">{plan.renders}</p>
                  <p className="text-xs md:text-sm text-muted-foreground -mt-1">renders</p>
              </CardContent>
              <CardFooter className="flex-col gap-1 px-2 pb-2">
                  <p className="font-semibold text-sm md:text-base">{plan.price}<span className="text-xs text-muted-foreground">/mês</span></p>
              </CardFooter>
              </Card>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button 
          className="w-full" 
          size="lg" 
          onClick={handleSubscription}
          disabled={!!isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Assinar plano ${selectedPlan?.name || ''}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
