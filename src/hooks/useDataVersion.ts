import { useEffect, useRef } from 'react';

const POLL_MS = 15_000;

export function useDataVersion(onNewData: () => void) {
  const lastVersion = useRef<string | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/metrics/version');
        if (!res.ok) return;
        const { v } = await res.json();
        if (lastVersion.current !== null && v !== lastVersion.current) {
          onNewData();
        }
        lastVersion.current = v;
      } catch {
        // ignore network errors, next poll will retry
      }
    };

    check();
    const timer = setInterval(check, POLL_MS);
    return () => clearInterval(timer);
  }, [onNewData]);
}
