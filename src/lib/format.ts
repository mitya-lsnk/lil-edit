export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function pct(from: number, to: number): number {
  if (from <= 0) return 0;
  return Math.round((1 - to / from) * 100);
}
