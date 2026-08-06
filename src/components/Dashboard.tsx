import React, { useState, useEffect } from 'react';
import type { Equipment, IssueReport, ChangeLogEntry } from '../types';
import { TrendChart } from './TrendChart';
import { IssuePanel } from './IssuePanel';

interface Props {
  equipment: Equipment[];
  issues: IssueReport[];
  onUpdateIssue: (issue: IssueReport) => void;
}

// Configurable thresholds
const _RESERVED = 0; // placeholder

export function Dashboard({ equipment, issues, onUpdateIssue }: Props) {
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([]);
  const [timeframe, setTimeframe] = useState<'7' | '30' | '90' | '180' | '365'>('90');

  useEffect(() => {
    fetch('/api/changelog')
      .then((r) => r.ok ? r.json() : [])
      .then(setChangelog)
      .catch(() => setChangelog([]));
  }, []);

  // Analytics calculations
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - parseInt(timeframe) * 24 * 60 * 60 * 1000);
  const recentChanges = changelog.filter((c) => new Date(c.changedAt) >= cutoffDate);

  const conditionDamages = recentChanges.filter(
    (c) => c.changeType === 'condition_change' && (c.newValue === 'bad' || c.newValue === 'unavailable' || c.newValue === 'slight_bend')
  );
  const quantityDecreases = recentChanges.filter(
    (c) => c.changeType === 'quantity_change' && Number(c.newValue) < Number(c.oldValue)
  );
  const issuesReported = recentChanges.filter((c) => c.changeType === 'issue_reported');
  const issuesResolved = recentChanges.filter((c) => c.changeType === 'issue_resolved');

  // Annualized rate
  const daysInPeriod = parseInt(timeframe);
  const annualizedDamageRate = conditionDamages.length > 0
    ? Math.round((conditionDamages.length / daysInPeriod) * 365)
    : 0;

  // Summary stats
  const totalItems = equipment.length;
  const totalJamPoles = equipment.filter((e) => e.type === 'jam_pole').length;
  const totalCottermans = equipment.filter((e) => e.type === 'cotterman').length;

  const openIssues = issues.filter((i) => i.status === 'open');
  const criticalIssues = issues.filter((i) => i.status !== 'resolved' && i.severity === 'critical');
  const highIssues = issues.filter((i) => i.status !== 'resolved' && i.severity === 'high');

  // Condition breakdown
  const conditionGood = equipment.filter((e) => e.condition === 'good').length;
  const conditionSlightBend = equipment.filter((e) => e.condition === 'slight_bend').length;
  const conditionBad = equipment.filter((e) => e.condition === 'bad').length;
  const conditionUnavailable = equipment.filter((e) => e.condition === 'unavailable').length;

  // Stock percentage calculations
  const locationsWithHolders = equipment.filter((e) => e.holder);
  const totalHolderLocations = locationsWithHolders.length;
  const stockedLocations = locationsWithHolders.filter((e) => e.jamPoleQty > 0).length;
  const totalPoles = equipment.reduce((sum, e) => sum + (e.jamPoleQty || 0), 0);
  const siteStockPercent = totalHolderLocations > 0 ? Math.round((stockedLocations / totalHolderLocations) * 100) : 100;

  // Per-zone stock breakdown
  const zoneHolderSet = new Map<string, string>();
  locationsWithHolders.forEach((e) => {
    if (e.zone) {
      const key = e.zone.toLowerCase();
      if (!zoneHolderSet.has(key)) zoneHolderSet.set(key, e.zone);
    }
  });
  const zoneNames = [...zoneHolderSet.values()];
  const locationStock = zoneNames.map((z) => {
    const locItems = equipment.filter((e) => e.zone.toLowerCase() === z.toLowerCase() && e.holder);
    const locHolderCount = locItems.length;
    const locStocked = locItems.filter((e) => e.jamPoleQty > 0).length;
    const locPoles = locItems.reduce((sum, e) => sum + (e.jamPoleQty || 0), 0);
    const percent = locHolderCount > 0 ? Math.round((locStocked / locHolderCount) * 100) : 100;
    return { location: z, holderCount: locHolderCount, stocked: locStocked, poles: locPoles, percent };
  }).sort((a, b) => a.percent - b.percent);

  // Locations with holders but 0 poles
  const emptyHolders = locationsWithHolders.filter((e) => e.jamPoleQty === 0);

  // Cotterman holder compliance
  const cottermans = equipment.filter((e) => e.type === 'cotterman');
  const cottermansWithHolder = cottermans.filter((e) => e.holder);
  const cottermansWithoutHolder = cottermans.filter((e) => !e.holder);
  const cotternanCompliancePercent = cottermans.length > 0
    ? Math.round((cottermansWithHolder.length / cottermans.length) * 100)
    : 100;

  // Standalone jam pole holder compliance
  const standalonePoles = equipment.filter((e) => e.type === 'jam_pole');
  const standaloneWithHolder = standalonePoles.filter((e) => e.holder);
  const standaloneWithoutHolder = standalonePoles.filter((e) => !e.holder && e.jamPoleQty > 0);
  const standaloneCompliancePercent = standalonePoles.length > 0
    ? Math.round((standaloneWithHolder.length / standalonePoles.length) * 100)
    : 100;

  // Zone breakdown
  // Zone breakdown (case-insensitive grouping)
  const zoneSet = new Map<string, string>(); // lowercase → display name (first occurrence)
  equipment.forEach((e) => {
    if (e.zone) {
      const key = e.zone.toLowerCase();
      if (!zoneSet.has(key)) zoneSet.set(key, e.zone);
    }
  });
  const zones = [...zoneSet.values()];
  const zoneStats = zones.map((zone) => {
    const zoneItems = equipment.filter((e) => e.zone.toLowerCase() === zone.toLowerCase());
    const zoneIssues = issues.filter(
      (i) => i.status !== 'resolved' && zoneItems.some((e) => e.id === i.equipmentId)
    );
    return { zone, count: zoneItems.length, issues: zoneIssues.length };
  }).sort((a, b) => b.issues - a.issues);

  // Recent issues (last 10)
  const recentIssues = [...issues]
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
    .slice(0, 10);

  const getEquipmentById = (id: string) => equipment.find((e) => e.id === id);

  return (
    <div className="dashboard">
      {/* Summary Cards Row */}
      <div className="dash-cards">
        <div className="dash-card">
          <div className="dash-card-value">{totalItems}</div>
          <div className="dash-card-label">Total Equipment</div>
          <div className="dash-card-detail">
            {totalJamPoles} JP · {totalCottermans} COT
          </div>
        </div>

        <div className={`dash-card ${openIssues.length > 0 ? 'card-warning' : 'card-good'}`}>
          <div className="dash-card-value">{openIssues.length}</div>
          <div className="dash-card-label">Open Issues</div>
          <div className="dash-card-detail">
            {criticalIssues.length > 0 && <span className="text-critical">{criticalIssues.length} critical</span>}
            {highIssues.length > 0 && <span className="text-high"> · {highIssues.length} high</span>}
          </div>
        </div>

        <div className={`dash-card ${siteStockPercent < 70 ? 'card-warning' : siteStockPercent < 50 ? 'card-danger' : 'card-good'}`}>
          <div className="dash-card-value">{siteStockPercent}%</div>
          <div className="dash-card-label">Holders Stocked</div>
          <div className="dash-card-detail">{stockedLocations}/{totalHolderLocations} holder locations have poles</div>
        </div>

        <div className={`dash-card ${emptyHolders.length > 0 ? 'card-danger' : 'card-good'}`}>
          <div className="dash-card-value">{emptyHolders.length}</div>
          <div className="dash-card-label">Empty Holders</div>
          <div className="dash-card-detail">Holder locations with 0 poles</div>
        </div>

        <div className="dash-card">
          <div className="dash-card-value">{conditionBad + conditionUnavailable}</div>
          <div className="dash-card-label">Bad / Unavailable</div>
          <div className="dash-card-detail">Need attention</div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="dash-grid">
        {/* Condition Breakdown */}
        <div className="dash-section">
          <h3>Condition Breakdown</h3>
          <div className="condition-bars">
            <div className="condition-bar-row">
              <span className="condition-label">Good</span>
              <div className="condition-bar">
                <div
                  className="condition-fill fill-good"
                  style={{ width: `${totalItems ? (conditionGood / totalItems) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="condition-count">{conditionGood}</span>
            </div>
            <div className="condition-bar-row">
              <span className="condition-label">Slight Bend</span>
              <div className="condition-bar">
                <div
                  className="condition-fill fill-neutral"
                  style={{ width: `${totalItems ? (conditionSlightBend / totalItems) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="condition-count">{conditionSlightBend}</span>
            </div>
            <div className="condition-bar-row">
              <span className="condition-label">Bad</span>
              <div className="condition-bar">
                <div
                  className="condition-fill fill-bad"
                  style={{ width: `${totalItems ? (conditionBad / totalItems) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="condition-count">{conditionBad}</span>
            </div>
            <div className="condition-bar-row">
              <span className="condition-label">N/A</span>
              <div className="condition-bar">
                <div
                  className="condition-fill fill-unavailable"
                  style={{ width: `${totalItems ? (conditionUnavailable / totalItems) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="condition-count">{conditionUnavailable}</span>
            </div>
          </div>
        </div>

        {/* Stock Levels by Zone */}
        <div className="dash-section dash-section-wide">
          <h3>📊 Jam Pole Stock</h3>
          <div className="stock-circles">
            {/* Site-wide circle */}
            <div className="stock-circle-card">
              <div className="donut-wrapper">
                <svg viewBox="0 0 36 36" className="donut-chart">
                  <path
                    className="donut-bg"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="donut-fill"
                    strokeDasharray={`${siteStockPercent}, 100`}
                    style={{ stroke: siteStockPercent === 100 ? '#4caf50' : siteStockPercent >= 75 ? '#f5c400' : siteStockPercent >= 50 ? '#ff9800' : '#f44336' }}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" className="donut-text">{siteStockPercent}%</text>
                </svg>
              </div>
              <div className="stock-circle-label">Site Total</div>
              <div className="stock-circle-detail">{stockedLocations}/{totalHolderLocations} stocked</div>
            </div>

            {/* Per-zone circles */}
            {locationStock.map(({ location, holderCount, stocked, percent }) => (
              <div key={location} className="stock-circle-card">
                <div className="donut-wrapper">
                  <svg viewBox="0 0 36 36" className="donut-chart">
                    <path
                      className="donut-bg"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="donut-fill"
                      strokeDasharray={`${percent}, 100`}
                      style={{ stroke: percent === 100 ? '#4caf50' : percent >= 75 ? '#f5c400' : percent >= 50 ? '#ff9800' : '#f44336' }}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <text x="18" y="20.35" className="donut-text">{percent}%</text>
                  </svg>
                </div>
                <div className="stock-circle-label">{location}</div>
                <div className="stock-circle-detail">{stocked}/{holderCount}</div>
              </div>
            ))}
          </div>

          <div className="stock-legend">
            <span className="stock-legend-item"><span className="stock-legend-dot" style={{background:'#4caf50'}}></span> 100%</span>
            <span className="stock-legend-item"><span className="stock-legend-dot" style={{background:'#f5c400'}}></span> 75-99%</span>
            <span className="stock-legend-item"><span className="stock-legend-dot" style={{background:'#ff9800'}}></span> 50-74%</span>
            <span className="stock-legend-item"><span className="stock-legend-dot" style={{background:'#f44336'}}></span> Below 50%</span>
          </div>
        </div>

        {/* Stock Problem Areas by Zone */}
        <div className="dash-section dash-section-wide">
          <h3>📉 Stock Loss by Zone</h3>
          <p className="dash-subtitle">Zones ranked by how many jam poles have been lost (from activity log)</p>

          {/* Quantity changes over time per zone from changelog */}
          {changelog.length > 0 && (() => {
            const qtyChanges = changelog.filter(c => c.changeType === 'quantity_change');
            if (qtyChanges.length === 0) return <p className="dash-empty">No quantity changes recorded yet. Data will appear as stock levels change over time.</p>;

            // Group quantity decreases by zone
            const zoneDecreases: Record<string, number> = {};
            qtyChanges.forEach(c => {
              const oldQty = Number(c.oldValue) || 0;
              const newQty = Number(c.newValue) || 0;
              if (newQty < oldQty) {
                const eq = equipment.find(e => e.id === c.equipmentId);
                const zone = eq?.zone || 'Unknown';
                zoneDecreases[zone] = (zoneDecreases[zone] || 0) + (oldQty - newQty);
              }
            });

            const sorted = Object.entries(zoneDecreases).sort(([,a], [,b]) => b - a);
            if (sorted.length === 0) return <p className="dash-empty">No stock losses recorded yet.</p>;

            return (
              <div className="problem-trend-list">
                {sorted.map(([zone, lost]) => (
                  <div key={zone} className="problem-trend-item">
                    <span className="problem-trend-zone">{zone}</span>
                    <div className="problem-trend-bar-wrap">
                      <div className="problem-trend-bar" style={{ width: `${Math.min(100, (lost / sorted[0][1]) * 100)}%` }}></div>
                    </div>
                    <span className="problem-trend-count">-{lost} poles</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Cotterman Holder Compliance */}
        <div className="dash-section">
          <h3>🪜 Cotterman Holder Compliance</h3>
          <p className="dash-subtitle">All Cotterman ladders are required to have a holder</p>

          <div className="compliance-display">
            <div className="donut-wrapper donut-large">
              <svg viewBox="0 0 36 36" className="donut-chart">
                <path
                  className="donut-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="donut-fill"
                  strokeDasharray={`${cotternanCompliancePercent}, 100`}
                  style={{ stroke: cotternanCompliancePercent === 100 ? '#4caf50' : cotternanCompliancePercent >= 75 ? '#f5c400' : cotternanCompliancePercent >= 50 ? '#ff9800' : '#f44336' }}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className="donut-text">{cotternanCompliancePercent}%</text>
              </svg>
            </div>
            <div className="compliance-stats">
              <div className="compliance-stat">
                <span className="compliance-value compliance-good">{cottermansWithHolder.length}</span>
                <span className="compliance-label">With Holder ✓</span>
              </div>
              <div className="compliance-stat">
                <span className="compliance-value compliance-bad">{cottermansWithoutHolder.length}</span>
                <span className="compliance-label">Missing Holder ✗</span>
              </div>
              <div className="compliance-stat">
                <span className="compliance-value">{cottermans.length}</span>
                <span className="compliance-label">Total Cottermans</span>
              </div>
            </div>
          </div>

          {cottermansWithoutHolder.length > 0 && (
            <div className="compliance-list">
              <h4>⚠️ Non-Compliant Cottermans:</h4>
              {cottermansWithoutHolder.map((c) => (
                <div key={c.id} className="compliance-item">
                  <strong>{c.identificationNumber}</strong> — {c.zone} · {c.location}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Standalone Jam Pole Holder Compliance */}
        <div className="dash-section">
          <h3>🔵 Jam Pole Holder Compliance</h3>
          <p className="dash-subtitle">Standalone jam pole locations that have a holder</p>

          <div className="compliance-display">
            <div className="donut-wrapper donut-large">
              <svg viewBox="0 0 36 36" className="donut-chart">
                <path
                  className="donut-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="donut-fill"
                  strokeDasharray={`${standaloneCompliancePercent}, 100`}
                  style={{ stroke: standaloneCompliancePercent === 100 ? '#4caf50' : standaloneCompliancePercent >= 75 ? '#f5c400' : standaloneCompliancePercent >= 50 ? '#ff9800' : '#f44336' }}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" className="donut-text">{standaloneCompliancePercent}%</text>
              </svg>
            </div>
            <div className="compliance-stats">
              <div className="compliance-stat">
                <span className="compliance-value compliance-good">{standaloneWithHolder.length}</span>
                <span className="compliance-label">With Holder ✓</span>
              </div>
              <div className="compliance-stat">
                <span className="compliance-value compliance-bad">{standaloneWithoutHolder.length}</span>
                <span className="compliance-label">Missing Holder ✗</span>
              </div>
              <div className="compliance-stat">
                <span className="compliance-value">{standalonePoles.length}</span>
                <span className="compliance-label">Total Standalone Locations</span>
              </div>
            </div>
          </div>

          {standaloneWithoutHolder.length > 0 && (
            <div className="compliance-list">
              <h4>⚠️ Jam Poles Without Holders:</h4>
              {standaloneWithoutHolder.map((c) => (
                <div key={c.id} className="compliance-item">
                  <strong>{c.identificationNumber}</strong> — {c.zone} · {c.location}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zone Overview */}
        <div className="dash-section">
          <h3>Zone Overview</h3>
          <div className="zone-grid">
            {zoneStats.map(({ zone, count, issues }) => (
              <div key={zone} className={`zone-card ${issues > 0 ? 'zone-has-issues' : ''}`}>
                <div className="zone-name">{zone}</div>
                <div className="zone-count">{count} items</div>
                {issues > 0 && <div className="zone-issues">{issues} issue{issues > 1 ? 's' : ''}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Issues */}
        <div className="dash-section">
          <h3>Recent Issues</h3>
          {recentIssues.length === 0 ? (
            <p className="dash-empty">No issues reported yet</p>
          ) : (
            <div className="dash-issue-list">
              {recentIssues.map((issue) => {
                const eq = getEquipmentById(issue.equipmentId);
                return (
                  <div key={issue.id} className={`dash-issue severity-${issue.severity}`}>
                    <div className="issue-header">
                      <span className={`severity-dot sev-${issue.severity}`}></span>
                      <strong>{eq?.identificationNumber || '?'}</strong>
                      <span className="issue-status">{issue.status}</span>
                      <span className="issue-time">
                        {new Date(issue.reportedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="issue-desc">{issue.description}</div>
                    {eq && <div className="issue-location">{eq.zone} · {eq.location}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Insights & Trends */}
        <div className="dash-section dash-section-wide">
          <h3>📈 Insights &amp; Trends</h3>
          <div className="insights-timeframe">
            <label>Timeframe:</label>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as any)}>
              <option value="7">Last 7 days (1 week)</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days (3 months)</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last 1 year</option>
            </select>
          </div>

          {recentChanges.length === 0 ? (
            <p className="dash-empty">No change history yet. Insights will appear as you use the system over time.</p>
          ) : (
            <>
            {/* Trend Line Charts */}
            <div className="trend-charts-grid">
              <TrendChart
                title="Issues Reported"
                color="#f44336"
                data={(() => {
                  // Group issues by week/day depending on timeframe
                  const bucketDays = parseInt(timeframe) <= 30 ? 1 : 7;
                  const buckets: Record<string, number> = {};
                  const now = new Date();
                  for (let i = parseInt(timeframe); i >= 0; i -= bucketDays) {
                    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    buckets[key] = 0;
                  }
                  recentChanges.filter(c => c.changeType === 'issue_reported').forEach(c => {
                    const d = new Date(c.changedAt);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    if (buckets[key] !== undefined) buckets[key]++;
                  });
                  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
                })()}
              />
              <TrendChart
                title="Condition Changes"
                color="#ff9800"
                data={(() => {
                  const bucketDays = parseInt(timeframe) <= 30 ? 1 : 7;
                  const buckets: Record<string, number> = {};
                  const now = new Date();
                  for (let i = parseInt(timeframe); i >= 0; i -= bucketDays) {
                    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    buckets[key] = 0;
                  }
                  recentChanges.filter(c => c.changeType === 'condition_change').forEach(c => {
                    const d = new Date(c.changedAt);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    if (buckets[key] !== undefined) buckets[key]++;
                  });
                  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
                })()}
              />
              <TrendChart
                title="All Activity"
                color="#2196f3"
                data={(() => {
                  const bucketDays = parseInt(timeframe) <= 30 ? 1 : 7;
                  const buckets: Record<string, number> = {};
                  const now = new Date();
                  for (let i = parseInt(timeframe); i >= 0; i -= bucketDays) {
                    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    buckets[key] = 0;
                  }
                  recentChanges.forEach(c => {
                    const d = new Date(c.changedAt);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    if (buckets[key] !== undefined) buckets[key]++;
                  });
                  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
                })()}
              />
              <TrendChart
                title="Stock Loss (Poles Removed)"
                color="#f44336"
                data={(() => {
                  const bucketDays = parseInt(timeframe) <= 30 ? 1 : 7;
                  const buckets: Record<string, number> = {};
                  const now = new Date();
                  for (let i = parseInt(timeframe); i >= 0; i -= bucketDays) {
                    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    buckets[key] = 0;
                  }
                  recentChanges.filter(c => c.changeType === 'quantity_change').forEach(c => {
                    const oldQty = Number(c.oldValue) || 0;
                    const newQty = Number(c.newValue) || 0;
                    if (newQty < oldQty) {
                      const d = new Date(c.changedAt);
                      const key = `${d.getMonth() + 1}/${d.getDate()}`;
                      if (buckets[key] !== undefined) buckets[key] += (oldQty - newQty);
                    }
                  });
                  return Object.entries(buckets).map(([label, value]) => ({ label, value }));
                })()}
              />
            </div>

            <div className="insights-grid">
              <div className="insight-card">
                <div className="insight-value">{conditionDamages.length}</div>
                <div className="insight-label">Items Damaged</div>
                <div className="insight-detail">Condition changed to Fair/Poor in {timeframe} days</div>
                {annualizedDamageRate > 0 && (
                  <div className="insight-rate">Annualized: ~{annualizedDamageRate}/year</div>
                )}
              </div>
              <div className="insight-card">
                <div className="insight-value">{quantityDecreases.length}</div>
                <div className="insight-label">Stock Reductions</div>
                <div className="insight-detail">Jam pole quantities decreased</div>
              </div>
              <div className="insight-card">
                <div className="insight-value">{issuesReported.length}</div>
                <div className="insight-label">Issues Reported</div>
                <div className="insight-detail">{issuesResolved.length} resolved ({issuesReported.length > 0 ? Math.round((issuesResolved.length / issuesReported.length) * 100) : 0}% resolution)</div>
              </div>
              <div className="insight-card">
                <div className="insight-value">{recentChanges.length > 0 ? Math.round(recentChanges.length / (daysInPeriod / 7)) : 0}</div>
                <div className="insight-label">Changes/Week</div>
                <div className="insight-detail">Average activity level</div>
              </div>
            </div>

          {conditionDamages.length > 0 && (
            <div className="insights-breakdown">
              <h4>Most Affected Equipment</h4>
              <div className="breakdown-list">
                {Object.entries(
                  conditionDamages.reduce((acc, c) => { acc[c.equipmentIdNumber] = (acc[c.equipmentIdNumber] || 0) + 1; return acc; }, {} as Record<string, number>)
                ).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, count]) => (
                  <div key={id} className="breakdown-item">
                    <span className="breakdown-id">{id}</span>
                    <span className="breakdown-count">{count} incident{count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>
        )}
        </div>

        {/* Issue Management */}
        <div className="dash-section">
          <IssuePanel issues={issues} equipment={equipment} onUpdateIssue={onUpdateIssue} />
        </div>



        {/* Quick Links */}
        <div className="dash-section">
          <h3>Quick Actions</h3>
          <div className="quick-links">
            <a
              href="https://atoz.amazon.work/safety_observations"
              target="_blank"
              rel="noopener noreferrer"
              className="quick-link-btn"
            >
              📝 Report Safety Observation (AtoZ)
            </a>
            <a
              href="https://t.corp.amazon.com/create"
              target="_blank"
              rel="noopener noreferrer"
              className="quick-link-btn quick-link-rme"
            >
              🔧 Submit RME Ticket (SIM)
            </a>
          </div>
          <p className="dash-hint">
            Tip: You can also report issues directly from any dot on the map.
          </p>
        </div>
      </div>
    </div>
  );
}
