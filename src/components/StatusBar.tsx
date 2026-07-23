import React from 'react';
import type { SyncStatus } from '../types';

interface Props {
  syncStatus: SyncStatus;
  connectedUsers: number;
}

export function StatusBar({ syncStatus, connectedUsers }: Props) {
  return (
    <footer className="status-bar" role="status" aria-live="polite">
      <div className="status-left">
        <span className={`status-dot ${syncStatus.isOnline ? 'online' : 'offline'}`}></span>
        <span>{syncStatus.isOnline ? 'Connected' : 'Offline'}</span>
        {syncStatus.pendingChanges > 0 && (
          <span className="pending-indicator">
            ({syncStatus.pendingChanges} pending sync)
          </span>
        )}
      </div>
      <div className="status-center">
        {syncStatus.lastSyncedAt && (
          <span className="last-sync">
            Last synced: {new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="status-right">
        <span className="users-indicator">
          👥 {connectedUsers} user{connectedUsers !== 1 ? 's' : ''} connected
        </span>
      </div>
    </footer>
  );
}
