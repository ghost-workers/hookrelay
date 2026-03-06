---
title: "Stop Using ngrok for Webhook Testing"
subtitle: "How HookRelay replaces your entire webhook debugging stack"
tags: webdev, javascript, api, devtools
canonical_url: https://hookrelay.fly.dev/landing/blog/test-webhooks-locally.html
---

# Stop Using ngrok for Webhook Testing

ngrok is great. Until it isn't.

You're integrating Stripe webhooks. You fire up ngrok, get a random URL, paste it into Stripe's dashboard, trigger a test event, and... nothing. The free URL expired. Or you typo'd the port. Or ngrok's inspector shows the request but your app never received it.

There's a simpler way.

## The Problem With the ngrok Workflow

The standard webhook development loop looks like this:

1. Start ngrok (`ngrok http 3000`)
2. Copy the generated URL
3. Paste it into your webhook provider's dashboard
4. Trigger a test event
5. Check if your handler received it
6. Realize the ngrok URL changed because you restarted it
7. Go back to step 2

Every restart gives you a new URL. Free tier limits your connections. The inspector is basic. And you still need to manually replay failed webhooks.

## HookRelay: Capture, Inspect, Replay

[HookRelay](https://hookrelay.fly.dev) gives you a permanent webhook URL. Every request is captured with full headers and body, streamed to a real-time dashboard.

Here's what changes:

**Before (ngrok)**:
- Temporary URLs that change on restart
- Manual replay by re-triggering events in the provider
- No persistent history of received webhooks
- Inspector that disappears when you close the terminal

**After (HookRelay)**:
- Permanent endpoint URLs that never change
- One-click replay of any captured webhook
- Full request history with search and filtering
- Real-time SSE streaming — see webhooks arrive instantly

## How It Works

1. **Create an endpoint** — you get a URL like `https://hookrelay.fly.dev/h/abc123`
2. **Point your webhook provider at it** — Stripe, GitHub, Shopify, whatever
3. **Watch requests stream in** — full headers, body, method, timestamp
4. **Replay any request** — hit the replay button, it re-sends to your local server
5. **Forward to localhost** — route captured webhooks to your development server

The entire thing runs on Hono + SQLite + React. One process, no infrastructure complexity.

## Real Example: Debugging a Stripe Webhook

You're building a subscription flow. Stripe sends `checkout.session.completed` but your handler isn't updating the user's tier.

With HookRelay:

1. Point Stripe's webhook URL to your HookRelay endpoint
2. Complete a test checkout
3. See the exact payload Stripe sent — every header, the full JSON body
4. Spot the issue (maybe you're checking `event.type` wrong, or the `customer` field isn't where you expected)
5. Fix your handler
6. Hit "Replay" to re-send the exact same webhook
7. Confirm it works — no need to go through checkout again

That replay step alone saves minutes per iteration.

## The Tech Stack

For the curious:

- **Hono** — lightweight, Web Standard API-based HTTP framework
- **SQLite** (via better-sqlite3) — single-file database, zero config
- **React 19** — SPA frontend with real-time updates
- **Server-Sent Events** — push webhook data to the dashboard as it arrives
- **Fly.io** — single-region deployment, auto-sleep on idle

No Redis. No Postgres. No message queue. The entire backend is one process serving both the API and the frontend.

## Pricing

- **Free**: 1 endpoint, 100 requests/day — enough to test a single integration
- **Pro ($29/mo)**: 10 endpoints, 10K requests/day, 30-day history
- **Team ($99/mo)**: Unlimited endpoints, 100K requests/day, 90-day history

## Try It

Go to [hookrelay.fly.dev](https://hookrelay.fly.dev), create an account (magic link, no password), and set up your first endpoint in 30 seconds.

Then point a webhook at it and watch it arrive in real-time. That's it. That's the pitch.
