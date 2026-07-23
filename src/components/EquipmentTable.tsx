import React, { useState } from 'react';
import type { Equipment, IssueReport, EquipmentCondition } from '../types';

interface Props {
  equipment: Equipment[];
  issues: IssueReport[];
  onUpdate: (equipment: Equipment) => void;
  onDelete: (id: string) => void;
  onSelect: (equipment: Equipment) => void;
  onReportIssue: (equipment: Equipment) => void;
  highlightedIds: Set<string>;
  globalSearch: string;
}

const TYPE_LABELS: Record<string, string> = {
  jam_pole: '🔵 Jam Pole',
  cotterman: '🟡 Cotterman',
};

const CONDITION_COLORS: Record<EquipmentCondition, string> = {
  good: '#4caf50',
  slight_bend: '#ff9800',
  bad: '#f44336',
  unavailable: '#9e9e9e',
};

export function EquipmentTable({ equipment, issues, onUpdate, onDelete, onSelect, onReportIssue, highlightedIds, globalSearch }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Equipment>>({});

  const filtered = equipment
    .filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          item.identificationNumber.toLowerCase().includes(s) ||
          item.zone.toLowerCase().includes(s) ||
          item.location.toLowerCase().includes(s) ||
          item.floorLevel.toLowerCase().includes(s) ||
          item.itemArea.toLowerCase().includes(s) ||
          item.mountedOn?.toLowerCase().includes(s) ||
          item.notes?.toLowerCase().includes(s)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (globalSearch) {
        const aMatch = highlightedIds.has(a.id) ? 0 : 1;
        const bMatch = highlightedIds.has(b.id) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return 0;
    });

  const getOpenIssueCount = (equipId: string) =>
    issues.filter((i) => i.equipmentId === equipId && i.status !== 'resolved').length;

  const startEdit = (item: Equipment) => {
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const saveEdit = () => {
    if (editingId && editData) {
      onUpdate(editData as Equipment);
      setEditingId(null);
      setEditData({});
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  return (
    <div className="equipment-table">
      {/* Toolbar */}
      <div className="table-toolbar">
        <input
          type="search"
          placeholder="Search ID#, location, zone, area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
          aria-label="Search equipment"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="filter-select"
          aria-label="Filter by type"
        >
          <option value="all">All Types</option>
          <option value="jam_pole">Jam Poles</option>
          <option value="cotterman">Cottermans</option>
        </select>
        <span className="item-count">{filtered.length} items</span>
      </div>

      {/* Table */}
      <div className="table-container">
        <table role="grid" aria-label="Equipment inventory">
          <thead>
            <tr>
              <th scope="col">Zone</th>
              <th scope="col">Location</th>
              <th scope="col">Floor</th>
              <th scope="col">Area</th>
              <th scope="col">Type</th>
              <th scope="col">ID #</th>
              <th scope="col">JP Qty</th>
              <th scope="col">Holder</th>
              <th scope="col">Condition</th>
              <th scope="col">Last Audit</th>
              <th scope="col">Notes</th>
              <th scope="col">Issues</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr
                key={item.id}
                className={`${editingId === item.id ? 'editing' : ''} ${highlightedIds.has(item.id) ? 'highlighted' : ''}`}
                onClick={() => onSelect(item)}
              >
                <td>
                  {editingId === item.id ? (
                    <input
                      value={editData.zone || ''}
                      onChange={(e) => setEditData({ ...editData, zone: e.target.value })}
                      aria-label="Zone"
                      style={{ width: '50px' }}
                    />
                  ) : (
                    item.zone
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <input
                      value={editData.location || ''}
                      onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                      aria-label="Location"
                    />
                  ) : (
                    item.location
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <input
                      value={editData.floorLevel || ''}
                      onChange={(e) => setEditData({ ...editData, floorLevel: e.target.value })}
                      aria-label="Floor Level"
                      style={{ width: '40px' }}
                    />
                  ) : (
                    item.floorLevel
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <input
                      value={editData.itemArea || ''}
                      onChange={(e) => setEditData({ ...editData, itemArea: e.target.value })}
                      aria-label="Item Area"
                    />
                  ) : (
                    item.itemArea
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <select
                      value={editData.type || 'jam_pole'}
                      onChange={(e) => setEditData({ ...editData, type: e.target.value as any })}
                      aria-label="Equipment Type"
                    >
                      <option value="jam_pole">Jam Pole</option>
                      <option value="cotterman">Cotterman</option>
                    </select>
                  ) : (
                    TYPE_LABELS[item.type] || item.type
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <input
                      value={editData.identificationNumber || ''}
                      onChange={(e) => setEditData({ ...editData, identificationNumber: e.target.value })}
                      aria-label="ID number"
                    />
                  ) : (
                    <strong>{item.identificationNumber}</strong>
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <input
                      type="number"
                      min="0"
                      value={editData.jamPoleQty ?? 0}
                      onChange={(e) => setEditData({ ...editData, jamPoleQty: parseInt(e.target.value) || 0 })}
                      aria-label="Jam Pole Quantity"
                      style={{ width: '45px' }}
                    />
                  ) : (
                    item.jamPoleQty || '—'
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <select
                      value={editData.holder ? 'yes' : 'no'}
                      onChange={(e) => setEditData({ ...editData, holder: e.target.value === 'yes' })}
                      aria-label="Holder"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : (
                    item.holder ? '✓ Yes' : '—'
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <select
                      value={editData.condition || 'good'}
                      onChange={(e) => setEditData({ ...editData, condition: e.target.value as EquipmentCondition })}
                      aria-label="Condition"
                    >
                      <option value="good">Good</option>
                      <option value="slight_bend">Slight Bend</option>
                      <option value="bad">Bad</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  ) : (
                    <span className="condition-badge" style={{ backgroundColor: CONDITION_COLORS[item.condition] }}>
                      {item.condition}
                    </span>
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <input
                      type="date"
                      value={editData.lastAuditDate || ''}
                      onChange={(e) => setEditData({ ...editData, lastAuditDate: e.target.value })}
                      aria-label="Last audit date"
                    />
                  ) : (
                    item.lastAuditDate || '—'
                  )}
                </td>
                <td>
                  {editingId === item.id ? (
                    <input
                      value={editData.notes || ''}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      aria-label="Notes"
                      placeholder="Add notes..."
                    />
                  ) : (
                    item.notes || '—'
                  )}
                </td>
                <td>
                  {getOpenIssueCount(item.id) > 0 && (
                    <span className="issue-badge">{getOpenIssueCount(item.id)}</span>
                  )}
                </td>
                <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                  {editingId === item.id ? (
                    <>
                      <button className="btn btn-sm btn-success" onClick={saveEdit} title="Save">✓</button>
                      <button className="btn btn-sm" onClick={cancelEdit} title="Cancel">✗</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm" onClick={() => startEdit(item)} title="Edit">✏️</button>
                      <button className="btn btn-sm btn-warning" onClick={() => onReportIssue(item)} title="Report Issue">⚠️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => { if (confirm(`Delete ${item.identificationNumber}?`)) onDelete(item.id); }} title="Delete">🗑️</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="empty-state">
                  No equipment found. Add equipment or import your spreadsheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
