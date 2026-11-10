# API notes (verified against the live bar, 2026-11-10)

Host `192.168.100.25`, ports 80 and 8080 serve the same remote.

## Observed

- `GET /api/state` — public snapshot, ~1.6 KB. In standby: `power: "Standby"`, `input: "Optical"`,
  `source_state: 1`, no `streaming`, no `automation`, no `media_controls`, no `setup.calibration`.
  `watcher: ""`.
- `GET /api/features` — `schema: 1`, 25 core actions, four extensions; `bar91.display-feedback` is
  `included: false` with a `reason`. Manuals for de/en/es/fr/nl.
- `GET /api/events` — `data: {state}` lines; a new one at least every 2 s (system sample
  increments), so a 30 s silent stream is treated as dead.
- `POST /api/action` with a wrong `X-CSRF-Token` → **403, plain text**
  `Refresh the page before using controls` (not JSON). The client maps a non-JSON 403 to
  `BarError('forbidden', <text>)`; the controller shows it like the web does.
- Extension state lives under `extensions[id]` and is also mirrored at top-level `eq`.
  `capabilities.project()` maps `bass-offset`, `front-eq` and `center-level` onto `bass_offset`,
  `eq` and `sound.center` exactly like the web.

## Web behaviours ported verbatim

Source read from the bar: `/app.js` and `/components/*.js` (equalizer, system, playback, sound,
center, segmented, bluetooth, details, capabilities, bass-offset, advanced, speakers).

- Messages (`success()`, `pendingMessage()`), summaries, labels and help text are copied.
- One intentional wording fix: the web says "Center level N selected." with the raw 0-based level;
  the app says the 1-based level the panel shows.
- The web's `<select>` for bass offset becomes slider + steppers + typed entry (13 steps > 6).
- Audio sync: taps wait 900 ms then send one `av_sync_set`; typed values send at once. The slider
  sends on release / 300 ms idle.

## Not available from the API

See plan Appendix C. In addition: Bluetooth `peer_name` is absent while nothing is connected.
