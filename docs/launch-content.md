# HookRelay Launch Content Drafts

Prepared marketing copy for launch across multiple channels. Ready to post once Stripe billing is live.

---

## Show HN Post

**Title:** Show HN: HookRelay – Capture, inspect, and replay webhooks in real-time

**Body:**

We built HookRelay to solve a problem every developer hits: debugging webhooks is painful. You set up a webhook, something breaks, and you have no idea what payload actually arrived (or didn't).

HookRelay gives you a unique URL. Point any webhook provider at it (Stripe, GitHub, Shopify, whatever). Every incoming request is captured and displayed in a real-time dashboard — headers, body, timing, everything.

Key features:
- Real-time streaming via SSE — payloads appear instantly
- One-click replay — re-send any captured webhook to test your handler
- Forward to localhost — no ngrok needed
- Free tier: 1 endpoint, 100 captures/day, 24h retention
- Pro ($29/mo): 10 endpoints, 10K captures/day, 30-day retention

Tech stack: Hono + better-sqlite3 backend, React 19 frontend, deployed on Fly.io.

Live at https://hookrelay.fly.dev

Would love feedback on the UX and what features you'd want next.

---

## Product Hunt Listing

**Tagline:** Stop guessing. See every webhook.

**Description:**

HookRelay captures, inspects, and replays webhooks in real-time. Built for developers who are tired of debugging webhook integrations blind.

Point any webhook provider — Stripe, GitHub, Shopify, Twilio — at your HookRelay URL. Every request is captured and displayed live in your dashboard with full headers, body, and metadata.

**Key Features:**
- Real-time inspection with live streaming
- One-click replay for debugging
- Forward webhooks to localhost (no tunnel needed)
- Signature verification for Stripe, GitHub, and more
- Team sharing and collaboration

**Maker Comment:**

We built HookRelay because every time we integrated a webhook provider, we'd spend more time debugging the integration than building the feature. "Did the webhook fire?" "What was in the payload?" "Why did my handler reject it?"

HookRelay sits between the webhook provider and your app. It captures everything, shows it to you in real-time, and lets you replay any request with one click. You can even forward webhooks straight to localhost — no ngrok or tunnel config needed.

The free tier is genuinely useful for solo devs (1 endpoint, 100 captures/day). Pro and Team tiers are for production use with more endpoints, higher limits, and longer retention.

---

## Reddit Posts

### r/webdev

**Title:** I built a free webhook debugging tool — capture, inspect, and replay webhooks in real-time

**Body:**

Debugging webhooks has always been one of those "just annoying enough" problems. You configure a webhook, wait for it to fire, check your logs, realize the payload format changed, reconfigure, wait again...

We built HookRelay to fix this. It gives you a URL that captures any incoming HTTP request and displays it in a live dashboard. You can replay requests, forward them to localhost, and share endpoints with your team.

Free tier: 1 endpoint, 100 captures/day. No credit card required.

https://hookrelay.fly.dev

Happy to answer questions about the stack (Hono + React 19 + SQLite on Fly.io).

### r/SideProject

**Title:** HookRelay — webhook debugging tool, from zero to deployed in a week

**Body:**

HookRelay is a tool for capturing and debugging webhooks in real-time.

The problem: Every webhook integration involves a painful cycle of "fire webhook → check logs → realize payload was wrong → reconfigure → repeat."

The solution: Point webhooks at a HookRelay URL. See every request live. Replay failures with one click. Forward to localhost for local development.

Stack: Hono (Node.js), React 19, SQLite, SSE for real-time, deployed on Fly.io.

Free tier available. Feedback welcome: https://hookrelay.fly.dev

### r/devtools

**Title:** HookRelay: open-source webhook inspector with real-time streaming and replay

**Body:**

HookRelay is a webhook debugging tool that captures incoming HTTP requests and streams them to a live dashboard via SSE.

Features:
- Unique capture URLs for each endpoint
- Real-time request inspection (headers, body, timing)
- One-click replay to any target URL
- Forward to localhost without tunnels
- Free tier for solo devs

Check it out: https://hookrelay.fly.dev

---

## Dev.to Article Outline

**Title:** Building a Webhook Debugger with Hono, React 19, and SQLite

**Sections:**

1. The problem — why webhook debugging sucks
2. Architecture decisions — why Hono over Express, why SQLite over Postgres, why SSE over WebSockets
3. The capture flow — how incoming webhooks are stored and streamed
4. Real-time with SSE — server-sent events for live dashboard updates
5. Replay mechanism — re-sending captured requests
6. Deployment on Fly.io — single-process architecture with SQLite
7. Lessons learned
8. Try it out — link and free tier info
