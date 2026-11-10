// Shapes reported by jbl-bar-toolkit. Every field is optional: older or
// smaller backends omit what they cannot read, and the UI says so.

export type Power = 'On' | 'Standby' | 'Starting' | string;

export interface SoundState {
  bass?: number;
  atmos?: number;
  rear?: number;
  rear_docked?: boolean;
  rear_battery_left?: number;
  rear_battery_right?: number;
  night?: boolean;
  center?: number;
  center_error?: string;
  av_sync_ms?: number;
  audio_format?: string;
}

export interface BluetoothState {
  name?: string;
  peer_name?: string;
  connected?: boolean;
  selected?: boolean;
  discoverable?: boolean;
  connectable?: boolean;
  media_ready?: boolean;
  audio?: string;
}

export interface SetupState {
  calibration?: string;
  sub_pairing?: boolean;
  subwoofer?: string;
}

export interface MemoryReading {
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  estimated_available?: boolean;
}

export interface SystemState {
  sample?: number;
  cpu_percent?: number;
  cpu_cores?: number;
  load_average?: number[];
  memory?: MemoryReading;
  storage?: MemoryReading;
  network?: {receive_bytes_per_second?: number; transmit_bytes_per_second?: number};
  processes?: number;
  uptime_seconds?: number;
  temperature_c?: number;
}

export interface WifiState {
  available?: boolean;
  connected?: boolean;
  ssid?: string;
  ip?: string;
  signal_dbm?: number;
  frequency_mhz?: number;
  hotspot_ip?: string;
}

export interface EqState {
  available?: boolean;
  enabled?: boolean;
  gains_db?: number[];
  frequencies_hz?: number[];
  status?: string;
  error?: string;
  kept?: boolean;
}

export interface BassOffsetState {
  offset_db?: number;
  status?: string;
  error?: string;
}

export interface CastState {
  title?: string;
  artist?: string;
  album?: string;
  application?: string;
  mirroring?: boolean;
  duration?: number;
  current_time?: number;
  player_state?: string;
  low_shelf_gain?: number;
  high_shelf_gain?: number;
}

export interface StreamingState {
  service?: string;
  status?: string;
  active?: boolean;
  detail?: string;
  cast?: CastState;
}

export interface AutomationState {
  enabled?: boolean;
  status?: string;
  error?: string;
  remembered_mode?: string;
}

export interface BarState {
  available?: boolean;
  error?: string;
  power?: Power;
  mode?: string;
  volume?: number;
  muted?: boolean;
  input?: string;
  source?: number;
  source_state?: number;
  sound?: SoundState;
  bluetooth?: BluetoothState;
  setup?: SetupState;
  system?: SystemState;
  wifi?: WifiState;
  eq?: EqState;
  bass_offset?: BassOffsetState;
  extensions?: Record<string, any>;
  streaming?: StreamingState;
  media_controls?: string[];
  automation?: AutomationState;
  control?: {busy?: boolean; [key: string]: unknown};
  watcher?: string;
  uptime?: number;
  revision?: number;
  csrf?: string;
  hostname?: string;
}

export interface Extension {
  id: string;
  name?: string;
  model?: string;
  component?: string;
  included: boolean;
  experimental?: boolean;
  reason?: string;
  actions: string[];
}

export interface Features {
  schema: number;
  model: string;
  name: string;
  actions: string[];
  extensions: Extension[];
  manuals?: Record<string, string>;
}

export interface ActionBody {
  action: string;
  value?: number;
  gains_db?: number[];
  parameters?: Record<string, unknown>;
}
