import React, { useState, useEffect } from 'react';
import type { ChangeLogEntry } from '../types';

export function ActivityLog() {
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/changelog')
      .then((r) => r.ok ? r.json() : [])
      .then(setChangelog)
      .catch(() => setChangelog([]));
  }, []);

  // Group by date
  const grouped = changelog
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    .filter((c) => filter === 'all' || c.changeType === filter)
    .reduce((acc, entry) => {
      const date = new Date(entry.changedAt).toLocaleDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    }, {} as Record<string, ChangeLogEntry[]>);

  const changeTypeLabels: Record<string, string> = {
    condition_change: '🔄 Condition',
    quantity_change: '📦 Quantity',
    issue_reported: '⚠️ Issue',
    issue_resolved: '✓ Resolved',
    created: '➕ Created',
    deleted: '🗑️ Deleted',
    edit: '✏️ Edit',
  };

  return (
    <div className="activity-log">
      <div className="activity-header">
        <h3>📋 Activity Log</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-dropdown-dark"
        >
          <option value="all">All Changes</option>
          <option value="condition_change">Condition Changes</option>
          <option value="quantity_change">Quantity Changes</option>
          <option value="issue_reported">Issues Reported</option>
          <option value="issue_resolved">Issues Resolved</option>
          <option value="edit">Edits</option>
        </select>
      </div>

      {changelog.length === 0 ? (
        <p className="dash-empty">No activity recorded yet. Changes will appear here as the team uses the system.</p>
      ) : (
        <div className="activity-timeline">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date} className="activity-day">
              <div className="activity-date">{date}</div>
              <div className="activity-entries">
                {entries.map((entry) => (
                  <div key={entry.id} className="activity-entry">
                    <span className="activity-type">{changeTypeLabels[entry.changeType] || '•'}</span>
                    <span className="activity-equip">{entry.equipmentIdNumber || '?'}</span>
                    <span className="activity-detail">
                      {entry.field}: {entry.oldValue || '—'} → {entry.newValue || '—'}
                    </span>
                    <span className="activity-by">{entry.changedBy}</span>
                    <span className="activity-time">
                      {new Date(entry.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
