export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

function clampChannel(channel: number): number {
  return Math.min(1, Math.max(0, channel));
}

function linearToSrgb(channel: number): number {
  const encoded =
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return clampChannel(encoded);
}

function srgbToLinear(channel: number): number {
  const clamped = clampChannel(channel);
  return clamped <= 0.04045
    ? clamped / 12.92
    : Math.pow((clamped + 0.055) / 1.055, 2.4);
}

export function parseOklch(value: string): Oklch {
  const number = '[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)';
  const match = value.match(
    new RegExp(`^oklch\\(\\s*(${number})\\s+(${number})\\s+(${number})\\s*\\)$`),
  );

  if (!match) throw new Error(`Invalid oklch color: ${value}`);

  const [, l, c, h] = match;
  return { l: Number(l), c: Number(c), h: Number(h) };
}

export function oklchToSrgb(l: number, c: number, h: number): Rgb {
  const hueRadians = (h * Math.PI) / 180;
  const a = c * Math.cos(hueRadians);
  const b = c * Math.sin(hueRadians);

  const lRoot = l + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = l - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = l - 0.0894841775 * a - 1.291485548 * b;

  const lLinear = lRoot ** 3;
  const mLinear = mRoot ** 3;
  const sLinear = sRoot ** 3;

  return {
    r: linearToSrgb(
      4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear,
    ),
    g: linearToSrgb(
      -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear,
    ),
    b: linearToSrgb(
      -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.707614701 * sLinear,
    ),
  };
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.0722 * srgbToLinear(rgb.b)
  );
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}
