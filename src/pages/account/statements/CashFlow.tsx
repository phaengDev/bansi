import type { ReactNode } from 'react';
import moment from 'moment';
import { formatNumber } from '../../../utils/configApi';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import { changeOf, trendOf, type Entry } from '../journal/reportData';
import { CASH_CLASS_CODE } from '../journal/journalKit';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { accountFlows, acct, linesByCategory, within, type AccountFlow, type Line } from './statementData';
import { Change, KpiDelta, PlotFrame, SectionRow, Zero, amount, niceAxis } from './StatementBits';

type Totals = { opening: number; receipts: number; payments: number; transferNet: number; operating: number; change: number; closing: number };

const totalsOf = (flows: AccountFlow[]): Totals => {
  const sum = (pick: (f: AccountFlow) => number) => flows.reduce((n, f) => n + pick(f), 0);
  const opening = sum((f) => f.opening);
  const closing = sum((f) => f.closing);
  const receipts = sum((f) => f.receipts);
  const payments = sum((f) => f.payments);
  return { opening, closing, receipts, payments, transferNet: sum((f) => f.transferIn - f.transferOut), operating: receipts - payments, change: closing - opening };
};

/** ເງິນເຂົ້າ/ອອກ: ມີຍອດ = +/− ຕົວເລກ, ບໍ່ມີ = ຂີດ */
const signed = (value: number, sign: '+' | '−') => (value ? `${sign}${formatNumber(value)}` : <Zero />);

/**
 * ໃບລາຍງານກະແສເງິນສົດ (ວິທີກົງ) — ເງິນສົດ ແລະ ເງິນຝາກ ຕົ້ນງວດ + ເງິນຮັບ (ລາຍຮັບ ຕາມປະເພດ) − ເງິນຈ່າຍ (ລາຍຈ່າຍ ຕາມປະເພດ)
 * = ທ້າຍງວດ, ທຽບງວດກ່ອນ; ແລ້ວແຍກຕາມບັນຊີ (ຕົ້ນງວດ / ຮັບ / ຈ່າຍ / ໂອນເຂົ້າ / ໂອນອອກ / ທ້າຍງວດ). ຍອດເງິນແທ້ທີ່ເຂົ້າ-ອອກ (ລວມອາກອນ).
 * ຍອດຕົ້ນ/ທ້າຍງວດ ຄິດຍ້ອນຈາກຍອດປັດຈຸບັນຂອງບັນຊີ (ເບິ່ງ accountFlows). ເທິງໃບມີກຣາບຍອດເງິນຕາມເວລາ (ບໍ່ພິມ)
 */
const CashFlow = ({ data }: { data: StatementData }) => {
  const t = useT();
  const { range, prev, currency, symbol } = data;
  // ເງິນເຂົ້າ = ລາຍຮັບ + ຮັບຊຳລະຈາກລູກໜີ້, ເງິນອອກ = ລາຍຈ່າຍ + ຈ່າຍຊຳລະເຈົ້າໜີ້
  const inflows = [...data.incomes, ...data.receipts];
  const outflows = [...data.expenses, ...data.payments];
  const flows = accountFlows(data.accounts, inflows, outflows, data.transfers, range, currency);
  const now = totalsOf(flows);
  const before = totalsOf(accountFlows(data.accounts, inflows, outflows, data.transfers, prev, currency));
  // ນັບສະເພາະລາຍການຂອງບັນຊີທີ່ຢູ່ໃນໃບ — ຍອດຕົ້ນ + ຮັບ − ຈ່າຍ ± ໂອນ ຈຶ່ງເທົ່າທ້າຍງວດພໍດີ
  const ids = new Set(flows.map((f) => f.account._uuid));
  const ofAccounts = (e: Entry) => e.active && !!e.account && ids.has(e.account.id);
  const ins = inflows.filter(ofAccounts);
  const outs = outflows.filter(ofAccounts);
  const receiptLines = linesByCategory(ins, range, prev, (e) => e.amount, t('notSpecified'));
  const paymentLines = linesByCategory(outs, range, prev, (e) => e.amount, t('notSpecified'));

  // ກຣາບ: ຍອດເງິນລວມທ້າຍແຕ່ລະຊ່ອງເວລາ = ຕົ້ນງວດ + ສະສົມ (ຮັບ − ຈ່າຍ ± ໂອນ); ຊ່ອງທີ່ຍັງບໍ່ຮອດ ບໍ່ແຕ້ມ
  const inTrend = trendOf(ins.filter((e) => within(e.date, range)), range);
  const outTrend = trendOf(outs.filter((e) => within(e.date, range)), range);
  const fmt = inTrend.daily ? 'YYYY-MM-DD' : 'YYYY-MM';
  const moves = new Map<string, number>();
  data.transfers.forEach((tr) => {
    const date = moment(tr.createdAt);
    if (!within(date, range)) return;
    const amount = Number(tr.balance_transfer) || 0;
    const sign = (ids.has(Number(tr.account_inid)) ? 1 : 0) - (ids.has(Number(tr.account_outid)) ? 1 : 0);
    if (sign) moves.set(date.format(fmt), (moves.get(date.format(fmt)) ?? 0) + sign * amount);
  });
  const todayKey = moment().format(fmt);
  const future = inTrend.slots.findIndex((s) => s.key > todayKey);
  const shown = future < 0 ? inTrend.slots.length : future;
  type Point = { key: string; tip: string; balance: number; in: number; out: number; moved: number };
  const points = inTrend.slots.slice(0, shown).reduce<Point[]>((list, s, i) => {
    const out = outTrend.slots[i].total;
    const moved = moves.get(s.key) ?? 0;
    const balance = (list.length ? list[list.length - 1].balance : now.opening) + s.total - out + moved;
    return [...list, { key: s.key, tip: s.tip, balance, in: s.total, out, moved }];
  }, []);
  // ແກນບໍ່ຈຳເປັນເລີ່ມ 0 (ເສັ້ນ) — ເຜື່ອຂອບ 10% ໃຫ້ເຫັນການຂຶ້ນລົງ, ບໍ່ລົງຕ່ຳກວ່າ 0 ຖ້າຍອດບໍ່ຕິດລົບ
  const values = [now.opening, ...points.map((p) => p.balance)];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.05 || 1;
  const axis = niceAxis(lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad);
  const n = inTrend.slots.length;
  const xOf = (i: number) => ((i + 0.5) / n) * 100;
  const yOf = (v: number) => (1 - (v - axis.min) / (axis.max - axis.min)) * 100;
  const line = points.map((p, i) => `${xOf(i)},${yOf(p.balance)}`).join(' ');
  const area = points.length ? `${xOf(0)},100 ${line} ${xOf(points.length - 1)},100` : '';

  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${range.end.format('DD/MM/YYYY')}`;
  const prevText = `${prev.start.format('DD/MM/YYYY')} – ${prev.end.format('DD/MM/YYYY')}`;
  const startText = range.start.format('DD/MM/YYYY');
  const endText = range.end.format('DD/MM/YYYY');
  const countIn = (list: Entry[]) => list.filter((e) => within(e.date, range)).length;

  /** ແຖວລາຍການ — ເງິນຈ່າຍສະແດງຕິດລົບ (ໃນວົງເລັບ), ປ່ຽນແປງທຽບຂະໜາດ (ຈ່າຍເພີ່ມ = ບໍ່ດີ) */
  const renderLines = (lines: Line[], negative: boolean) =>
    lines.length ? lines.map((l) => (
      <tr key={l.key} className={`is-line is-${negative ? 'out' : 'in'}`}>
        <td className="is-indent">{l.code && <span className="acc-fs-code">{l.code}</span>}{l.label}</td>
        <td>{amount(negative ? -l.current : l.current)}</td>
        <td className="is-previous">{amount(negative ? -l.previous : l.previous)}</td>
        <Change current={l.current} previous={l.previous} good={!negative} />
      </tr>
    )) : (
      <tr className="is-empty"><td className="is-indent" colSpan={4}>{t('rpEmpty')}</td></tr>
    );

  const totalRow = (className: string, label: ReactNode, a: number, b: number, good = true) => (
    <tr className={className}>
      <td>{label}</td>
      <td>{acct(a)}</td>
      <td className="is-previous">{acct(b)}</td>
      <Change current={a} previous={b} good={good} />
    </tr>
  );

  const bankOf = (a: TreasuryAccount) =>
    a.banks?.abbr || a.banks?.name_la || t(a.treasury?.types?.type_code === CASH_CLASS_CODE ? 'incomeReceiveCash' : 'treasuryNoBank');

  const exportRows = () => {
    const col = { item: t('fsItem'), now: rangeText, before: prevText, change: t('fsChange') };
    const row = (label: string, a: number | string = '', b: number | string = '', c = '') => ({ [col.item]: label, [col.now]: a, [col.before]: b, [col.change]: c });
    const pct = (a: number, b: number) => {
      const c = changeOf(a, b);
      return c === null ? '' : `${c.toFixed(1)}%`;
    };
    const lineRows = (lines: Line[], negative: boolean) =>
      lines.map((l) => row(`      ${[l.code, l.label].filter(Boolean).join(' ')}`, negative ? -l.current : l.current, negative ? -l.previous : l.previous, pct(l.current, l.previous)));
    const statement = [
      row(t('fsCashOpening'), now.opening, before.opening, pct(now.opening, before.opening)),
      row(t('fsOperating')),
      row(`   ${t('fsReceipts')}`),
      ...lineRows(receiptLines, false),
      row(`   ${t('fsTotalReceipts')}`, now.receipts, before.receipts, pct(now.receipts, before.receipts)),
      row(`   ${t('fsPayments')}`),
      ...lineRows(paymentLines, true),
      row(`   ${t('fsTotalPayments')}`, -now.payments, -before.payments, pct(now.payments, before.payments)),
      row(t('fsNetOperating'), now.operating, before.operating),
      ...(now.transferNet || before.transferNet ? [row(t('fsTransferNet'), now.transferNet, before.transferNet)] : []),
      row(t('fsNetChange'), now.change, before.change),
      row(t('fsCashClosing'), now.closing, before.closing, pct(now.closing, before.closing)),
      row(''),
      row(t('fsByAccount')),
      ...flows.map((f) => row(
        `   ${bankOf(f.account)} · ${f.account.acountName}: ${t('fsOpening')} ${formatNumber(f.opening)} · +${formatNumber(f.receipts + f.transferIn)} · −${formatNumber(f.payments + f.transferOut)}`,
        f.closing,
      )),
    ];
    exportExcel(statement, `cash-flow_${range.start.format('YYYY-MM-DD')}_${range.end.format('YYYY-MM-DD')}`,
      `${t('fsCashFlow')} ${rangeText} (${currency ?? ''})`);
  };

  return (
    <>
      {/* ---- ຕົວເລກສະຫຼຸບ: ຕົ້ນງວດ + ຮັບ − ຈ່າຍ = ທ້າຍງວດ ---- */}
      <div className="acc-rp-kpis acc-fs-flow-kpis">
        <div className="acc-rp-kpi">
          <small>{t('fsCashOpening')}</small>
          <b>{symbol} {acct(now.opening)}</b>
          <em className="is-flat">{startText}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsTotalReceipts')} · {countIn(ins)} {t('incomeItems')}</small>
          <b className="is-in">+{formatNumber(now.receipts)}</b>
          <KpiDelta current={now.receipts} previous={before.receipts} good />
        </div>
        <div className="acc-rp-kpi">
          <small>{t('fsTotalPayments')} · {countIn(outs)} {t('incomeItems')}</small>
          <b className="is-out">−{formatNumber(now.payments)}</b>
          <KpiDelta current={now.payments} previous={before.payments} good={false} />
        </div>
        <div className={`acc-rp-kpi is-main${now.closing < 0 ? ' is-loss' : ''}`}>
          <small>{t('fsCashClosing')}</small>
          <b>{symbol} {acct(now.closing)}</b>
          <em>{now.change >= 0 ? '+' : '−'}{formatNumber(Math.abs(now.change))} · {endText}</em>
        </div>
      </div>

      {/* ---- ຍອດເງິນຕາມເວລາ ---- */}
      <section className="acc-rp-card">
        <header>
          <h4><i className="fa-solid fa-chart-line" /> {t(inTrend.daily ? 'fsBalanceTrendDaily' : 'fsBalanceTrendMonthly')}</h4>
          <small className="acc-fs-legend">
            <span><i className="is-line" /> {t(inTrend.daily ? 'fsBalanceLine' : 'fsBalanceLineMonth')}</span>
          </small>
        </header>
        <PlotFrame ticks={axis.ticks} labels={inTrend.slots.map((s) => s.label)} future={future < 0 ? undefined : future}>
          <svg className="acc-fs-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="acc-fs-line-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0e9f86" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#0e9f86" stopOpacity="0" />
              </linearGradient>
            </defs>
            {area && <polygon points={area} fill="url(#acc-fs-line-fill)" />}
            {line && <polyline points={line} fill="none" stroke="#0e9f86" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
          </svg>
          <div className="acc-fs-hits" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {inTrend.slots.map((s, i) => {
              const p = points[i];
              if (!p) return <span key={s.key} />;
              const tip = `${p.tip} · ${acct(p.balance)}${p.in ? ` · +${formatNumber(p.in)}` : ''}${p.out ? ` · −${formatNumber(p.out)}` : ''}${p.moved ? ` · ${t('fsTransferNet')} ${acct(p.moved)}` : ''}`;
              return (
                <span key={s.key} className={`acc-fs-hit${i >= n / 2 ? ' is-late' : ''}${p.in || p.out || p.moved ? ' is-moved' : ''}`}
                  data-tip={tip} aria-label={tip} tabIndex={p.in || p.out || p.moved ? 0 : -1}
                >
                  <i style={{ top: `${yOf(p.balance)}%` }} />
                </span>
              );
            })}
          </div>
        </PlotFrame>
      </section>

      {/* ---- ໃບລາຍງານ (ສ່ວນທີ່ພິມ) ---- */}
      <StatementDoc
        title={t('fsCashFlow')}
        period={`${t('fsForPeriod')} ${rangeText}`}
        unit={currency ?? ''}
        onExcel={exportRows}
        note={<>
          <p>{t('fsCashFlowNote')}</p>
          <p>{t('fsCashFlowMethod')}</p>
        </>}
      >
        <div className="acc-rp-scroll">
          <table className="acc-fs-table is-compare is-flow">
            <colgroup>
              <col />
              <col className="is-num" />
              <col className="is-num" />
              <col className="is-change" />
            </colgroup>
            <thead>
              <tr>
                <th>{t('fsItem')}</th>
                <th>{t('fsThisPeriod')}<small>{rangeText}</small></th>
                <th>{t('fsPreviousPeriod')}<small>{prevText}</small></th>
                <th>{t('fsChange')}<small>{t('fsChangeHint')}</small></th>
              </tr>
            </thead>
            <tbody>
              {totalRow('is-strong', <>{t('fsCashOpening')} <small>({startText})</small></>, now.opening, before.opening)}

              <SectionRow tone="in" icon="fa-arrow-down" label={t('fsReceipts')} count={receiptLines.length} span={4} />
              {renderLines(receiptLines, false)}
              {totalRow('is-subtotal', t('fsTotalReceipts'), now.receipts, before.receipts)}

              <SectionRow tone="out" icon="fa-arrow-up" label={t('fsPayments')} count={paymentLines.length} span={4} />
              {renderLines(paymentLines, true)}
              <tr className="is-subtotal">
                <td>{t('fsTotalPayments')}</td>
                <td>{acct(-now.payments)}</td>
                <td className="is-previous">{acct(-before.payments)}</td>
                <Change current={now.payments} previous={before.payments} good={false} />
              </tr>

              {totalRow('is-subtotal is-gap', t('fsNetOperating'), now.operating, before.operating)}
              {(now.transferNet !== 0 || before.transferNet !== 0) && totalRow('is-plain', t('fsTransferNet'), now.transferNet, before.transferNet)}
              {totalRow('is-plain', t('fsNetChange'), now.change, before.change)}
              {totalRow(`is-total${now.closing < 0 ? ' is-negative' : ''}`, <>{t('fsCashClosing')} <small>({endText})</small></>, now.closing, before.closing)}
            </tbody>
          </table>
        </div>

        {/* ---- ແຍກຕາມບັນຊີ ---- */}
        <h5 className="acc-fs-subhead"><i className="fa-solid fa-building-columns" /> {t('fsByAccount')}</h5>
        <div className="acc-rp-scroll">
          <table className="acc-fs-table is-accounts">
            <thead>
              <tr>
                <th>{t('fsAccount')}</th>
                <th>{t('fsOpening')}</th>
                <th>{t('fsReceiptsShort')}</th>
                <th>{t('fsPaymentsShort')}</th>
                <th>{t('mvSrcTRANSFER_IN')}</th>
                <th>{t('mvSrcTRANSFER_OUT')}</th>
                <th>{t('fsClosing')}</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.account._uuid}>
                  <td>
                    <span className="acc-fs-account">
                      <span className="acc-rp-share-logo">
                        {f.account.banks?.url ? <img src={f.account.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}
                      </span>
                      <span>
                        <b>{bankOf(f.account)}</b>
                        <small>{[f.account.acountName, f.account.acount_number].filter(Boolean).join(' · ')}</small>
                      </span>
                    </span>
                  </td>
                  <td>{acct(f.opening)}</td>
                  <td className="is-in">{signed(f.receipts, '+')}</td>
                  <td className="is-out">{signed(f.payments, '−')}</td>
                  <td>{signed(f.transferIn, '+')}</td>
                  <td>{signed(f.transferOut, '−')}</td>
                  <td><b>{acct(f.closing)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('total')} · {flows.length} {t('bankAccounts')}</td>
                <td>{acct(now.opening)}</td>
                <td>{signed(now.receipts, '+')}</td>
                <td>{signed(now.payments, '−')}</td>
                <td>{signed(flows.reduce((s, f) => s + f.transferIn, 0), '+')}</td>
                <td>{signed(flows.reduce((s, f) => s + f.transferOut, 0), '−')}</td>
                <td>{acct(now.closing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </StatementDoc>
    </>
  );
};

export default CashFlow;
