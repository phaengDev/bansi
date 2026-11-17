import { useEffect, useId, useState } from 'react';

/**
 * ພາບພື້ນຫຼັງທາງການຂອງໃບເກັບເງິນອາກອນ (ຂອບ, ລາຍກະໜົກ, ໂລ່ ສ່ວຍສາອາກອນ — ຕ້ອງຄືແບບຟອມຂອງກົມສ່ວຍສາອາກອນທຸກເສັ້ນ):
 * ວາງໄຟລ໌ A4 ຕັ້ງ (ລາຍສີດຽວ/ຂາວດຳ ເທິງພື້ນຂາວ, ≥ 1240×1754px) ໄວ້ທີ່ public/assets/. ລະບົບລົງສີຕາມ `color`
 * (ຄວາມເຂັ້ມຂອງລາຍຄືເດີມ). ບໍ່ມີໄຟລ໌ = ໃຊ້ລາຍທີ່ແຕ້ມດ້ວຍ SVG ລຸ່ມນີ້ແທນ (ສຳລັບທົດລອງເທົ່ານັ້ນ)
 */
const ARTWORK_URLS = ['/assets/invoice-background.png', '/assets/invoice-background.jpg'];

/** ພາບທາງການທີ່ໂຫຼດໄດ້ (null = ບໍ່ມີໄຟລ໌) — ໂຫຼດເທື່ອດຽວຕໍ່ການເປີດໜ້າ */
let artworkPromise: Promise<HTMLImageElement | null> | null = null;
const loadArtwork = () => {
  artworkPromise ??= ARTWORK_URLS.reduce<Promise<HTMLImageElement | null>>(
    (prev, url) => prev.then((found) => found ?? new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
      img.onerror = () => resolve(null);
      img.src = url;
    })),
    Promise.resolve(null),
  );
  return artworkPromise;
};

/** ສີ → ພາບທີ່ປ່ຽນສີແລ້ວ (data URL) — ຄວາມເຂັ້ມຂອງລາຍ = ຄວາມຕ່າງຈາກສີຂາວ, ສີ = ສີຂອງສະບັບ */
const tinted = new Map<string, string>();
const tintArtwork = (img: HTMLImageElement, color: string) => {
  const cached = tinted.get(color);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const hex = color.replace('#', '');
  const [tr, tg, tb] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const px = data.data;
  // ລາຍເຂັ້ມທີ່ສຸດທີ່ສີນີ້ໃຫ້ໄດ້ = ເຕັມສີ (alpha 1): ລາຍທີ່ເຂັ້ມເທົ່າສີ (ຂອບ) ອອກມາເປັນສີນັ້ນພໍດີ, ລາຍຈາງ ຈາງຕາມສັດສ່ວນ
  const full = 255 - Math.min(tr, tg, tb) || 255;
  for (let i = 0; i < px.length; i += 4) {
    const ink = Math.min(255, ((255 - Math.min(px[i], px[i + 1], px[i + 2])) * 255) / full);
    px[i + 3] = Math.round((ink * px[i + 3]) / 255);
    px[i] = tr;
    px[i + 1] = tg;
    px[i + 2] = tb;
  }
  ctx.putImageData(data, 0, 0);
  const url = canvas.toDataURL('image/png');
  tinted.set(color, url);
  return url;
};

/** ພາບທາງການໃນສີທີ່ກຳນົດ — undefined = ກຳລັງກວດ, null = ບໍ່ມີໄຟລ໌ (ໃຊ້ SVG) */
const useOfficialArtwork = (color: string) => {
  const [url, setUrl] = useState<string | null | undefined>(() => tinted.get(color));
  useEffect(() => {
    let alive = true;
    loadArtwork().then((img) => {
      if (alive) setUrl(img ? tintArtwork(img, color) : null);
    });
    return () => {
      alive = false;
    };
  }, [color]);
  return url;
};

/**
 * ພື້ນຫຼັງທີ່ແຕ້ມເອງ (ໃຊ້ເມື່ອຍັງບໍ່ມີໄຟລ໌ທາງການ) (A4, ຫົວໜ່ວຍ mm): ເສັ້ນລາຍລະອຽດ (guilloche) ທົ່ວໜ້າ,
 * ເສັ້ນລັດສະໝີຈາກກາງ, ວົງລາຍຄື້ນອ້ອມກາງ, ຂອບລາຍເຊືອກ 2 ຊັ້ນ, ລາຍກະໜົກຢູ່ 4 ມຸມ, ດອກບົວຂ້າງຊ້າຍ-ຂວາ ແລະ
 * ໂລ່ "ສ່ວຍສາອາກອນ" ຈາງໆຢູ່ກາງ. ສີທັງໝົດ = currentColor (ສີຂອງສະບັບ — ກຳນົດຈາກ CSS color ຂອງ <svg>)
 */
const W = 210;
const H = 297;
const CX = W / 2;
const CY = 150;

const r = (n: number) => Math.round(n * 100) / 100;

/** ເສັ້ນລັດສະໝີຈາກກາງໜ້າ */
const SUNBURST = Array.from({ length: 200 }, (_, i) => {
  const a = (i / 200) * Math.PI * 2;
  return `M${CX},${CY}L${r(CX + Math.cos(a) * 240)},${r(CY + Math.sin(a) * 240)}`;
}).join('');

/** ວົງລາຍຄື້ນ r(θ) = R + A·sin(Nθ + φ) */
const waveRing = (R: number, A: number, N: number, phase = 0) => {
  const pts = Array.from({ length: 361 }, (_, d) => {
    const a = (d * Math.PI) / 180;
    const rr = R + A * Math.sin(N * a + phase);
    return `${r(CX + Math.cos(a) * rr)},${r(CY + Math.sin(a) * rr)}`;
  });
  return `M${pts.join('L')}Z`;
};
const ROSETTE = [
  waveRing(30, 3, 24), waveRing(30, 3, 24, Math.PI), waveRing(40, 4, 30), waveRing(40, 4, 30, Math.PI),
  waveRing(52, 3.5, 36), waveRing(52, 3.5, 36, Math.PI / 2), waveRing(64, 2.5, 48),
];

/** ຄື້ນຕາມຂອບ (ຂອບລາຍເຊືອກ) — ຈາກ (x1,y1) ຫາ (x2,y2) ອອກທາງຕັ້ງສາກ */
const edgeWave = (x1: number, y1: number, x2: number, y2: number, amp: number, wave: number, phase: number) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const steps = Math.ceil(len / 0.8);
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const s = (i / steps) * len;
    const off = amp * Math.sin((s / wave) * Math.PI * 2 + phase);
    return `${r(x1 + ux * s - uy * off)},${r(y1 + uy * s + ux * off)}`;
  });
  return `M${pts.join('L')}`;
};
const BAND = 7.6; // ເສັ້ນກາງຂອງແຖບຂອບ (ຫ່າງຈາກຂອບເຈ້ຍ)
const ROPE = [0, Math.PI].map((phase) => [
  edgeWave(BAND, BAND, W - BAND, BAND, 1.1, 3.2, phase),
  edgeWave(W - BAND, BAND, W - BAND, H - BAND, 1.1, 3.2, phase),
  edgeWave(W - BAND, H - BAND, BAND, H - BAND, 1.1, 3.2, phase),
  edgeWave(BAND, H - BAND, BAND, BAND, 1.1, 3.2, phase),
].join('')).join('');

/** ລາຍກະໜົກຢູ່ມຸມ (ກ່ອງ 34×34, ມຸມຊ້າຍເທິງ) — ກ້ານມ້ວນ 2 ທາງຕາມຂອບ + ດອກບົວທາງເສັ້ນທະແຍງ + ໃບແຫຼມ */
const CORNER = [
  // ກ້ານມ້ວນຕາມຂອບເທິງ ແລະ ຂອບຊ້າຍ
  'M3,3C14,3 24,4 30,10C33,13 32,18 28,18C25,18 24,15 26,13.5',
  'M3,3C3,14 4,24 10,30C13,33 18,32 18,28C18,25 15,24 13.5,26',
  // ດອກບົວທາງເສັ້ນທະແຍງ
  'M5,5C11,7 16,11 17,17C11,16 7,11 5,5Z',
  'M8,6C14,6 20,9 23,14',
  'M6,8C6,14 9,20 14,23',
  // ໃບແຫຼມຕາມກ້ານ
  'M15,4.2C18,1.5 22,1.6 24,3.6C21,3.4 18,3.8 15,4.2Z',
  'M4.2,15C1.5,18 1.6,22 3.6,24C3.4,21 3.8,18 4.2,15Z',
  'M21,7.5C24,6.5 27,7.4 28.5,9.6C26,8.8 23.5,8.4 21,7.5Z',
  'M7.5,21C6.5,24 7.4,27 9.6,28.5C8.8,26 8.4,23.5 7.5,21Z',
].join('');

/** ດອກບົວຂ້າງ (ກ່ອງ 30×40 ກາງ 15,20) — ກີບກາງ + ກີບຂ້າງ + ກ້ານມ້ວນລຸ່ມ */
const LOTUS = [
  'M15,2C20,10 20,18 15,26C10,18 10,10 15,2Z',
  'M15,26C9,22 4,16 3,9C8,12 12,18 15,26Z',
  'M15,26C21,22 26,16 27,9C22,12 18,18 15,26Z',
  'M15,26C10,25 5,27 3,31C6,30 9,30 12,31',
  'M15,26C20,25 25,27 27,31C24,30 21,30 18,31',
  'M15,26L15,38',
  'M15,33C12,33 10,35 10,37.5C12,36 13.5,35.5 15,35.5C16.5,35.5 18,36 20,37.5C20,35 18,33 15,33Z',
].join('');

/** ໃບໄມ້ຂອງຊໍ່ຊ້ອຍອ້ອມໂລ່ (ຊ້າຍ) — ຂວາ = ສະທ້ອນ */
const LAUREL = Array.from({ length: 9 }, (_, i) => {
  const a = Math.PI * (0.62 + i * 0.075);
  const x = CX + Math.cos(a) * 44;
  const y = CY + 6 + Math.sin(a) * 44;
  const deg = (a * 180) / Math.PI + 90;
  return { x: r(x), y: r(y), deg: r(deg) };
});

/** ພື້ນຫຼັງຂອງໃບເກັບເງິນ — color = ສີລາຍ (ພາບທາງການຖືກລົງສີນີ້) */
const InvoiceBackground = ({ color }: { color: string }) => {
  const art = useOfficialArtwork(color);
  if (art) return <img className="acc-ivp-bg" src={art} alt="" aria-hidden="true" />;
  return <DrawnBackground />;
};

const DrawnBackground = () => {
  const id = useId().replace(/:/g, '');
  return (
    <svg className="acc-ivp-bg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {/* ເສັ້ນຂວາງລະອຽດທົ່ວໜ້າ */}
        <pattern id={`hatch-${id}`} width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="1.6" stroke="currentColor" strokeWidth="0.18" />
        </pattern>
        <clipPath id={`inside-${id}`}>
          <rect x="11" y="11" width={W - 22} height={H - 22} />
        </clipPath>
      </defs>

      <g clipPath={`url(#inside-${id})`}>
        <rect x="0" y="0" width={W} height={H} fill={`url(#hatch-${id})`} opacity="0.07" />
        <path d={SUNBURST} stroke="currentColor" strokeWidth="0.12" opacity="0.07" fill="none" />
        <g fill="none" stroke="currentColor" strokeWidth="0.22" opacity="0.13">
          {ROSETTE.map((d, i) => <path key={i} d={d} />)}
        </g>
      </g>

      {/* ຂອບ: ເສັ້ນນອກ-ໃນ + ລາຍເຊືອກກາງ */}
      <g fill="none" stroke="currentColor">
        <rect x="4.5" y="4.5" width={W - 9} height={H - 9} strokeWidth="0.7" opacity="0.85" />
        <rect x="10.7" y="10.7" width={W - 21.4} height={H - 21.4} strokeWidth="0.35" opacity="0.85" />
        <path d={ROPE} strokeWidth="0.28" opacity="0.6" />
      </g>

      {/* ລາຍກະໜົກ 4 ມຸມ */}
      {/* ຂະໜາດ 0.72 — ຢູ່ໃນມຸມ ບໍ່ທັບຂໍ້ຄວາມຫຼາຍ */}
      <g fill="none" stroke="currentColor" strokeWidth="0.55" opacity="0.45" strokeLinecap="round">
        <path d={CORNER} transform="translate(11.5,11.5) scale(0.72)" />
        <path d={CORNER} transform={`translate(${W - 11.5},11.5) scale(-0.72,0.72)`} />
        <path d={CORNER} transform={`translate(11.5,${H - 11.5}) scale(0.72,-0.72)`} />
        <path d={CORNER} transform={`translate(${W - 11.5},${H - 11.5}) scale(-0.72,-0.72)`} />
      </g>

      {/* ດອກບົວຂ້າງຊ້າຍ-ຂວາ */}
      <g fill="none" stroke="currentColor" strokeWidth="0.35" opacity="0.22">
        <path d={LOTUS} transform={`translate(13,${CY + 15}) rotate(-90) scale(0.9)`} />
        <path d={LOTUS} transform={`translate(${W - 13},${CY - 15}) rotate(90) scale(0.9)`} />
      </g>

      {/* ໂລ່ "ສ່ວຍສາອາກອນ" ຈາງໆຢູ່ກາງ */}
      <g opacity="0.12" fill="none" stroke="currentColor">
        <path d={`M${CX - 30},${CY - 32}L${CX + 30},${CY - 32}L${CX + 30},${CY}C${CX + 30},${CY + 22} ${CX + 12},${CY + 33} ${CX},${CY + 40}C${CX - 12},${CY + 33} ${CX - 30},${CY + 22} ${CX - 30},${CY}Z`} strokeWidth="1.4" />
        <path d={`M${CX - 26},${CY - 28}L${CX + 26},${CY - 28}L${CX + 26},${CY - 1}C${CX + 26},${CY + 18} ${CX + 10},${CY + 28} ${CX},${CY + 34}C${CX - 10},${CY + 28} ${CX - 26},${CY + 18} ${CX - 26},${CY - 1}Z`} strokeWidth="0.5" />
        {LAUREL.map((l, i) => (
          <g key={i}>
            <ellipse cx={l.x} cy={l.y} rx="1.6" ry="3.6" transform={`rotate(${l.deg} ${l.x} ${l.y})`} strokeWidth="0.5" />
            <ellipse cx={r(2 * CX - l.x)} cy={l.y} rx="1.6" ry="3.6" transform={`rotate(${-l.deg} ${r(2 * CX - l.x)} ${l.y})`} strokeWidth="0.5" />
          </g>
        ))}
        <g fill="currentColor" stroke="none" textAnchor="middle">
          <text x={CX} y={CY - 18} fontSize="6" letterSpacing="2.4">ສ ປ ປ ລ</text>
          <text x={CX} y={CY + 4} fontSize="19" fontWeight="800" letterSpacing="1.5">TAX</text>
          <text x={CX} y={CY + 16} fontSize="5.4">ສ່ວຍສາອາກອນ</text>
        </g>
        <path d={`M${CX - 24},${CY + 9.5}L${CX + 24},${CY + 9.5}L${CX + 20},${CY + 13.5}L${CX + 24},${CY + 18}L${CX - 24},${CY + 18}L${CX - 20},${CY + 13.5}Z`} strokeWidth="0.5" />
      </g>
    </svg>
  );
};

export default InvoiceBackground;
