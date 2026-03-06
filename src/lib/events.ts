// ABOUTME: Server-Sent Events (SSE) hub for real-time request streaming.
// ABOUTME: Manages per-endpoint subscriber lists and broadcasts captured requests.

import type { CapturedRequest } from '../db/queries.js';

type Subscriber = (data: string) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(endpointId: string, callback: Subscriber): () => void {
  if (!subscribers.has(endpointId)) {
    subscribers.set(endpointId, new Set());
  }
  subscribers.get(endpointId)!.add(callback);

  return () => {
    const subs = subscribers.get(endpointId);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        subscribers.delete(endpointId);
      }
    }
  };
}

export function broadcast(endpointId: string, request: CapturedRequest): void {
  const subs = subscribers.get(endpointId);
  if (!subs) return;

  const data = JSON.stringify({
    type: 'request',
    payload: request,
  });

  for (const cb of subs) {
    try {
      cb(data);
    } catch {
      // subscriber disconnected, will be cleaned up
    }
  }
}

export function getSubscriberCount(endpointId: string): number {
  return subscribers.get(endpointId)?.size ?? 0;
}
