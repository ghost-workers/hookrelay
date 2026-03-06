// ABOUTME: Authentication middleware for HookRelay API routes.
// ABOUTME: Extracts session token from Authorization header and attaches user to context.

import type { Context, Next } from 'hono';
import { getUserBySession } from '../db/queries.js';

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const user = getUserBySession(token);
  if (!user) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  c.set('user', user);
  c.set('userId', user.id);
  await next();
}
