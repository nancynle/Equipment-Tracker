import React, { useState } from 'react';
import type { SyncStatus } from '../types';

interface Props {
  syncStatus: SyncStatus;
  connectedUsers: string[];
}

export function StatusBar({ syncStatus, connectedUsers }: Props) {
  const [showUsers, setShowUsers] = useState(false);

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
        <span
          className="users-indicator"
          onClick={() => setShowUsers(!showUsers)}
          style={{ cursor: 'pointer' }}
          title="Click to see who's connected"
        >
          👥 {connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''} online
        </span>
        {showUsers && connectedUsers.length > 0 && (
          <div className="users-popup">
            {connectedUsers.map((user, i) => (
              <div key={i} className="users-popup-item">👤 {user}</div>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
