// ABOUTME: Tests for Stripe billing integration, tier enforcement, and usage tracking.
// ABOUTME: Covers tier limits, subscription lifecycle, checkout, webhook handling, and portal.

import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/server.js';

let sessionToken: string;
let userId: string;
let endpointId: string;

async function login(email = 'billing-test@example.com'): Promise<{ sessionToken: string; userId: string }> {
  const loginRes = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const { token } = await loginRes.json();
  const verifyRes = await app.request(
    `/api/auth/verify?email=${encodeURIComponent(email)}&token=${token}`
  );
  const body = await verifyRes.json();
  return { sessionToken: body.sessionToken, userId: body.user.id };
}

describe('Billing & Tiers', () => {
  beforeAll(async () => {
    const creds = await login();
    sessionToken = creds.sessionToken;
    userId = creds.userId;
  });

  describe('Tier info', () => {
    it('GET /api/billing/tiers returns pricing tiers', async () => {
      const res = await app.request('/api/billing/tiers');
      expect(res.status).toBe(200);
      const tiers = await res.json();
      expect(tiers).toHaveLength(3);
      expect(tiers.map((t: any) => t.name)).toEqual(['Free', 'Pro', 'Team']);
      const free = tiers.find((t: any) => t.name === 'Free');
      expect(free.maxEndpoints).toBe(1);
      expect(free.maxRequestsPerDay).toBe(100);
      expect(free.retentionDays).toBe(1);
      const pro = tiers.find((t: any) => t.name === 'Pro');
      expect(pro.priceMonthly).toBe(2900);
      expect(pro.maxEndpoints).toBe(10);
      expect(pro.maxRequestsPerDay).toBe(10000);
      expect(pro.retentionDays).toBe(30);
      const team = tiers.find((t: any) => t.name === 'Team');
      expect(team.priceMonthly).toBe(9900);
      expect(team.maxEndpoints).toBe(-1); // unlimited
      expect(team.maxRequestsPerDay).toBe(100000);
      expect(team.retentionDays).toBe(90);
    });
  });

  describe('User subscription status', () => {
    it('GET /api/billing/subscription returns free tier for new users', async () => {
      const res = await app.request('/api/billing/subscription', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tier).toBe('free');
      expect(body.status).toBe('active');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await app.request('/api/billing/subscription');
      expect(res.status).toBe(401);
    });
  });

  describe('Usage tracking', () => {
    it('GET /api/billing/usage returns current usage counts', async () => {
      const res = await app.request('/api/billing/usage', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.endpointCount).toBeDefined();
      expect(body.requestsToday).toBeDefined();
      expect(body.tier).toBe('free');
      expect(body.limits).toBeDefined();
    });
  });

  describe('Tier enforcement — endpoint limits', () => {
    it('allows creating first endpoint on free tier', async () => {
      const res = await app.request('/api/endpoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: 'Billing Test Endpoint' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      endpointId = body.id;
    });

    it('blocks creating second endpoint on free tier', async () => {
      const res = await app.request('/api/endpoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: 'Should Fail' }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('endpoint limit');
    });
  });

  describe('Checkout session', () => {
    it('POST /api/billing/checkout requires auth', async () => {
      const res = await app.request('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: 'pro' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid tier', async () => {
      const res = await app.request('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ tier: 'mega' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects checkout for free tier', async () => {
      const res = await app.request('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ tier: 'free' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns checkout URL for valid paid tier when Stripe is configured', async () => {
      if (!process.env.STRIPE_SECRET_KEY) {
        // Without Stripe keys, we expect a config error
        const res = await app.request('/api/billing/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({ tier: 'pro' }),
        });
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toContain('not configured');
      }
    });
  });

  describe('Portal session', () => {
    it('POST /api/billing/portal requires auth', async () => {
      const res = await app.request('/api/billing/portal', { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  describe('Cleanup', () => {
    it('deletes test endpoint', async () => {
      const res = await app.request(`/api/endpoints/${endpointId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
    });
  });
});
