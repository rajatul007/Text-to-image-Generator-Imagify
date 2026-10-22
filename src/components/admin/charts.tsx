"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { tickLine: false, axisLine: false, tick: { fill: "var(--faint)", fontSize: 11 } } as const;
const tooltip = { contentStyle: { background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, color: "var(--text)", fontSize: 12 } };

export function DailyGenerationsChart({ data }: { data: { day: string; completed: number; failed: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -20, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="day" {...axis} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltip} cursor={{ fill: "color-mix(in srgb, var(--violet) 8%, transparent)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="completed" name="Completed" stackId="a" fill="var(--violet)" />
        <Bar dataKey="failed" name="Failed" stackId="a" fill="var(--danger)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ data }: { data: { day: string; revenue: number; signups: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: -10, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="day" {...axis} interval="preserveStartEnd" />
        <YAxis yAxisId="l" {...axis} tickFormatter={(v) => `₹${v}`} />
        <YAxis yAxisId="r" orientation="right" allowDecimals={false} {...axis} />
        <Tooltip {...tooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="l" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="var(--blue)" strokeWidth={2} dot={false} />
        <Line yAxisId="r" type="monotone" dataKey="signups" name="Signups" stroke="var(--violet)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MonthlyChart({ data }: { data: { month: string; generations: number; activeUsers: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -20, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--line)" />
        <XAxis dataKey="month" {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="generations" name="Generations" stroke="var(--violet)" fill="color-mix(in srgb, var(--violet) 25%, transparent)" strokeWidth={2} />
        <Area type="monotone" dataKey="activeUsers" name="Active users" stroke="var(--blue)" fill="color-mix(in srgb, var(--blue) 20%, transparent)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
