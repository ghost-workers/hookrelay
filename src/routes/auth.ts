// ABOUTME: Auth routes for magic link login flow.
// ABOUTME: Handles signup/login request, token verification, and session creation.

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createUser, getUserByEmail, setMagicToken, verifyMagicToken, setSessionToken } from '../db/queries.js';

const auth = new Hono();

// Request a magic link
auth.post('/login', async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  if (!email || !email.includes('@')) {
    return c.json({ error: 'Valid email required' }, 400);
  }

  let user = getUserByEmail(email);
  if (!user) {
    user = createUser(email);
  }

  const token = nanoid(32);
  const expiresAt = Math.floor(Date.now() / 1000) + 600; // 10 minutes
  setMagicToken(user.id, token, expiresAt);

  // In production, send this via email. For MVP, return it directly.
  const magicLink = `/auth/verify?email=${encodeURIComponent(email)}&token=${token}`;

  return c.json({
    message: 'Magic link generated',
    magicLink,
    // For MVP dev convenience, include token directly
    token,
  });
});

// Verify magic link and create session
auth.get('/verify', async (c) => {
  const email = c.req.query('email');
  const token = c.req.query('token');

  if (!email || !token) {
    return c.json({ error: 'Missing email or token' }, 400);
  }

  const user = verifyMagicToken(email, token);
  if (!user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  const sessionToken = nanoid(48);
  setSessionToken(user.id, sessionToken);

  return c.json({
    sessionToken,
    user: { id: user.id, email: user.email },
  });
});

// Get current user info
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { getUserBySession } = await import('../db/queries.js');
  const user = getUserBySession(authHeader.slice(7));
  if (!user) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  return c.json({ id: user.id, email: user.email });
});

export { auth };
