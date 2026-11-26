import { useState, type ReactNode } from 'react';
import { formatNumber } from '../../utils/configApi';
import { useT } from '../../context/LanguageContext';

/**
 * ກຣາບຂອງລະບົບສິນເຊື່ອ (React + SVG/HTML ລ້ວນ — ບໍ່ມີ library). ກົດ dataviz: ເສັ້ນ/ແທ່ງບາງ, ປາຍມົນ 4px ຢູ່ຝັ່ງຂໍ້ມູນ,
 * ຊ່ອງວ່າງ 2px ລະຫວ່າງແທ່ງ, ແກນດຽວ, legend ເມື່ອມີ ≥ 2 ຊຸດ, tooltip ເມື່ອຊີ້ / focus, ຂໍ້ຄວາມໃຊ້ສີຕົວໜັງສື ບໍ່ແມ່ນສີຊຸດຂໍ້ມູນ.
 * ສີ (ກວດດ້ວຍ validate_palette): ຊຸດ 1 #257de0, ຊຸດ 2 #f47230 (ຕ່ຳກວ່າ 3:1 → ມີມຸມມອງຕາຕະລາງ), ສະຖານະ good/warning/critical
 */

/** ຕົວເລກຫຍໍ້ສຳລັບແກນ / ປ້າຍ: 1,250,000 → 1.3M */
export const compact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e4) return `${Math.round(n / 1e3)}K`;
  return formatNumber(Math.round(n));
};

/** ແກນທີ່ປັດເປັນຕົວເລກງາມ (0, 5M, 10M …) */
const niceTicks = (max: number, count = 4) => {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
};

/** tooltip ລອຍ (ຄ່ານຳໜ້າ ຊື່ຕາມຫຼັງ) */
type Tip = { x: number; y: number; title: string; rows: { key?: string; label: string; value: string }[] } | null;
const TipBox = ({ tip }: { tip: Tip }) => tip && (
  <div className="cr-tip" style={{ left: tip.x, top: tip.y }} role="status">
    <b>{tip.title}</b>
    {tip.rows.map((r) => (
      <span key={r.label}>{r.key && <i style={{ background: r.key }} />}<strong>{r.value}</strong> {r.label}</span>
    ))}
  </div>
);

/** ລາຍການ meter — ອັດຕາສ່ວນຕໍ່ແຖວ (PAR 1 / 30 / 90) ພ້ອມສະຖານະ (ໄອຄອນ + ຂໍ້ຄວາມ, ບໍ່ແມ່ນສີຢ່າງດຽວ) */
export const MeterList = ({ rows }: { rows: { label: string; hint: string; rate: number; amount: string; warn: number; bad: number }[] }) => {
  const t = useT();
  return (
    <div className="cr-meters">
      {rows.map((r) => {
        const state = r.rate >= r.bad ? 'is-bad' : r.rate >= r.warn ? 'is-warn' : 'is-good';
        const icon = state === 'is-bad' ? 'fa-circle-exclamation' : state === 'is-warn' ? 'fa-triangle-exclamation' : 'fa-circle-check';
        const word = t(state === 'is-bad' ? 'crParHigh' : state === 'is-warn' ? 'crParWatch' : 'crParGood');
        return (
          <div key={r.label} className={`cr-meter ${state}`} role="meter" aria-valuenow={r.rate} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.label} ${r.rate}%`}>
            <span className="cr-meter-name"><b>{r.label}</b><small>{r.hint}</small></span>
            <span className="cr-meter-track"><i style={{ width: `${Math.min(100, r.rate)}%` }} /></span>
            <span className="cr-meter-value"><b>{r.rate}%</b><small>{r.amount}</small></span>
            <span className="cr-meter-state"><i className={`fa-solid ${icon}`} /> {word}</span>
          </div>
        );
      })}
    </div>
  );
};

/**
 * ແທ່ງນອນຕາມອາຍຸໜີ້ (ລຳດັບທຳມະຊາດ: ປົກກະຕິ → 180+ ມື້). ສີດຽວ, ປົກກະຕິ = ສີເທົາ (ບໍ່ເດັ່ນ).
 * onPick = ກົດແທ່ງເພື່ອກັ່ນລາຍການ (ໜ້າຕິດຕາມໜີ້)
 */
export const AgingBars = ({ rows, active, onPick }: {
  rows: { key: string; label: string; contracts: number; amount: number }[];
  active?: string | null;
  onPick?: (key: string) => void;
}) => {
  const t = useT();
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const [tip, setTip] = useState<Tip>(null);
  return (
    <div className="cr-aging" onPointerLeave={() => setTip(null)}>
      {rows.map((r) => {
        const body = (
          <>
            <span className="cr-aging-name">{r.label}</span>
            <span className="cr-aging-track">
              <i className={r.key === 'current' ? 'is-current' : ''} style={{ width: r.amount > 0 ? `max(${(r.amount / max) * 100}%, 4px)` : 0 }} />
            </span>
            <span className="cr-aging-value"><b>{compact(r.amount)}</b><small>{r.contracts} {t('crContracts')}</small></span>
          </>
        );
        const show = (e: { currentTarget: HTMLElement }) => {
          const box = e.currentTarget.getBoundingClientRect();
          const host = e.currentTarget.parentElement!.getBoundingClientRect();
          setTip({ x: box.left - host.left + box.width / 2, y: box.top - host.top, title: r.label, rows: [{ label: t('lnOutstanding'), value: formatNumber(r.amount) }, { label: t('crContracts'), value: String(r.contracts) }] });
        };
        return onPick ? (
          <button key={r.key} type="button" className={`cr-aging-row${active === r.key ? ' is-active' : ''}`} onClick={() => onPick(r.key)}
            onPointerEnter={show} onFocus={show} onBlur={() => setTip(null)} aria-pressed={active === r.key}
          >
            {body}
          </button>
        ) : (
          <div key={r.key} className="cr-aging-row" tabIndex={0} onPointerEnter={show} onFocus={show} onBlur={() => setTip(null)}>{body}</div>
        );
      })}
      <TipBox tip={tip} />
    </div>
  );
};

/**
 * ຖັນລາຍເດືອນ — 1 ຫຼື 2 ຊຸດ (ຖັນຄູ່), ແກນ y ດຽວ ປັດເປັນຕົວເລກງາມ, tooltip ຕໍ່ເດືອນ (ທຸກຊຸດ), ສະຫຼັບເປັນຕາຕະລາງໄດ້
 */
export const MonthColumns = ({ months, series, title, hint }: {
  months: string[];
  series: { key: string; label: string; color: string; values: number[] }[];
  title: string;
  hint?: ReactNode;
}) => {
  const t = useT();
  const [tip, setTip] = useState<Tip>(null);
  const [table, setTable] = useState(false);
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 8, t: 10, b: 26 };
  const ticks = niceTicks(Math.max(...series.flatMap((s) => s.values), 0));
  const top = ticks[ticks.length - 1] || 1;
  const band = (W - pad.l - pad.r) / months.length;
  const barW = Math.min(18, (band - 8) / series.length - 2);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const label = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;
  /** ຖັນປາຍມົນ 4px ດ້ານເທິງ, ສີ່ຫຼ່ຽມຢູ່ເສັ້ນຖານ */
  const column = (x: number, v: number) => {
    const y0 = y(0);
    const y1 = y(v);
    const h = y0 - y1;
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + barW - r} Q${x + barW},${y1} ${x + barW},${y1 + r} V${y0} Z`;
  };
  const showMonth = (i: number) => setTip({
    x: ((pad.l + band * i + band / 2) / W) * 100, y: 0, title: label(months[i]),
    rows: series.map((s) => ({ key: s.color, label: s.label, value: formatNumber(s.values[i]) })),
  });
  return (
    <section className="cr-chart">
      <header>
        <span><b>{title}</b>{hint && <small>{hint}</small>}</span>
        {series.length > 1 && (
          <span className="cr-legend">
            {series.map((s) => <span key={s.key}><i style={{ background: s.color }} /> {s.label}</span>)}
          </span>
        )}
        <button type="button" className="cr-chart-toggle" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          <i className={`fa-solid ${table ? 'fa-chart-column' : 'fa-table'}`} /> {t(table ? 'crShowChart' : 'crShowTable')}
        </button>
      </header>
      {table ? (
        <div className="acc-rp-scroll">
          <table className="acc-fs-table cr-chart-table">
            <thead><tr><th>{t('crMonth')}</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
            <tbody>
              {months.map((m, i) => <tr key={m}><td>{label(m)}</td>{series.map((s) => <td key={s.key}>{formatNumber(s.values[i])}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cr-chart-plot" onPointerLeave={() => setTip(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} preserveAspectRatio="none">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} className={v === 0 ? 'is-base' : 'is-grid'} />
                <text x={pad.l - 6} y={y(v) + 4} className="is-tick" textAnchor="end">{v === 0 ? '0' : compact(v)}</text>
              </g>
            ))}
            {months.map((m, i) => {
              const x0 = pad.l + band * i + (band - (barW + 2) * series.length + 2) / 2;
              return (
                <g key={m} className="cr-chart-month" tabIndex={0} onPointerEnter={() => showMonth(i)} onFocus={() => showMonth(i)} onBlur={() => setTip(null)}
                  aria-label={`${label(m)} ${series.map((s) => `${s.label} ${formatNumber(s.values[i])}`).join(', ')}`}
                >
                  {/* ພື້ນທີ່ຊີ້ ກວ້າງທັງເດືອນ (ໃຫຍ່ກວ່າແທ່ງ) */}
                  <rect x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t - pad.b} className="is-hit" />
                  {series.map((s, k) => <path key={s.key} d={column(x0 + k * (barW + 2), s.values[i])} fill={s.color} />)}
                  <text x={pad.l + band * i + band / 2} y={H - 8} className="is-tick" textAnchor="middle">{label(m)}</text>
                </g>
              );
            })}
          </svg>
          {/* ໃກ້ຂອບ → ຍຶດຂ້າງໃນ ບໍ່ໃຫ້ຖືກຕັດ */}
          {tip && <div className={`cr-tip is-chart${tip.x > 70 ? ' is-end' : tip.x < 30 ? ' is-start' : ''}`} style={{ left: `${tip.x}%` }} role="status">
            <b>{tip.title}</b>
            {tip.rows.map((r) => <span key={r.label}><i style={{ background: r.key }} /><strong>{r.value}</strong> {r.label}</span>)}
          </div>}
        </div>
      )}
    </section>
  );
};

/** ແທ່ງແບ່ງສ່ວນ (ສູງ 28px) — ລາຍຮັບແຍກ ດອກເບ້ຍ / ຄ່າທຳນຽມ / ຄ່າປັບ: % ໃນແທ່ງ, ຊື່ + ຈຳນວນ ຢູ່ legend */
export const SegmentBar = ({ parts, empty }: { parts: { key: string; label: string; value: number; color: string; ink?: string }[]; empty?: ReactNode }) => {
  const total = parts.reduce((n, p) => n + p.value, 0);
  const [tip, setTip] = useState<Tip>(null);
  if (!(total > 0)) return <p className="cr-segempty"><i className="fa-solid fa-circle-info" /> {empty}</p>;
  return (
    <div className="cr-segwrap" onPointerLeave={() => setTip(null)}>
      <div className="cr-segbar" role="img" aria-label={parts.map((p) => `${p.label} ${formatNumber(p.value)}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => {
          const share = Math.round((p.value / total) * 100);
          const show = (e: { currentTarget: HTMLElement }) => {
            const box = e.currentTarget.getBoundingClientRect();
            const host = e.currentTarget.parentElement!.getBoundingClientRect();
            setTip({ x: box.left - host.left + box.width / 2, y: -6, title: p.label, rows: [{ label: `${share}%`, value: formatNumber(p.value) }] });
          };
          return (
            <span key={p.key} style={{ flexGrow: p.value, background: p.color, color: p.ink ?? '#fff' }} tabIndex={0} onPointerEnter={show} onFocus={show} onBlur={() => setTip(null)}>
              {share >= 12 ? `${share}%` : ''}
            </span>
          );
        })}
      </div>
      <TipBox tip={tip} />
      <ul className="cr-seglegend">
        {parts.map((p) => <li key={p.key}><i style={{ background: p.color }} /> {p.label} <b>{formatNumber(p.value)}</b></li>)}
      </ul>
    </div>
  );
};
