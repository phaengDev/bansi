import moment from 'moment';
import { formatNumber } from '../../../utils/configApi';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import { changeOf, trendOf, type Entry } from '../journal/reportData';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { acct, linesByCategory, netOf, sumLines, within, type Line } from './statementData';
import { Change, KpiDelta, PlotFrame, SectionRow, Share, amount, niceAxis } from './StatementBits';

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
  // ຍັງບໍ່ມີ → ຕາມປະເພດລາຍຮັບ-ລາຍຈ່າຍ ຂອງສະກຸນທີ່ເລືອກ ຄືເດີມ (ໜ້າຫຼັກບັງຄັບສະກຸນເປັນ LAK ເມື່ອມີ gl)
  const { gl } = data;
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
  const axis = niceAxis(0, Math.max(1, ...inTrend.slots.map((s) => s.total), ...outTrend.slots.map((s) => s.total)));
  const todayKey = moment().format(inTrend.daily ? 'YYYY-MM-DD' : 'YYYY-MM');
  const future = inTrend.slots.findIndex((s) => s.key > todayKey);

  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${range.end.format('DD/MM/YYYY')}`;
  const prevText = `${prev.start.format('DD/MM/YYYY')} – ${prev.end.format('DD/MM/YYYY')}`;
  const pct = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

  const noCurrent = !revenue.current && !expense.current && !!(revenue.previous || expense.previous);

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
          <KpiDelta current={revenue.current} previous={revenue.previous} good />
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsTotalExpenses')}</small>
          <b className="is-out">{sym} {formatNumber(expense.current)}</b>
          <KpiDelta current={expense.current} previous={expense.previous} good={false} />
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
        <PlotFrame ticks={axis.ticks} labels={inTrend.slots.map((s) => s.label)} future={future < 0 ? undefined : future}>
          <div className="acc-fs-pairs" style={{ gridTemplateColumns: `repeat(${inTrend.slots.length}, minmax(0, 1fr))` }}>
            {inTrend.slots.map((s, i) => {
              const out = outTrend.slots[i];
              const tip = `${s.tip} · +${formatNumber(s.total)} / −${formatNumber(out.total)} = ${acct(s.total - out.total)}`;
              const height = (v: number) => (v ? `max(2px, ${(v / axis.max) * 100}%)` : 0);
              return (
                <span key={s.key} className={`acc-fs-pair${i >= inTrend.slots.length / 2 ? ' is-late' : ''}`}
                  data-tip={tip} aria-label={tip} tabIndex={s.count || out.count ? 0 : -1}
                >
                  <i className="is-in" style={{ height: height(s.total) }} />
                  <i className="is-out" style={{ height: height(out.total) }} />
                </span>
              );
            })}
          </div>
        </PlotFrame>
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
              <SectionRow tone="in" icon="fa-arrow-trend-up" label={t('fsRevenue')} count={revenueLines.length} span={5} />
              {renderLines(revenueLines, revenue.current, true)}
              <tr className="is-subtotal">
                <td>{t('fsTotalRevenue')}</td>
                <td>{acct(revenue.current)}</td>
                <td />
                <td className="is-previous">{acct(revenue.previous)}</td>
                <Change current={revenue.current} previous={revenue.previous} good />
              </tr>

              <SectionRow tone="out" icon="fa-arrow-trend-down" label={t('fsExpenses')} count={expenseLines.length} span={5} />
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
