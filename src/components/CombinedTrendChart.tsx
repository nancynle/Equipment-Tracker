import React from 'react';

interface DataSeries {
  label: string;
  color: string;
  data: number[];
}

interface Props {
  series: DataSeries[];
  labels: string[];
  height?: number;
}

export function CombinedTrendChart({ series, labels, height = 200 }: Props) {
  if (labels.length === 0) {
    return <p className="dash-empty">No data yet</p>;
  }

  const maxValue = Math.max(...series.flatMap(s => s.data), 1);
  const width = 600;
  const padding = { top: 15, bottom: 30, left: 25, right: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getPoints = (data: number[]) => {
    return data.map((value, i) => {
      const x = padding.left + (i / Math.max(labels.length - 1, 1)) * chartWidth;
      const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
      return { x, y };
    });
  };

  const getLinePath = (points: { x: number; y: number }[]) => {
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="combined-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="combined-chart-svg">
        {/* Grid lines */}
        {yTicks.map((pct) => (
          <g key={pct}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + chartHeight * (1 - pct)}
              y2={padding.top + chartHeight * (1 - pct)}
              stroke="#e0e0e0"
              strokeWidth="0.3"
            />
            <text
              x={padding.left - 3}
              y={padding.top + chartHeight * (1 - pct) + 1.5}
              textAnchor="end"
              fontSize="4"
              fill="#999"
            >
              {Math.round(maxValue * pct)}
            </text>
          </g>
        ))}

        {/* Lines and areas */}
        {series.map((s) => {
          const points = getPoints(s.data);
          const linePath = getLinePath(points);
          const areaPath = linePath + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;
          return (
            <g key={s.label}>
              <path d={areaPath} fill={s.color} opacity="0.08" />
              <path d={linePath} fill="none" stroke={s.color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.2" fill={s.color} />
              ))}
            </g>
          );
        })}

        {/* X-axis labels */}
        {labels.map((label, i) => {
          const showEvery = Math.max(1, Math.floor(labels.length / 7));
          if (i % showEvery !== 0 && i !== labels.length - 1) return null;
          const x = padding.left + (i / Math.max(labels.length - 1, 1)) * chartWidth;
          return (
            <text
              key={i}
              x={x}
              y={height - 5}
              textAnchor="middle"
              fontSize="4.5"
              fill="#333"
              fontWeight="500"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="combined-chart-legend">
        {series.map((s) => (
          <span key={s.label} className="combined-legend-item">
            <span className="combined-legend-dot" style={{ background: s.color }}></span>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
