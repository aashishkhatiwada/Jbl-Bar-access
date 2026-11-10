import type {BarState, MemoryReading} from '../api/types';
import {bytes, finiteNonnegative, finitePositive, rate, rateSpoken, uptime, wifiBand, wifiQuality} from './format';

// History belongs to this screen, and advances only for real server samples.
export interface Sample {
  time: number;
  cpu: number | null;
  ram: number | null;
}

export const STALE_AFTER = 6500;
const WINDOW = 120000;

export function memoryReading(value: MemoryReading | undefined): MemoryReading | null {
  if (!value || !finitePositive(value.total_bytes) || !finiteNonnegative(value.available_bytes) || !finiteNonnegative(value.used_bytes) || value.available_bytes > value.total_bytes || value.used_bytes > value.total_bytes) return null;
  return value;
}

export class MonitorHistory {
  samples: Sample[] = [];
  sample: number | null = null;
  received = 0;

  // Records a new sample; resets on a bar restart or a long gap.
  update(s: BarState | null, connected: boolean, now = Date.now()) {
    const reported = s?.system;
    const valid = connected && Number.isSafeInteger(reported?.sample) && (reported!.sample as number) >= 0;
    if (!valid) {
      this.samples = [];
      this.sample = null;
      this.received = 0;
      return;
    }
    const data = reported!;
    if (data.sample === this.sample) return;
    if (this.sample !== null && ((data.sample as number) < this.sample || now - this.received > STALE_AFTER)) this.samples = [];
    const cpu = finiteNonnegative(data.cpu_percent) && data.cpu_percent <= 100 ? data.cpu_percent : null;
    const memory = memoryReading(data.memory);
    this.sample = data.sample as number;
    this.received = now;
    this.samples = [...this.samples, {time: now, cpu, ram: memory ? (memory.used_bytes / memory.total_bytes) * 100 : null}];
    while (this.samples.length > 60 || now - this.samples[0].time > WINDOW) this.samples.shift();
  }
}

export function monitorView(s: BarState, connected: boolean, history: MonitorHistory, now = Date.now()) {
  const reported = s.system;
  const valid = connected && Number.isSafeInteger(reported?.sample) && (reported!.sample as number) >= 0;
  const data = valid ? reported! : {};
  const stale = valid && now - history.received > STALE_AFTER;
  const cpu = finiteNonnegative(data.cpu_percent) && data.cpu_percent <= 100 ? data.cpu_percent : null;
  const memory = memoryReading(data.memory);
  const storage = memoryReading(data.storage);
  const ram = memory ? (memory.used_bytes / memory.total_bytes) * 100 : null;
  const chartLabel = (label: string, key: 'cpu' | 'ram') => {
    const points = history.samples.filter(p => p[key] != null);
    return label + ' history: ' + (points.length ? points.length + ' real samples, latest ' + Math.round(points[points.length - 1][key] as number) + '%' : 'no samples available');
  };
  const wifi = s.wifi || {};
  const load = Array.isArray(data.load_average) && data.load_average.length === 3 && data.load_average.every(finiteNonnegative) ? data.load_average.map(v => v.toFixed(2)).join(' / ') : '—';
  return {
    state: !connected ? 'offline' : stale ? 'stale' : valid ? 'live' : 'waiting',
    status: !connected ? 'Offline' : stale ? 'Waiting for new data' : valid ? 'Live · every 2s' : 'Not available',
    cpu: cpu === null ? '—' : Math.round(cpu) + '%',
    cpuDetail: Number.isSafeInteger(data.cpu_cores) && (data.cpu_cores as number) > 0 ? data.cpu_cores + (data.cpu_cores === 1 ? ' core' : ' cores') : 'Cores not reported',
    ram: ram === null ? '—' : Math.round(ram) + '%',
    ramDetail: memory ? bytes(memory.used_bytes) + ' / ' + bytes(memory.total_bytes) : 'Usage not reported',
    ramAvailable: memory ? bytes(memory.available_bytes) + ' available' + (memory.estimated_available ? ' · estimated' : '') : 'Available memory not reported',
    historyCount: history.samples.length ? (history.samples.length === 1 ? 'Collecting history' : history.samples.length + ' samples · 2 min window') : 'No samples yet',
    cpuChartLabel: chartLabel('CPU', 'cpu'),
    ramChartLabel: chartLabel('RAM', 'ram'),
    storagePercent: storage ? (storage.used_bytes / storage.total_bytes) * 100 : null,
    storageDetail: storage ? Math.round((storage.used_bytes / storage.total_bytes) * 100) + '% used' : '—',
    storageValue: storage ? bytes(storage.available_bytes) + ' free of ' + bytes(storage.total_bytes) : 'Usage not reported',
    receive: rate(data.network?.receive_bytes_per_second),
    transmit: rate(data.network?.transmit_bytes_per_second),
    receiveSpoken: rateSpoken(data.network?.receive_bytes_per_second),
    transmitSpoken: rateSpoken(data.network?.transmit_bytes_per_second),
    uptime: uptime(data.uptime_seconds),
    load,
    processes: Number.isSafeInteger(data.processes) && (data.processes as number) >= 0 ? String(data.processes) : null,
    temperature: Number.isFinite(data.temperature_c) ? (data.temperature_c as number).toFixed(1) + ' °C' : null,
    note: !connected ? 'Connection lost. Vitals will resume with fresh samples.' : stale ? 'These readings have stopped updating. Waiting for a fresh sample.' : valid ? 'History builds while this screen is open.' : 'System vitals are not available from this version of the remote.',
    wifiName: wifi.available ? (wifi.connected ? wifi.ssid || 'Connected network' : 'Not connected') : 'Status unavailable',
    wifiStatus: wifi.connected ? ['Connected', wifiQuality(wifi.signal_dbm)].filter(Boolean).join(' · ') : wifi.hotspot_ip ? 'Setup hotspot is active' : wifi.available ? 'Waiting for a Wi-Fi connection' : 'The Wi-Fi service has not reported its state.',
    wifiIp: wifi.ip || 'No network address',
    wifiSignal: [wifi.signal_dbm == null ? '' : wifi.signal_dbm + ' dBm', wifiBand(wifi.frequency_mhz)].filter(Boolean).join(' · '),
    localAddress: s.hostname === 'jbl.local',
    hotspot: wifi.hotspot_ip ? 'Local hotspot control: http://' + wifi.hotspot_ip : null,
  };
}
