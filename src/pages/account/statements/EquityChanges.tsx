import { useMemo } from 'react';
import { Loader } from 'rsuite';
import { exportExcel } from '../../../utils/exportHelpers';
import { useLangField, useT } from '../../../context/LanguageContext';
import { money, type ChartAccount } from '../gl/glApi';
import { GlNotReady, useChartAccounts } from '../gl/glKit';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { Zero } from './StatementBits';
import { useGlSnapshots, useRoleAccountId } from './glSnapshots';

type Column = { key: string; label: string; code?: string; opening: number; profit: number; increase: number; decrease: number };

const cell = (value: number) => (Math.abs(value) >= 0.005 ? money(value) : <Zero />);

/**
 * ໃບລາຍງານການປ່ຽນແປງທຶນ (Statement of changes in equity — ກົດໝາຍບັນຊີ ມາດຕາ 31, IFRS for SMEs ພາກ 6).
 * ຖັນ = ແຕ່ລະບັນຊີທຶນ (ກຸ່ມ 3) ທີ່ມີຍອດ; ຖັນ "ກຳໄລສະສົມ" = ບັນຊີກຳໄລສະສົມ + ກຳໄລທີ່ຍັງບໍ່ໂອນ (ລາຍຮັບ − ລາຍຈ່າຍ ທັງໝົດກ່ອນ/ໃນງວດ)
 * ຄືໃບສະຫຼຸບຊັບສົມບັດ — ຍອດທ້າຍງວດຈຶ່ງກົງກັບ ທຶນທັງໝົດ ໃນໃບສະຫຼຸບຊັບສົມບັດ ສະເໝີ.
 * ແຖວ: ຍອດຕົ້ນງວດ → ກຳໄລ (ຂາດທຶນ) ສຸດທິ → ເພີ່ມທຶນ / ເພີ່ມຂຶ້ນ (ມີ) → ປັນຜົນ / ຖອນ / ຫຼຸດລົງ (ໜີ້) → ຍອດທ້າຍງວດ
 */
const EquityChanges = ({ data }: { data: StatementData }) => {
  const t = useT();
  const lf = useLangField();
  const { range } = data;
  const { rows: accounts, notReady: chartNotReady, loading: chartLoading } = useChartAccounts();
  const reAccountId = useRoleAccountId('RETAINED_EARNINGS');
  const { data: snaps, error, notReady } = useGlSnapshots({ period: { start: range.start, end: range.end } });

  const columns = useMemo(() => {
    if (!snaps || chartLoading || reAccountId === undefined) return null;
    const snap = snaps.period;
    const postable = accounts.filter((a) => Number(a.is_postable) === 1);
    // ບັນຊີທຶນ: ມີ − ໜີ້ = ເພີ່ມທຶນ
    const of = (a: ChartAccount) => {
      const b = snap.get(a._uuid);
      return { opening: -(b?.opening ?? 0), increase: b?.credit ?? 0, decrease: -(b?.debit ?? 0) };
    };
    const reAccount = postable.find((a) => a._uuid === reAccountId)
      ?? postable.find((a) => Number(a.account_group) === 3 && a.account_code === '3200');
    // ກຳໄລທີ່ຍັງບໍ່ໂອນ: ກ່ອນຕົ້ນງວດ → ຍອດຕົ້ນງວດ, ໃນງວດ → ກຳໄລ (ຂາດທຶນ) ສຸດທິ
    const pnl = postable.filter((a) => Number(a.account_group) >= 4);
    const priorProfit = -pnl.reduce((n, a) => n + (snap.get(a._uuid)?.opening ?? 0), 0);
    const profit = pnl.reduce((n, a) => n + (snap.get(a._uuid)?.credit ?? 0) - (snap.get(a._uuid)?.debit ?? 0), 0);

    const re = reAccount ? of(reAccount) : { opening: 0, increase: 0, decrease: 0 };
    const retained: Column = {
      key: 'retained', label: reAccount ? lf(reAccount, 'name') : t('glBsPriorEarnings'), code: reAccount?.account_code,
      opening: re.opening + priorProfit, profit, increase: re.increase, decrease: re.decrease,
    };
    const others: Column[] = postable
      .filter((a) => Number(a.account_group) === 3 && a._uuid !== reAccount?._uuid)
      .map((a) => ({ key: String(a._uuid), label: lf(a, 'name'), code: a.account_code, profit: 0, ...of(a) }))
      .filter((c) => [c.opening, c.increase, c.decrease].some((v) => Math.abs(v) >= 0.005));
    return [...others, retained];
  }, [snaps, accounts, chartLoading, reAccountId, lf, t]);

  if (notReady || chartNotReady) return <GlNotReady />;
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;
  if (!columns) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const closing = (c: Column) => c.opening + c.profit + c.increase + c.decrease;
  const total = (pick: (c: Column) => number) => columns.reduce((n, c) => n + pick(c), 0);
  const startText = range.start.clone().subtract(1, 'day').format('DD/MM/YYYY');
  const endText = range.end.format('DD/MM/YYYY');
  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${endText}`;
  const rows: { key: string; label: string; pick: (c: Column) => number; className?: string }[] = [
    { key: 'opening', label: `${t('fsEqOpening')} ${startText}`, pick: (c) => c.opening, className: 'is-subtotal is-light' },
    { key: 'profit', label: t('fsEqProfit'), pick: (c) => c.profit },
    { key: 'increase', label: t('fsEqIncrease'), pick: (c) => c.increase },
    { key: 'decrease', label: t('fsEqDecrease'), pick: (c) => c.decrease },
    { key: 'closing', label: `${t('fsEqClosing')} ${endText}`, pick: closing, className: 'is-total' },
  ];

  const exportRows = () => {
    exportExcel(rows.map((r) => ({
      [t('fsItem')]: r.label,
      ...Object.fromEntries(columns.map((c) => [`${c.code ? `${c.code} ` : ''}${c.label}`, r.pick(c)])),
      [t('total')]: total(r.pick),
    })), `equity-changes_${range.end.format('YYYY-MM-DD')}`, `${t('fsEquityChanges')} ${rangeText} (LAK)`);
  };

  return (
    <>
      <div className="acc-rp-kpis">
        <div className="acc-rp-kpi is-main">
          <small>{t('glBsTotalEquity')} · {endText}</small>
          <b>₭ {money(total(closing))}</b>
          <em className="is-flat">{t('fsEqOpening')} ₭ {money(total((c) => c.opening))}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsEqProfit')}</small>
          <b className={total((c) => c.profit) < 0 ? 'is-out' : 'is-in'}>₭ {money(total((c) => c.profit))}</b>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsEqIncrease')}</small>
          <b className="is-in">₭ {money(total((c) => c.increase))}</b>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsEqDecrease')}</small>
          <b className="is-out">₭ {money(total((c) => c.decrease))}</b>
        </div>
      </div>

      <StatementDoc title={t('fsEquityChanges')} period={rangeText} unit="LAK" onExcel={exportRows} note={<p>{t('fsEqNote')}</p>}>
        <div className="acc-rp-scroll">
          <table className="acc-fs-table acc-fs-equity">
            <thead>
              <tr>
                <th>{t('fsItem')}</th>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}{c.code && <small>{c.code}</small>}</th>
                ))}
                <th>{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={r.className ?? 'is-line'}>
                  <td className={r.className ? '' : 'is-indent'}>{r.label}</td>
                  {columns.map((c) => <td key={c.key}>{cell(r.pick(c))}</td>)}
                  <td><b>{cell(total(r.pick))}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StatementDoc>
    </>
  );
};

export default EquityChanges;
