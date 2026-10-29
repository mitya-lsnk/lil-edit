// The one place the app reads and writes its remembered choices in
// localStorage. Callers keep their own keys (they are what users' saved
// settings live under), so only the mechanics are shared.

/**
 * What was saved under `key`, laid over `defaults`. A key that was never saved,
 * a half-written value or unavailable storage (private mode) all give back the
 * defaults, so a bad value can only ever cost the choice, never the startup.
 * Fields added since the value was saved fall back to their defaults.
 */
export function loadStored<T extends object>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* malformed value or storage unavailable */
  }
  return { ...defaults };
}

/** Remember `value` under `key`. Silently does nothing if storage is full or unavailable. */
export function saveStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode: the choice is just not remembered */
  }
}
