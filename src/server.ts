// ABOUTME: Main HookRelay server entry point.
// ABOUTME: Configures Hono app with routes, CORS, and serves the SPA frontend.

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { auth } from './routes/auth.js';
import { endpoints } from './routes/endpoints.js';
import { hooks } from './routes/hooks.js';
import { billing } from './routes/billing.js';
import { getDb } from './db/schema.js';

const app = new Hono();

// CORS for frontend
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'hookrelay' }));

// API routes
app.route('/api/auth', auth);
app.route('/api/endpoints', endpoints);
app.route('/api/billing', billing);
app.route('/', hooks);

// Serve landing page and blog at /landing
app.use('/landing/*', serveStatic({ root: './' }));
app.get('/landing', serveStatic({ root: './', path: './landing/index.html' }));

// Serve frontend static files in production
app.use('/*', serveStatic({ root: './frontend/dist' }));

// SPA fallback — serve index.html for non-API routes that don't match a static file
app.get('/*', serveStatic({ root: './frontend/dist', path: 'index.html' }));

// Initialize DB on startup
getDb();

// Only start the server when run directly, not when imported by tests
const isDirectRun = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirectRun) {
  const port = parseInt(process.env.PORT || '3200', 10);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`HookRelay running on http://localhost:${info.port}`);
  });
}

export { app };
