import { useEffect, useRef, useState } from 'react';
import { DateRangePicker, Loader, SelectPicker } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { exportExcel } from '../../../utils/exportHelpers';
import { printElementByFrame } from '../../../utils/Print';
import { useT } from '../../../context/LanguageContext';
import IncomeDetail from './IncomeDetail';
import ExpenseDetail from './ExpenseDetail';
import type { Income } from './IncomeForm';
import type { Expense } from './ExpenseForm';
import { formatQty } from './journalKit';
import {
  changeOf, fromExpense, fromIncome, groupSum, previousRange, rangeOf, topItems, trendOf,
  type Bucket, type Entry, type Period, type Range, type ReportKind,
} from './reportData';

type Method = 'all' | 'cash' | 'transfer';

/** ພິມລາຍງານ — A4 ນອນ, ເຊື່ອງຕົວກັ່ນ/ປຸ່ມ (.no-print), ສີພື້ນຂອງແທ່ງກຣາຟຕ້ອງພິມອອກ */
const REPORT_PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  html, body { background: #fff !important; margin: 0; }
  .no-print { display: none !important; }
  .acc-rp { padding: 0 !important; }
  .acc-rp-card, .acc-rp-kpi { box-shadow: none !important; break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/** ແຖບສ່ວນແບ່ງ (ປະເພດ / ບັນຊີ / ຜູ້ໂອນ-ຜູ້ຮັບ) — ຍອດ, % ຂອງທັງໝົດ, ຈຳນວນລາຍການ */
const ShareList = ({ buckets, total, limit = 8, logo = false }: {
  buckets: Bucket[];
  total: number;
  limit?: number;
  logo?: boolean;
}) => {
  const t = useT();
  const shown = buckets.slice(0, limit);
  const rest = buckets.slice(limit);
  const peak = Math.max(1, ...shown.map((b) => b.total));
  return (
    <ul className="acc-rp-share">
      {shown.map((b) => (
        <li key={b.key}>
          <div className="acc-rp-share-head">
            {logo && (
              <span className="acc-rp-share-logo">
                {b.url ? <img src={b.url} alt="" /> : <i className="fa-solid fa-wallet" />}
              </span>
            )}
            <span className="acc-rp-share-label" title={b.label}>
              <b>{b.label}</b>
              <small>{[b.sub, `${b.count} ${t('incomeItems')}`].filter(Boolean).join(' · ')}</small>
            </span>
            <span className="acc-rp-share-amount">
              <b>{formatNumber(b.total)}</b>
              <small>{total ? ((b.total / total) * 100).toFixed(1) : '0.0'}%</small>
            </span>
          </div>
          <span className="acc-rp-share-bar"><i style={{ width: `${(b.total / peak) * 100}%` }} /></span>
        </li>
      ))}
      {rest.length > 0 && (
        <li className="acc-rp-share-rest">
          +{rest.length} · {formatNumber(rest.reduce((n, b) => n + b.total, 0))}
        </li>
      )}
    </ul>
  );
};

/**
 * ລາຍງານລາຍຮັບ / ລາຍຈ່າຍ (ໜ້າຕ່າງ ບັນທຶກບັນຊີປະຈຳວັນ) — ດຶງລາຍການຂອງຊ່ວງທີ່ເລືອກ + ຊ່ວງກ່ອນໜ້າ (ທຽບ %)
 * ແລ້ວສະຫຼຸບຢູ່ໜ້າເວັບ: ຍອດລວມ / ຈຳນວນ / ສະເລ່ຍ / ອາກອນ, ແນວໂນ້ມ (ລາຍວັນ ຫຼື ລາຍເດືອນ), ຕາມປະເພດ, ຕາມບັນຊີ + ວິທີ,
 * ຕາມຜູ້ໂອນ/ຜູ້ຮັບ, ລາຍການຍ່ອຍທີ່ຈ່າຍຫຼາຍສຸດ (ລາຍຈ່າຍ) ແລະ ຕາຕະລາງທຸກລາຍການ (ກົດເປີດໃບ). ນັບສະເພາະທີ່ໃຊ້ງານ,
 * ສະກຸນດຽວຕໍ່ຄັ້ງ (ບວກຂ້າມສະກຸນບໍ່ໄດ້). ສົ່ງອອກ Excel ແລະ ພິມໄດ້
 */
const EntryReport = ({ kind }: { kind: ReportKind }) => {
  const t = useT();
  const isIncome = kind === 'income';
  const reportRef = useRef<HTMLDivElement>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [range, setRange] = useState<Range>(() => rangeOf('month'));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [prevEntries, setPrevEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>('all');
  const [viewing, setViewing] = useState<Entry | null>(null);

  const startKey = range.start.format('YYYY-MM-DD');
  const endKey = range.end.format('YYYY-MM-DD');

  useEffect(() => {
    let cancelled = false;
    const path = isIncome ? '/income/fetch' : '/expense/fetch';
    const convert = (list: any[]) => list.map((r) => (isIncome ? fromIncome(r as Income) : fromExpense(r as Expense)));
    const prev = previousRange(period, range);
    // ສົ່ງເປັນ string "YYYY-MM-DD" — ບໍ່ຜ່ານ interceptor ທີ່ແປງ Date
    const body = (r: Range) => ({ start_date: r.start.format('YYYY-MM-DD'), end_date: r.end.format('YYYY-MM-DD') });
    setLoading(true);
    setError('');
    Promise.all([postApi(path, body(range)), postApi(path, body(prev))])
      .then(([cur, before]) => {
        if (cancelled) return;
        setEntries(convert(cur.data?.data ?? []));
        setPrevEntries(convert(before.data?.data ?? []));
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, startKey, endKey]);

  const pickPeriod = (value: Exclude<Period, 'custom'>) => {
    setPeriod(value);
    setRange(rangeOf(value));
  };

  // ---- ສະກຸນເງິນ: ເລືອກໄດ້ເມື່ອມີຫຼາຍສະກຸນ, ຄ່າຕັ້ງຕົ້ນ = ສະກຸນທີ່ມີລາຍການຫຼາຍສຸດ ----
  const active = entries.filter((e) => e.active);
  const currencies = [...new Map(active.map((e) => [e.currency.key, e.currency])).values()]
    .map((c) => ({ ...c, count: active.filter((e) => e.currency.key === c.key).length }))
    .sort((a, b) => b.count - a.count);
  const curKey = currency && currencies.some((c) => c.key === currency) ? currency : currencies[0]?.key ?? null;
  const symbol = currencies.find((c) => c.key === curKey)?.symbol ?? '';
  const money = (value: number) => `${symbol} ${formatNumber(value)}`.trim();

  const matches = (e: Entry) =>
    e.active
    && (!curKey || e.currency.key === curKey)
    && (categoryId == null || (e.category?.id ?? 0) === categoryId)
    && (accountId == null || e.account?.id === accountId)
    && (method === 'all' || (method === 'transfer') === e.transfer);
  const shown = entries.filter(matches).sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.id - a.id);
  const prevShown = prevEntries.filter(matches);
  const cancelledCount = entries.filter((e) => !e.active).length;

  const total = shown.reduce((n, e) => n + e.amount, 0);
  const prevTotal = prevShown.reduce((n, e) => n + e.amount, 0);
  const change = changeOf(total, prevTotal);
  const taxTotal = shown.reduce((n, e) => n + e.tax, 0);
  const average = shown.length ? total / shown.length : 0;
  const itemCount = shown.reduce((n, e) => n + e.items.length, 0);

  // ---- ສ່ວນແບ່ງ ----
  const byCategory = groupSum(shown, (e) => ({
    key: String(e.category?.id ?? 0),
    label: e.category ? `${e.category.code} · ${e.category.name}` : t('notSpecified'),
  }));
  const byAccount = groupSum(shown, (e) => ({
    key: String(e.account?.id ?? 0),
    label: e.account?.name ?? '—',
    sub: e.account?.bank ?? t('treasuryNoBank'),
    url: e.account?.url,
  }));
  const byParty = groupSum(shown.filter((e) => e.party), (e) => ({ key: e.party!.toLowerCase(), label: e.party! }));
  const cashTotal = shown.filter((e) => !e.transfer).reduce((n, e) => n + e.amount, 0);
  const transferTotal = total - cashTotal;
  const items = isIncome ? [] : topItems(shown);

  // ---- ແນວໂນ້ມ ----
  const trend = trendOf(shown, range);
  const peak = Math.max(1, ...trend.slots.map((s) => s.total));
  const slotAvg = trend.slots.length ? total / trend.slots.length : 0;
  const labelEvery = trend.slots.length > 16 ? 5 : 1;

  // ---- ຕົວເລືອກກັ່ນ (ຈາກຂໍ້ມູນໃນຊ່ວງ) ----
  const categoryOptions = groupSum(active, (e) => ({
    key: String(e.category?.id ?? 0),
    label: e.category ? `${e.category.code} · ${e.category.name}` : t('notSpecified'),
  })).map((b) => ({ label: b.label, value: Number(b.key) }));
  const accountOptions = groupSum(active.filter((e) => e.account), (e) => ({
    key: String(e.account!.id),
    label: e.account!.name,
    sub: e.account!.bank ?? undefined,
  })).map((b) => ({ label: b.sub ? `${b.label} (${b.sub})` : b.label, value: Number(b.key) }));

  const title = t(isIncome ? 'journalIncomeReport' : 'journalExpenseReport');
  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${range.end.format('DD/MM/YYYY')}`;
  const periods: { key: Exclude<Period, 'custom'>; label: string }[] = [
    { key: 'month', label: t('mvThisMonth') },
    { key: 'lastMonth', label: t('mvLastMonth') },
    { key: 'quarter', label: t('rpThisQuarter') },
    { key: 'year', label: t('mvThisYear') },
  ];
  const methods: { key: Method; label: string }[] = [
    { key: 'all', label: t('all') },
    { key: 'cash', label: t('incomeReceiveCash') },
    { key: 'transfer', label: t('incomeReceiveTransfer') },
  ];
  const hasFilter = categoryId != null || accountId != null || method !== 'all';

  const exportRows = () => {
    const col = {
      no: '#',
      date: t('mvDate'),
      number: t('rpNumber'),
      title: t(isIncome ? 'incomeTitle' : 'expenseTitle'),
      category: t(isIncome ? 'incomeCategory' : 'expenseCategory'),
      account: t(isIncome ? 'incomeAccount' : 'expenseAccount'),
      method: t(isIncome ? 'incomeReceiveMethod' : 'expensePayMethod'),
      party: t(isIncome ? 'incomeStepPayer' : 'expensePayee'),
      items: t('expenseStepItems'),
      base: t(isIncome ? 'incomeAmount' : 'expenseSubtotal'),
      tax: t('incomeTaxField'),
      total: t(isIncome ? 'incomeTotal' : 'expenseTotal'),
    };
    const rows: Record<string, string | number>[] = shown.map((e, i) => ({
      [col.no]: i + 1,
      [col.date]: e.date.format('DD/MM/YYYY'),
      [col.number]: e.number,
      [col.title]: e.title,
      [col.category]: e.category ? `${e.category.code} ${e.category.name}` : '',
      [col.account]: e.account?.name ?? '',
      [col.method]: t(e.transfer ? 'incomeReceiveTransfer' : 'incomeReceiveCash'),
      [col.party]: e.party ?? '',
      ...(isIncome ? {} : {
        [col.items]: e.items.map((it) => `${it.item_name} ×${formatQty(it.quantity)}${it.unit ? ` ${it.unit}` : ''} = ${formatNumber(it.amount)}`).join('; '),
      }),
      [col.base]: e.base,
      [col.tax]: e.tax,
      [col.total]: e.amount,
    }));
    rows.push({
      [col.no]: '',
      [col.title]: t('total'),
      [col.base]: shown.reduce((n, e) => n + e.base, 0),
      [col.tax]: taxTotal,
      [col.total]: total,
    });
    exportExcel(rows, `${kind}-report_${startKey}_${endKey}`, `${title} ${rangeText}${symbol ? ` (${curKey})` : ''}`);
  };

  const print = () => {
    if (reportRef.current) printElementByFrame(reportRef.current, REPORT_PRINT_CSS);
  };

  const sign = isIncome ? '+' : '−';

  return (
    <div ref={reportRef} className={`acc-rp${isIncome ? '' : ' is-expense'}`}>
      {/* ---- ຫົວ: ຊື່ລາຍງານ + ຊ່ວງ + ສົ່ງອອກ ---- */}
      <header className="acc-rp-head">
        <span className="acc-rp-icon"><i className={`fa-solid ${isIncome ? 'fa-chart-line' : 'fa-chart-pie'}`} /></span>
        <span className="acc-rp-title">
          <h3>{title}</h3>
          <small>{rangeText}{curKey ? ` · ${curKey}` : ''}</small>
        </span>
        <span className="acc-rp-actions no-print">
          <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!shown.length}>
            <i className="fa-solid fa-file-excel" /> Excel
          </button>
          <button type="button" className="acc-rp-btn" onClick={print} disabled={!shown.length}>
            <i className="fa-solid fa-print" /> {t('incomePrintOnly')}
          </button>
        </span>
      </header>

      {/* ---- ຕົວກັ່ນ ---- */}
      <div className="acc-rp-filters no-print">
        <div className="acc-rp-filter-row">
          <div className="acc-type-segment" role="tablist">
            {periods.map((p) => (
              <button key={p.key} type="button" role="tab" aria-selected={period === p.key}
                className={period === p.key ? 'is-active' : ''} onClick={() => pickPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <DateRangePicker
            className="acc-rp-range"
            format="dd/MM/yyyy"
            character=" – "
            cleanable={false}
            placement="bottomEnd"
            value={[range.start.toDate(), range.end.toDate()]}
            onChange={(value) => {
              if (!value) return;
              setPeriod('custom');
              setRange({ start: moment(value[0]).startOf('day'), end: moment(value[1]).endOf('day') });
            }}
          />
        </div>
        <div className="acc-rp-filter-row">
          <div className="acc-rp-select">
            <SelectPicker block data={categoryOptions} value={categoryId} searchable={categoryOptions.length > 8}
              placeholder={t('rpAllCategories')} onChange={(value) => setCategoryId(value as number | null)}
            />
          </div>
          <div className="acc-rp-select">
            <SelectPicker block data={accountOptions} value={accountId} searchable={accountOptions.length > 8}
              placeholder={t('rpAllAccounts')} onChange={(value) => setAccountId(value as number | null)}
            />
          </div>
          <div className="acc-type-segment" role="tablist">
            {methods.map((m) => (
              <button key={m.key} type="button" role="tab" aria-selected={method === m.key}
                className={method === m.key ? 'is-active' : ''} onClick={() => setMethod(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {currencies.length > 1 && (
            <div className="acc-type-segment" role="tablist" aria-label={t('accountTypeCurrency')}>
              {currencies.map((c) => (
                <button key={c.key} type="button" role="tab" aria-selected={curKey === c.key}
                  className={curKey === c.key ? 'is-active' : ''} onClick={() => setCurrency(c.key)}
                >
                  {c.symbol !== c.key ? `${c.symbol} ` : ''}{c.key} <em>{c.count}</em>
                </button>
              ))}
            </div>
          )}
          {hasFilter && (
            <button type="button" className="acc-type-clear" onClick={() => {
              setCategoryId(null);
              setAccountId(null);
              setMethod('all');
            }}
            >
              <i className="fa-solid fa-filter-circle-xmark" /> {t('accountTypeClearFilter')}
            </button>
          )}
        </div>
      </div>

      {loading && !entries.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : error ? (
        <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          {/* ---- ຕົວເລກສຳຄັນ ---- */}
          <div className="acc-rp-kpis">
            <div className="acc-rp-kpi is-main">
              <small>{t(isIncome ? 'rpTotalIncome' : 'rpTotalExpense')}</small>
              <b>{money(total)}</b>
              {change === null ? (
                <em className="is-flat">{t('rpNoPrevious')}</em>
              ) : (
                // ລາຍຮັບເພີ່ມ = ດີ (ຂຽວ), ລາຍຈ່າຍເພີ່ມ = ລະວັງ (ແດງ)
                <em className={(change >= 0) === isIncome ? 'is-good' : 'is-bad'}>
                  <i className={`fa-solid ${change >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} />
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}% {t('rpVsPrevious')} ({formatNumber(prevTotal)})
                </em>
              )}
            </div>
            <div className="acc-rp-kpi">
              <small>{t('rpCount')}</small>
              <b>{formatNumber(shown.length)}</b>
              <em className="is-flat">
                {isIncome
                  ? `${t('incomeReceiveCash')} ${shown.filter((e) => !e.transfer).length} · ${t('incomeReceiveTransfer')} ${shown.filter((e) => e.transfer).length}`
                  : `${itemCount} ${t('rpSubItems')}`}
              </em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('rpAverage')}</small>
              <b>{money(Math.round(average))}</b>
              <em className="is-flat">{t(trend.daily ? 'rpPerDay' : 'rpPerMonth')} {formatNumber(Math.round(slotAvg))}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('rpTaxTotal')}</small>
              <b>{money(taxTotal)}</b>
              <em className="is-flat">{cancelledCount ? `${t('rpCancelledExcluded')} ${cancelledCount}` : ' '}</em>
            </div>
          </div>

          {shown.length ? (
            <>
              {/* ---- ແນວໂນ້ມ ---- */}
              <section className="acc-rp-card">
                <header>
                  <h4><i className="fa-solid fa-chart-column" /> {t(trend.daily ? 'rpTrendDaily' : 'rpTrendMonthly')}</h4>
                  <small><i className="acc-rp-avg-key" /> {t('rpAverageLine')} {formatNumber(Math.round(slotAvg))}</small>
                </header>
                <div className="acc-rp-chart">
                  <span className="acc-rp-tick is-top">{formatNumber(peak)}</span>
                  <div className="acc-rp-bars" style={{ gridTemplateColumns: `repeat(${trend.slots.length}, minmax(0, 1fr))` }}>
                    {slotAvg > 0 && <span className="acc-rp-avg" style={{ bottom: `${(slotAvg / peak) * 100}%` }} />}
                    {trend.slots.map((s, i) => {
                      const tip = `${s.tip} · ${s.count ? `${sign}${formatNumber(s.total)} (${s.count})` : '0'}`;
                      return (
                        <span key={s.key} className={`acc-rp-bar${s.count ? '' : ' is-empty'}${i >= trend.slots.length / 2 ? ' is-late' : ''}`}
                          data-tip={tip} aria-label={tip} tabIndex={s.count ? 0 : -1}
                        >
                          <i style={{ height: s.count ? `max(3px, ${(s.total / peak) * 100}%)` : undefined }} />
                        </span>
                      );
                    })}
                  </div>
                  <div className="acc-rp-axis" style={{ gridTemplateColumns: `repeat(${trend.slots.length}, minmax(0, 1fr))` }}>
                    {trend.slots.map((s, i) => (
                      <span key={s.key}>{i % labelEvery === 0 || i === trend.slots.length - 1 ? s.label : ''}</span>
                    ))}
                  </div>
                </div>
              </section>

              {/* ---- ສ່ວນແບ່ງ ---- */}
              <div className="acc-rp-grid">
                <section className="acc-rp-card">
                  <header><h4><i className="fa-solid fa-tags" /> {t('rpByCategory')}</h4><small>{byCategory.length}</small></header>
                  <ShareList buckets={byCategory} total={total} />
                </section>
                <section className="acc-rp-card">
                  <header><h4><i className="fa-solid fa-wallet" /> {t('rpByAccount')}</h4><small>{byAccount.length}</small></header>
                  {/* ເງິນສົດ / ເງິນໂອນ — ແຖບແບ່ງສອງສ່ວນ */}
                  <div className="acc-rp-split">
                    <span className="acc-rp-split-bar">
                      <i className="is-cash" style={{ width: `${total ? (cashTotal / total) * 100 : 0}%` }} />
                      <i className="is-transfer" style={{ width: `${total ? (transferTotal / total) * 100 : 0}%` }} />
                    </span>
                    <span className="acc-rp-split-legend">
                      <span><i className="is-cash" /> {t('incomeReceiveCash')} <b>{formatNumber(cashTotal)}</b></span>
                      <span><i className="is-transfer" /> {t('incomeReceiveTransfer')} <b>{formatNumber(transferTotal)}</b></span>
                    </span>
                  </div>
                  <ShareList buckets={byAccount} total={total} logo />
                </section>
                {byParty.length > 0 && (
                  <section className="acc-rp-card">
                    <header><h4><i className="fa-solid fa-user-tag" /> {t(isIncome ? 'rpByPayer' : 'rpByPayee')}</h4><small>{byParty.length}</small></header>
                    <ShareList buckets={byParty} total={total} />
                  </section>
                )}
                {items.length > 0 && (
                  <section className="acc-rp-card">
                    <header><h4><i className="fa-solid fa-basket-shopping" /> {t('rpTopItems')}</h4><small>{items.length}</small></header>
                    <table className="acc-rp-table is-compact">
                      <thead>
                        <tr>
                          <th>{t('expenseItemName')}</th>
                          <th>{t('expenseQty')}</th>
                          <th>{t('expenseLineTotal')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it) => (
                          <tr key={`${it.name}|${it.unit ?? ''}`}>
                            <td>{it.name}<small>{it.count} {t('rpTimes')}</small></td>
                            <td>{formatQty(it.qty)}{it.unit ? ` ${it.unit}` : ''}</td>
                            <td>{formatNumber(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}
              </div>

              {/* ---- ທຸກລາຍການ — ກົດແຖວ = ເປີດໃບ (ເບິ່ງຢ່າງດຽວ) ---- */}
              <section className="acc-rp-card">
                <header><h4><i className="fa-solid fa-list" /> {t('rpEntries')}</h4><small>{shown.length}</small></header>
                <div className="acc-rp-scroll">
                  <table className="acc-rp-table">
                    <thead>
                      <tr>
                        <th>{t('mvDate')}</th>
                        <th>{t('rpNumber')}</th>
                        <th>{t(isIncome ? 'incomeTitle' : 'expenseTitle')}</th>
                        <th>{t(isIncome ? 'incomeCategory' : 'expenseCategory')}</th>
                        <th>{t(isIncome ? 'incomeAccount' : 'expenseAccount')}</th>
                        <th>{t('incomeTaxField')}</th>
                        <th>{t(isIncome ? 'incomeTotal' : 'expenseTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((e) => (
                        <tr key={e.id} tabIndex={0} onClick={() => setViewing(e)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter') setViewing(e);
                          }}
                        >
                          <td>{e.date.format('DD/MM/YYYY')}</td>
                          <td><span className="acc-jr-no">{e.number}</span></td>
                          <td>
                            {e.title}
                            {e.party && <small>{e.party}</small>}
                          </td>
                          <td>{e.category ? `${e.category.code} · ${e.category.name}` : '—'}</td>
                          <td>
                            {e.account?.name ?? '—'}
                            <small>{t(e.transfer ? 'incomeReceiveTransfer' : 'incomeReceiveCash')}</small>
                          </td>
                          <td>{e.tax ? formatNumber(e.tax) : '—'}</td>
                          <td>{sign}{formatNumber(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5}>{t('total')} · {shown.length} {t('incomeItems')}</td>
                        <td>{formatNumber(taxTotal)}</td>
                        <td>{money(total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <div className="acc-class-empty">
              <i className={`fa-solid ${isIncome ? 'fa-chart-line' : 'fa-chart-pie'}`} />
              <p>{t('rpEmpty')}</p>
            </div>
          )}
        </div>
      )}

      {viewing && (isIncome
        ? <IncomeDetail income={viewing.raw as Income} onClose={() => setViewing(null)} />
        : <ExpenseDetail expense={viewing.raw as Expense} onClose={() => setViewing(null)} />)}
    </div>
  );
};

export default EntryReport;
