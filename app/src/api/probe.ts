import {BarError, createApi} from './client';

export type ProbeResult =
  | {kind: 'connected'; name: string; power: string; revision?: number}
  | {kind: 'restarting'; message: string}
  | {kind: 'wrong-network'; message: string}
  | {kind: 'offline'; message: string}
  | {kind: 'not-toolkit'; message: string};

// Settings "Test connection": one state request, classified into the
// connection states the plan names.
export async function probe(host: string, fetcher: typeof fetch = fetch): Promise<ProbeResult> {
  const api = createApi(host, fetcher);
  try {
    const state = await api.getState();
    if (typeof state.available !== 'boolean') return {kind: 'not-toolkit', message: 'Something answered at ' + api.host + ', but it is not the JBL toolkit remote.'};
    if (!state.available) return {kind: 'restarting', message: state.error || 'The soundbar is starting. Try again in a minute.'};
    const features = await api.getFeatures();
    return {kind: 'connected', name: features?.name || 'JBL Bar 9.1', power: state.power || 'unknown', revision: state.revision};
  } catch (error) {
    const e = error instanceof BarError ? error : new BarError('network', String(error));
    if (e.kind === 'forbidden') return {kind: 'wrong-network', message: 'The soundbar refused this phone. It only accepts devices on its own Wi-Fi network (192.168.100.x).'};
    if (e.kind === 'parse' || e.kind === 'http') return {kind: 'not-toolkit', message: 'Something answered at ' + api.host + ', but it is not the JBL toolkit remote.'};
    if (e.kind === 'timeout') return {kind: 'offline', message: 'No answer from ' + api.host + '. Check the address and that the phone is on the soundbar’s Wi-Fi.'};
    return {kind: 'offline', message: 'Cannot reach ' + api.host + '. Check the address, the Wi-Fi network, and that the soundbar is plugged in.'};
  }
}
