import type { ScaleLinear } from "d3-scale";
import { GRID, INK } from "../lib/colors";

interface Props {
  x: ScaleLinear<number, number>;
  y: ScaleLinear<number, number>;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  xTicks?: number[];
  yTicks?: number[];
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  xLabel?: string;
  yLabel?: string;
  rotateX?: boolean;
}

export function Axes({
  x, y, width, height, margin, xTicks, yTicks, xFormat, yFormat, xLabel, yLabel, rotateX,
}: Props) {
  const xt = xTicks ?? x.ticks(8);
  const yt = yTicks ?? y.ticks(6);
  const fx = xFormat ?? ((v: number) => String(v));
  const fy = yFormat ?? ((v: number) => String(v));
  return (
    <g>
      {/* horizontal gridlines */}
      {yt.map((t) => (
        <line key={`gy${t}`} x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)}
          stroke={GRID} strokeWidth={1} />
      ))}
      {/* y ticks */}
      {yt.map((t) => (
        <text key={`yt${t}`} x={margin.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle"
          fontSize={11} fill={INK} fontFamily="JetBrains Mono, monospace" opacity={0.8}>
          {fy(t)}
        </text>
      ))}
      {/* x ticks */}
      {xt.map((t) => (
        <text key={`xt${t}`}
          x={x(t)} y={height - margin.bottom + (rotateX ? 8 : 16)}
          textAnchor={rotateX ? "end" : "middle"}
          transform={rotateX ? `rotate(-90 ${x(t)} ${height - margin.bottom + 8})` : undefined}
          fontSize={11} fill={INK} fontFamily="JetBrains Mono, monospace" opacity={0.8}>
          {fx(t)}
        </text>
      ))}
      {/* axis lines */}
      <line x1={margin.left} x2={width - margin.right} y1={height - margin.bottom}
        y2={height - margin.bottom} stroke={INK} strokeWidth={1.5} />
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={height - margin.bottom}
        stroke={INK} strokeWidth={1.5} />
      {xLabel && (
        <text x={(margin.left + width - margin.right) / 2} y={height - 4} textAnchor="middle"
          fontSize={12} fill={INK} fontFamily="Archivo, sans-serif" fontWeight={600}>
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text transform={`rotate(-90 14 ${(margin.top + height - margin.bottom) / 2})`}
          x={14} y={(margin.top + height - margin.bottom) / 2} textAnchor="middle"
          fontSize={12} fill={INK} fontFamily="Archivo, sans-serif" fontWeight={600}>
          {yLabel}
        </text>
      )}
    </g>
  );
}
