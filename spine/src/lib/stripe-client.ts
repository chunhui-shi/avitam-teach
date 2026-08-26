import Stripe from 'stripe';

let client: Stripe | null = null;

export function stripeClient(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  if (!client) {
    client = new Stripe(apiKey, { apiVersion: '2026-03-25.dahlia' });
  }
  return client;
}
