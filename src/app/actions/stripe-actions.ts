
'use server';

import { stripe } from '@/lib/stripe';
import { PLANS } from '@/lib/stripe-plans';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminApp } from '@/firebase/admin-config';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';

interface CreateCheckoutSessionProps {
  planId: 'starter' | 'pro' | 'da-vinci';
  userId: string;
  projectId: string;
  userEmail: string | null;
  stripeCustomerId: string | null;
}

export async function createCheckoutSession(
  props: CreateCheckoutSessionProps
): Promise<{ error?: string }> {
  const { planId, userId, projectId, userEmail, stripeCustomerId } = props;
  const origin = headers().get('origin') || 'http://localhost:9002';

  const plan = PLANS.find((p) => p.id === planId);

  if (!plan) {
    return { error: 'Plano não encontrado.' };
  }

  if (!userEmail) {
    return { error: 'Não foi possível buscar as informações do usuário. Faça o login novamente.' };
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/editor/${projectId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/editor/${projectId}`,
      customer: stripeCustomerId || undefined, // Pass existing customer ID if available
      customer_email: stripeCustomerId ? undefined : userEmail, // Only pass email if creating a new customer
      // The `metadata` on the session is useful for your own records or webhooks.
      metadata: { 
        userId: userId,
        planId: planId,
      },
      // The `subscription_data.metadata` is what the Firebase extension reads to link the
      // subscription to the correct Firebase user. THIS IS CRITICAL.
      subscription_data: {
        metadata: {
          userId: userId,
          planId: planId,
        }
      }
    });
  } catch (error) {
    console.error('[STRIPE_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Não foi possível iniciar o checkout: ${errorMessage}` };
  }

  if (session?.url) {
    redirect(session.url);
  }

  return { error: 'Não foi possível criar a URL de checkout do Stripe.' };
}


export async function createBillingPortalSession(
  customerId: string,
  projectId: string,
): Promise<{ error?: string }> {
  const origin = headers().get('origin') || 'http://localhost:9002';

  let portalSession;
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/editor/${projectId}`,
    });
  } catch (error) {
    console.error('[STRIPE_PORTAL_ERROR]', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
    return { error: `Não foi possível criar a sessão do portal: ${errorMessage}` };
  }

  if (portalSession?.url) {
    redirect(portalSession.url);
  } 
  
  return { error: 'Não foi possível criar a URL do portal do cliente.' };
}


export async function syncStripeSubscription(sessionId: string, userId: string): Promise<{ success?: boolean, error?: string }> {
  if (!sessionId || !userId) {
    return { error: 'ID da sessão ou ID do usuário ausente.' };
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    
    if (session.payment_status !== 'paid') {
      return { error: 'Pagamento não concluído.' };
    }

    const subscription = session.subscription as Stripe.Subscription;
    if (!subscription) {
      throw new Error('Assinatura não encontrada na sessão do Stripe.');
    }

    // Robustly get the priceId from either the subscription item or the session metadata
    const priceId = subscription.items.data[0]?.price.id || session.metadata?.priceId;
    if (!priceId) {
      throw new Error('ID do preço não encontrado nos itens da assinatura.');
    }

    const plan = PLANS.find(p => p.priceId === priceId);
    if (!plan) {
      throw new Error(`Plano não encontrado para o priceId: ${priceId}`);
    }

    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const subscriptionId = subscription.id;
    const currentPeriodEnd = Timestamp.fromMillis(subscription.current_period_end * 1000);
    const creditsToAdd = plan.id === 'starter' ? 50 : plan.id === 'pro' ? 150 : 400;

    const adminApp = getAdminApp();
    const firestore = getFirestore(adminApp);
    const userRef = firestore.collection('users').doc(userId);

    await firestore.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error(`Usuário com UID ${userId} não encontrado no Firestore.`);
      }

      const userData = userDoc.data()!;
      // Only add credits if the subscription ID is new or different
      if (userData.stripeSubscriptionId !== subscriptionId) {
        const existingCredits = userData.credits || 0;
        transaction.update(userRef, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId: priceId,
          stripeCurrentPeriodEnd: currentPeriodEnd,
          credits: existingCredits + creditsToAdd,
        });
      } else {
        // If it's the same subscription, just update the period end
         transaction.update(userRef, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: priceId,
            stripeCurrentPeriodEnd: currentPeriodEnd,
        });
      }
    });

    return { success: true };

  } catch (error) {
    console.error('Falha ao sincronizar assinatura do Stripe:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido durante a sincronização.';
    return { error: errorMessage };
  }
}
