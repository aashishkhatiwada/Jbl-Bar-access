// Tokens ported from the web remote's style.css (:root and the phone
// breakpoint). Translucent web colours are pre-composited over the panel so
// contrast can be checked. Text colours are verified ≥ 4.5:1 on --panel in
// __tests__/contrast.test.ts.

export const colors = {
  bg: '#14171e',
  panel: '#1d222b',
  raised: '#24272e',
  line: 'rgba(255,255,255,0.08)', // #ffffff14
  lineStrong: 'rgba(255,255,255,0.10)', // #ffffff1a button borders
  segmentBorder: 'rgba(255,255,255,0.11)', // #ffffff1c
  text: '#f0f1f5',
  muted: '#c0c7d4',
  subtle: '#aab4c5',
  orange: '#f1ab85',
  green: '#a9d4b0',
  teal: '#8ecfc6',
  violet: '#c1b0ed',
  danger: '#f2a5a5',
  // Supporting colours from individual rules.
  selectedText: '#ffe1cd',
  selectedBg: 'rgba(241,171,133,0.10)', // #f1ab851a
  selectedBorder: 'rgba(241,171,133,0.56)', // #f1ab8590
  segmentSelectedBg: 'rgba(241,171,133,0.13)', // #f1ab8521
  segmentSelectedRing: 'rgba(241,171,133,0.44)', // #f1ab8570
  powerBorder: 'rgba(238,155,124,0.19)', // #ee9b7c30
  powerBg: 'rgba(238,155,124,0.02)',
  accentBorder: 'rgba(238,155,124,0.25)', // #ee9b7c40
  applyBg: 'rgba(238,155,124,0.05)',
  applyText: '#ffd1bc',
  feedback: '#9299a5',
  feedbackReadable: '#a3aab6', // feedback text lifted to 4.5:1 on --bg
  caption: '#858b97',
  captionReadable: '#9aa1ad', // rear caption lifted to 4.5:1 on --panel
  batteryText: '#b9bdc5',
  subCaption: '#a6aab3',
  bassCaption: '#a89c9b', // #8b8180 lifted to 4.5:1
  devTag: '#b8a08e',
  helpStrong: '#c1c5cf',
  vital: '#c8cad2',
  eqOutput: '#c9cbd2',
  insetBg: 'rgba(17,18,21,0.25)', // #11121540
  btPanelBg: 'rgba(23,27,35,0.33)',
  metricBg: 'rgba(17,18,21,0.19)',
  meterTrack: 'rgba(255,255,255,0.07)',
  batteryLow: '#d8ba85',
  batteryCritical: '#e18b83',
  brandText: '#1a1918',
  speakerEdge: '#4d5058',
  speakerTop: '#383a41',
  speakerBody: '#25272e',
  subEdge: '#494b50',
  subBody: '#2d2f33',
  barLogo: '#b1b2b9',
  barLogoBg: '#2b2d32',
  barDisplay: '#c5c5c1',
  barDisplayBg: '#26282d',
  chartGrid: 'rgba(255,255,255,0.03)',
  overlay: 'rgba(8,10,14,0.78)',
};

// The web uses rem sizes; RN font sizes are dp and scale with the system
// font size (allowFontScaling stays on everywhere).
export const font = {
  caption: 13, // .8125rem
  small: 14, // .875rem
  control: 15, // .9375rem
  body: 16, // 1rem
  h2: 18, // 1.125rem
  title: 26, // h1 on phones, 1.625rem
  volume: 52, // 3.25rem
  metric: 32, // 2rem
};

export const radius = {panel: 18, button: 9, segment: 8, small: 7, tag: 4};

export const touch = {min: 44};

export const fontFamily = undefined; // system sans, like the web's ui-sans-serif
export const mono = 'monospace';
