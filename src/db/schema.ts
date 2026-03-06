// ABOUTME: Database schema and initialization for HookRelay.
// ABOUTME: Creates SQLite tables for endpoints, captured requests, users, subscriptions, and usage.

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.HOOKRELAY_DB_PATH || path.join(process.cwd(), 'hookrelay.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      magic_token TEXT,
      magic_token_expires_at INTEGER,
      session_token TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS endpoints (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'Untitled',
      forward_url TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS captured_requests (
      id TEXT PRIMARY KEY,
      endpoint_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL DEFAULT '/',
      headers TEXT NOT NULL DEFAULT '{}',
      query TEXT NOT NULL DEFAULT '{}',
      body TEXT,
      content_type TEXT,
      source_ip TEXT,
      received_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (endpoint_id) REFERENCES endpoints(id)
    );

    CREATE INDEX IF NOT EXISTS idx_captured_requests_endpoint
      ON captured_requests(endpoint_id, received_at DESC);

    CREATE INDEX IF NOT EXISTS idx_endpoints_user
      ON endpoints(user_id);

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      current_period_start INTEGER,
      current_period_end INTEGER,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date
      ON daily_usage(user_id, date DESC);
  `);
}
