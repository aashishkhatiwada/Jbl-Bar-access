import type {ActionBody, BarState, Features} from '../api/types';

// Optional panels come from bundled components; feature discovery says which
// the bar includes. Without discovery (older v1 remotes) everything falls back
// to the state-based behaviour, exactly like the web client.
export const KNOWN_COMPONENTS = new Set(['front-eq', 'center-level', 'bass-offset']);

const BINDINGS: Record<string, [string, string]> = {
  bass_offset_set: ['bass-offset', 'set'],
  eq_apply: ['front-eq', 'apply'],
  eq_reset: ['front-eq', 'reset'],
  center_next: ['center-level', 'next'],
};

export interface CommandInput {
  gains?: number[] | null;
  value?: number | null;
  parameters?: Record<string, unknown> | null;
}

export function command(features: Features | null, action: string, input: CommandInput = {}): ActionBody {
  if (action === 'av_sync_up' || action === 'av_sync_down') return {action: 'av_sync_set'};
  if (action === 'av_sync_set') return {action, value: input.value ?? undefined};
  const binding = BINDINGS[action];
  const feature = binding && features?.extensions.find(item => item.component === binding[0] && item.included);
  const target = feature && feature.id + '.' + binding[1];
  if (feature && target && feature.actions.includes(target)) {
    if (input.parameters) return {action: target, parameters: input.parameters};
    if (action === 'eq_apply') return {action: target, parameters: {gains_db: input.gains ?? undefined}};
    return {action: target};
  }
  return action === 'eq_apply' ? {action, gains_db: input.gains ?? undefined} : {action};
}

// Projects extension state onto the core fields the UI reads.
export function project(features: Features | null, snapshot: BarState): BarState;
export function project(features: Features | null, snapshot: BarState | null): BarState | null;
export function project(features: Features | null, snapshot: BarState | null): BarState | null {
  if (!snapshot || !features) return snapshot;
  let value = snapshot;
  for (const feature of features.extensions) {
    if (!feature.included || !feature.component || !KNOWN_COMPONENTS.has(feature.component)) continue;
    const projected = snapshot.extensions?.[feature.id];
    if (projected == null) continue;
    if (value === snapshot) value = {...snapshot};
    if (feature.component === 'bass-offset') value.bass_offset = projected;
    if (feature.component === 'front-eq') value.eq = projected;
    if (feature.component === 'center-level') value.sound = {...value.sound, center: projected.level, center_error: projected.error};
  }
  return value;
}

// Whether an optional component's panel is shown. Before discovery the web
// shows every bundled panel; it hides one only when features say so.
export function componentIncluded(features: Features | null, component: string): boolean {
  if (!features) return true;
  return features.extensions.some(item => item.component === component && item.included === true);
}

// Whether the backend supports an action at all (its core list plus included
// extensions). Without discovery every action is allowed.
export function supports(features: Features | null, action: string): boolean {
  if (!features) return true;
  const actions = new Set(features.actions);
  for (const item of features.extensions) if (item.included) for (const a of item.actions || []) actions.add(a);
  return actions.has(command(features, action).action);
}

export function deviceName(features: Features | null): string {
  return features?.name || 'JBL Bar 9.1';
}

export const MANUAL_LANGUAGES: Record<string, string> = {en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español', nl: 'Nederlands'};

// The owner's manual in the phone's language when available, else English.
export function manual(features: Features | null, locales: string[]): {code: string; url: string; label: string} | null {
  const manuals = features?.manuals && typeof features.manuals === 'object' ? features.manuals : {};
  const valid = (code: string) => typeof manuals[code] === 'string' && /^https:\/\/[^\s"<>]+$/.test(manuals[code]);
  const preferred = [...locales, 'en'].map(tag => String(tag || '').slice(0, 2).toLowerCase());
  const code = preferred.find(valid) || Object.keys(manuals).sort().find(valid);
  if (!code) return null;
  return {code, url: manuals[code], label: 'PDF · ' + (MANUAL_LANGUAGES[code] || code.toUpperCase())};
}
