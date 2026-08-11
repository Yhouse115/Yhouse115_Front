import { useEffect, useState } from 'react';

import { fetchHealth, type HealthResponse } from '../services/health';

type HealthState =
  | { status: 'loading' }
  | { status: 'ok'; data: HealthResponse }
  | { status: 'error'; message: string };

export function HealthCheck() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;

    fetchHealth()
      .then((data) => {
        if (mounted) {
          setHealth({ status: 'ok', data });
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          const message = error instanceof Error ? error.message : 'Unknown health check error';
          setHealth({ status: 'error', message });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (health.status === 'loading') {
    return <section className="status-panel">백엔드 상태를 확인하는 중입니다.</section>;
  }

  if (health.status === 'error') {
    return (
      <section className="status-panel status-panel--error">
        <strong>Backend disconnected</strong>
        <span>{health.message}</span>
      </section>
    );
  }

  return (
    <section className="status-panel status-panel--ok">
      <strong>Backend connected</strong>
      <span>
        {health.data.service} · {health.data.environment} · {health.data.version}
      </span>
    </section>
  );
}
