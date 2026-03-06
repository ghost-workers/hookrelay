// ABOUTME: Webhook capture and replay routes.
// ABOUTME: Handles incoming webhook requests, stores them, broadcasts via SSE, and supports replay.

import { Hono } from 'hono';
import { getEndpoint, captureRequest, getRequestById } from '../db/queries.js';
import { broadcast, subscribe } from '../lib/events.js';
import { authMiddleware } from '../middleware/auth.js';
import type { CapturedRequest } from '../db/queries.js';
import { getSubscription, incrementDailyUsage, getDailyUsage } from '../billing/queries.js';
import { getTier, TIERS } from '../billing/tiers.js';

const hooks = new Hono();

// Catch-all handler for incoming webhooks: POST/PUT/PATCH/DELETE/GET to /h/:endpointId/*
hooks.all('/h/:endpointId/*', async (c) => {
  return handleWebhook(c);
});

hooks.all('/h/:endpointId', async (c) => {
  return handleWebhook(c);
});

async function handleWebhook(c: any): Promise<Response> {
  const endpointId = c.req.param('endpointId');
  const endpoint = getEndpoint(endpointId);

  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Check daily request rate limit for the endpoint owner
  const sub = getSubscription(endpoint.user_id);
  const tier = getTier(sub.tier) || TIERS.free;
  const currentUsage = getDailyUsage(endpoint.user_id);
  if (currentUsage >= tier.maxRequestsPerDay) {
    return c.json({ error: 'Daily request limit reached. Upgrade your plan for more requests.' }, 429);
  }

  const url = new URL(c.req.url);
  const hookPath = url.pathname.replace(`/h/${endpointId}`, '') || '/';
  const headers: Record<string, string> = {};
  c.req.raw.headers.forEach((value: string, key: string) => {
    headers[key] = value;
  });

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let body: string | null = null;
  const contentType = c.req.header('content-type') || null;
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    try {
      body = await c.req.text();
    } catch {
      body = null;
    }
  }

  const captured = captureRequest(endpointId, {
    method: c.req.method,
    path: hookPath,
    headers,
    query,
    body,
    contentType,
    sourceIp: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null,
  });

  // Track usage
  incrementDailyUsage(endpoint.user_id);

  // Broadcast to SSE subscribers
  broadcast(endpointId, captured);

  // Forward if configured
  if (endpoint.forward_url) {
    forwardRequest(endpoint.forward_url, captured).catch(() => {
      // fire-and-forget forwarding
    });
  }

  return c.json({ received: true, id: captured.id });
}

// SSE stream for real-time request viewing
hooks.get('/stream/:endpointId', (c) => {
  const endpointId = c.req.param('endpointId');
  const endpoint = getEndpoint(endpointId);

  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        // Send initial connection message
        send(JSON.stringify({ type: 'connected', endpointId }));

        const unsubscribe = subscribe(endpointId, send);

        // Handle client disconnect
        c.req.raw.signal?.addEventListener('abort', () => {
          unsubscribe();
        });
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
});

// Replay a captured request to a target URL (authenticated)
hooks.post('/replay/:requestId', authMiddleware, async (c) => {
  const requestId = c.req.param('requestId');
  const { targetUrl } = await c.req.json<{ targetUrl: string }>();

  if (!targetUrl) {
    return c.json({ error: 'targetUrl required' }, 400);
  }

  const captured = getRequestById(requestId);
  if (!captured) {
    return c.json({ error: 'Request not found' }, 404);
  }

  const result = await forwardRequest(targetUrl, captured);
  return c.json(result);
});

async function forwardRequest(
  targetUrl: string,
  captured: CapturedRequest
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const headers = JSON.parse(captured.headers) as Record<string, string>;
  // Remove hop-by-hop headers
  delete headers['host'];
  delete headers['connection'];
  delete headers['transfer-encoding'];

  const response = await fetch(targetUrl, {
    method: captured.method,
    headers,
    body: captured.method !== 'GET' && captured.method !== 'HEAD' ? captured.body : undefined,
  });

  const respHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    respHeaders[key] = value;
  });

  return {
    status: response.status,
    headers: respHeaders,
    body: await response.text(),
  };
}

export { hooks };
