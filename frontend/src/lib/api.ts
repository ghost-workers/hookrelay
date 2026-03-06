// ABOUTME: API client for HookRelay backend.
// ABOUTME: Provides typed fetch wrappers for auth, endpoints, and request operations.

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('hookrelay_token');
}

export function setToken(token: string): void {
  localStorage.setItem('hookrelay_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('hookrelay_token');
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth
export async function login(email: string) {
  return apiFetch<{ message: string; magicLink: string; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyToken(email: string, token: string) {
  return apiFetch<{ sessionToken: string; user: { id: string; email: string } }>(
    `/auth/verify?email=${encodeURIComponent(email)}&token=${token}`
  );
}

export async function getMe() {
  return apiFetch<{ id: string; email: string }>('/auth/me');
}

// Endpoints
export interface Endpoint {
  id: string;
  user_id: string;
  name: string;
  forward_url: string | null;
  created_at: number;
}

export async function listEndpoints() {
  return apiFetch<Endpoint[]>('/endpoints');
}

export async function createEndpoint(name?: string, forwardUrl?: string) {
  return apiFetch<Endpoint>('/endpoints', {
    method: 'POST',
    body: JSON.stringify({ name, forwardUrl }),
  });
}

export async function updateEndpoint(id: string, data: { name?: string; forwardUrl?: string | null }) {
  return apiFetch<Endpoint>(`/endpoints/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteEndpoint(id: string) {
  return apiFetch<{ deleted: boolean }>(`/endpoints/${id}`, { method: 'DELETE' });
}

// Requests
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

export async function listRequests(endpointId: string, limit = 100) {
  return apiFetch<CapturedRequest[]>(`/endpoints/${endpointId}/requests?limit=${limit}`);
}

export async function replayRequest(requestId: string, targetUrl: string) {
  return apiFetch<{ status: number; headers: Record<string, string>; body: string }>(
    `/replay/${requestId}`,
    { method: 'POST', body: JSON.stringify({ targetUrl }) }
  );
}

// SSE
export function subscribeToEndpoint(
  endpointId: string,
  onMessage: (req: CapturedRequest) => void
): () => void {
  const source = new EventSource(`/stream/${endpointId}`);

  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'request') {
        onMessage(data.payload);
      }
    } catch {
      // ignore parse errors
    }
  };

  return () => source.close();
}
