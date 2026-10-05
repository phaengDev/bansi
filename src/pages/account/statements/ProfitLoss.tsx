import { formatNumber } from '../../../utils/configApi';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import { changeOf, trendOf, type Entry } from '../journal/reportData';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { acct, linesByCategory, netOf, sumLines, within, type Line } from './statementData';
import { useGlPnl } from '../gl/useGlPnl';

const Zero = () => <span className="acc-fs-zero">–</span>;

/** ຕົວເລກແຖວລາຍການ — 0 ສະແດງເປັນຂີດ ຕາມແບບໃບລາຍງານບັນຊີ */
const amount = (value: number) => (value ? acct(value) : <Zero />);

/** ປ່ຽນແປງ = ຜົນຕ່າງ + % ທຽບງວດກ່ອນ — good = ເພີ່ມຂຶ້ນແມ່ນດີບໍ່ (ລາຍຮັບ/ກຳໄລ ແມ່ນ, ລາຍຈ່າຍ ບໍ່ແມ່ນ) */
const Change = ({ current, previous, good }: { current: number; previous: number; good: boolean }) => {
  const t = useT();
  const diff = current - previous;
  if (!diff) return <td className="acc-fs-change"><Zero /></td>;
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

/** ສັດສ່ວນຂອງແຖວໃນຍອດລວມໝວດ (ງວດນີ້) */
const Share = ({ value, total }: { value: number; total: number }) => {
  if (!value || total <= 0) return <td className="acc-fs-share"><Zero /></td>;
  const pct = (value / total) * 100;
  return (
    <td className="acc-fs-share">
      <span className="acc-fs-share-bar"><i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></span>
      {pct.toFixed(1)}%
    </td>
  );
};

/**
 * ໃບລາຍງານຜົນດຳເນີນງານ (ກຳໄລ-ຂາດທຶນ) — ລາຍຮັບ − ລາຍຈ່າຍ ແຍກຕາມປະເພດ, ທຽບຊ່ວງກ່ອນ.
 * ຍອດບໍ່ລວມອາກອນ (ອາກອນສະແດງແຍກໃນໝາຍເຫດ). ເທິງໃບມີຕົວເລກສະຫຼຸບ ແລະ ກຣາຟລາຍຮັບ-ລາຍຈ່າຍຕາມເວລາ (ບໍ່ພິມ)
 */
const ProfitLoss = ({ data }: { data: StatementData }) => {
  const t = useT();
  const { range, prev, currency, symbol } = data;
  const inCur = (e: Entry) => e.active && e.currency.key === currency;
  const incomes = data.incomes.filter(inCur);
  const expenses = data.expenses.filter(inCur);

  // ລະບົບບັນຊີຄູ່ມີລາຍການແລ້ວ → ແຖວຕາມບັນຊີໃນຜັງ (LAK, ລວມບັນທຶກທົ່ວໄປ ເຊັ່ນ ຄ່າຫຼຸ້ຍຫ້ຽນ);
  // ຍັງບໍ່ມີ → ຕາມປະເພດລາຍຮັບ-ລາຍຈ່າຍ ຂອງສະກຸນທີ່ເລືອກ ຄືເດີມ
  const gl = useGlPnl(range, prev);
  const unit = gl ? 'LAK' : currency ?? '';
  const sym = gl ? '₭' : symbol;
  const revenueLines = gl ? gl.revenue : linesByCategory(incomes, range, prev, netOf, t('notSpecified'));
  const expenseLines = gl ? gl.expense : linesByCategory(expenses, range, prev, netOf, t('notSpecified'));
  const revenue = sumLines(revenueLines);
  const expense = sumLines(expenseLines);
  const profit = { current: revenue.current - expense.current, previous: revenue.previous - expense.previous };
  const margin = (p: number, r: number) => (r ? (p / r) * 100 : null);
  const marginNow = margin(profit.current, revenue.current);
  const marginPrev = margin(profit.previous, revenue.previous);
  const taxIn = incomes.filter((e) => within(e.date, range)).reduce((n, e) => n + e.tax, 0);
  const taxOut = expenses.filter((e) => within(e.date, range)).reduce((n, e) => n + e.tax, 0);

  // ກຣາຟ: ລາຍຮັບ ແລະ ລາຍຈ່າຍ (ສຸດທິ) ໃນຊ່ອງເວລາດຽວກັນ
  const asNet = (list: Entry[]) => list.filter((e) => within(e.date, range)).map((e) => ({ ...e, amount: netOf(e) }));
  const inTrend = trendOf(asNet(incomes), range);
  const outTrend = trendOf(asNet(expenses), range);
  const peak = Math.max(1, ...inTrend.slots.map((s) => s.total), ...outTrend.slots.map((s) => s.total));
  const labelEvery = inTrend.slots.length > 16 ? 5 : 1;

  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${range.end.format('DD/MM/YYYY')}`;
  const prevText = `${prev.start.format('DD/MM/YYYY')} – ${prev.end.format('DD/MM/YYYY')}`;
  const pct = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

  const noCurrent = !revenue.current && !expense.current && !!(revenue.previous || expense.previous);

  /** ຫົວໝວດ — ແຖບສີ: ລາຍຮັບ ຂຽວ, ລາຍຈ່າຍ ແດງ */
  const renderSection = (tone: 'in' | 'out', label: string, count: number) => (
    <tr className={`is-section is-${tone}`}>
      <td colSpan={5}>
        <span className="acc-fs-section">
          <i className={`fa-solid ${tone === 'in' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} />
          {label}
          {count > 0 && <small>{count}</small>}
        </span>
      </td>
    </tr>
  );

  const renderLines = (lines: Line[], total: number, good: boolean) =>
    lines.length ? lines.map((l) => (
      <tr key={l.key} className={`is-line is-${good ? 'in' : 'out'}`}>
        <td className="is-indent">{l.code && <span className="acc-fs-code">{l.code}</span>}{l.label}</td>
        <td>{amount(l.current)}</td>
        <Share value={l.current} total={total} />
        <td className="is-previous">{amount(l.previous)}</td>
        <Change current={l.current} previous={l.previous} good={good} />
      </tr>
    )) : (
      <tr className="is-empty"><td className="is-indent" colSpan={5}>{t('rpEmpty')}</td></tr>
    );

  const exportRows = () => {
    const col = { item: t('fsItem'), now: rangeText, before: prevText, change: t('fsChange') };
    const row = (label: string, now: number | string, before: number | string, change = '') =>
      ({ [col.item]: label, [col.now]: now, [col.before]: before, [col.change]: change });
    const changeText = (a: number, b: number) => {
      const c = changeOf(a, b);
      return c === null ? '' : `${c.toFixed(1)}%`;
    };
    const lineRows = (lines: Line[]) =>
      lines.map((l) => row(`   ${[l.code, l.label].filter(Boolean).join(' ')}`, l.current, l.previous, changeText(l.current, l.previous)));
    exportExcel([
      row(t('fsRevenue'), '', ''),
      ...lineRows(revenueLines),
      row(t('fsTotalRevenue'), revenue.current, revenue.previous, changeText(revenue.current, revenue.previous)),
      row(t('fsExpenses'), '', ''),
      ...lineRows(expenseLines),
      row(t('fsTotalExpenses'), expense.current, expense.previous, changeText(expense.current, expense.previous)),
      row(t('fsNetProfit'), profit.current, profit.previous, changeText(profit.current, profit.previous)),
      row(t('fsMargin'), pct(marginNow), pct(marginPrev)),
    ], `profit-loss_${range.start.format('YYYY-MM-DD')}_${range.end.format('YYYY-MM-DD')}`,
    `${t('fsProfitLoss')} ${rangeText} (${unit})`);
  };

  return (
    <>
      {/* ---- ຕົວເລກສະຫຼຸບ ---- */}
      <div className="acc-rp-kpis">
        <div className={`acc-rp-kpi is-main${profit.current < 0 ? ' is-loss' : ''}`}>
          <small>{t(profit.current < 0 ? 'fsNetLoss' : 'fsNetProfit')}</small>
          <b>{sym} {acct(profit.current)}</b>
          <em>{t('fsMargin')} {pct(marginNow)}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsTotalRevenue')}</small>
          <b className="is-in">{sym} {formatNumber(revenue.current)}</b>
          <em className="is-flat">{t('rpVsPrevious')} {formatNumber(revenue.previous)}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsTotalExpenses')}</small>
          <b className="is-out">{sym} {formatNumber(expense.current)}</b>
          <em className="is-flat">{t('rpVsPrevious')} {formatNumber(expense.previous)}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsExpenseRatio')}</small>
          <b>{pct(revenue.current ? (expense.current / revenue.current) * 100 : null)}</b>
          <em className="is-flat">{t('fsExpenseRatioHint')}</em>
        </div>
      </div>

      {/* ---- ລາຍຮັບ-ລາຍຈ່າຍ ຕາມເວລາ ---- */}
      <section className="acc-rp-card">
        <header>
          <h4><i className="fa-solid fa-chart-column" /> {t(inTrend.daily ? 'fsTrendDaily' : 'fsTrendMonthly')}</h4>
          <small className="acc-fs-legend">
            <span><i className="is-in" /> {t('fsRevenue')}</span>
            <span><i className="is-out" /> {t('fsExpenses')}</span>
          </small>
        </header>
        <span className="acc-rp-tick">{formatNumber(peak)}</span>
        <div className="acc-fs-pairs" style={{ gridTemplateColumns: `repeat(${inTrend.slots.length}, minmax(0, 1fr))` }}>
          {inTrend.slots.map((s, i) => {
            const out = outTrend.slots[i];
            const tip = `${s.tip} · +${formatNumber(s.total)} / −${formatNumber(out.total)} = ${acct(s.total - out.total)}`;
            return (
              <span key={s.key} className={`acc-fs-pair${i >= inTrend.slots.length / 2 ? ' is-late' : ''}`}
                data-tip={tip} aria-label={tip} tabIndex={s.count || out.count ? 0 : -1}
              >
                <i className="is-in" style={{ height: s.total ? `max(2px, ${(s.total / peak) * 100}%)` : 0 }} />
                <i className="is-out" style={{ height: out.total ? `max(2px, ${(out.total / peak) * 100}%)` : 0 }} />
              </span>
            );
          })}
        </div>
        <div className="acc-rp-axis" style={{ gridTemplateColumns: `repeat(${inTrend.slots.length}, minmax(0, 1fr))` }}>
          {inTrend.slots.map((s, i) => (
            <span key={s.key}>{i % labelEvery === 0 || i === inTrend.slots.length - 1 ? s.label : ''}</span>
          ))}
        </div>
      </section>

      {/* ---- ໃບລາຍງານ (ສ່ວນທີ່ພິມ) ---- */}
      <StatementDoc
        title={t('fsProfitLoss')}
        period={`${t('fsForPeriod')} ${rangeText}`}
        unit={unit}
        onExcel={exportRows}
        note={<>
          {gl && <p><i className="fa-solid fa-book" /> {t('fsFromLedger')}</p>}
          <p>{t('fsTaxMemo')}: {t('fsTaxOnRevenue')} {formatNumber(taxIn)} · {t('fsTaxOnExpenses')} {formatNumber(taxOut)}</p>
          <p>{t('fsProfitLossNote')}</p>
        </>}
      >
        {noCurrent && (
          <p className="acc-fs-notice no-print">
            <i className="fa-solid fa-circle-info" /> {t('fsNoEntriesThisPeriod')}
          </p>
        )}
        <div className="acc-rp-scroll">
          <table className="acc-fs-table is-compare">
            <colgroup>
              <col />
              <col className="is-num" />
              <col className="is-share" />
              <col className="is-num" />
              <col className="is-change" />
            </colgroup>
            <thead>
              <tr>
                <th>{t('fsItem')}</th>
                <th>{t('fsThisPeriod')}<small>{rangeText}</small></th>
                <th>{t('fsShare')}<small>{t('fsShareHint')}</small></th>
                <th>{t('fsPreviousPeriod')}<small>{prevText}</small></th>
                <th>{t('fsChange')}<small>{t('fsChangeHint')}</small></th>
              </tr>
            </thead>
            <tbody>
              {renderSection('in', t('fsRevenue'), revenueLines.length)}
              {renderLines(revenueLines, revenue.current, true)}
              <tr className="is-subtotal">
                <td>{t('fsTotalRevenue')}</td>
                <td>{acct(revenue.current)}</td>
                <td />
                <td className="is-previous">{acct(revenue.previous)}</td>
                <Change current={revenue.current} previous={revenue.previous} good />
              </tr>

              {renderSection('out', t('fsExpenses'), expenseLines.length)}
              {renderLines(expenseLines, expense.current, false)}
              <tr className="is-subtotal">
                <td>{t('fsTotalExpenses')}</td>
                <td>{acct(expense.current)}</td>
                <td />
                <td className="is-previous">{acct(expense.previous)}</td>
                <Change current={expense.current} previous={expense.previous} good={false} />
              </tr>

              <tr className={`is-total${profit.current < 0 ? ' is-negative' : ''}`}>
                <td>{t('fsNetProfitLoss')}</td>
                <td>{acct(profit.current)}</td>
                <td />
                <td className="is-previous">{acct(profit.previous)}</td>
                <Change current={profit.current} previous={profit.previous} good />
              </tr>
              <tr className="is-ratio">
                <td>{t('fsMargin')}</td>
                <td>{pct(marginNow)}</td>
                <td />
                <td className="is-previous">{pct(marginPrev)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </StatementDoc>
    </>
  );
};

export default ProfitLoss;
