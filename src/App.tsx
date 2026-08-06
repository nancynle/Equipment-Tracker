import React, { useState, useEffect, useCallback } from 'react';
import { EquipmentTable } from './components/EquipmentTable';
import { EquipmentMap } from './components/EquipmentMap';
import { Dashboard } from './components/Dashboard';
import { ActivityLogPage } from './components/ActivityLogPage';
import { IssueReportModal } from './components/IssueReportModal';
import { AddEquipmentModal } from './components/AddEquipmentModal';
import { StatusBar } from './components/StatusBar';
import { useSocket } from './hooks/useSocket';
import { useOffline } from './hooks/useOffline';
import type { Equipment, IssueReport, SyncStatus } from './types';

type ViewMode = 'table' | 'map' | 'split' | 'dashboard' | 'activity';

export default function App() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [username, setUsername] = useState<string>(() => {
    return localStorage.getItem('equipment-tracker-username') || '';
  });
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAuditAlert, setShowAuditAlert] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    lastSyncedAt: null,
    pendingChanges: 0,
    connectedUsers: 1,
  });

  const { isOnline, pendingChanges, queueChange } = useOffline();
  const { socket, connected, connectedUsers } = useSocket();

  // Fetch initial data
  useEffect(() => {
    fetchEquipment();
    fetchIssues();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('equipment:update', (updated: Equipment) => {
      setEquipment((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e))
      );
    });

    socket.on('equipment:create', (created: Equipment) => {
      setEquipment((prev) => [...prev, created]);
    });

    socket.on('equipment:delete', (id: string) => {
      setEquipment((prev) => prev.filter((e) => e.id !== id));
    });

    socket.on('issue:create', (issue: IssueReport) => {
      setIssues((prev) => [...prev, issue]);
    });

    socket.on('issue:update', (updated: IssueReport) => {
      setIssues((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
    });

    socket.on('sync:status', (status: SyncStatus) => {
      setSyncStatus(status);
    });

    return () => {
      socket.off('equipment:update');
      socket.off('equipment:create');
      socket.off('equipment:delete');
      socket.off('issue:create');
      socket.off('issue:update');
      socket.off('sync:status');
    };
  }, [socket]);

  const fetchEquipment = async () => {
    try {
      const res = await fetch('/api/equipment');
      if (res.ok) {
        const data = await res.json();
        setEquipment(data);
      }
    } catch (err) {
      console.error('Failed to fetch equipment:', err);
    }
  };

  const fetchIssues = async () => {
    try {
      const res = await fetch('/api/issues');
      if (res.ok) {
        const data = await res.json();
        setIssues(data);
      }
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    }
  };

  const handleUpdateEquipment = useCallback(
    (updated: Equipment) => {
      const timestamped: Equipment = {
        ...updated,
        lastModifiedBy: username || 'unknown',
      };

      // Optimistic update
      setEquipment((prev) =>
        prev.map((e) => (e.id === timestamped.id ? timestamped : e))
      );

      if (isOnline && socket?.connected) {
        socket.emit('equipment:update', timestamped);
      } else {
        queueChange({ type: 'equipment:update', data: timestamped });
      }
    },
    [isOnline, socket, queueChange]
  );

  const handleCreateEquipment = useCallback(
    (newItem: Equipment) => {
      setEquipment((prev) => [...prev, newItem]);

      if (isOnline && socket?.connected) {
        socket.emit('equipment:create', newItem);
      } else {
        queueChange({ type: 'equipment:create', data: newItem });
      }
    },
    [isOnline, socket, queueChange]
  );

  const handleDeleteEquipment = useCallback(
    (id: string) => {
      setEquipment((prev) => prev.filter((e) => e.id !== id));

      if (isOnline && socket?.connected) {
        socket.emit('equipment:delete', id);
      } else {
        queueChange({ type: 'equipment:delete', data: id });
      }
    },
    [isOnline, socket, queueChange]
  );

  const handleReportIssue = useCallback(
    (issue: IssueReport) => {
      setIssues((prev) => [...prev, issue]);

      if (isOnline && socket?.connected) {
        socket.emit('issue:create', issue);
      } else {
        queueChange({ type: 'issue:create', data: issue });
      }
      setShowIssueModal(false);
    },
    [isOnline, socket, queueChange]
  );

  const handleUpdatePosition = useCallback(
    (id: string, mapX: number, mapY: number) => {
      const item = equipment.find((e) => e.id === id);
      if (item) {
        handleUpdateEquipment({ ...item, mapX, mapY });
      }
    },
    [equipment, handleUpdateEquipment]
  );

  const handleUpdateIssue = useCallback(
    (issue: IssueReport) => {
      setIssues((prev) => prev.map((i) => i.id === issue.id ? issue : i));

      if (isOnline && socket?.connected) {
        socket.emit('issue:update', issue);
      } else {
        queueChange({ type: 'issue:update', data: issue });
      }
    },
    [isOnline, socket, queueChange]
  );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('spreadsheet', file);

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const result = await res.json();

      if (result.success) {
        alert(`✅ Import complete!\n\n${result.imported} items imported\n${result.skipped} rows skipped\n${result.total} total items now`);
        // Refresh data
        fetchEquipment();
      } else {
        alert(`❌ Import failed: ${result.error}`);
      }
    } catch (err) {
      alert('❌ Import failed — check that the server is running');
    }

    // Reset file input
    e.target.value = '';
  };

  const matchesSearch = (item: Equipment, query: string): boolean => {
    if (!query) return false;
    const s = query.toLowerCase();
    return (
      item.identificationNumber.toLowerCase().includes(s) ||
      item.zone.toLowerCase().includes(s) ||
      item.location.toLowerCase().includes(s) ||
      item.floorLevel.toLowerCase().includes(s) ||
      item.itemArea.toLowerCase().includes(s) ||
      item.type.replace('_', ' ').toLowerCase().includes(s) ||
      (item.mountedOn?.toLowerCase().includes(s) ?? false) ||
      (item.notes?.toLowerCase().includes(s) ?? false)
    );
  };

  const highlightedIds = globalSearch
    ? new Set(equipment.filter((item) => matchesSearch(item, globalSearch)).map((e) => e.id))
    : new Set<string>();

  return (
    <div className="app">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="offline-banner" role="alert">
          <span className="offline-icon">⚠️</span>
          You are offline. Changes will sync when connection is restored.
          {pendingChanges > 0 && (
            <span className="pending-badge">{pendingChanges} pending</span>
          )}
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1>🏗️ Equipment Tracker v2</h1>
          <span className="subtitle">Jam Poles · Ladders · Cottermans</span>
        </div>
        <div className="header-center">
          <div className="global-search">
            <input
              type="search"
              placeholder="🔍 Search ID#, zone, location, area..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="global-search-input"
              aria-label="Global search"
            />
            {globalSearch && (
              <span className="search-results-count">
                {equipment.filter((item) => matchesSearch(item, globalSearch)).length} matches
              </span>
            )}
          </div>
        </div>
        <div className="header-right">
          <div className="view-toggle" role="tablist">
            <button
              role="tab"
              aria-selected={viewMode === 'dashboard'}
              className={viewMode === 'dashboard' ? 'active' : ''}
              onClick={() => setViewMode('dashboard')}
            >
              📊 Dashboard
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'table'}
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
            >
              📋 Table
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'map'}
              className={viewMode === 'map' ? 'active' : ''}
              onClick={() => setViewMode('map')}
            >
              🗺️ Map
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'split'}
              className={viewMode === 'split' ? 'active' : ''}
              onClick={() => setViewMode('split')}
            >
              ⬛ Split
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'activity'}
              className={viewMode === 'activity' ? 'active' : ''}
              onClick={() => setViewMode('activity')}
            >
              📋 Activity
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Equipment
          </button>
          <label className="btn" title="Import from existing Excel spreadsheet">
            📥 Import
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleImport}
            />
          </label>
          <button className="btn" title="Download Excel file" onClick={async () => {
            try {
              const res = await fetch('/api/download');
              if (!res.ok) throw new Error('Download failed');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'equipment-tracker.xlsx';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch (err) {
              alert('❌ Export failed');
            }
          }}>
            ⬇️ Export
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className={`main-content view-${viewMode}`}>
        {viewMode === 'dashboard' && (
          <section className="dashboard-panel">
            <Dashboard equipment={equipment} issues={issues} onUpdateIssue={handleUpdateIssue} />
          </section>
        )}
        {viewMode === 'activity' && (
          <section className="dashboard-panel">
            <ActivityLogPage />
          </section>
        )}
        {(viewMode === 'table' || viewMode === 'split') && (
          <section className="table-panel">
            <EquipmentTable
              equipment={equipment}
              issues={issues}
              onUpdate={handleUpdateEquipment}
              onDelete={handleDeleteEquipment}
              onSelect={setSelectedEquipment}
              onReportIssue={(eq) => {
                setSelectedEquipment(eq);
                setShowIssueModal(true);
              }}
              highlightedIds={highlightedIds}
              globalSearch={globalSearch}
            />
          </section>
        )}
        {(viewMode === 'map' || viewMode === 'split') && (
          <section className="map-panel">
            <EquipmentMap
              equipment={equipment}
              issues={issues}
              selectedEquipment={selectedEquipment}
              onSelect={setSelectedEquipment}
              onUpdatePosition={handleUpdatePosition}
              highlightedIds={highlightedIds}
            />
          </section>
        )}
      </main>

      {/* Status Bar */}
      <StatusBar
        syncStatus={{ ...syncStatus, isOnline, pendingChanges }}
        connectedUsers={connectedUsers}
      />

      {/* Modals */}
      {showIssueModal && selectedEquipment && (
        <IssueReportModal
          equipment={selectedEquipment}
          username={username}
          onSubmit={handleReportIssue}
          onClose={() => setShowIssueModal(false)}
        />
      )}

      {showAddModal && (
        <AddEquipmentModal
          equipment={equipment}
          username={username}
          onSubmit={handleCreateEquipment}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Audit Alert */}
      {showAuditAlert && !showUsernamePrompt && equipment.length > 0 && (() => {
        const getAuditStatus = (item: Equipment) => {
          if (!item.lastAuditDate) return 'never';
          const lastAudit = new Date(item.lastAuditDate);
          const now = new Date();
          const daysSince = Math.floor((now.getTime() - lastAudit.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince > 14) return 'overdue';
          if (daysSince > 7) return 'due_soon';
          return 'ok';
        };
        const overdue = equipment.filter(e => getAuditStatus(e) === 'overdue');
        const dueSoon = equipment.filter(e => getAuditStatus(e) === 'due_soon');
        const never = equipment.filter(e => getAuditStatus(e) === 'never');
        const total = overdue.length + dueSoon.length + never.length;

        if (total === 0) return null;

        return (
          <div className="modal-overlay" onClick={() => setShowAuditAlert(false)}>
            <div className="modal audit-alert-modal" onClick={(e) => e.stopPropagation()}>
              <h2>🔔 Audit Status Update</h2>
              <p className="audit-alert-subtitle">The following equipment needs attention:</p>

              {overdue.length > 0 && (
                <div className="audit-alert-section">
                  <h3 className="audit-section-overdue">🔴 Overdue — {overdue.length} items (14+ days)</h3>
                  <div className="audit-alert-list">
                    {overdue.slice(0, 10).map(e => (
                      <div key={e.id} className="audit-alert-item">
                        <strong>{e.identificationNumber}</strong> — {e.zone} · {e.location}
                        <span className="audit-alert-date">Last: {e.lastAuditDate}</span>
                      </div>
                    ))}
                    {overdue.length > 10 && <div className="audit-alert-more">+{overdue.length - 10} more</div>}
                  </div>
                </div>
              )}

              {dueSoon.length > 0 && (
                <div className="audit-alert-section">
                  <h3 className="audit-section-due">🟡 Due Soon — {dueSoon.length} items (7-14 days)</h3>
                  <div className="audit-alert-list">
                    {dueSoon.slice(0, 10).map(e => (
                      <div key={e.id} className="audit-alert-item">
                        <strong>{e.identificationNumber}</strong> — {e.zone} · {e.location}
                        <span className="audit-alert-date">Last: {e.lastAuditDate}</span>
                      </div>
                    ))}
                    {dueSoon.length > 10 && <div className="audit-alert-more">+{dueSoon.length - 10} more</div>}
                  </div>
                </div>
              )}

              {never.length > 0 && (
                <div className="audit-alert-section">
                  <h3 className="audit-section-never">⚫ Never Audited — {never.length} items</h3>
                  <div className="audit-alert-list">
                    {never.slice(0, 5).map(e => (
                      <div key={e.id} className="audit-alert-item">
                        <strong>{e.identificationNumber}</strong> — {e.zone} · {e.location}
                      </div>
                    ))}
                    {never.length > 5 && <div className="audit-alert-more">+{never.length - 5} more</div>}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn" onClick={() => setShowAuditAlert(false)}>
                  Dismiss
                </button>
                <button className="btn btn-primary" onClick={() => { setShowAuditAlert(false); setViewMode('table'); }}>
                  Go to Table
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Username prompt */}
      {showUsernamePrompt && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: '380px', textAlign: 'center' }}>
            <h2>👋 Welcome</h2>
            <p style={{ color: '#666', marginBottom: '16px' }}>Enter your Amazon username so we can track who makes changes.</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (username.trim()) {
                localStorage.setItem('equipment-tracker-username', username.trim());
                setShowUsernamePrompt(false);
                // Show audit alert after a short delay to let data load
                setTimeout(() => setShowAuditAlert(true), 1500);
              }
            }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., nancynle"
                style={{ width: '100%', padding: '10px', fontSize: '1rem', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '12px' }}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                Continue
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
