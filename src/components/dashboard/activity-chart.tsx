"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ActivityChart({ data }: { data: { day: string; completed: number; failed: number }[] }) {
  const empty = data.every((d) => d.completed === 0 && d.failed === 0);
  return (
    <div className="relative h-56 w-full">
      {empty && <p className="absolute inset-0 grid place-items-center text-sm text-muted">No generations in the last 14 days yet.</p>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "var(--faint)", fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--faint)", fontSize: 11 }} />
          <Tooltip cursor={{ fill: "color-mix(in srgb, var(--violet) 8%, transparent)" }} contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", fontSize: 12 }} />
          <Bar dataKey="completed" name="Completed" stackId="a" fill="var(--violet)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="failed" name="Failed" stackId="a" fill="var(--danger)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
