#!/usr/bin/env node
// A fake jbl-bar-toolkit API for exercising the app without the soundbar.
//   node mock-bar/server.js [--port 8080] [--latency 150]
// Point the app's Settings at <this machine's IP>:8080.
// Switch scenarios: curl -X POST localhost:8080/mock/scenario/<name>
// Scenarios: normal, standby, busy, stale, rotate-csrf, low-battery,
// docked, unknown-battery, slow, restarting, eq-keep, bluetooth, cast.
'use strict';
const http = require('http');
const crypto = require('crypto');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const PORT = Number(args.port || 8080);
let latency = Number(args.latency || 150);

const FEATURES = {
  schema: 1, model: 'bar91', name: 'JBL Bar 9.1',
  actions: ['volume_up', 'volume_down', 'mute', 'power', 'standard', 'smart', 'night_toggle', 'av_sync_set', 'calibrate', 'sub_pair', 'input_tv', 'input_hdmi', 'input_bluetooth', 'bluetooth_pair', 'bass_next', 'atmos_next', 'rear_next', 'media_play', 'media_pause', 'media_stop', 'media_previous', 'media_next', 'center_next', 'eq_apply', 'eq_reset'],
  extensions: [
    {id: 'bar91.bass-offset', name: 'Bass offset', model: 'bar91', component: 'bass-offset', included: true, experimental: true, actions: ['bar91.bass-offset.set']},
    {id: 'bar91.center-level', name: 'Center level', model: 'bar91', component: 'center-level', included: true, experimental: true, actions: ['bar91.center-level.next']},
    {id: 'bar91.display-feedback', name: 'Front display feedback', model: 'bar91', included: false, experimental: true, reason: 'native display entry mechanism is not qualified', actions: []},
    {id: 'bar91.front-eq', name: 'Front EQ', model: 'bar91', component: 'front-eq', included: true, experimental: true, actions: ['bar91.front-eq.apply', 'bar91.front-eq.reset']},
  ],
  manuals: {en: 'https://ca.jbl.com/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw8adad6ce/pdfs/JBL_SB_Bar%209.1_3D_SURROUND_Owner%27s%20Manual_EN.pdf'},
};

const INPUTS = {input_tv: ['TV / ARC', 0], input_hdmi: ['HDMI', 3], input_bluetooth: ['Bluetooth', 2]};
let csrf = crypto.randomBytes(32).toString('hex');
let revision = 1;
let sample = 1;
let scenario = 'normal';
let busyUntil = 0;

function fresh() {
  return {
    available: true, power: 'On', mode: 'Standard', volume: 12, muted: false, input: 'TV / ARC', source: 0, source_state: 0,
    sound: {bass: 2, atmos: 1, rear: 1, rear_docked: true, rear_battery_left: 100, rear_battery_right: 100, night: false, av_sync_ms: 0, audio_format: 'Dolby Atmos'},
    bluetooth: {name: 'Jbl bar 9.1', connected: false, selected: false, discoverable: false, connectable: false, audio: 'Disconnected'},
    setup: {sub_pairing: false, calibration: '', subwoofer: 'Connected'},
    control: {busy: false},
    wifi: {available: true, connected: true, ssid: 'mock-network', ip: '192.168.100.25', signal_dbm: -56, frequency_mhz: 5745},
    extensions: {
      'bar91.bass-offset': {offset_db: 0, status: 'original'},
      'bar91.center-level': {error: '', level: 0},
      'bar91.front-eq': {available: true, enabled: false, gains_db: [0, 0, 0, 0, 0], frequencies_hz: [125, 500, 2000, 4000, 8000], status: 'original', kept: true},
    },
    hostname: 'jbl.local', watcher: 'STANDARD_THIS_WAKE', uptime: 297024,
  };
}
let bar = fresh();

function snapshot() {
  const s = JSON.parse(JSON.stringify(bar));
  s.system = {
    sample, cpu_cores: 4, cpu_percent: 20 + Math.round(Math.random() * 30), load_average: [1.2, 1.1, 1.0],
    memory: {total_bytes: 469528576, available_bytes: 260435968, used_bytes: 209092608 + Math.round(Math.random() * 1e7), estimated_available: false},
    storage: {total_bytes: 35815424, available_bytes: 21360640, used_bytes: 12582912},
    network: {receive_bytes_per_second: Math.round(Math.random() * 40000), transmit_bytes_per_second: Math.round(Math.random() * 9000)},
    processes: 170, uptime_seconds: bar.uptime,
  };
  s.eq = s.extensions['bar91.front-eq'];
  s.control = {busy: Date.now() < busyUntil || scenario === 'busy'};
  s.revision = scenario === 'stale' && Math.random() < 0.4 ? revision - 3 : revision;
  s.csrf = csrf;
  if (scenario === 'restarting') return {available: false, error: 'Your soundbar is restarting…', revision, csrf};
  return s;
}

function bump() {
  revision++;
  broadcast();
}

function applyScenario(name) {
  scenario = name;
  bar = fresh();
  if (name === 'standby') bar.power = 'Standby';
  if (name === 'rotate-csrf') csrf = crypto.randomBytes(32).toString('hex');
  if (name === 'low-battery') Object.assign(bar.sound, {rear_docked: false, rear_battery_left: 14, rear_battery_right: 40});
  if (name === 'docked') Object.assign(bar.sound, {rear_docked: true, rear_battery_left: 9, rear_battery_right: 9});
  if (name === 'unknown-battery') {
    delete bar.sound.rear_battery_left;
    delete bar.sound.rear_battery_right;
    delete bar.sound.rear_docked;
  }
  if (name === 'slow') latency = 2500;
  else latency = Number(args.latency || 150);
  if (name === 'eq-keep') {
    bar.power = 'Standby';
    bar.extensions['bar91.front-eq'] = {...bar.extensions['bar91.front-eq'], available: false, status: 'waiting', kept: true};
  }
  if (name === 'bluetooth') {
    Object.assign(bar, {input: 'Bluetooth', source_state: 2, media_controls: ['media_play', 'media_pause', 'media_next', 'media_previous']});
    Object.assign(bar.bluetooth, {connected: true, peer_name: 'Pixel 9', audio: 'Streaming', selected: true});
  }
  if (name === 'cast') {
    Object.assign(bar, {input: 'Chromecast', source_state: 6, media_controls: ['media_play', 'media_pause', 'media_stop', 'media_next', 'media_previous']});
    bar.streaming = {service: 'Chromecast', status: 'Playing', active: true, cast: {title: 'Night Drive', artist: 'Mock Artist', album: 'Fixtures', application: 'Spotify', duration: 245, current_time: 61, player_state: 'PLAYING'}};
  }
  bump();
}

function act(body) {
  const a = body.action;
  const s = bar.sound;
  const ext = bar.extensions;
  if (a === 'power') bar.power = bar.power === 'On' ? 'Standby' : 'On';
  else if (bar.power !== 'On') return 'Turn on the soundbar first.';
  if (a === 'volume_up') bar.volume = Math.min(31, bar.volume + 1);
  if (a === 'volume_down') bar.volume = Math.max(0, bar.volume - 1);
  if (a === 'mute') bar.muted = !bar.muted;
  if (a === 'standard' || a === 'smart') bar.mode = a === 'smart' ? 'Smart' : 'Standard';
  if (a === 'night_toggle') s.night = !s.night;
  if (a === 'bass_next') s.bass = (s.bass + 1) % 5;
  if (a === 'atmos_next') s.atmos = (s.atmos + 1) % 3;
  if (a === 'rear_next') {
    if (s.rear_docked) return 'Undock the rear speakers first.';
    s.rear = (s.rear + 1) % 4;
  }
  if (a === 'bar91.center-level.next') ext['bar91.center-level'].level = (ext['bar91.center-level'].level + 1) % 6;
  if (a === 'av_sync_set') {
    if (!Number.isInteger(body.value) || body.value < 0 || body.value > 250 || body.value % 10) return 'Invalid audio sync value.';
    s.av_sync_ms = body.value;
    busyUntil = Date.now() + 5000;
  }
  if (INPUTS[a]) [bar.input, bar.source_state] = INPUTS[a];
  if (a === 'bar91.front-eq.apply') {
    const g = body.parameters && body.parameters.gains_db;
    if (!Array.isArray(g) || g.length !== 5) return 'Invalid EQ gains.';
    const eq = ext['bar91.front-eq'];
    Object.assign(eq, {gains_db: g, enabled: g.some(v => v !== 0), status: g.some(v => v !== 0) ? 'custom' : 'original'});
  }
  if (a === 'bar91.front-eq.reset') Object.assign(ext['bar91.front-eq'], {gains_db: [0, 0, 0, 0, 0], enabled: false, status: 'original'});
  if (a === 'bar91.bass-offset.set') {
    const db = body.parameters && body.parameters.offset_db;
    if (typeof db !== 'number' || db < -3 || db > 3) return 'Invalid offset.';
    Object.assign(ext['bar91.bass-offset'], {offset_db: db, status: db === 0 ? 'original' : 'saved'});
  }
  if (a === 'bluetooth_pair') Object.assign(bar.bluetooth, {discoverable: true, connectable: true});
  if (a === 'sub_pair') bar.setup.sub_pairing = true;
  if (a === 'calibrate') bar.setup.calibration = 'Measuring 1 of 2';
  return null;
}

const clients = new Set();
function broadcast() {
  const data = 'data: ' + JSON.stringify(snapshot()) + '\n\n';
  for (const res of clients) res.write(data);
}
setInterval(() => {
  sample++;
  revision++;
  broadcast();
}, 2000);
setInterval(() => {
  for (const res of clients) res.write(': heartbeat\n\n');
}, 15000);
// Discharge rears slowly when detached in the low-battery scenario.
setInterval(() => {
  if (scenario === 'low-battery' && !bar.sound.rear_docked && bar.sound.rear_battery_left > 1) bar.sound.rear_battery_left--;
}, 20000);

function send(res, status, body, type = 'application/json') {
  setTimeout(() => {
    res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'});
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  }, latency);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/state') return send(res, 200, snapshot());
  if (url.pathname === '/api/features') return send(res, 200, FEATURES);
  if (url.pathname === '/api/events') {
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive'});
    res.write('data: ' + JSON.stringify(snapshot()) + '\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname.startsWith('/mock/scenario/') && req.method === 'POST') {
    applyScenario(url.pathname.split('/').pop());
    return send(res, 200, {scenario});
  }
  if (url.pathname.startsWith('/mock/battery/') && req.method === 'POST') {
    const [, , , side, value] = url.pathname.split('/');
    bar.sound['rear_battery_' + side] = Number(value);
    bar.sound.rear_docked = false;
    bump();
    return send(res, 200, bar.sound);
  }
  if (url.pathname === '/api/action' && req.method === 'POST') {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      if (raw.length > 256) return send(res, 413, 'Request too large', 'text/plain');
      if (req.headers['x-csrf-token'] !== csrf) return send(res, 403, 'Refresh the page before using controls', 'text/plain');
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(res, 400, {error: 'Invalid JSON'});
      }
      const known = new Set(['action', 'value', 'gains_db', 'parameters']);
      if (Object.keys(body).some(k => !known.has(k))) return send(res, 400, {error: 'Unknown field'});
      const error = act(body);
      revision++;
      const state = snapshot();
      if (error) return send(res, 409, {error, state});
      send(res, 200, state);
      broadcast();
    });
    return;
  }
  send(res, 404, {error: 'Not found'});
}).listen(PORT, '0.0.0.0', () => console.log('mock-bar on :' + PORT + ' · scenario ' + scenario));
