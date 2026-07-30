import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Equipment, IssueReport } from '../types';

interface Props {
  equipment: Equipment;
  username: string;
  onSubmit: (issue: IssueReport) => void;
  onClose: () => void;
}

// TODO: Replace these with your actual links
const MS_FORM_BASE_URL = 'https://forms.cloud.microsoft/r/Ai16vzJFLb';
const MS_FORM_SPANISH_URL = 'https://forms.cloud.microsoft/r/sPb4nyH7Fr';
const RME_TICKET_URL = 'https://t.corp.amazon.com/create';

export function IssueReportModal({ equipment, username, onSubmit, onClose }: Props) {
  const [severity, setSeverity] = useState<IssueReport['severity']>('medium');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // Build MS Form URL with pre-filled fields
  const getMsFormUrl = () => {
    const params = new URLSearchParams({
      'entry.1': equipment.identificationNumber,
      'entry.2': equipment.zone || '',
      'entry.3': equipment.zone || '',
      'entry.4': equipment.type.replace('_', ' '),
      'entry.5': equipment.floorLevel || '',
    });
    return `${MS_FORM_BASE_URL}?${params.toString()}`;
  };

  // Build RME ticket URL with pre-filled data
  const getRmeTicketUrl = () => {
    const params = new URLSearchParams({
      equipment_id: equipment.identificationNumber,
      location: `${equipment.zone} - ${equipment.location}`,
      floor: equipment.floorLevel,
      type: equipment.type.replace('_', ' '),
      issue: description || 'Equipment issue',
    });
    return `${RME_TICKET_URL}?${params.toString()}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    const issue: IssueReport = {
      id: uuidv4(),
      equipmentId: equipment.id,
      reportedBy: username || 'unknown',
      reportedAt: new Date().toISOString(),
      severity,
      description: description.trim(),
      status: 'open',
      assignedTo: assignedTo.trim() || undefined,
    };

    onSubmit(issue);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="issue-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="issue-title">⚠️ Report Issue</h2>
        <p className="modal-subtitle">
          For: <strong>{equipment.identificationNumber}</strong> — {equipment.zone} ({equipment.type.replace('_', ' ')})
        </p>

        {/* Quick action links */}
        <div className="issue-quick-links">
          <a
            href={getMsFormUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link-btn"
          >
            📝 Report Issue (English)
          </a>
          <a
            href={MS_FORM_SPANISH_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link-btn"
          >
            📝 Reportar Problema (Español)
          </a>
          <a
            href={getRmeTicketUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link-btn quick-link-rme"
          >
            🔧 RME Ticket
          </a>
        </div>

        <div className="issue-divider">
          <span>or log it here directly</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="severity">Severity</label>
            <select
              id="severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IssueReport['severity'])}
            >
              <option value="low">Low — Minor, non-urgent</option>
              <option value="medium">Medium — Needs attention soon</option>
              <option value="high">High — Safety concern</option>
              <option value="critical">Critical — Do not use, immediate danger</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's wrong? (e.g., bent rung, missing jam pole, stuck mechanism...)"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="assigned-to">
              Notify / Assign To <span className="optional">(optional)</span>
            </label>
            <input
              id="assigned-to"
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Username or alias"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-danger">
              🚨 Log Issue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
