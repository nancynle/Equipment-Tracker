import React, { useState, useEffect } from 'react';
import type { ChangeLogEntry } from '../types';

export function ActivityLogPage() {
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/changelog')
      .then((r) => r.ok ? r.json() : [])
      .then(setChangelog)
      .catch(() => setChangelog([]));
  }, []);

  // Get unique users
  const users = [...new Set(changelog.map((c) => c.changedBy).filter(Boolean))];

  // Filter entries
  const filtered = changelog
    .filter((c) => filter === 'all' || c.changeType === filter)
    .filter((c) => userFilter === 'all' || c.changedBy === userFilter)
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  // Group by date
  const grouped = filtered.reduce((acc, entry) => {
    const date = new Date(entry.changedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, ChangeLogEntry[]>);

  const changeTypeLabels: Record<string, { icon: string; label: string; color: string }> = {
    condition_change: { icon: '🔄', label: 'Condition Changed', color: '#ff9800' },
    quantity_change: { icon: '📦', label: 'Quantity Changed', color: '#2196f3' },
    issue_reported: { icon: '⚠️', label: 'Issue Reported', color: '#f44336' },
    issue_resolved: { icon: '✅', label: 'Issue Resolved', color: '#4caf50' },
    created: { icon: '➕', label: 'Equipment Added', color: '#4caf50' },
    deleted: { icon: '🗑️', label: 'Equipment Deleted', color: '#f44336' },
    edit: { icon: '✏️', label: 'Edit', color: '#666' },
  };

  return (
    <div className="activity-log-page">
      <div className="activity-page-header">
        <h2>📋 Activity Log</h2>
        <p className="activity-page-subtitle">Full history of all changes made to equipment data</p>
        <div className="activity-page-filters">
          <div className="activity-filter">
            <label>Action:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All Actions</option>
              <option value="created">➕ Equipment Added</option>
              <option value="deleted">🗑️ Equipment Deleted</option>
              <option value="condition_change">🔄 Condition Changes</option>
              <option value="quantity_change">📦 Quantity Changes</option>
              <option value="issue_reported">⚠️ Issues Reported</option>
              <option value="issue_resolved">✅ Issues Resolved</option>
              <option value="edit">✏️ Edits</option>
            </select>
          </div>
          <div className="activity-filter">
            <label>User:</label>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="all">All Users</option>
              {users.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <span className="activity-count">{filtered.length} entries</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="activity-empty">
          <p>No activity recorded yet.</p>
          <p>Changes will appear here as the team edits equipment, reports issues, adds or removes items.</p>
        </div>
      ) : (
        <div className="activity-page-timeline">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date} className="activity-page-day">
              <div className="activity-page-date">{date}</div>
              <div className="activity-page-entries">
                {entries.map((entry) => {
                  const typeInfo = changeTypeLabels[entry.changeType] || { icon: '•', label: entry.changeType, color: '#666' };
                  return (
                    <div key={entry.id} className="activity-page-entry">
                      <div className="activity-page-entry-icon" style={{ backgroundColor: typeInfo.color }}>
                        {typeInfo.icon}
                      </div>
                      <div className="activity-page-entry-content">
                        <div className="activity-page-entry-title">
                          <strong>{typeInfo.label}</strong>
                          <span className="activity-page-equip">{entry.equipmentIdNumber || 'Unknown'}</span>
                        </div>
                        <div className="activity-page-entry-detail">
                          {entry.changeType === 'created' && (
                            <span>Added: {entry.newValue}</span>
                          )}
                          {entry.changeType === 'deleted' && (
                            <span>Removed: {entry.oldValue}</span>
                          )}
                          {(entry.changeType === 'condition_change' || entry.changeType === 'quantity_change' || entry.changeType === 'edit') && (
                            <span><strong>{entry.field}</strong>: <span className="old-value">{entry.oldValue || '(empty)'}</span> → <span className="new-value">{entry.newValue || '(empty)'}</span></span>
                          )}
                          {entry.changeType === 'issue_reported' && (
                            <span>{entry.newValue}</span>
                          )}
                          {entry.changeType === 'issue_resolved' && (
                            <span>Issue resolved</span>
                          )}
                        </div>
                        <div className="activity-page-entry-meta">
                          <span className="activity-page-user">👤 {entry.changedBy || 'unknown'}</span>
                          <span className="activity-page-time">
                            {new Date(entry.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
