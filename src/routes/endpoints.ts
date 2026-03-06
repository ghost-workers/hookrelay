// ABOUTME: CRUD API routes for managing webhook capture endpoints.
// ABOUTME: Authenticated routes for creating, listing, updating, and deleting endpoints.

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  createEndpoint,
  getEndpointsByUser,
  getEndpoint,
  updateEndpoint,
  deleteEndpoint,
  getRequestsByEndpoint,
  getRequestById,
  deleteRequestsByEndpoint,
  captureRequest,
} from '../db/queries.js';
import { getSubscription, getEndpointCount, incrementDailyUsage } from '../billing/queries.js';
import { getTier, TIERS } from '../billing/tiers.js';
import { broadcast } from '../lib/events.js';

type Env = { Variables: { user: any; userId: string } };
const endpoints = new Hono<Env>();

endpoints.use('*', authMiddleware);

// List user's endpoints
endpoints.get('/', (c) => {
  const userId = c.get('userId') as string;
  const list = getEndpointsByUser(userId);
  return c.json(list);
});

// Create a new endpoint
endpoints.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const sub = getSubscription(userId);
  const tier = getTier(sub.tier) || TIERS.free;
  const currentCount = getEndpointCount(userId);
  if (tier.maxEndpoints !== -1 && currentCount >= tier.maxEndpoints) {
    return c.json({ error: `You have reached your endpoint limit (${tier.maxEndpoints}). Upgrade your plan to create more.` }, 403);
  }
  const isFirstEndpoint = currentCount === 0;
  const body = await c.req.json<{ name?: string; forwardUrl?: string }>();
  const endpoint = createEndpoint(userId, body.name, body.forwardUrl);

  if (isFirstEndpoint) {
    sendTestWebhook(endpoint.id, userId);
  }

  return c.json(endpoint, 201);
});

// Get single endpoint
endpoints.get('/:id', (c) => {
  const userId = c.get('userId') as string;
  const endpoint = getEndpoint(c.req.param('id'));
  if (!endpoint || endpoint.user_id !== userId) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.json(endpoint);
});

// Update endpoint
endpoints.patch('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const endpoint = getEndpoint(c.req.param('id'));
  if (!endpoint || endpoint.user_id !== userId) {
    return c.json({ error: 'Not found' }, 404);
  }
  const body = await c.req.json<{ name?: string; forwardUrl?: string | null }>();
  const updated = updateEndpoint(endpoint.id, {
    name: body.name,
    forward_url: body.forwardUrl,
  });
  return c.json(updated);
});

// Delete endpoint
endpoints.delete('/:id', (c) => {
  const userId = c.get('userId') as string;
  const endpoint = getEndpoint(c.req.param('id'));
  if (!endpoint || endpoint.user_id !== userId) {
    return c.json({ error: 'Not found' }, 404);
  }
  deleteEndpoint(endpoint.id);
  return c.json({ deleted: true });
});

// List captured requests for an endpoint
endpoints.get('/:id/requests', (c) => {
  const userId = c.get('userId') as string;
  const endpoint = getEndpoint(c.req.param('id'));
  if (!endpoint || endpoint.user_id !== userId) {
    return c.json({ error: 'Not found' }, 404);
  }
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const requests = getRequestsByEndpoint(endpoint.id, limit, offset);
  return c.json(requests);
});

// Get single captured request
endpoints.get('/:id/requests/:reqId', (c) => {
  const userId = c.get('userId') as string;
  const endpoint = getEndpoint(c.req.param('id'));
  if (!endpoint || endpoint.user_id !== userId) {
    return c.json({ error: 'Not found' }, 404);
  }
  const req = getRequestById(c.req.param('reqId'));
  if (!req || req.endpoint_id !== endpoint.id) {
    return c.json({ error: 'Not found' }, 404);
  }
  return c.json(req);
});

// Clear captured requests
endpoints.delete('/:id/requests', (c) => {
  const userId = c.get('userId') as string;
  const endpoint = getEndpoint(c.req.param('id'));
  if (!endpoint || endpoint.user_id !== userId) {
    return c.json({ error: 'Not found' }, 404);
  }
  const count = deleteRequestsByEndpoint(endpoint.id);
  return c.json({ deleted: count });
});

function sendTestWebhook(endpointId: string, userId: string): void {
  const payload = JSON.stringify({
    event: 'test.webhook',
    data: {
      message: 'Welcome to HookRelay! This is a sample webhook.',
      timestamp: new Date().toISOString(),
      source: 'hookrelay-onboarding',
    },
  });

  const captured = captureRequest(endpointId, {
    method: 'POST',
    path: '/',
    headers: { 'content-type': 'application/json', 'user-agent': 'HookRelay-Onboarding/1.0' },
    query: {},
    body: payload,
    contentType: 'application/json',
    sourceIp: '127.0.0.1',
  });

  incrementDailyUsage(userId);
  broadcast(endpointId, captured);
}

export { endpoints };
