import type { CSSProperties, ReactNode } from 'react';
import { formatNumber } from '../../../utils/configApi';
import { useT } from '../../../context/LanguageContext';
import { changeOf } from '../journal/reportData';
import { acct } from './statementData';

/** ຊິ້ນສ່ວນທີ່ໃບລາຍງານການເງິນທັງ 3 ໃບໃຊ້ຮ່ວມກັນ — ຕົວເລກ, ປ່ຽນແປງ, ຫົວໝວດ, ກອບກຣາບ */

export const Zero = () => <span className="acc-fs-zero">–</span>;

/** ຕົວເລກແຖວລາຍການ — 0 ສະແດງເປັນຂີດ ຕາມແບບໃບລາຍງານບັນຊີ */
export const amount = (value: number) => (Math.abs(value) >= 0.005 ? acct(value) : <Zero />);

/** ປ່ຽນແປງ = ຜົນຕ່າງ + % ທຽບງວດກ່ອນ — good = ເພີ່ມຂຶ້ນແມ່ນດີບໍ່ (ລາຍຮັບ/ກຳໄລ/ຊັບສິນ ແມ່ນ, ລາຍຈ່າຍ/ໜີ້ສິນ ບໍ່ແມ່ນ) */
export const Change = ({ current, previous, good }: { current: number; previous: number; good: boolean }) => {
  const t = useT();
  const diff = current - previous;
  if (Math.abs(diff) < 0.005) return <td className="acc-fs-change"><Zero /></td>;
  const up = diff > 0;
  const change = changeOf(current, previous);
  // ງວດກ່ອນເປັນ 0 = ລາຍການໃໝ່; ງວດກ່ອນຕິດລົບ (ຂາດທຶນ) % ບໍ່ມີຄວາມໝາຍ → ບໍ່ສະແດງ
  const pill = change !== null
    ? <><i className={`fa-solid ${up ? 'fa-caret-up' : 'fa-caret-down'}`} /> {Math.abs(change).toFixed(1)}%</>
    : previous === 0 ? t('fsNew') : null;
  return (
    <td className={`acc-fs-change ${up === good ? 'is-good' : 'is-bad'}`}>
      <span className="acc-fs-diff">{up ? '+' : '−'}{formatNumber(Math.abs(diff))}</span>
      {pill && <span className="acc-fs-pill">{pill}</span>}
    </td>
  );
};

/** ແຖວປ່ຽນແປງໃນບັດຕົວເລກສະຫຼຸບ — ▲ 14.6% · ທຽບຊ່ວງກ່ອນ 69,500,000 */
export const KpiDelta = ({ current, previous, good, prefix = '' }: { current: number; previous: number; good: boolean; prefix?: string }) => {
  const t = useT();
  const diff = current - previous;
  const change = changeOf(current, previous);
  const tone = Math.abs(diff) < 0.005 ? 'is-flat' : (diff > 0) === good ? 'is-good' : 'is-bad';
  return (
    <em className={tone}>
      {tone !== 'is-flat' && (change !== null
        ? <span className="acc-fs-delta"><i className={`fa-solid ${diff > 0 ? 'fa-caret-up' : 'fa-caret-down'}`} />{Math.abs(change).toFixed(1)}%</span>
        : previous === 0 && <span className="acc-fs-delta">{t('fsNew')}</span>)}
      <span className="acc-fs-delta-ref">{t('rpVsPrevious')} {prefix}{acct(previous)}</span>
    </em>
  );
};

/** ສັດສ່ວນຂອງແຖວໃນຍອດລວມໝວດ (ງວດນີ້) */
export const Share = ({ value, total }: { value: number; total: number }) => {
  if (!value || total <= 0) return <td className="acc-fs-share"><Zero /></td>;
  const pct = (value / total) * 100;
  return (
    <td className="acc-fs-share">
      <span className="acc-fs-share-bar"><i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></span>
      {pct.toFixed(1)}%
    </td>
  );
};

export type SectionTone = 'in' | 'out' | 'asset' | 'liability' | 'equity';

/** ຫົວໝວດ — ແຖບສີຊ້າຍ + ໄອຄອນ + ຈຳນວນແຖວ (ສີຕາມ tone) */
export const SectionRow = ({ tone, icon, label, count, span }: { tone: SectionTone; icon: string; label: ReactNode; count?: number; span: number }) => (
  <tr className={`is-section is-${tone}`}>
    <td colSpan={span}>
      <span className="acc-fs-section">
        <i className={`fa-solid ${icon}`} />
        {label}
        {!!count && <small>{count}</small>}
      </span>
    </td>
  </tr>
);

/** ຕົວເລກຫຍໍ້ໃຫ້ແກນກຣາບ: 1.5B / 60M / 850K */
export const compact = (value: number) => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  const fmt = (n: number, unit: string) => `${sign}${Number(n.toFixed(n < 10 ? 1 : 0))}${unit}`;
  if (abs >= 1e9) return fmt(abs / 1e9, 'B');
  if (abs >= 1e6) return fmt(abs / 1e6, 'M');
  if (abs >= 1e3) return fmt(abs / 1e3, 'K');
  return `${sign}${formatNumber(abs)}`;
};

/** ຂັ້ນແກນທີ່ອ່ານງ່າຍ (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ) */
const niceStep = (raw: number) => {
  if (raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * pow >= raw) ?? 10;
  return step * pow;
};

/** ແກນ 4 ຂັ້ນ ຈາກ lo ຫາ hi — lo/hi ຂະຫຍາຍອອກເປັນຕົວເລກມົນ */
export const niceAxis = (lo: number, hi: number, steps = 4) => {
  if (hi - lo < 1) hi = lo + 1;
  // ເງິນບໍ່ມີເຄິ່ງກີບ — ຂັ້ນນ້ອຍສຸດ 1 (ບໍ່ໃຫ້ແກນຂຶ້ນ 1, 1, 1, 0, 0)
  const step = Math.max(1, niceStep((hi - lo) / steps));
  const min = Math.floor(lo / step) * step;
  const max = min + step * steps >= hi ? min + step * steps : Math.ceil(hi / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => max - i * step);
  return { min, max, ticks };
};

/**
 * ກອບກຣາບ — ແກນ Y (ຕົວເລກຫຍໍ້) ຊ້າຍ, ພື້ນທີ່ກຣາບ + ແກນ X (ປ້າຍຊ່ອງເວລາ). ເສັ້ນຕາຕະລາງຕາມຂັ້ນຂອງ ticks
 * ຊ່ອງເວລາທີ່ຍັງບໍ່ຮອດ (ຫຼັງມື້ນີ້) ພື້ນອ່ອນ
 */
export const PlotFrame = ({ ticks, labels, future, height, children }: {
  ticks: number[];
  labels: string[];
  /** ຄວາມສູງພື້ນທີ່ກຣາບ (px) — ບໍ່ສົ່ງ = 168 */
  height?: number;
  /** ດັດຊະນີຊ່ອງທຳອິດທີ່ຍັງບໍ່ຮອດ — ບໍ່ມີ = ທຸກຊ່ອງຜ່ານແລ້ວ */
  future?: number;
  children: ReactNode;
}) => {
  const every = labels.length > 16 ? 5 : 1;
  const cols = { gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` };
  const rest = future !== undefined && future < labels.length ? (labels.length - future) / labels.length : 0;
  return (
    <div className="acc-fs-plot" style={height ? ({ '--fs-plot-h': `${height}px` } as CSSProperties) : undefined}>
      <span className="acc-fs-yaxis" aria-hidden>
        {ticks.map((v, i) => <span key={i}>{compact(v)}</span>)}
      </span>
      <div className="acc-fs-plot-main">
        <div className="acc-fs-plot-area" style={{ '--fs-rows': ticks.length - 1 } as CSSProperties}>
          {rest > 0 && <span className="acc-fs-future" style={{ width: `${rest * 100}%` }} />}
          {children}
        </div>
        <div className="acc-rp-axis" style={cols}>
          {labels.map((label, i) => <span key={i}>{i % every === 0 || i === labels.length - 1 ? label : ''}</span>)}
        </div>
      </div>
    </div>
  );
};
