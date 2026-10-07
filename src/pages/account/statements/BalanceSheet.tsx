import { useEffect, useMemo, useState } from 'react';
import { Loader } from 'rsuite';
import type { Moment } from 'moment';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { exportExcel } from '../../../utils/exportHelpers';
import { useLangField, useT } from '../../../context/LanguageContext';
import { isNotReady, money, type Balance, type ChartAccount } from '../gl/glApi';
import { GlNotReady, useChartAccounts } from '../gl/glKit';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { useFiscalYears, type FiscalYear } from '../../../utils/selectOption';


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

  const lineRow = (key: string | number, label: string, now: number, before: number, className = '', code?: string) => (
    <tr key={key} className={className}>
      <td className={className ? '' : 'is-indent'}>{code && <span className="acc-fs-code">{code}</span>}{label}</td>
      <td>{money(now)}</td>
      <td className="is-previous">{money(before)}</td>
    </tr>
  );
  const sectionRows = (s: (typeof sections)[number]) => [
    <tr key={`${s.key}-h`} className="is-group"><td colSpan={3}>{t(s.label)}</td></tr>,
    ...(s.lines.length
      ? s.lines.map((l) => lineRow(l.account._uuid, lf(l.account, 'name'), l.now, l.before, '', l.account.account_code))
      : [<tr key={`${s.key}-e`} className="is-empty"><td className="is-indent" colSpan={3}>{t('rpEmpty')}</td></tr>]),
    lineRow(`${s.key}-t`, `${t('total')}${t(s.label)}`, s.now, s.before, 'is-subtotal is-light'),
  ];

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
      <table className="acc-fs-table is-balance">
        <thead>
          <tr>
            <th>{t('fsItem')}</th>
            <th>{t('glBsAsOf')}<small>{nowText}</small></th>
            <th>{t('glBsAsOf')}<small>{beforeText}</small></th>
          </tr>
        </thead>
        <tbody>
          <tr className="is-section"><td colSpan={3}>{t('glGroupAsset')}</td></tr>
          {sections.filter((s) => s.group === 1).flatMap(sectionRows)}
          {lineRow('assets', t('glBsTotalAssets'), assets.now, assets.before, 'is-total')}

          <tr className="is-section"><td colSpan={3}>{t('glGroupLiability')}</td></tr>
          {sections.filter((s) => s.group === 2).flatMap(sectionRows)}
          {lineRow('liabilities', t('glBsTotalLiabilities'), liabilities.now, liabilities.before, 'is-subtotal')}

          <tr className="is-section"><td colSpan={3}>{t('glGroupEquity')}</td></tr>
          {equity.lines.map((l) => lineRow(l.account._uuid, lf(l.account, 'name'), l.now, l.before, '', l.account.account_code))}
          {lineRow('prior', t('glBsPriorEarnings'), equity.prior.now, equity.prior.before)}
          {lineRow('current', t('glBsCurrentEarnings'), equity.current.now, equity.current.before)}
          {lineRow('equity', t('glBsTotalEquity'), equity.now, equity.before, 'is-subtotal')}

          {lineRow('le', t('glBsTotalLiabilitiesEquity'), totalLE.now, totalLE.before, `is-total${balanced ? '' : ' is-negative'}`)}
        </tbody>
      </table>
    </StatementDoc>
  );
};

export default BalanceSheet;
