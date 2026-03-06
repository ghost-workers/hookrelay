// ABOUTME: Pricing tier definitions for HookRelay.
// ABOUTME: Defines free, pro, and team tiers with their limits and Stripe price IDs.

export interface TierDefinition {
  id: string;
  name: string;
  priceMonthly: number;
  maxEndpoints: number;
  maxRequestsPerDay: number;
  retentionDays: number;
  features: string[];
  stripePriceId: string | null;
  trialDays: number;
}

export const TIERS: Record<string, TierDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    maxEndpoints: 1,
    maxRequestsPerDay: 100,
    retentionDays: 1,
    features: ['1 endpoint', '100 requests/day', '24h retention'],
    stripePriceId: null,
    trialDays: 0,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 2900,
    maxEndpoints: 10,
    maxRequestsPerDay: 10000,
    retentionDays: 30,
    features: ['10 endpoints', '10K requests/day', '30-day retention', 'Replay'],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
    trialDays: 14,
  },
  team: {
    id: 'team',
    name: 'Team',
    priceMonthly: 9900,
    maxEndpoints: -1, // unlimited
    maxRequestsPerDay: 100000,
    retentionDays: 90,
    features: ['Unlimited endpoints', '100K requests/day', '90-day retention', 'Forwarding', 'Team members'],
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID || null,
    trialDays: 14,
  },
};

export function getTierList(): TierDefinition[] {
  return [TIERS.free, TIERS.pro, TIERS.team];
}

export function getTier(tierId: string): TierDefinition | undefined {
  return TIERS[tierId];
}
