/** Server-side time helpers (kept out of component bodies so render logic stays pure). */
export function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000);
}

export function startOfDayDaysAgo(days: number) {
  const d = new Date(Date.now() - days * 86_400_000);
  d.setHours(0, 0, 0, 0);
  return d;
}
