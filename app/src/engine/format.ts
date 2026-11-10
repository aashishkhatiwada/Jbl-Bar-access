// Formatting shared by the UI, ported from the web components.

export const finitePositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
export const finiteNonnegative = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function fixed(value: number, digits: number): string {
  // toLocaleString with maximumFractionDigits, without locale grouping surprises.
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return rounded.toLocaleString('en-US', {maximumFractionDigits: digits});
}

export function bytes(value: number): string {
  return fixed(value / 1048576, 1) + ' MiB';
}

export function rate(value: unknown): string {
  if (!finiteNonnegative(value)) return '—';
  const unit = value >= 1048576 ? 1048576 : value >= 1024 ? 1024 : 1;
  return fixed(value / unit, unit === 1 ? 0 : 1) + (unit === 1048576 ? ' MiB/s' : unit === 1024 ? ' KiB/s' : ' B/s');
}

// Spoken form for screen readers: "KiB/s" is read letter by letter otherwise.
export function rateSpoken(value: unknown): string {
  return rate(value).replace('MiB/s', 'mebibytes per second').replace('KiB/s', 'kibibytes per second').replace('B/s', 'bytes per second');
}

export function uptime(value: unknown): string {
  if (!finiteNonnegative(value)) return '—';
  if (value < 60) return Math.floor(value) + 's';
  return [value >= 86400 ? Math.floor(value / 86400) + 'd' : '', value >= 3600 ? (Math.floor(value / 3600) % 24) + 'h' : '', (Math.floor(value / 60) % 60) + 'm'].filter(Boolean).join(' ');
}

// Details panel uses the long form, always with days.
export function deviceUptime(value: unknown): string {
  if (!finitePositive(value)) return 'Not reported';
  return Math.floor(value / 86400) + 'd ' + (Math.floor(value / 3600) % 24) + 'h ' + (Math.floor(value / 60) % 60) + 'm';
}

export function eqGain(value: number): string {
  return (value === 0 ? '0' : value.toFixed(1).replace(/\.0$/, '')) + ' dB';
}

export function signedDb(db: number): string {
  return (db > 0 ? '+' : '') + db.toFixed(1) + ' dB';
}

// Center level dB above original, for levels 0..5.
export const CENTER_DB = ['0', '2.4', '4.8', '7.2', '9.6', '12'];

export function mediaTime(value: unknown): string {
  if (!finiteNonnegative(value)) return '';
  const seconds = Math.floor(value);
  return (seconds >= 3600 ? Math.floor(seconds / 3600) + ':' : '') +
    String(Math.floor(seconds / 60) % 60).padStart(seconds >= 3600 ? 2 : 1, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

export function secondsAgo(since: number, now = Date.now()): string {
  const seconds = Math.floor((now - since) / 1000);
  return seconds < 5 ? 'Synced just now' : 'Synced ' + seconds + 's ago';
}

export function wifiQuality(signal: number | undefined): string {
  if (signal == null) return '';
  return signal >= -55 ? 'Strong signal' : signal >= -67 ? 'Good signal' : signal >= -75 ? 'Fair signal' : 'Weak signal';
}

export function wifiBand(mhz: number | undefined): string {
  if (!mhz) return '';
  return mhz >= 5925 ? '6 GHz' : mhz >= 4900 ? '5 GHz' : '2.4 GHz';
}

// Snaps a typed number to a step inside a range. Null when not a number.
export function snap(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round((value - min) / step) * step + min;
  const clamped = Math.max(min, Math.min(max, snapped));
  // Avoid -0 and float dust (e.g. 0.5 steps).
  const decimals = (String(step).split('.')[1] || '').length;
  const out = Number(clamped.toFixed(decimals));
  return Object.is(out, -0) ? 0 : out;
}

// Parses user-typed numbers, accepting the Unicode minus and a comma decimal.
export function parseTyped(text: string): number | null {
  const cleaned = text.trim().replace(/−/g, '-').replace(',', '.').replace(/\s*(dB|ms)$/i, '');
  if (cleaned === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function sourceName(input: string | undefined): string {
  return /^Input \d+$/.test(input || '') ? 'Other source' : input || 'Unknown source';
}
