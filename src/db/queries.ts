// ABOUTME: Database query functions for HookRelay entities.
// ABOUTME: Provides CRUD operations for users, endpoints, and captured requests.

import { getDb } from './schema.js';
import { nanoid } from 'nanoid';

export interface User {
  id: string;
  email: string;
  magic_token: string | null;
  magic_token_expires_at: number | null;
  session_token: string | null;
  created_at: number;
}

export interface Endpoint {
  id: string;
  user_id: string;
  name: string;
  forward_url: string | null;
  created_at: number;
}

export interface CapturedRequest {
  id: string;
  endpoint_id: string;
  method: string;
  path: string;
  headers: string;
  query: string;
  body: string | null;
  content_type: string | null;
  source_ip: string | null;
  received_at: number;
}

// Users
export function createUser(email: string): User {
  const id = nanoid();
  const db = getDb();
  db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(id, email);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
}

export function getUserByEmail(email: string): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function getUserBySession(token: string): User | undefined {
  return getDb().prepare('SELECT * FROM users WHERE session_token = ?').get(token) as User | undefined;
}

export function setMagicToken(userId: string, token: string, expiresAt: number): void {
  getDb().prepare('UPDATE users SET magic_token = ?, magic_token_expires_at = ? WHERE id = ?')
    .run(token, expiresAt, userId);
}

export function setSessionToken(userId: string, token: string): void {
  getDb().prepare('UPDATE users SET session_token = ?, magic_token = NULL, magic_token_expires_at = NULL WHERE id = ?')
    .run(token, userId);
}

export function verifyMagicToken(email: string, token: string): User | null {
  const user = getDb().prepare(
    'SELECT * FROM users WHERE email = ? AND magic_token = ? AND magic_token_expires_at > ?'
  ).get(email, token, Math.floor(Date.now() / 1000)) as User | undefined;
  return user ?? null;
}

// Endpoints
export function createEndpoint(userId: string, name?: string, forwardUrl?: string): Endpoint {
  const id = nanoid(12);
  const db = getDb();
  db.prepare('INSERT INTO endpoints (id, user_id, name, forward_url) VALUES (?, ?, ?, ?)')
    .run(id, userId, name || 'Untitled', forwardUrl || null);
  return db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as Endpoint;
}

export function getEndpoint(id: string): Endpoint | undefined {
  return getDb().prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as Endpoint | undefined;
}

export function getEndpointsByUser(userId: string): Endpoint[] {
  return getDb().prepare('SELECT * FROM endpoints WHERE user_id = ? ORDER BY created_at DESC').all(userId) as Endpoint[];
}

export function updateEndpoint(id: string, updates: { name?: string; forward_url?: string | null }): Endpoint | undefined {
  const db = getDb();
  if (updates.name !== undefined) {
    db.prepare('UPDATE endpoints SET name = ? WHERE id = ?').run(updates.name, id);
  }
  if (updates.forward_url !== undefined) {
    db.prepare('UPDATE endpoints SET forward_url = ? WHERE id = ?').run(updates.forward_url, id);
  }
  return db.prepare('SELECT * FROM endpoints WHERE id = ?').get(id) as Endpoint | undefined;
}

export function deleteEndpoint(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM captured_requests WHERE endpoint_id = ?').run(id);
  db.prepare('DELETE FROM endpoints WHERE id = ?').run(id);
}

// Captured Requests
export function captureRequest(endpointId: string, data: {
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string | null;
  contentType: string | null;
  sourceIp: string | null;
}): CapturedRequest {
  const id = nanoid();
  const db = getDb();
  db.prepare(`
    INSERT INTO captured_requests (id, endpoint_id, method, path, headers, query, body, content_type, source_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, endpointId, data.method, data.path,
    JSON.stringify(data.headers), JSON.stringify(data.query),
    data.body, data.contentType, data.sourceIp
  );
  return db.prepare('SELECT * FROM captured_requests WHERE id = ?').get(id) as CapturedRequest;
}

export function getRequestsByEndpoint(endpointId: string, limit = 100, offset = 0): CapturedRequest[] {
  return getDb().prepare(
    'SELECT * FROM captured_requests WHERE endpoint_id = ? ORDER BY received_at DESC LIMIT ? OFFSET ?'
  ).all(endpointId, limit, offset) as CapturedRequest[];
}

export function getRequestById(id: string): CapturedRequest | undefined {
  return getDb().prepare('SELECT * FROM captured_requests WHERE id = ?').get(id) as CapturedRequest | undefined;
}

export function deleteRequestsByEndpoint(endpointId: string): number {
  return getDb().prepare('DELETE FROM captured_requests WHERE endpoint_id = ?').run(endpointId).changes;
}
