import React from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  title: string;
  color?: string;
  height?: number;
}

export function TrendChart({ data, title, color = '#2196f3', height = 150 }: Props) {
  if (data.length === 0) {
    return (
      <div className="trend-chart">
        <h4 className="trend-title">{title}</h4>
        <p className="dash-empty">No data yet</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const width = 100;
  const padding = { top: 10, bottom: 25, left: 5, right: 5 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Generate path for the line
  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.value / maxValue) * chartHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Area fill path
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  return (
    <div className="trend-chart">
      <h4 className="trend-title">{title}</h4>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-svg"
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + chartHeight * (1 - pct)}
            y2={padding.top + chartHeight * (1 - pct)}
            stroke="#e0e0e0"
            strokeWidth="0.3"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={color} opacity="0.1" />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Only show every nth label to avoid crowding
          const showEvery = Math.max(1, Math.floor(data.length / 6));
          if (i % showEvery !== 0 && i !== data.length - 1) return null;
          const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
          return (
            <text
              key={i}
              x={x}
              y={height - 3}
              textAnchor="middle"
              fontSize="3.5"
              fill="#666"
            >
              {d.label}
            </text>
          );
        })}

        {/* Max value label */}
        <text x={padding.left} y={padding.top - 2} fontSize="3.5" fill="#666">
          {maxValue}
        </text>
      </svg>
      <div className="trend-summary">
        <span className="trend-current">{data[data.length - 1]?.value ?? 0}</span>
        <span className="trend-label">current</span>
        {data.length >= 2 && (
          <span className={`trend-change ${data[data.length - 1].value >= data[data.length - 2].value ? 'trend-up' : 'trend-down'}`}>
            {data[data.length - 1].value >= data[data.length - 2].value ? '↑' : '↓'}
            {Math.abs(data[data.length - 1].value - data[data.length - 2].value)}
          </span>
        )}
      </div>
    </div>
  );
}
