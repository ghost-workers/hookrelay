// ABOUTME: Database queries for billing-related operations.
// ABOUTME: Manages subscriptions, usage tracking, and tier lookups.

import { getDb } from '../db/schema.js';
import { nanoid } from 'nanoid';

export interface Subscription {
  id: string;
  user_id: string;
  tier: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  current_period_start: number | null;
  current_period_end: number | null;
  cancel_at_period_end: number;
  created_at: number;
  updated_at: number;
}

export function getSubscription(userId: string): Subscription {
  const db = getDb();
  let sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as Subscription | undefined;
  if (!sub) {
    const id = nanoid();
    db.prepare('INSERT INTO subscriptions (id, user_id) VALUES (?, ?)').run(id, userId);
    sub = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as Subscription;
  }
  return sub;
}

export function updateSubscription(userId: string, updates: {
  tier?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  status?: string;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: number;
}): Subscription {
  const db = getDb();
  // Ensure subscription exists
  getSubscription(userId);

  const setClauses: string[] = ['updated_at = unixepoch()'];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  values.push(userId);
  db.prepare(`UPDATE subscriptions SET ${setClauses.join(', ')} WHERE user_id = ?`).run(...values);
  return db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) as Subscription;
}

export function getSubscriptionByStripeCustomerId(customerId: string): Subscription | undefined {
  return getDb().prepare('SELECT * FROM subscriptions WHERE stripe_customer_id = ?').get(customerId) as Subscription | undefined;
}

export function getSubscriptionByStripeSubId(subId: string): Subscription | undefined {
  return getDb().prepare('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?').get(subId) as Subscription | undefined;
}

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export function incrementDailyUsage(userId: string): number {
  const db = getDb();
  const date = todayDateString();
  db.prepare(`
    INSERT INTO daily_usage (user_id, date, request_count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, date) DO UPDATE SET request_count = request_count + 1
  `).run(userId, date);
  const row = db.prepare('SELECT request_count FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, date) as { request_count: number };
  return row.request_count;
}

export function getDailyUsage(userId: string): number {
  const date = todayDateString();
  const row = getDb().prepare('SELECT request_count FROM daily_usage WHERE user_id = ? AND date = ?').get(userId, date) as { request_count: number } | undefined;
  return row?.request_count ?? 0;
}

export function getEndpointCount(userId: string): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM endpoints WHERE user_id = ?').get(userId) as { count: number };
  return row.count;
}
