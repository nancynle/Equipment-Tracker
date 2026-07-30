import React from 'react';
import type { IssueReport, Equipment } from '../types';

interface Props {
  issues: IssueReport[];
  equipment: Equipment[];
  onUpdateIssue: (issue: IssueReport) => void;
}

export function IssuePanel({ issues, equipment, onUpdateIssue }: Props) {
  const openIssues = issues.filter((i) => i.status !== 'resolved');
  const resolvedIssues = issues.filter((i) => i.status === 'resolved');

  const getEquipment = (id: string) => equipment.find((e) => e.id === id);

  const handleResolve = (issue: IssueReport) => {
    onUpdateIssue({
      ...issue,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    });
  };

  const handleReopen = (issue: IssueReport) => {
    onUpdateIssue({
      ...issue,
      status: 'open',
      resolvedAt: undefined,
    });
  };

  return (
    <div className="issue-panel">
      <h3>⚠️ Open Issues ({openIssues.length})</h3>
      {openIssues.length === 0 ? (
        <p className="dash-empty">No open issues ✓</p>
      ) : (
        <div className="issue-list">
          {openIssues.map((issue) => {
            const eq = getEquipment(issue.equipmentId);
            return (
              <div key={issue.id} className={`issue-item severity-${issue.severity}`}>
                <div className="issue-item-header">
                  <span className={`severity-dot sev-${issue.severity}`}></span>
                  <strong>{eq?.identificationNumber || '?'}</strong>
                  <span className="issue-severity-label">{issue.severity}</span>
                  <span className="issue-date">{new Date(issue.reportedAt).toLocaleDateString()}</span>
                </div>
                <div className="issue-item-body">
                  <p>{issue.description}</p>
                  {eq && <span className="issue-item-location">{eq.zone} · {eq.location}</span>}
                  {issue.assignedTo && <span className="issue-item-assigned">Assigned: {issue.assignedTo}</span>}
                </div>
                <div className="issue-item-actions">
                  <button className="btn btn-sm btn-success" onClick={() => handleResolve(issue)}>
                    ✓ Resolve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {resolvedIssues.length > 0 && (
        <>
          <h3 style={{ marginTop: '20px' }}>✓ Resolved ({resolvedIssues.length})</h3>
          <div className="issue-list issue-list-resolved">
            {resolvedIssues.slice(0, 10).map((issue) => {
              const eq = getEquipment(issue.equipmentId);
              return (
                <div key={issue.id} className="issue-item issue-resolved">
                  <div className="issue-item-header">
                    <span className="severity-dot sev-resolved"></span>
                    <strong>{eq?.identificationNumber || '?'}</strong>
                    <span className="issue-date">
                      Resolved {issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <div className="issue-item-body">
                    <p>{issue.description}</p>
                  </div>
                  <div className="issue-item-actions">
                    <button className="btn btn-sm" onClick={() => handleReopen(issue)}>
                      ↩ Reopen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
