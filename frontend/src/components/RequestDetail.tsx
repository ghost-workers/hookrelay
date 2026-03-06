// ABOUTME: Request detail view showing headers, body, and replay functionality.
// ABOUTME: Renders a captured webhook request with syntax-highlighted JSON and replay button.

import { useState } from 'react';
import { replayRequest, type CapturedRequest } from '../lib/api.ts';

interface RequestDetailProps {
  request: CapturedRequest;
}

export function RequestDetail({ request }: RequestDetailProps) {
  const [replayUrl, setReplayUrl] = useState('');
  const [replayResult, setReplayResult] = useState<{
    status: number;
    body: string;
  } | null>(null);
  const [replaying, setReplaying] = useState(false);

  const headers = JSON.parse(request.headers) as Record<string, string>;
  const query = JSON.parse(request.query) as Record<string, string>;

  const handleReplay = async () => {
    if (!replayUrl) return;
    setReplaying(true);
    try {
      const result = await replayRequest(request.id, replayUrl);
      setReplayResult({ status: result.status, body: result.body });
    } catch (e: any) {
      setReplayResult({ status: 0, body: e.message });
    } finally {
      setReplaying(false);
    }
  };

  const formatBody = (body: string | null, contentType: string | null): string => {
    if (!body) return '(empty)';
    if (contentType?.includes('json')) {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }
    return body;
  };

  return (
    <div>
      <div style={styles.header}>
        <span style={styles.method}>{request.method}</span>
        <span style={styles.path}>{request.path}</span>
        <span style={styles.time}>
          {new Date(request.received_at * 1000).toLocaleString()}
        </span>
      </div>

      {request.source_ip && (
        <p style={styles.meta}>Source IP: {request.source_ip}</p>
      )}

      {/* Headers */}
      <Section title="Headers">
        <table style={styles.table}>
          <tbody>
            {Object.entries(headers).map(([key, value]) => (
              <tr key={key}>
                <td style={styles.headerKey}>{key}</td>
                <td style={styles.headerValue}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Query Parameters */}
      {Object.keys(query).length > 0 && (
        <Section title="Query Parameters">
          <table style={styles.table}>
            <tbody>
              {Object.entries(query).map(([key, value]) => (
                <tr key={key}>
                  <td style={styles.headerKey}>{key}</td>
                  <td style={styles.headerValue}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Body */}
      <Section title="Body">
        <pre style={styles.pre}>
          {formatBody(request.body, request.content_type)}
        </pre>
      </Section>

      {/* Replay */}
      <Section title="Replay">
        <div style={styles.replayRow}>
          <input
            type="url"
            placeholder="https://your-server.com/webhook"
            value={replayUrl}
            onChange={(e) => setReplayUrl(e.target.value)}
            style={styles.replayInput}
          />
          <button onClick={handleReplay} disabled={replaying || !replayUrl} style={styles.replayBtn}>
            {replaying ? 'Sending...' : 'Replay'}
          </button>
        </div>

        {replayResult && (
          <div style={styles.replayResult}>
            <p style={{ marginBottom: '0.5rem' }}>
              Status: <strong>{replayResult.status || 'Error'}</strong>
            </p>
            <pre style={styles.pre}>{replayResult.body}</pre>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <h4 style={styles.sectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
  method: {
    fontWeight: 700,
    fontFamily: 'monospace',
    fontSize: '1.1rem',
    color: '#a78bfa',
  } as React.CSSProperties,
  path: {
    fontFamily: 'monospace',
    fontSize: '1rem',
    color: '#e2e8f0',
  } as React.CSSProperties,
  time: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginLeft: 'auto',
  } as React.CSSProperties,
  meta: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginBottom: '1rem',
  } as React.CSSProperties,
  section: {
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  table: {
    width: '100%',
    fontSize: '0.8rem',
    borderCollapse: 'collapse' as const,
  } as React.CSSProperties,
  headerKey: {
    color: '#6366f1',
    fontFamily: 'monospace',
    padding: '3px 12px 3px 0',
    verticalAlign: 'top',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  headerValue: {
    color: '#cbd5e1',
    fontFamily: 'monospace',
    padding: '3px 0',
    wordBreak: 'break-all' as const,
  } as React.CSSProperties,
  pre: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '0.75rem',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    color: '#e2e8f0',
    overflow: 'auto',
    maxHeight: '300px',
    whiteSpace: 'pre-wrap' as const,
  } as React.CSSProperties,
  replayRow: {
    display: 'flex',
    gap: '0.5rem',
  } as React.CSSProperties,
  replayInput: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#e2e8f0',
    fontSize: '0.85rem',
    fontFamily: 'monospace',
    outline: 'none',
  } as React.CSSProperties,
  replayBtn: {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: 'none',
    background: '#6366f1',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  replayResult: {
    marginTop: '0.75rem',
  } as React.CSSProperties,
};
