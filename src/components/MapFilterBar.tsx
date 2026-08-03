import React, { useState } from 'react';
import type { Equipment } from '../types';

interface Props {
  equipment: Equipment[];
  selectedFloor: string;
  selectedZone: string;
  selectedType: string;
  selectedHighlight: string;
  viewOnly: boolean;
  onFloorChange: (floor: string) => void;
  onZoneChange: (zone: string) => void;
  onTypeChange: (type: string) => void;
  onHighlightChange: (highlight: string) => void;
  onViewOnlyChange: (viewOnly: boolean) => void;
  colors: Record<string, string>;
  onColorsChange: (colors: Record<string, string>) => void;
}

export function MapFilterBar({
  equipment,
  selectedFloor,
  selectedZone,
  selectedType,
  selectedHighlight,
  viewOnly,
  onFloorChange,
  onZoneChange,
  onTypeChange,
  onHighlightChange,
  onViewOnlyChange,
  colors,
  onColorsChange,
}: Props) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const floors = [...new Set(equipment.map((e) => e.floorLevel).filter(Boolean))].sort();
  const zones = [...new Set(equipment.map((e) => e.zone).filter(Boolean))].sort();

  return (
    <div className="map-filter-bar">
      {/* Floor dropdown */}
      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-floor">FLOOR:</label>
        <select
          id="filter-floor"
          className="filter-dropdown"
          value={selectedFloor}
          onChange={(e) => onFloorChange(e.target.value)}
        >
          <option value="all">All</option>
          <option value="ground">Ground</option>
          <option value="mezzanine">Mezzanine</option>
        </select>
      </div>

      {/* Zone dropdown */}
      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-zone">ZONE:</label>
        <select
          id="filter-zone"
          className="filter-dropdown"
          value={selectedZone}
          onChange={(e) => onZoneChange(e.target.value)}
        >
          <option value="all">All</option>
          {zones.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>

      {/* Equipment type dropdown */}
      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-type">EQUIP:</label>
        <select
          id="filter-type"
          className="filter-dropdown"
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value)}
        >
          <option value="all">All</option>
          <option value="jam_pole">🔵 Jam Pole</option>
          <option value="cotterman">🟡 Cotterman</option>
        </select>
      </div>

      {/* Highlight filter */}
      <div className="filter-group">
        <label className="filter-label" htmlFor="filter-highlight">HIGHLIGHT:</label>
        <select
          id="filter-highlight"
          className="filter-dropdown"
          value={selectedHighlight}
          onChange={(e) => onHighlightChange(e.target.value)}
        >
          <option value="none">None</option>
          <option value="missing_poles">🔴 Missing Jam Poles</option>
          <option value="missing_holders">🟠 Missing Holders</option>
          <option value="damaged">🟡 Damaged (Bad/Slight Bend)</option>
          <option value="unavailable">⚫ Unavailable</option>
        </select>
      </div>

      {/* View only toggle */}
      <div className="filter-group">
        <button
          className={`filter-btn ${viewOnly ? 'active active-blue' : ''}`}
          onClick={() => onViewOnlyChange(!viewOnly)}
          title={viewOnly ? 'Markers locked (click to unlock for editing)' : 'Markers unlocked (click to lock)'}
        >
          {viewOnly ? '🔒 View Only' : '🔓 Edit Mode'}
        </button>
      </div>

      {/* Color settings */}
      <div className="filter-group filter-group-right">
        <button
          className={`filter-btn ${showColorPicker ? 'active' : ''}`}
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Customize dot colors"
        >
          🎨 Colors
        </button>
      </div>

      {/* Color picker dropdown */}
      {showColorPicker && (
        <div className="color-picker-panel">
          <div className="color-row">
            <label htmlFor="color-jampole">Jam Pole:</label>
            <input
              id="color-jampole"
              type="color"
              value={colors.jam_pole}
              onChange={(e) => onColorsChange({ ...colors, jam_pole: e.target.value })}
            />
            <span className="color-hex">{colors.jam_pole}</span>
          </div>
          <div className="color-row">
            <label htmlFor="color-cotterman">Cotterman:</label>
            <input
              id="color-cotterman"
              type="color"
              value={colors.cotterman}
              onChange={(e) => onColorsChange({ ...colors, cotterman: e.target.value })}
            />
            <span className="color-hex">{colors.cotterman}</span>
          </div>
          <button
            className="filter-btn"
            onClick={() => onColorsChange({ jam_pole: '#2196f3', cotterman: '#f5c400' })}
            style={{ marginTop: '6px', fontSize: '0.7rem' }}
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}
