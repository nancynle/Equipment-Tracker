import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Equipment, EquipmentType, EquipmentCondition } from '../types';

interface Props {
  equipment: Equipment[];
  onSubmit: (equipment: Equipment) => void;
  onClose: () => void;
}

export function AddEquipmentModal({ equipment, onSubmit, onClose }: Props) {
  const [type, setType] = useState<EquipmentType>('jam_pole');
  const [zone, setZone] = useState('');
  const [location, setLocation] = useState('');
  const [floorLevel, setFloorLevel] = useState('1');
  const [itemArea, setItemArea] = useState('');
  const [identificationNumber, setIdentificationNumber] = useState('');
  const [jamPoleQty, setJamPoleQty] = useState(0);
  const [holder, setHolder] = useState(true);
  const [condition, setCondition] = useState<EquipmentCondition>('good');
  const [lastAuditDate, setLastAuditDate] = useState('');
  const [mountedOn, setMountedOn] = useState('');
  const [notes, setNotes] = useState('');

  const cottermans = equipment.filter((e) => e.type === 'cotterman');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identificationNumber.trim()) return;

    const newEquipment: Equipment = {
      id: uuidv4(),
      zone: zone.trim(),
      location: location.trim(),
      floorLevel: floorLevel.trim(),
      itemArea: itemArea.trim(),
      type,
      identificationNumber: identificationNumber.trim(),
      jamPoleQty,
      holder,
      condition,
      lastAuditDate,
      notes: notes.trim() || undefined,
      mountedOn: mountedOn || undefined,
      lastModifiedBy: 'current-user',
      mapX: 50,
      mapY: 50,
    };

    onSubmit(newEquipment);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="add-title">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="add-title">➕ Add Equipment</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eq-zone">Zone</label>
              <input
                id="eq-zone"
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="e.g., A, B, C"
              />
            </div>
            <div className="form-group">
              <label htmlFor="eq-location">Location</label>
              <input
                id="eq-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., North Wall, Aisle 3"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eq-floor">Floor Level</label>
              <input
                id="eq-floor"
                type="text"
                value={floorLevel}
                onChange={(e) => setFloorLevel(e.target.value)}
                placeholder="1, 2, M..."
              />
            </div>
            <div className="form-group">
              <label htmlFor="eq-area">Item Area</label>
              <input
                id="eq-area"
                type="text"
                value={itemArea}
                onChange={(e) => setItemArea(e.target.value)}
                placeholder="e.g., Pack, Ship, Recv"
              />
            </div>
            <div className="form-group">
              <label htmlFor="eq-type">Equipment Type</label>
              <select
                id="eq-type"
                value={type}
                onChange={(e) => setType(e.target.value as EquipmentType)}
              >
                <option value="jam_pole">Jam Pole</option>
                <option value="cotterman">Cotterman</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eq-id">ID #</label>
              <input
                id="eq-id"
                type="text"
                value={identificationNumber}
                onChange={(e) => setIdentificationNumber(e.target.value)}
                placeholder="e.g., JP-001"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="eq-condition">Condition</label>
              <select
                id="eq-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as EquipmentCondition)}
              >
                <option value="good">Good</option>
                <option value="slight_bend">Slight Bend</option>
                <option value="bad">Bad</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eq-qty">Jam Pole Qty</label>
              <input
                id="eq-qty"
                type="number"
                min="0"
                value={jamPoleQty}
                onChange={(e) => setJamPoleQty(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="eq-holder">Holder</label>
              <select
                id="eq-holder"
                value={holder ? 'yes' : 'no'}
                onChange={(e) => setHolder(e.target.value === 'yes')}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="eq-audit">Last Audit Date</label>
            <input
              id="eq-audit"
              type="date"
              value={lastAuditDate}
              onChange={(e) => setLastAuditDate(e.target.value)}
            />
          </div>

          {type === 'jam_pole' && (
            <div className="form-group">
              <label htmlFor="eq-mounted">Mounted On <span className="optional">(if on a Cotterman)</span></label>
              <select id="eq-mounted" value={mountedOn} onChange={(e) => setMountedOn(e.target.value)}>
                <option value="">— Standalone —</option>
                {cottermans.map((c) => (
                  <option key={c.id} value={c.identificationNumber}>
                    {c.identificationNumber} ({c.zone} - {c.location})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="eq-notes">Notes <span className="optional">(optional)</span></label>
            <textarea
              id="eq-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Equipment</button>
          </div>
        </form>
      </div>
    </div>
  );
}
