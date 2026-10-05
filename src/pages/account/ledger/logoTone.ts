import { useEffect, useState, type CSSProperties } from 'react';

/** ຊຸດສີຂອງບັດ — ຊື່ດຽວກັບຕົວແປ --tone-* ຂອງ .acc-tone (_account-setting.scss) */
export type LogoTone = { a: string; b: string; deep: string; soft: string };

const STORE_KEY = 'acc.logoTone.v1';
const SAMPLE = 64;
const BINS = 24;

type Hsl = [number, number, number];

const rgbToHsl = (r: number, g: number, b: number): Hsl => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};

const hslToRgb = (h: number, s: number, l: number) => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};

/** relative luminance (WCAG) — ໃຊ້ເລືອກຄວາມເຂັ້ມໃຫ້ຕົວໜັງສືຂາວເທິງປົກອ່ານອອກທຸກສີ */
const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** ສີທີ່ມີ hue/saturation ນີ້ ແລະ luminance ໃກ້ target — ສີເຫຼືອງ/ຂຽວຈຶ່ງເຂັ້ມກວ່າສີຟ້າ/ມ່ວງ ຢູ່ຄວາມເຂັ້ມດຽວກັນ */
const shade = (h: number, s: number, target: number) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(hslToRgb(h, s, mid)) > target) hi = mid;
    else lo = mid;
  }
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(lo * 1000) / 10}%)`;
};

/**
 * ສີຫຼັກຂອງໂລໂກ້: ຂ້າມພື້ນຂາວ/ດຳ/ເທົາ ແລະ ພິກເຊລໂປ່ງໃສ, ນັບ hue ເປັນຖັງ (ຖ່ວງດ້ວຍຄວາມສົດຂອງສີ) ແລ້ວເອົາຖັງທີ່ໜັກສຸດ
 * (ລວມຖັງຂ້າງຄຽງ ເພາະສີແດງຢູ່ທັງສອງປາຍຂອງວົງ hue). ພິກເຊລກາງຮູບໜັກກວ່າຂອບ — ໂລໂກ້ທະນາຄານຫຼາຍແຫ່ງມີວົງຂອບສີຄຳ
 * ທີ່ບໍ່ແມ່ນສີຫຼັກ (PSVB, APB). null = ໂລໂກ້ແທບບໍ່ມີສີ → ໃຊ້ສີໝວດຄືເດີມ
 */
const dominantHsl = (data: Uint8ClampedArray): Hsl | null => {
  const bins = new Array<number>(BINS).fill(0);
  const pixels: { h: number; s: number; l: number; w: number }[] = [];
  const half = SAMPLE / 2;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    opaque++;
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    if (l > 0.9 || l < 0.08 || s < 0.25) continue;
    const px = (i / 4) % SAMPLE;
    const py = Math.floor(i / 4 / SAMPLE);
    const dist = Math.min(1, Math.hypot(px + 0.5 - half, py + 0.5 - half) / half);
    const chroma = s * (1 - Math.abs(2 * l - 1));
    const w = chroma * (1.6 - dist) ** 4;
    bins[Math.floor(h / (360 / BINS)) % BINS] += w;
    pixels.push({ h, s, l, w });
  }
  if (!opaque || pixels.length < opaque * 0.03) return null;

  let best = 0;
  let bestWeight = -1;
  for (let i = 0; i < BINS; i++) {
    const weight = bins[(i + BINS - 1) % BINS] + bins[i] + bins[(i + 1) % BINS];
    if (weight > bestWeight) {
      best = i;
      bestWeight = weight;
    }
  }
  const center = (best + 0.5) * (360 / BINS);
  let x = 0;
  let y = 0;
  let s = 0;
  let l = 0;
  let total = 0;
  pixels.forEach((p) => {
    const diff = Math.abs(((p.h - center + 540) % 360) - 180);
    if (diff > 360 / BINS * 1.5) return;
    const rad = (p.h * Math.PI) / 180;
    x += Math.cos(rad) * p.w;
    y += Math.sin(rad) * p.w;
    s += p.s * p.w;
    l += p.l * p.w;
    total += p.w;
  });
  if (!total) return null;
  return [((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, s / total, l / total];
};

/** ສີເຫຼືອງ/ຄຳ ເມື່ອເຮັດໃຫ້ເຂັ້ມພໍໃຫ້ຕົວໜັງສືຂາວອ່ານອອກ ຈະກາຍເປັນສີກາກີ — ເລື່ອນໄປທາງສີຄຳອຳພັນແທນ */
const warmGold = (h: number) => (h >= 38 && h <= 75 ? 36 : h);

export const toneFromHsl = ([hue, s]: Hsl): LogoTone => {
  const h = warmGold(hue);
  const sat = Math.min(0.8, Math.max(0.4, s));
  return {
    deep: shade(h, sat, 0.035),
    b: shade(h, sat, 0.13),
    a: shade(h, sat, 0.36),
    soft: `hsl(${Math.round(h)} ${Math.round(Math.min(sat, 0.6) * 100)}% 95%)`,
  };
};

/** ໂຫຼດໂລໂກ້ແບບ CORS (server ຮູບສົ່ງ Access-Control-Allow-Origin: *) ແລ້ວອ່ານພິກເຊລຈາກ canvas ນ້ອຍ */
const extract = (url: string) =>
  new Promise<LogoTone | null>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        const hsl = dominantHsl(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
        resolve(hsl && toneFromHsl(hsl));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = reject;
    img.src = url;
  });

// ຈື່ຜົນໄວ້ໃນ browser — ເປີດໜ້າຄັ້ງຕໍ່ໄປບັດມີສີໂລໂກ້ທັນທີ ບໍ່ກະພິບຈາກສີໝວດ. ປ່ຽນໂລໂກ້ = ຊື່ໄຟລ໌ໃໝ່ = ຄິດໃໝ່ເອງ
const readStore = (): Record<string, LogoTone | null> => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') ?? {};
  } catch {
    return {};
  }
};

const writeStore = (url: string, tone: LogoTone | null) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...readStore(), [url]: tone }));
  } catch {
    // storage ປິດ/ເຕັມ — ບໍ່ເປັນຫຍັງ, ຄິດໃໝ່ຕອນເປີດໜ້າ
  }
};

const pending = new Map<string, Promise<LogoTone | null>>();

const logoTone = (url: string) => {
  if (!pending.has(url)) {
    pending.set(
      url,
      extract(url).then(
        (tone) => {
          writeStore(url, tone);
          return tone;
        },
        () => null // ໂຫຼດບໍ່ໄດ້ — ບໍ່ຈື່ ໃຫ້ລອງໃໝ່ຕອນເປີດໜ້າຄັ້ງຕໍ່ໄປ
      )
    );
  }
  return pending.get(url)!;
};

/** ສີຂອງແຕ່ລະໂລໂກ້ (key = URL) — ຍັງບໍ່ໄດ້ ຫຼື ບໍ່ມີສີ = ບໍ່ມີ key / null */
export const useLogoTones = (urls: (string | null | undefined)[]) => {
  const key = [...new Set(urls.filter(Boolean) as string[])].sort().join('\n');
  const [tones, setTones] = useState<Record<string, LogoTone | null>>(readStore);

  useEffect(() => {
    let alive = true;
    key.split('\n').filter((url) => url && !(url in tones)).forEach((url) => {
      logoTone(url).then((tone) => {
        if (alive) setTones((prev) => ({ ...prev, [url]: tone }));
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return tones;
};

/** ຂຽນທັບ --tone-* ຂອງໝວດ ສະເພາະບັດນັ້ນ */
export const toneStyle = (tone?: LogoTone | null): CSSProperties | undefined =>
  tone
    ? ({ '--tone-a': tone.a, '--tone-b': tone.b, '--tone-deep': tone.deep, '--tone-soft': tone.soft } as CSSProperties)
    : undefined;
