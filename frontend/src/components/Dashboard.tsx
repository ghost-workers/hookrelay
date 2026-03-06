// ABOUTME: Main dashboard component showing endpoints and captured requests.
// ABOUTME: Handles endpoint CRUD, real-time SSE streaming, and request detail viewing.

import { useState, useEffect } from 'react';
import {
  listEndpoints,
  createEndpoint,
  deleteEndpoint,
  listRequests,
  subscribeToEndpoint,
  type Endpoint,
  type CapturedRequest,
} from '../lib/api.ts';
import { RequestDetail } from './RequestDetail.tsx';

interface DashboardProps {
  user: { id: string; email: string };
  onLogout: () => void;
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [activeEndpoint, setActiveEndpoint] = useState<Endpoint | null>(null);
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<CapturedRequest | null>(null);
  const [creating, setCreating] = useState(false);

  // Load endpoints
  useEffect(() => {
    listEndpoints().then(setEndpoints).catch(console.error);
  }, []);

  // Load requests and subscribe to SSE when endpoint changes
  useEffect(() => {
    if (!activeEndpoint) {
      setRequests([]);
      return;
    }

    listRequests(activeEndpoint.id).then(setRequests).catch(console.error);

    const unsubscribe = subscribeToEndpoint(activeEndpoint.id, (req) => {
      setRequests((prev) => [req, ...prev]);
    });

    return unsubscribe;
  }, [activeEndpoint?.id]);

  const handleCreateEndpoint = async () => {
    setCreating(true);
    try {
      const ep = await createEndpoint(`Endpoint ${endpoints.length + 1}`);
      setEndpoints((prev) => [ep, ...prev]);
      setActiveEndpoint(ep);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    await deleteEndpoint(id);
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
    if (activeEndpoint?.id === id) {
      setActiveEndpoint(null);
      setSelectedRequest(null);
    }
  };

  const webhookUrl = activeEndpoint
    ? `${window.location.origin}/h/${activeEndpoint.id}`
    : null;

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.logo}>HookRelay</h2>
          <span style={styles.email}>{user.email}</span>
        </div>

        <button onClick={handleCreateEndpoint} disabled={creating} style={styles.newBtn}>
          + New Endpoint
        </button>

        <div style={styles.endpointList}>
          {endpoints.map((ep) => (
            <div
              key={ep.id}
              style={{
                ...styles.endpointItem,
                ...(activeEndpoint?.id === ep.id ? styles.endpointActive : {}),
              }}
              onClick={() => {
                setActiveEndpoint(ep);
                setSelectedRequest(null);
              }}
            >
              <span style={styles.endpointName}>{ep.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteEndpoint(ep.id);
                }}
                style={styles.deleteBtn}
              >
                x
              </button>
            </div>
          ))}
        </div>

        <button onClick={onLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>

      {/* Main content */}
      <div style={styles.main}>
        {!activeEndpoint ? (
          <div style={styles.empty}>
            <h2>Select or create an endpoint to get started</h2>
            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
              Point your webhooks at the generated URL and watch requests stream in.
            </p>
          </div>
        ) : (
          <>
            {/* Webhook URL bar */}
            <div style={styles.urlBar}>
              <span style={styles.urlLabel}>Webhook URL:</span>
              <code style={styles.urlCode}>{webhookUrl}</code>
              <button
                style={styles.copyBtn}
                onClick={() => navigator.clipboard.writeText(webhookUrl!)}
              >
                Copy
              </button>
            </div>

            {/* Request list + detail */}
            <div style={styles.content}>
              <div style={styles.requestList}>
                <h3 style={styles.sectionTitle}>
                  Requests ({requests.length})
                  <span style={styles.live}>LIVE</span>
                </h3>
                {requests.length === 0 ? (
                  <p style={styles.noRequests}>No requests yet. Send a webhook to the URL above.</p>
                ) : (
                  requests.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        ...styles.requestItem,
                        ...(selectedRequest?.id === req.id ? styles.requestActive : {}),
                      }}
                      onClick={() => setSelectedRequest(req)}
                    >
                      <span style={methodColor(req.method)}>{req.method}</span>
                      <span style={styles.requestPath}>{req.path}</span>
                      <span style={styles.requestTime}>
                        {new Date(req.received_at * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div style={styles.detail}>
                {selectedRequest ? (
                  <RequestDetail request={selectedRequest} />
                ) : (
                  <p style={{ color: '#64748b', textAlign: 'center', marginTop: '3rem' }}>
                    Select a request to view details
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function methodColor(method: string): React.CSSProperties {
  const colors: Record<string, string> = {
    GET: '#22d3ee',
    POST: '#a78bfa',
    PUT: '#fbbf24',
    PATCH: '#fb923c',
    DELETE: '#f87171',
  };
  return {
    color: colors[method] || '#94a3b8',
    fontWeight: 700,
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    width: '52px',
    flexShrink: 0,
  };
}

const styles = {
  layout: {
    display: 'flex',
    height: '100vh',
  } as React.CSSProperties,
  sidebar: {
    width: '260px',
    background: '#1e293b',
    borderRight: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '1rem',
    flexShrink: 0,
  } as React.CSSProperties,
  sidebarHeader: {
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  logo: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#f1f5f9',
  } as React.CSSProperties,
  email: {
    fontSize: '0.75rem',
    color: '#64748b',
  } as React.CSSProperties,
  newBtn: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px dashed #475569',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    marginBottom: '1rem',
    fontSize: '0.85rem',
  } as React.CSSProperties,
  endpointList: {
    flex: 1,
    overflowY: 'auto' as const,
  } as React.CSSProperties,
  endpointItem: {
    padding: '0.6rem 0.75rem',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2px',
  } as React.CSSProperties,
  endpointActive: {
    background: '#334155',
  } as React.CSSProperties,
  endpointName: {
    fontSize: '0.85rem',
    color: '#e2e8f0',
  } as React.CSSProperties,
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '2px 6px',
  } as React.CSSProperties,
  logoutBtn: {
    padding: '0.5rem',
    borderRadius: '6px',
    border: '1px solid #334155',
    background: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '0.8rem',
    marginTop: '0.5rem',
  } as React.CSSProperties,
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  } as React.CSSProperties,
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#94a3b8',
  } as React.CSSProperties,
  urlBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1.25rem',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
  } as React.CSSProperties,
  urlLabel: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    flexShrink: 0,
  } as React.CSSProperties,
  urlCode: {
    flex: 1,
    fontSize: '0.85rem',
    color: '#6366f1',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  copyBtn: {
    padding: '4px 12px',
    borderRadius: '4px',
    border: '1px solid #475569',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '0.75rem',
    flexShrink: 0,
  } as React.CSSProperties,
  content: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  } as React.CSSProperties,
  requestList: {
    width: '340px',
    borderRight: '1px solid #334155',
    overflowY: 'auto' as const,
    padding: '1rem',
    flexShrink: 0,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  } as React.CSSProperties,
  live: {
    fontSize: '0.6rem',
    background: '#22c55e',
    color: '#fff',
    padding: '1px 6px',
    borderRadius: '4px',
    fontWeight: 700,
  } as React.CSSProperties,
  noRequests: {
    fontSize: '0.85rem',
    color: '#475569',
    textAlign: 'center' as const,
    marginTop: '2rem',
  } as React.CSSProperties,
  requestItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.6rem',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '2px',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  requestActive: {
    background: '#334155',
  } as React.CSSProperties,
  requestPath: {
    flex: 1,
    color: '#e2e8f0',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  requestTime: {
    color: '#64748b',
    fontSize: '0.7rem',
    flexShrink: 0,
  } as React.CSSProperties,
  detail: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1rem 1.5rem',
  } as React.CSSProperties,
};
