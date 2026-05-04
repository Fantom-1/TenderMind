"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  eligible: "#15803D",
  needs_review: "#B45309",
  not_eligible: "#B91C1C",
  pending: "#94A3B8",
  approved: "#1E40AF",
};

export function VerdictDonut({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.every((d) => d.value === 0)) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-text-subtle">
        No evaluations yet — upload a tender to begin.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={COLORS[d.name] ?? "#64748B"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#0F172A",
            border: "none",
            borderRadius: 6,
            color: "white",
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
