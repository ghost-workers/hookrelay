// ABOUTME: Billing API routes for Stripe integration.
// ABOUTME: Handles tier listing, subscription status, checkout sessions, webhooks, and portal links.

import { Hono } from 'hono';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth.js';
import { getTierList, getTier, TIERS } from '../billing/tiers.js';
import {
  getSubscription,
  updateSubscription,
  getSubscriptionByStripeSubId,
  getDailyUsage,
  getEndpointCount,
} from '../billing/queries.js';

type Env = { Variables: { user: any; userId: string } };
const billing = new Hono<Env>();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// Public — list available tiers
billing.get('/tiers', (c) => {
  return c.json(getTierList());
});

// Authenticated — get current subscription
billing.get('/subscription', authMiddleware, (c) => {
  const userId = c.get('userId') as string;
  const sub = getSubscription(userId);
  const tier = getTier(sub.tier) || TIERS.free;
  return c.json({
    tier: sub.tier,
    status: sub.status,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    currentPeriodEnd: sub.current_period_end,
    limits: {
      maxEndpoints: tier.maxEndpoints,
      maxRequestsPerDay: tier.maxRequestsPerDay,
      retentionDays: tier.retentionDays,
    },
  });
});

// Authenticated — get usage stats
billing.get('/usage', authMiddleware, (c) => {
  const userId = c.get('userId') as string;
  const sub = getSubscription(userId);
  const tier = getTier(sub.tier) || TIERS.free;
  return c.json({
    tier: sub.tier,
    endpointCount: getEndpointCount(userId),
    requestsToday: getDailyUsage(userId),
    limits: {
      maxEndpoints: tier.maxEndpoints,
      maxRequestsPerDay: tier.maxRequestsPerDay,
      retentionDays: tier.retentionDays,
    },
  });
});

// Authenticated — create Stripe Checkout session
billing.post('/checkout', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const user = c.get('user');
  const { tier: tierId } = await c.req.json<{ tier: string }>();

  if (!tierId || tierId === 'free') {
    return c.json({ error: 'Cannot checkout for free tier' }, 400);
  }

  const tier = getTier(tierId);
  if (!tier || !tier.stripePriceId) {
    if (!tier) {
      return c.json({ error: 'Invalid tier' }, 400);
    }
    return c.json({ error: 'Stripe not configured for this tier' }, 503);
  }

  const stripe = getStripe();
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const sub = getSubscription(userId);
  let customerId = sub.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { userId } });
    customerId = customer.id;
    updateSubscription(userId, { stripe_customer_id: customerId });
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3200';
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: tier.stripePriceId, quantity: 1 }],
    subscription_data: tier.trialDays > 0
      ? { trial_period_days: tier.trialDays }
      : undefined,
    success_url: `${appUrl}/billing?success=true`,
    cancel_url: `${appUrl}/billing?cancelled=true`,
    metadata: { userId, tierId },
  });

  return c.json({ url: session.url });
});

// Authenticated — create Stripe Customer Portal session
billing.post('/portal', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const stripe = getStripe();
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const sub = getSubscription(userId);
  if (!sub.stripe_customer_id) {
    return c.json({ error: 'No billing account found' }, 400);
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3200';
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${appUrl}/billing`,
  });

  return c.json({ url: session.url });
});

// Stripe webhook — handles subscription lifecycle events
billing.post('/webhook', async (c) => {
  const stripe = getStripe();
  if (!stripe) {
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  const sig = c.req.header('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return c.json({ error: 'Missing signature or webhook secret' }, 400);
  }

  let event;
  try {
    const rawBody = await c.req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const tierId = session.metadata?.tierId;
      if (userId && tierId) {
        updateSubscription(userId, {
          tier: tierId,
          stripe_subscription_id: session.subscription as string,
          status: 'active',
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as any;
      const sub = getSubscriptionByStripeSubId(subscription.id);
      if (sub) {
        updateSubscription(sub.user_id, {
          status: subscription.status === 'active' || subscription.status === 'trialing'
            ? 'active' : subscription.status,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end ? 1 : 0,
        });
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const sub = getSubscriptionByStripeSubId(subscription.id);
      if (sub) {
        updateSubscription(sub.user_id, {
          tier: 'free',
          status: 'active',
          stripe_subscription_id: undefined,
          cancel_at_period_end: 0,
        });
      }
      break;
    }
  }

  return c.json({ received: true });
});

export { billing };
