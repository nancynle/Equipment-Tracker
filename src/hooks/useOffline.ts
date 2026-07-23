import { useState, useEffect, useCallback } from 'react';

interface QueuedChange {
  type: string;
  data: unknown;
  timestamp: string;
}

const QUEUE_KEY = 'equipment-tracker-offline-queue';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check for pending changes on mount
    const queue = getQueue();
    setPendingChanges(queue.length);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getQueue = (): QueuedChange[] => {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveQueue = (queue: QueuedChange[]) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    setPendingChanges(queue.length);
  };

  const queueChange = useCallback((change: { type: string; data: unknown }) => {
    const queue = getQueue();
    queue.push({ ...change, timestamp: new Date().toISOString() });
    saveQueue(queue);
  }, []);

  const flushQueue = async () => {
    const queue = getQueue();
    if (queue.length === 0) return;

    console.log(`[Offline] Flushing ${queue.length} queued changes`);
    const failed: QueuedChange[] = [];

    for (const change of queue) {
      try {
        let url = '/api/equipment';
        let method = 'POST';

        if (change.type === 'equipment:update') {
          url = `/api/equipment/${(change.data as { id: string }).id}`;
          method = 'PUT';
        } else if (change.type === 'equipment:delete') {
          url = `/api/equipment/${change.data}`;
          method = 'DELETE';
        } else if (change.type === 'issue:create') {
          url = '/api/issues';
          method = 'POST';
        }

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: method !== 'DELETE' ? JSON.stringify(change.data) : undefined,
        });

        if (!res.ok) {
          failed.push(change);
        }
      } catch {
        failed.push(change);
      }
    }

    saveQueue(failed);
    if (failed.length > 0) {
      console.warn(`[Offline] ${failed.length} changes failed to sync`);
    } else {
      console.log('[Offline] All changes synced successfully');
    }
  };

  return { isOnline, pendingChanges, queueChange, flushQueue };
}
