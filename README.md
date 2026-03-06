# HookRelay

Capture, debug, and relay webhooks in real time.

## What is HookRelay?

HookRelay gives you unique URLs that capture incoming webhooks. Every request is logged with full headers, body, and metadata — visible in real time through a web dashboard. You can replay any captured webhook with one click, or forward them to your local development server.

**Live at [hookrelay.fly.dev](https://hookrelay.fly.dev/landing)**

## Features

- **Real-time inspection** — See webhook payloads the instant they arrive via WebSocket
- **One-click replay** — Resend any captured webhook as many times as you need
- **Local forwarding** — Forward webhooks to localhost without tunnels or ngrok
- **HMAC signature verification** — Verify webhook signatures from Stripe, GitHub, and others
- **Delivery analytics** — Track success rates, response times, and failure patterns
- **Team collaboration** — Share endpoints and webhook history across your team

## Pricing

| Plan | Price | Endpoints | Captures/mo |
|------|-------|-----------|-------------|
| Free | $0 | 1 | 100 |
| Pro | $29/mo | 10 | 10,000 |
| Team | $99/mo | Unlimited | 100,000 |

## Tech Stack

- **Backend:** TypeScript, Hono, Node.js
- **Frontend:** React, Vite
- **Database:** SQLite (better-sqlite3)
- **Real-time:** WebSocket / SSE
- **Hosting:** Fly.io
- **Payments:** Stripe

## Getting Started

1. Go to [hookrelay.fly.dev](https://hookrelay.fly.dev/landing)
2. Sign up with your email (magic link auth, no password needed)
3. Create an endpoint — you'll get a unique webhook URL
4. Point your webhook provider to your HookRelay URL
5. Watch webhooks arrive in real time

## Blog

- [Getting Started with HookRelay](https://hookrelay.fly.dev/landing/blog/getting-started.html)
- [How to Debug Webhooks: A Complete Guide](https://hookrelay.fly.dev/landing/blog/webhook-debugging-guide.html)
- [How to Test Webhooks Locally Without ngrok](https://hookrelay.fly.dev/landing/blog/test-webhooks-locally.html)

## License

Proprietary. All rights reserved.
