"use client";

import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LorenzCurve } from "@/workers/pyodide.worker";
import { useT } from "@/lib/i18n";

interface ChartPoint {
  x: number;
  equality: number;
  value?: number;
}

function toChartData(curve: LorenzCurve | null): ChartPoint[] {
  if (!curve) return [{ x: 0, equality: 0 }, { x: 1, equality: 1 }];
  return curve.x.map((x, i) => ({ x, equality: x, value: curve.y[i] }));
}

/** One Lorenz chart for a single model (baseline or enhanced) against the
 * equality reference line — desktop shows these as two separate panels,
 * not one merged chart. */
export function LorenzChart({
  curve,
  label,
  color,
}: {
  curve: LorenzCurve | null;
  label: string;
  color: string;
}) {
  const t = useT();
  const data = toChartData(curve);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--border-color)" strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 1]}
            tick={{ fill: "var(--foreground-muted)", fontSize: 12 }}
          />
          <YAxis domain={[0, 1]} tick={{ fill: "var(--foreground-muted)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "var(--background-elevated)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="equality"
            name={t("lorenz_equality_line")}
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            activeDot={{ r: 4 }}
          />
          {curve && (
            <Line
              type="monotone"
              dataKey="value"
              name={label}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
          )}
          {curve && <Brush dataKey="x" height={18} stroke="var(--border-color)" travellerWidth={8} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
