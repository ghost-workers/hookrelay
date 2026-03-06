// ABOUTME: Integration tests for HookRelay API endpoints.
// ABOUTME: Tests auth flow, endpoint CRUD, webhook capture, and request replay.

import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../src/server.js';

let sessionToken: string;
let endpointId: string;
let capturedRequestId: string;

describe('HookRelay API', () => {
  describe('Health', () => {
    it('returns ok', async () => {
      const res = await app.request('/api/health');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
    });
  });

  describe('Auth', () => {
    it('generates magic link for new user', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeTruthy();
      expect(body.magicLink).toBeTruthy();
    });

    it('verifies magic token and creates session', async () => {
      // First, get the magic token
      const loginRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      const { token } = await loginRes.json();

      const res = await app.request(
        `/api/auth/verify?email=${encodeURIComponent('test@example.com')}&token=${token}`
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessionToken).toBeTruthy();
      expect(body.user.email).toBe('test@example.com');
      sessionToken = body.sessionToken;
    });

    it('rejects invalid email', async () => {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Endpoints', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await app.request('/api/endpoints');
      expect(res.status).toBe(401);
    });

    it('creates an endpoint', async () => {
      const res = await app.request('/api/endpoints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: 'Test Hook' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.name).toBe('Test Hook');
      expect(body.id).toBeTruthy();
      endpointId = body.id;
    });

    it('sends auto-test webhook on first endpoint creation', async () => {
      const res = await app.request(`/api/endpoints/${endpointId}/requests`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const testReq = body.find((r: any) => {
        const reqBody = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
        return reqBody.event === 'test.webhook';
      });
      expect(testReq).toBeTruthy();
      expect(testReq.method).toBe('POST');
      const parsed = JSON.parse(testReq.body);
      expect(parsed.data.source).toBe('hookrelay-onboarding');
    });

    it('lists endpoints', async () => {
      const res = await app.request('/api/endpoints', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it('gets a single endpoint', async () => {
      const res = await app.request(`/api/endpoints/${endpointId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(endpointId);
    });

    it('updates an endpoint', async () => {
      const res = await app.request(`/api/endpoints/${endpointId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: 'Renamed Hook' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('Renamed Hook');
    });
  });

  describe('Webhook Capture', () => {
    it('captures a POST webhook', async () => {
      const res = await app.request(`/h/${endpointId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'test-value',
        },
        body: JSON.stringify({ event: 'payment.completed', amount: 42 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
      expect(body.id).toBeTruthy();
      capturedRequestId = body.id;
    });

    it('captures a GET webhook', async () => {
      const res = await app.request(`/h/${endpointId}?foo=bar`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.received).toBe(true);
    });

    it('returns 404 for unknown endpoint', async () => {
      const res = await app.request('/h/nonexistent', { method: 'POST' });
      expect(res.status).toBe(404);
    });

    it('lists captured requests', async () => {
      const res = await app.request(`/api/endpoints/${endpointId}/requests`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.length).toBe(3);
      expect(body[0].method).toBeTruthy();
    });
  });

  describe('Cleanup', () => {
    it('deletes captured requests', async () => {
      const res = await app.request(`/api/endpoints/${endpointId}/requests`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(3);
    });

    it('deletes an endpoint', async () => {
      const res = await app.request(`/api/endpoints/${endpointId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.deleted).toBe(true);
    });
  });
});
