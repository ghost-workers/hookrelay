---
title: Building a Webhook Debugger with Hono, React 19, and SQLite
published: false
description: How we built HookRelay — a real-time webhook debugging tool — and the architecture decisions behind it.
tags: webdev, javascript, react, tutorial
canonical_url: https://hookrelay.fly.dev/landing/blog/webhook-debugging-guide.html
cover_image:
---

# Building a Webhook Debugger with Hono, React 19, and SQLite

Every developer who's integrated a third-party API has lived this loop:

1. Configure webhook URL in provider dashboard
2. Trigger an event
3. Check your server logs
4. See nothing
5. Wonder if the webhook fired, if your URL is wrong, or if your handler is broken
6. Add `console.log` everywhere
7. Repeat

We built [HookRelay](https://hookrelay.fly.dev) to kill this loop. It gives you a URL, captures every incoming HTTP request, and streams them to a dashboard in real-time. You can replay any request with one click and forward webhooks straight to localhost — no ngrok required.

Here's how we built it and why we made the choices we did.

## The Architecture

```
Webhook Provider (Stripe, GitHub, etc.)
        |
        v
  HookRelay Capture URL (/h/:endpointId)
        |
        v
  SQLite (store request)
        |
        v
  SSE stream → React Dashboard (real-time)
        |
        v
  Replay / Forward to localhost
```

The entire backend is a single Hono process with SQLite. No Redis, no Postgres, no message queue. One process, one database file, deployed on Fly.io.

## Why Hono over Express

Express is fine. We've all used it. But Hono is faster, lighter, and built for modern JavaScript:

- **Web Standard APIs**: Hono uses `Request` and `Response` natively. No proprietary `req`/`res` objects.
- **TypeScript-first**: Full type inference for routes, middleware, and context.
- **Tiny**: ~14KB. Express is ~200KB with common middleware.
- **Multi-runtime**: Runs on Node, Deno, Bun, Cloudflare Workers. We're on Node today but could move.

The routing API is clean:

```typescript
const app = new Hono();

// Capture incoming webhooks
app.all('/h/:endpointId', async (c) => {
  const endpointId = c.req.param('endpointId');
  const body = await c.req.text();
  const headers = Object.fromEntries(c.req.raw.headers);

  // Store the request
  const id = saveRequest(endpointId, {
    method: c.req.method,
    headers,
    body,
    url: c.req.url,
  });

  // Notify SSE listeners
  notifyListeners(endpointId, id);

  return c.json({ captured: true, id });
});
```

## Why SQLite over Postgres

This one surprises people. A SaaS product backed by SQLite?

Yes. Here's why:

1. **Zero ops**: No database server to manage. No connection pooling. No pg_dump. The database is a file.
2. **Fast reads**: SQLite reads are faster than Postgres for single-tenant workloads. No network round trip.
3. **Atomic writes**: WAL mode gives us concurrent readers with a single writer — perfect for our write-heavy capture flow.
4. **Portable**: The entire database is one file. Backups are `cp hookrelay.db hookrelay.db.bak`.
5. **Fly.io volumes**: Fly gives us persistent volumes. SQLite + volume = production database with zero config.

The schema is straightforward:

```sql
CREATE TABLE endpoints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE captured_requests (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL,
  method TEXT NOT NULL,
  headers TEXT NOT NULL,  -- JSON
  body TEXT,
  ip TEXT,
  captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
);
```

We use `better-sqlite3` for synchronous queries. No async/await ceremony for database calls — just function calls that return data.

## Real-Time with Server-Sent Events

We considered WebSockets. We chose SSE instead.

Why? SSE is simpler:

- **HTTP-native**: Works through proxies, load balancers, and CDNs without special config
- **Auto-reconnect**: The browser reconnects automatically if the connection drops
- **One-directional**: We only need server→client updates. SSE is purpose-built for this.
- **No library needed**: `EventSource` is built into every browser

The server-side implementation:

```typescript
app.get('/stream/:endpointId', async (c) => {
  const endpointId = c.req.param('endpointId');

  return streamSSE(c, async (stream) => {
    const listener = (requestId: string) => {
      const request = getRequestById(requestId);
      stream.writeSSE({
        event: 'webhook',
        data: JSON.stringify(request),
      });
    };

    addListener(endpointId, listener);

    // Keep connection alive
    while (true) {
      await stream.writeSSE({ event: 'ping', data: '' });
      await stream.sleep(15000);
    }
  });
});
```

On the client, React 19 makes consuming this trivial:

```typescript
useEffect(() => {
  const source = new EventSource(`/stream/${endpointId}`);

  source.addEventListener('webhook', (e) => {
    const request = JSON.parse(e.data);
    setRequests((prev) => [request, ...prev]);
  });

  return () => source.close();
}, [endpointId]);
```

New webhooks appear in the dashboard instantly. No polling. No complex state management.

## The Replay Mechanism

One-click replay is the feature people love most. When a webhook fails, you don't have to go back to Stripe's dashboard and re-trigger the event. Just hit replay.

The implementation is simple because we stored the full request:

```typescript
app.post('/api/endpoints/:endpointId/requests/:requestId/replay', async (c) => {
  const request = getRequestById(c.req.param('requestId'));

  const response = await fetch(request.targetUrl, {
    method: request.method,
    headers: JSON.parse(request.headers),
    body: request.body,
  });

  return c.json({
    status: response.status,
    replayed: true,
  });
});
```

We store the original headers, body, method — everything. Replay sends an identical request to your target URL.

## Deployment: Single Process on Fly.io

Our deployment is boring, and that's the point:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
COPY frontend/dist/ ./frontend/dist/
COPY landing/ ./landing/
CMD ["node", "dist/server.js"]
```

One process. One volume for SQLite. One machine on Fly.io.

```toml
# fly.toml
[mounts]
  source = "hookrelay_data"
  destination = "/data"

[[services]]
  internal_port = 8080
```

Total monthly cost for a low-traffic SaaS: about $5-7 on Fly.io's shared-cpu-1x.

## Lessons Learned

**SQLite is production-ready for single-server apps.** The "you can't use SQLite in production" meme needs to die. For apps that don't need horizontal scaling, it's the best database. Zero latency, zero ops, zero cost.

**SSE beats WebSockets for 90% of real-time features.** If you only need server-to-client updates, SSE is simpler in every way. Save WebSockets for bidirectional communication like chat.

**Hono is the framework Express should have been.** Type-safe, tiny, standards-based. If you're starting a new Node.js project, try Hono before reaching for Express.

**Single-process architecture scales further than you think.** A single Node process with SQLite can handle thousands of concurrent connections and tens of thousands of requests per second. You don't need microservices until you really do.

## Try It

HookRelay is live at [hookrelay.fly.dev](https://hookrelay.fly.dev).

Free tier: 1 endpoint, 100 captures per day, 24-hour retention. No credit card.

Create an endpoint, point a webhook at it, and watch requests stream in. If you've ever debugged a webhook integration, you'll immediately get why this exists.

---

*Built with Hono, React 19, better-sqlite3, and deployed on Fly.io. Source code on [GitHub](https://github.com/ghost-workers/hookrelay). Questions about the architecture? Drop a comment.*
