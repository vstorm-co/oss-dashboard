export const DAY = 86400000;
export const iso = date => new Date(date).toISOString().slice(0, 10);
export function dates(end, length) {
  return Array.from({length}, (_, i) => iso(new Date(`${end}T00:00:00Z`).getTime() - (length - 1 - i) * DAY));
}
export function latest(project) {
  return Object.entries(project.snapshots).sort(([a], [b]) => a.localeCompare(b)).at(-1)?.[1] || {};
}
export function daily(project, day, metric) {
  if (metric === 'downloads') {
    const packages = Object.values(project.packages);
    if (!packages.length) return null;
    const values = packages.map(p => p.days[day]);
    return values.every(v => v !== undefined) ? values.reduce((a, b) => a + b, 0) : null;
  }
  if (metric === 'prs' || metric === 'issues') {
    if (day > project.updatedAt.slice(0, 10)) return null;
    return project.events[day]?.[metric] || 0;
  }
  const before = iso(new Date(`${day}T00:00:00Z`).getTime() - DAY);
  const current = project.snapshots[day]?.[metric];
  const previous = project.snapshots[before]?.[metric];
  return current !== undefined && previous !== undefined ? current - previous : null;
}
export function series(projects, days, metric, group = 'day') {
  const relevant = metric === 'downloads' ? projects.filter(p => Object.keys(p.packages).length) : projects;
  const buckets = new Map();
  for (const day of days) {
    const key = group === 'month' ? day.slice(0, 7) : group === 'year' ? day.slice(0, 4) : day;
    const bucket = buckets.get(key) || {label: key, value: 0, known: 0, expected: 0};
    for (const project of relevant) {
      bucket.expected++;
      const value = daily(project, day, metric);
      if (value !== null) { bucket.value += value; bucket.known++; }
    }
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map(b => ({...b, value: b.known ? b.value : null}));
}
export function period(projects, days, metric) {
  const values = series(projects, days, metric);
  return {value: values.some(v => v.value !== null) ? values.reduce((sum, v) => sum + (v.value || 0), 0) : null,
    partial: values.some(v => v.known < v.expected)};
}
