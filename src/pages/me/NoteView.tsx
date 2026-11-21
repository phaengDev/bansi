import type { ReactNode } from 'react';

/**
 * ສະແດງໂນດທີ່ຂຽນ / ຂີດແຕ້ມໃນ app ພະນັກງານ (ອ່ານຢ່າງດຽວ): ຂໍ້ຄວາມພ້ອມສີ / ໂຕໜາ / ໄຮໄລ້ (marks) ແລະ ຮູບຂີດແຕ້ມ (ink → SVG)
 * — ຮູບແບບດຽວກັບ NoteMark / NoteInk ຂອງ app
 */

type Mark = { s: number; e: number; c?: string; b?: boolean | number; h?: string };
type Stroke = { c?: string; s?: number; p?: number[]; t?: string; f?: number | boolean; x?: string };

const parse = <T,>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** ສີ "#RRGGBB" ເທົ່ານັ້ນ (ກັນຂໍ້ມູນແປກ) */
const hex = (value: string | undefined, fallback: string) => (value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback);

/** ຂໍ້ຄວາມ + ສີ / ໂຕໜາ / ໄຮໄລ້ ຂອງຊ່ວງ [s, e) — ຊ່ວງຊ້ອນກັນ: ທຸກຄຸນສົມບັດຂອງຊ່ວງທີ່ຄອບຕົວອັກສອນນັ້ນໃຊ້ຮ່ວມກັນ */
export const MarkedText = ({ text, marks }: { text: string; marks: string | null }) => {
  const list = (parse<Mark[]>(marks) ?? []).filter((m) => Number.isInteger(m.s) && Number.isInteger(m.e) && m.e > m.s);
  if (!list.length) return <>{text}</>;
  const cuts = [...new Set([0, text.length, ...list.flatMap((m) => [Math.max(0, Math.min(text.length, m.s)), Math.max(0, Math.min(text.length, m.e))])])].sort((a, b) => a - b);
  const parts: ReactNode[] = [];
  for (let i = 0; i < cuts.length - 1; i += 1) {
    const [from, to] = [cuts[i], cuts[i + 1]];
    if (from === to) continue;
    const on = list.filter((m) => m.s <= from && m.e >= to);
    const piece = text.slice(from, to);
    if (!on.length) {
      parts.push(piece);
      continue;
    }
    const color = on.map((m) => m.c).filter(Boolean).pop();
    const highlight = on.map((m) => m.h).filter(Boolean).pop();
    parts.push(
      <span key={from} style={{
        color: color ? hex(color, 'inherit') : undefined,
        background: highlight ? hex(highlight, 'transparent') : undefined,
        fontWeight: on.some((m) => m.b === true || m.b === 1) ? 700 : undefined,
      }}
      >
        {piece}
      </span>,
    );
  }
  return <>{parts}</>;
};

const box = (p: number[]) => {
  const [x1, y1, x2, y2] = [p[0], p[1], p[p.length - 2], p[p.length - 1]];
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), x1, y1, x2, y2 };
};
const polygon = (cx: number, cy: number, rx: number, ry: number, points: number, inner?: number) =>
  Array.from({ length: inner ? points * 2 : points }, (_, i) => {
    const r = inner && i % 2 ? inner : 1;
    const a = (Math.PI * 2 * i) / (inner ? points * 2 : points) - Math.PI / 2;
    return `${cx + Math.cos(a) * rx * r},${cy + Math.sin(a) * ry * r}`;
  }).join(' ');

/** 1 ເສັ້ນ / ຮູບຊົງ / ຂໍ້ຄວາມ ຂອງຮູບຂີດແຕ້ມ */
const StrokeShape = ({ stroke, index }: { stroke: Stroke; index: number }) => {
  const p = (stroke.p ?? []).filter((n) => typeof n === 'number');
  if (p.length < 2) return null;
  const color = hex(stroke.c, '#172033');
  const size = Math.max(0.5, Math.min(200, Number(stroke.s) || 3));
  const fill = stroke.f ? color : 'none';
  const common = { stroke: color, strokeWidth: size, fill, fillOpacity: stroke.f ? 0.25 : undefined, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const b = box(p);
  switch (stroke.t) {
    case 'text':
      return (
        <text x={p[0]} y={p[1]} fill={color} fontSize={size} dominantBaseline="hanging" fontFamily="NotoSerifLao, sans-serif">
          {(stroke.x ?? '').split('\n').map((line, i) => <tspan key={i} x={p[0]} dy={i ? size * 1.3 : 0}>{line}</tspan>)}
        </text>
      );
    case 'line':
      return <line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} {...common} />;
    case 'arrow': {
      const angle = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
      const head = Math.max(10, size * 3);
      const wing = (side: number) => `${b.x2 - head * Math.cos(angle + side * 0.5)},${b.y2 - head * Math.sin(angle + side * 0.5)}`;
      return <g {...common} fill="none"><line x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} /><polyline points={`${wing(1)} ${b.x2},${b.y2} ${wing(-1)}`} /></g>;
    }
    case 'rect':
      return <rect x={b.x} y={b.y} width={b.w} height={b.h} {...common} />;
    case 'rrect':
    case 'bubble':
      return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(b.w, b.h) * 0.2} {...common} />;
    case 'oval':
      return <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} {...common} />;
    case 'star':
      return <polygon points={polygon(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 5, 0.45)} {...common} />;
    case 'hex':
      return <polygon points={polygon(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 6)} {...common} />;
    default: {
      const points = Array.from({ length: Math.floor(p.length / 2) }, (_, i) => `${p[i * 2]},${p[i * 2 + 1]}`).join(' ');
      return <polyline key={index} points={points} {...common} fill="none" strokeOpacity={stroke.t === 'hl' ? 0.35 : 1} />;
    }
  }
};

/** ຮູບຂີດແຕ້ມຂອງໂນດ (ຫຍໍ້/ຂະຫຍາຍພໍດີກ່ອງ ຮັກສາສັດສ່ວນ) — ບໍ່ມີ / ຜິດຮູບແບບ = ບໍ່ສະແດງ */
export const NoteInk = ({ ink, className }: { ink: string | null; className?: string }) => {
  const data = parse<{ w?: number; h?: number; strokes?: Stroke[] }>(ink);
  const strokes = (data?.strokes ?? []).filter((s) => (s.p?.length ?? 0) >= 2);
  if (!strokes.length) return null;
  const w = Number(data?.w) > 0 ? Number(data?.w) : 360;
  const h = Number(data?.h) > 0 ? Number(data?.h) : 480;
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" role="img">
      {strokes.map((stroke, i) => <StrokeShape key={i} stroke={stroke} index={i} />)}
    </svg>
  );
};

export const hasInk = (ink: string | null) => !!parse<{ strokes?: unknown[] }>(ink)?.strokes?.length;
