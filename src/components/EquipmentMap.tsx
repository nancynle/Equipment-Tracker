import React, { useRef, useState } from 'react';
import type { Equipment, IssueReport } from '../types';
import { MapFilterBar } from './MapFilterBar';

interface Props {
  equipment: Equipment[];
  issues: IssueReport[];
  selectedEquipment: Equipment | null;
  onSelect: (equipment: Equipment) => void;
  onUpdatePosition: (id: string, mapX: number, mapY: number) => void;
  highlightedIds: Set<string>;
}

const DEFAULT_COLORS: Record<string, string> = {
  jam_pole: '#2196f3',           // Blue
  cotterman: '#f5c400',          // Yellow
};

export function EquipmentMap({ equipment, issues, selectedEquipment, onSelect, onUpdatePosition, highlightedIds }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [viewOnly, setViewOnly] = useState(true);

  // Color customization (persisted in localStorage)
  const [colors, setColors] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('equipment-tracker-colors');
      return saved ? JSON.parse(saved) : DEFAULT_COLORS;
    } catch {
      return DEFAULT_COLORS;
    }
  });

  const handleColorsChange = (newColors: Record<string, string>) => {
    setColors(newColors);
    localStorage.setItem('equipment-tracker-colors', JSON.stringify(newColors));
  };

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.25;

  const floorImage = '/floorplan.png';

  // Apply filters
  const filteredEquipment = equipment.filter((e) => {
    if (selectedFloor !== 'all') {
      const floor = e.floorLevel.toLowerCase();
      if (selectedFloor === 'ground' && !['1', 'ground', 'g'].includes(floor)) return false;
      if (selectedFloor === 'mezzanine' && !['m', 'mezz', 'mezzanine', '2'].includes(floor)) return false;
    }
    if (selectedZone !== 'all' && e.zone.toLowerCase() !== selectedZone.toLowerCase()) return false;
    if (selectedType !== 'all' && e.type !== selectedType) return false;
    if (e.mountedOn) return false;
    return true;
  });

  const getMountedJamPoles = (cottermanId: string) =>
    equipment.filter((e) => e.mountedOn === cottermanId);

  const hasOpenIssue = (equipId: string) =>
    issues.some((i) => i.equipmentId === equipId && i.status !== 'resolved');

  // Marker drag (only when not in view-only mode)
  const handleMarkerDragStart = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (viewOnly) return;
    setDragging(id);
  };

  const handleMapMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (!dragging || !imgRef.current) return;

    // Calculate position relative to the actual image element
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onUpdatePosition(dragging, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
  };

  const handleMapMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  // Pan
  const handlePanStart = (e: React.MouseEvent) => {
    if (e.button === 0 && !dragging && e.target === mapRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  // Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  };

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  const handleZoomReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Touch support
  const lastTouchDist = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (dist - lastTouchDist.current) * 0.005;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
      lastTouchDist.current = dist;
      return;
    }
    if (!dragging || !imgRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    onUpdatePosition(dragging, Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
  };

  // Floor plan upload
  const handleFloorplanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('floorplan', file);
    try {
      const res = await fetch('/api/upload-floorplan', { method: 'POST', body: formData });
      if (res.ok && imgRef.current) {
        imgRef.current.src = `/floorplan.png?t=${Date.now()}`;
      }
    } catch (err) {
      console.error('Failed to upload floor plan:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="equipment-map">
      {/* Filter bar (IAH3-style) */}
      <MapFilterBar
        equipment={equipment}
        selectedFloor={selectedFloor}
        selectedZone={selectedZone}
        selectedType={selectedType}
        viewOnly={viewOnly}
        onFloorChange={setSelectedFloor}
        onZoneChange={setSelectedZone}
        onTypeChange={setSelectedType}
        onViewOnlyChange={setViewOnly}
        colors={colors}
        onColorsChange={handleColorsChange}
      />

      {/* Map toolbar */}
      <div className="map-toolbar-mini">
        <button
          className="btn btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Upload or replace floor plan image"
        >
          {uploading ? '⏳...' : '🖼️ Map'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFloorplanUpload}
          style={{ display: 'none' }}
        />
        <span className="map-count">{filteredEquipment.length} visible</span>
        <button
          className="btn btn-sm btn-save-positions"
          onClick={async () => {
            const positions = equipment.map(e => ({ id: e.id, mapX: e.mapX, mapY: e.mapY }));
            try {
              const res = await fetch('/api/equipment/bulk-positions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(positions),
              });
              const result = await res.json();
              alert(`✅ Positions saved! ${result.updated} dots updated.`);
            } catch (err) {
              alert('❌ Failed to save positions');
            }
          }}
          title="Save all dot positions to server"
        >
          💾 Save Positions
        </button>
      </div>

      {/* Map viewport */}
      <div
        ref={containerRef}
        className="map-viewport"
        onWheel={handleWheel}
        onMouseDown={handlePanStart}
        onMouseMove={handleMapMouseMove}
        onMouseUp={handleMapMouseUp}
        onMouseLeave={handleMapMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMapMouseUp}
      >
        {/* Map inner — transformed for zoom/pan */}
        <div
          ref={mapRef}
          className="map-container"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            cursor: isPanning ? 'grabbing' : (dragging ? 'grabbing' : 'grab'),
          }}
          role="application"
          aria-label="Equipment map. Scroll to zoom, drag background to pan."
        >
          {/* Floor plan image — dots are positioned relative to this */}
          <img
            ref={imgRef}
            src={floorImage}
            alt="Building floor plan"
            className="map-floorplan-img"
            draggable={false}
          />

          {/* Dot overlay — sits directly on top of the image */}
          <div className="map-dot-overlay">
            {filteredEquipment.map((item) => (
              <div
                key={item.id}
                className={`map-dot ${selectedEquipment?.id === item.id ? 'dot-selected' : ''} ${
                  highlightedIds.size > 0 ? (highlightedIds.has(item.id) ? 'dot-highlighted' : 'dot-dimmed') : ''
                } ${item.condition === 'bad' || item.condition === 'unavailable' ? 'dot-poor' : ''} ${hasOpenIssue(item.id) ? 'dot-has-issue' : ''}`}
                style={{
                  left: `${item.mapX}%`,
                  top: `${item.mapY}%`,
                  backgroundColor: colors[item.type] || '#888',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item);
                }}
                onMouseDown={handleMarkerDragStart(item.id)}
                onTouchStart={() => { if (!viewOnly) setDragging(item.id); }}
                title={`${item.identificationNumber} | ${item.zone} | ${item.location} | ${item.condition}`}
                role="button"
                aria-label={`${item.identificationNumber}, ${item.type.replace('_', ' ')}`}
                tabIndex={0}
              >
                {item.type === 'cotterman' && getMountedJamPoles(item.identificationNumber).length > 0 && (
                  <span className="dot-count">
                    {getMountedJamPoles(item.identificationNumber).length}
                  </span>
                )}
              </div>
            ))}
          </div>

          {filteredEquipment.length === 0 && (
            <div className="map-empty">
              No equipment matches current filters.
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="zoom-controls">
          <button onClick={handleZoomIn} title="Zoom in">+</button>
          <button onClick={handleZoomOut} title="Zoom out">−</button>
          <button onClick={handleZoomReset} title="Reset view" className="zoom-reset">⟲</button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Selected equipment detail */}
      {selectedEquipment && (
        <div className="map-detail-panel" aria-live="polite">
          <h3>
            <span className="detail-dot" style={{ backgroundColor: colors[selectedEquipment.type] || '#888' }}></span>
            {selectedEquipment.identificationNumber}
          </h3>
          <dl>
            <dt>Type</dt>
            <dd>{selectedEquipment.type.replace('_', ' ')}</dd>
            <dt>Zone</dt>
            <dd>{selectedEquipment.zone || '—'}</dd>
            <dt>Location</dt>
            <dd>{selectedEquipment.location || '—'}</dd>
            <dt>Floor</dt>
            <dd>{selectedEquipment.floorLevel || '—'}</dd>
            <dt>Area</dt>
            <dd>{selectedEquipment.itemArea || '—'}</dd>
            <dt>Condition</dt>
            <dd>{selectedEquipment.condition}</dd>
            <dt>JP Qty</dt>
            <dd>{selectedEquipment.jamPoleQty}</dd>
            <dt>Holder</dt>
            <dd>{selectedEquipment.holder ? 'Yes' : 'No'}</dd>
            <dt>Last Audit</dt>
            <dd>{selectedEquipment.lastAuditDate || '—'}</dd>
            {selectedEquipment.mountedOn && (
              <>
                <dt>Mounted On</dt>
                <dd>{selectedEquipment.mountedOn}</dd>
              </>
            )}
            {selectedEquipment.notes && (
              <>
                <dt>Notes</dt>
                <dd>{selectedEquipment.notes}</dd>
              </>
            )}
          </dl>

          {/* Mounted jam poles for Cottermans */}
          {selectedEquipment.type === 'cotterman' &&
            getMountedJamPoles(selectedEquipment.identificationNumber).length > 0 && (
              <div className="mounted-list">
                <h4>Mounted Jam Poles:</h4>
                <ul>
                  {getMountedJamPoles(selectedEquipment.identificationNumber).map((jp) => (
                    <li key={jp.id} onClick={() => onSelect(jp)} className="mounted-item">
                      {jp.identificationNumber} — {jp.condition}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          <p className="detail-meta">
            Modified by {selectedEquipment.lastModifiedBy || 'unknown'}
          </p>
        </div>
      )}
    </div>
  );
}
