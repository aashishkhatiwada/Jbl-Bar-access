// WCAG relative luminance contrast, used by tests to audit the palette.
function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function parse(color: string, over = '#000000'): [number, number, number] {
  const rgba = color.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  if (rgba) {
    const [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const a = Number(rgba[4]);
    const base = parse(over);
    return [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
  }
  const hex = color.replace('#', '');
  return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance([r, g, b]: [number, number, number]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(fg: string, bg: string): number {
  const background = parse(bg);
  const a = luminance(parse(fg, bg));
  const b = luminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
