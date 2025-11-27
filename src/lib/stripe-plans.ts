// ESTE ARQUIVO MAPEIA OS PLANOS DO SEU APP PARA OS PREÇOS CRIADOS NO SEU PAINEL DO STRIPE.
//
// 1. Crie 3 produtos no seu Stripe Dashboard: "Starter", "Pro", e "Da Vinci".
// 2. Para cada produto, crie um preço recorrente (mensal) com os valores corretos.
// 3. Copie o "API ID" de cada PREÇO (algo como price_xxxxxxxx) e cole abaixo.

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter Plan',
    priceId: 'price_1SOQ0eDcTaCR8CCYfd4hMK5N',
  },
  {
    id: 'pro',
    name: 'Pro Plan',
    priceId: 'price_1SOQASDcTaCR8CCY69Izs4SC',
  },
  {
    id: 'da-vinci',
    name: 'Da Vinci Plan',
    priceId: 'price_1SOR7LDcTaCR8CCY5rXintQm',
  },
];
