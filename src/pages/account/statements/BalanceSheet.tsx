import { Fragment, useEffect, useMemo, useState } from 'react';
import { Loader } from 'rsuite';
import type { Moment } from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { exportExcel } from '../../../utils/exportHelpers';
import { useLangField, useT } from '../../../context/LanguageContext';
import { isNotReady, money, type Balance, type ChartAccount } from '../gl/glApi';
import { GlNotReady, useChartAccounts } from '../gl/glKit';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { useFiscalYears, type FiscalYear } from '../../../utils/selectOption';
import { Change, KpiDelta, SectionRow, Zero } from './StatementBits';
import { acct } from './statementData';


/** ໝວດໃນໃບສະຫຼຸບຊັບສົມບັດ — ລຽງຕາມ account_type */
const SECTIONS = [
  { key: 'currentAssets', label: 'glBsCurrentAssets', group: 1, types: ['CASH', 'RECEIVABLE', 'CURRENT_ASSET'] },
  { key: 'noncurrentAssets', label: 'glBsNoncurrentAssets', group: 1, types: ['FIXED_ASSET', 'NONCURRENT_ASSET'] },
  { key: 'currentLiabilities', label: 'glBsCurrentLiabilities', group: 2, types: ['PAYABLE', 'CURRENT_LIABILITY'] },
  { key: 'noncurrentLiabilities', label: 'glBsNoncurrentLiabilities', group: 2, types: ['NONCURRENT_LIABILITY'] },
] as const;

/** ຕົ້ນປີການເງິນທີ່ວັນທີນີ້ຢູ່ (ບໍ່ມີ = 1 ມັງກອນ) — ແຍກກຳໄລປີນີ້ ອອກຈາກກຳໄລສະສົມປີກ່ອນ */
const fiscalStartOf = (date: Moment, years: FiscalYear[]) => {
  const key = date.format('YYYY-MM-DD');
  const year = years.find((y) => y.start_date <= key && y.end_date >= key);
  return year ? year.start_date : date.clone().startOf('year').format('YYYY-MM-DD');
};

type Snapshot = Map<number, Balance>;

/**
 * ໃບສະຫຼຸບຊັບສົມບັດ (Balance Sheet) ຈາກສະໝຸດບັນຊີ — ຍອດ ນ ວັນທ້າຍງວດນີ້ ທຽບທ້າຍງວດກ່ອນ (LAK).
 * ຊັບສິນ = ໜີ້ − ມີ; ໜີ້ສິນ/ທຶນ = ມີ − ໜີ້; ກຳໄລສະສົມປີກ່ອນ ແລະ ກຳໄລປີນີ້ ຄິດຈາກບັນຊີລາຍຮັບ-ລາຍຈ່າຍ
 * (ຍັງບໍ່ປິດບັນຊີກໍ່ຖືກຕ້ອງ). ຊັບສິນ = ໜີ້ສິນ + ທຶນ ສະເໝີ
 */
const BalanceSheet = ({ data }: { data: StatementData }) => {
  const t = useT();
  const lf = useLangField();
  const { rows: accounts, notReady: chartNotReady } = useChartAccounts();
  const years = useFiscalYears();
  const [snapshots, setSnapshots] = useState<{ now: Snapshot; before: Snapshot } | null>(null);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const endNow = data.range.end;
  const endBefore = data.prev.end;

  useEffect(() => {
    if (years.loading) return;
    let cancelled = false;
    setError('');
    const fetchAt = (end: Moment) => postApi('/gl/balances', {
      start_date: fiscalStartOf(end, years),
      end_date: end.format('YYYY-MM-DD'),
    }).then((res) => new Map<number, Balance>((res.data?.data ?? []).map((b: Balance) => [b.account_id, b])));
    Promise.all([fetchAt(endNow), fetchAt(endBefore)])
      .then(([now, before]) => !cancelled && setSnapshots({ now, before }))
      .catch((err) => {
        if (cancelled) return;
        if (isNotReady(err)) setNotReady(true);
        else setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [years, endNow.format('YYYY-MM-DD'), endBefore.format('YYYY-MM-DD')]);

  const report = useMemo(() => {
    if (!snapshots) return null;
    const postable = accounts.filter((a) => Number(a.is_postable) === 1);
    /** ຍອດ ນ ທ້າຍງວດ: ຊັບສິນ ໜີ້ − ມີ, ອື່ນໆ ມີ − ໜີ້ */
    const valueOf = (snap: Snapshot, a: ChartAccount) => {
      const closing = snap.get(a._uuid)?.closing ?? 0;
      return Number(a.account_group) === 1 ? closing : -closing;
    };
    const line = (a: ChartAccount) => ({ account: a, now: valueOf(snapshots.now, a), before: valueOf(snapshots.before, a) });
    const keep = (l: { now: number; before: number }) => Math.abs(l.now) >= 0.005 || Math.abs(l.before) >= 0.005;

    const sections = SECTIONS.map((s) => {
      const lines = postable.filter((a) => Number(a.account_group) === s.group && (s.types as readonly string[]).includes(a.account_type)).map(line).filter(keep);
      return { ...s, lines, now: lines.reduce((n, l) => n + l.now, 0), before: lines.reduce((n, l) => n + l.before, 0) };
    });

    // ລາຍຮັບ-ລາຍຈ່າຍ (ກຸ່ມ 4–5): opening = ກ່ອນຕົ້ນປີການເງິນ → ກຳໄລສະສົມ, ໃນຊ່ວງ = ກຳໄລປີນີ້ (ມີ − ໜີ້)
    const pnl = postable.filter((a) => Number(a.account_group) >= 4);
    const earnings = (snap: Snapshot) => ({
      prior: -pnl.reduce((n, a) => n + (snap.get(a._uuid)?.opening ?? 0), 0),
      current: pnl.reduce((n, a) => n + (snap.get(a._uuid)?.credit ?? 0) - (snap.get(a._uuid)?.debit ?? 0), 0),
    });
    const eNow = earnings(snapshots.now);
    const eBefore = earnings(snapshots.before);
    const equityLines = postable.filter((a) => Number(a.account_group) === 3).map(line).filter(keep);
    const equity = {
      lines: equityLines,
      prior: { now: eNow.prior, before: eBefore.prior },
      current: { now: eNow.current, before: eBefore.current },
      now: equityLines.reduce((n, l) => n + l.now, 0) + eNow.prior + eNow.current,
      before: equityLines.reduce((n, l) => n + l.before, 0) + eBefore.prior + eBefore.current,
    };
    const sumOf = (keys: string[], k: 'now' | 'before') => sections.filter((s) => keys.includes(s.key)).reduce((n, s) => n + s[k], 0);
    const assets = { now: sumOf(['currentAssets', 'noncurrentAssets'], 'now'), before: sumOf(['currentAssets', 'noncurrentAssets'], 'before') };
    const liabilities = { now: sumOf(['currentLiabilities', 'noncurrentLiabilities'], 'now'), before: sumOf(['currentLiabilities', 'noncurrentLiabilities'], 'before') };
    return { sections, equity, assets, liabilities };
  }, [snapshots, accounts]);

  if (notReady || chartNotReady) return <GlNotReady />;
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;
  if (!report) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const { sections, equity, assets, liabilities } = report;
  const totalLE = { now: liabilities.now + equity.now, before: liabilities.before + equity.before };
  const balanced = Math.abs(assets.now - totalLE.now) < 1 && Math.abs(assets.before - totalLE.before) < 1;
  const nowText = endNow.format('DD/MM/YYYY');
  const beforeText = endBefore.format('DD/MM/YYYY');

  /** ຍອດ ນ ວັນທີ — 0 = ຂີດ; good = ເພີ່ມຂຶ້ນແມ່ນດີບໍ່ (ຊັບສິນ/ທຶນ ແມ່ນ, ໜີ້ສິນ ບໍ່ແມ່ນ) */
  const lineRow = (key: string | number, label: string, now: number, before: number, good: boolean, className = '', code?: string) => (
    <tr key={key} className={className || 'is-line'}>
      <td className={className ? '' : 'is-indent'}>{code && <span className="acc-fs-code">{code}</span>}{label}</td>
      <td>{Math.abs(now) >= 0.005 ? money(now) : <Zero />}</td>
      <td className="is-previous">{Math.abs(before) >= 0.005 ? money(before) : <Zero />}</td>
      <Change current={now} previous={before} good={good} />
    </tr>
  );
  // ໝວດຍ່ອຍທີ່ບໍ່ມີບັນຊີມີຍອດ ບໍ່ສະແດງ (ບໍ່ໃຫ້ມີແຖວ "ບໍ່ມີຂໍ້ມູນ" ຫຼາຍແຖວ); ທັງກຸ່ມບໍ່ມີ = ແຖວດຽວ
  const groupRows = (group: 1 | 2, good: boolean) => {
    const list = sections.filter((s) => s.group === group && s.lines.length);
    if (!list.length) return <tr className="is-empty"><td className="is-indent" colSpan={4}>{t('rpEmpty')}</td></tr>;
    return list.map((s) => (
      <Fragment key={s.key}>
        <tr className="is-group"><td colSpan={4}>{t(s.label)}</td></tr>
        {s.lines.map((l) => lineRow(l.account._uuid, lf(l.account, 'name'), l.now, l.before, good, '', l.account.account_code))}
        {lineRow(`${s.key}-t`, `${t('total')}${t(s.label)}`, s.now, s.before, good, 'is-subtotal is-light')}
      </Fragment>
    ));
  };

  // ໂຄງສ້າງ: ຊັບສິນ (ໝູນວຽນ / ບໍ່ໝູນວຽນ) ທຽບ ໜີ້ສິນ + ທຶນ — ແຕ້ມສະເພາະເມື່ອທຸກສ່ວນບໍ່ຕິດລົບ
  const part = (key: string) => sections.find((s) => s.key === key)?.now ?? 0;
  const bars = [
    { key: 'a', label: t('glGroupAsset'), parts: [
      { key: 'ca', label: t('glBsCurrentAssets'), value: part('currentAssets'), tone: 'is-ca' },
      { key: 'na', label: t('glBsNoncurrentAssets'), value: part('noncurrentAssets'), tone: 'is-na' },
    ] },
    { key: 'le', label: t('glBsLiabEquity'), parts: [
      { key: 'cl', label: t('glBsCurrentLiabilities'), value: part('currentLiabilities'), tone: 'is-cl' },
      { key: 'nl', label: t('glBsNoncurrentLiabilities'), value: part('noncurrentLiabilities'), tone: 'is-nl' },
      { key: 'eq', label: t('glGroupEquity'), value: equity.now, tone: 'is-eq' },
    ] },
  ];
  const scale = Math.max(assets.now, totalLE.now);
  const drawable = scale > 0 && bars.every((b) => b.parts.every((p) => p.value >= 0));
  const currentRatio = part('currentLiabilities') > 0 ? part('currentAssets') / part('currentLiabilities') : null;
  const liabShare = assets.now > 0 ? (liabilities.now / assets.now) * 100 : null;

  const exportRows = () => {
    const c = { item: t('fsItem'), now: nowText, before: beforeText };
    const r = (item: string, now: number | string, before: number | string) => ({ [c.item]: item, [c.now]: now, [c.before]: before });
    exportExcel([
      r(t('glGroupAsset'), '', ''),
      ...sections.filter((s) => s.group === 1).flatMap((s) => [r(`  ${t(s.label)}`, '', ''), ...s.lines.map((l) => r(`    ${l.account.account_code} ${lf(l.account, 'name')}`, l.now, l.before)), r(`  ${t('total')}${t(s.label)}`, s.now, s.before)]),
      r(t('glBsTotalAssets'), assets.now, assets.before),
      r(t('glGroupLiability'), '', ''),
      ...sections.filter((s) => s.group === 2).flatMap((s) => [r(`  ${t(s.label)}`, '', ''), ...s.lines.map((l) => r(`    ${l.account.account_code} ${lf(l.account, 'name')}`, l.now, l.before)), r(`  ${t('total')}${t(s.label)}`, s.now, s.before)]),
      r(t('glBsTotalLiabilities'), liabilities.now, liabilities.before),
      r(t('glGroupEquity'), '', ''),
      ...equity.lines.map((l) => r(`    ${l.account.account_code} ${lf(l.account, 'name')}`, l.now, l.before)),
      r(`    ${t('glBsPriorEarnings')}`, equity.prior.now, equity.prior.before),
      r(`    ${t('glBsCurrentEarnings')}`, equity.current.now, equity.current.before),
      r(t('glBsTotalEquity'), equity.now, equity.before),
      r(t('glBsTotalLiabilitiesEquity'), totalLE.now, totalLE.before),
    ], `balance-sheet_${endNow.format('YYYY-MM-DD')}`, `${t('fsBalanceSheet')} ${nowText} (LAK)`);
  };

  return (
    <>
      {/* ---- ຕົວເລກສະຫຼຸບ ---- */}
      <div className="acc-rp-kpis">
        <div className={`acc-rp-kpi is-main${balanced ? '' : ' is-loss'}`}>
          <small>{t('glBsTotalAssets')} · {nowText}</small>
          <b>₭ {acct(assets.now)}</b>
          <em>
            <i className={`fa-solid ${balanced ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} /> {t(balanced ? 'glBsBalanced' : 'glBsUnbalanced')}
          </em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('glBsTotalLiabilities')}</small>
          <b className="is-out">₭ {acct(liabilities.now)}</b>
          <KpiDelta current={liabilities.now} previous={liabilities.before} good={false} />
        </div>
        <div className="acc-rp-kpi">
          <small>{t('glBsTotalEquity')}</small>
          <b className={equity.now < 0 ? 'is-out' : 'is-in'}>₭ {acct(equity.now)}</b>
          <KpiDelta current={equity.now} previous={equity.before} good />
        </div>
        <div className="acc-rp-kpi">
          <small>{t('glBsCurrentRatio')}</small>
          <b>{currentRatio === null ? '—' : `${currentRatio.toFixed(2)} ${t('glBsTimes')}`}</b>
          <em className="is-flat">
            {t('glBsCurrentRatioHint')}
            {liabShare !== null && <> · {t('glGroupLiability')} {liabShare.toFixed(1)}% {t('glBsOfAssets')}</>}
          </em>
        </div>
      </div>

      {/* ---- ໂຄງສ້າງ: ຊັບສິນ ທຽບ ໜີ້ສິນ + ທຶນ (ບໍ່ພິມ) ---- */}
      {drawable && (
        <section className="acc-rp-card">
          <header>
            <h4><i className="fa-solid fa-scale-balanced" /> {t('glBsStructure')}</h4>
            <small>{t('glBsAsOf')} {nowText}</small>
          </header>
          <div className="acc-fs-stack">
            {bars.map((b) => {
              const total = b.parts.reduce((n, p) => n + p.value, 0);
              return (
                <div key={b.key} className="acc-fs-stack-row">
                  <span className="acc-fs-stack-label">{b.label}<b>{formatNumber(total)}</b></span>
                  <span className="acc-fs-stack-track">
                    {b.parts.filter((p) => p.value > 0).map((p) => {
                      const tip = `${p.label} · ${formatNumber(p.value)} · ${((p.value / scale) * 100).toFixed(1)}%`;
                      return <i key={p.key} className={p.tone} style={{ width: `${(p.value / scale) * 100}%` }} data-tip={tip} aria-label={tip} tabIndex={0} />;
                    })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="acc-fs-stack-legend">
            {bars.flatMap((b) => b.parts).map((p) => (
              <span key={p.key} className={p.value ? '' : 'is-none'}>
                <i className={p.tone} />
                {p.label}
                <b>{p.value ? `${formatNumber(p.value)} · ${((p.value / scale) * 100).toFixed(1)}%` : '–'}</b>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ---- ໃບລາຍງານ (ສ່ວນທີ່ພິມ) ---- */}
      <StatementDoc
        title={t('fsBalanceSheet')}
        period={`${t('glBsAsOf')} ${nowText}`}
        unit="LAK"
        onExcel={exportRows}
        note={<>
          <p className={balanced ? 'acc-gl-ok' : 'acc-gl-bad'}>
            <i className={`fa-solid ${balanced ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} /> {t(balanced ? 'glBsBalanced' : 'glBsUnbalanced')}
          </p>
          <p>{t('glBsNote')}</p>
        </>}
      >
        <div className="acc-rp-scroll">
          <table className="acc-fs-table is-compare is-balance">
            <colgroup>
              <col />
              <col className="is-num" />
              <col className="is-num" />
              <col className="is-change" />
            </colgroup>
            <thead>
              <tr>
                <th>{t('fsItem')}</th>
                <th>{t('glBsAsOf')}<small>{nowText}</small></th>
                <th>{t('glBsAsOf')}<small>{beforeText}</small></th>
                <th>{t('fsChange')}<small>{t('fsChangeHint')}</small></th>
              </tr>
            </thead>
            <tbody>
              <SectionRow tone="asset" icon="fa-building-columns" label={t('glGroupAsset')} span={4} />
              {groupRows(1, true)}
              {lineRow('assets', t('glBsTotalAssets'), assets.now, assets.before, true, 'is-total')}

              <SectionRow tone="liability" icon="fa-file-invoice-dollar" label={t('glGroupLiability')} span={4} />
              {groupRows(2, false)}
              {lineRow('liabilities', t('glBsTotalLiabilities'), liabilities.now, liabilities.before, false, 'is-subtotal')}

              <SectionRow tone="equity" icon="fa-hand-holding-dollar" label={t('glGroupEquity')} span={4} />
              {equity.lines.map((l) => lineRow(l.account._uuid, lf(l.account, 'name'), l.now, l.before, true, '', l.account.account_code))}
              {lineRow('prior', t('glBsPriorEarnings'), equity.prior.now, equity.prior.before, true)}
              {lineRow('current', t('glBsCurrentEarnings'), equity.current.now, equity.current.before, true)}
              {lineRow('equity', t('glBsTotalEquity'), equity.now, equity.before, true, 'is-subtotal')}

              {lineRow('le', t('glBsTotalLiabilitiesEquity'), totalLE.now, totalLE.before, true, `is-total${balanced ? '' : ' is-negative'}`)}
            </tbody>
          </table>
        </div>
      </StatementDoc>
    </>
  );
};

export default BalanceSheet;
