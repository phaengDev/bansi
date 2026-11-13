import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { DateRangePicker, Loader } from 'rsuite';
import moment, { type Moment } from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { compact } from '../statements/StatementBits';
import IncomeDetail from './IncomeDetail';
import ExpenseDetail from './ExpenseDetail';
import type { Income } from './IncomeForm';
import type { Expense } from './ExpenseForm';
import { fromExpense, fromIncome, previousRange, rangeOf, type Entry, type Period, type Range } from './reportData';
import { biggestRise, calendarOf, categoriesOf, daysOf, longestStreak, partiesOf, pctChange, slotsOf, weekdaysOf, within } from './overviewData';
import { CountUp, FlowChart, MoneyCalendar, Sparkline, WeekdayChart, type CalendarMode, type FlowMode } from './OverviewCharts';
import { CategoryCard, DeltaPill, Facts, Leaderboard, RecentFeed, short, type Fact } from './OverviewCards';

const FLOW_MODES = ['bars', 'cumulative', 'net'] as const;
const FLOW_ICONS: Record<FlowMode, string> = { bars: 'fa-chart-column', cumulative: 'fa-chart-line', net: 'fa-arrow-down-up-across-line' };
const CAL_MODES = ['net', 'inc', 'exp'] as const;

/** ຄ່າທີ່ຜູ້ໃຊ້ເລືອກໄວ້ (ແບບກຣາບ) — ອ່ານ/ຂຽນບໍ່ໄດ້ ກໍ່ໃຊ້ຄ່າຕັ້ງຕົ້ນ */
const readPref = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
};
const writePref = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ບໍ່ບັນທຶກກໍ່ບໍ່ເປັນຫຍັງ
  }
};

const order = (i: number): CSSProperties => ({ '--i': i } as CSSProperties);
const createdOf = (e: Entry) => String((e.raw as { createdAt?: string }).createdAt ?? '');

/**
 * ພາບລວມ ລາຍຮັບ-ລາຍຈ່າຍ (ໜ້າທຳອິດຂອງໜ້າຕ່າງ ບັນທຶກບັນຊີປະຈຳວັນ) — ເງິນເຫຼືອ + ອາລົມ, ບັດສະຫຼຸບ, ກຣາບ 3 ແບບ,
 * ຕາມປະເພດ, ປະຕິທິນເງິນ, ມື້ໃນອາທິດ, ຈຸດເດັ່ນ, ອັນດັບ ແລະ ລາຍການລ່າສຸດ. ສະກຸນດຽວຕໍ່ຄັ້ງ, ທຽບງວດກ່ອນ.
 * ຂໍ້ມູນຈາກ /income/fetch + /expense/fetch (ງວດກ່ອນ → ທ້າຍງວດນີ້)
 */
const JournalOverview = ({ onNavigate }: { onNavigate: (key: 'income' | 'expense', create?: boolean) => void }) => {
  const t = useT();
  const [period, setPeriod] = useState<Period>('month');
  const [range, setRange] = useState<Range>(() => rangeOf('month'));
  const [currency, setCurrency] = useState<string | null>(null);
  const [incomes, setIncomes] = useState<Entry[]>([]);
  const [expenses, setExpenses] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [flowMode, setFlowMode] = useState<FlowMode>(() => readPref('joFlowMode', FLOW_MODES, 'bars'));
  const [calMode, setCalMode] = useState<CalendarMode>(() => readPref('joCalMode', CAL_MODES, 'net'));
  const [viewing, setViewing] = useState<{ kind: 'in' | 'out'; entry: Entry } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const prev = previousRange(period, range);
  const startKey = range.start.format('YYYY-MM-DD');
  const endKey = range.end.format('YYYY-MM-DD');
  const prevKey = prev.start.format('YYYY-MM-DD');

  useEffect(() => {
    let cancelled = false;
    // ສົ່ງເປັນ string "YYYY-MM-DD" — ບໍ່ຜ່ານ interceptor ທີ່ແປງ Date
    const span = { start_date: prevKey, end_date: endKey };
    setLoading(true);
    Promise.all([postApi('/income/fetch', span), postApi('/expense/fetch', span)])
      .then(([inc, exp]) => {
        if (cancelled) return;
        setIncomes((inc.data?.data ?? []).map((r: Income) => fromIncome(r)));
        setExpenses((exp.data?.data ?? []).map((r: Expense) => fromExpense(r)));
        setError('');
        setLoaded(true);
      })
      .catch((err) => !cancelled && setError(getErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [prevKey, endKey, reloadKey]);

  const pickPeriod = (value: Exclude<Period, 'custom'>) => {
    setPeriod(value);
    setRange(rangeOf(value));
  };
  const pickFlow = (mode: FlowMode) => {
    setFlowMode(mode);
    writePref('joFlowMode', mode);
  };
  const pickCal = (mode: CalendarMode) => {
    setCalMode(mode);
    writePref('joCalMode', mode);
  };

  // ---- ສະກຸນ: ກີບກ່ອນ, ແລ້ວຕາມຈຳນວນລາຍການ ----
  const active = [...incomes, ...expenses].filter((e) => e.active && within(e.date, range));
  const currencies = [...new Map(active.map((e) => [e.currency.key, e.currency])).values()]
    .map((c) => ({ ...c, count: active.filter((e) => e.currency.key === c.key).length }))
    .sort((a, b) => Number(/^(LAK|KIP)$/i.test(b.key)) - Number(/^(LAK|KIP)$/i.test(a.key)) || b.count - a.count);
  const curKey = currency && currencies.some((c) => c.key === currency) ? currency : currencies[0]?.key ?? null;
  const symbol = currencies.find((c) => c.key === curKey)?.symbol ?? '';

  const pick = (list: Entry[], r: Range) => list.filter((e) => e.active && (!curKey || e.currency.key === curKey) && within(e.date, r));
  const inNow = pick(incomes, range);
  const outNow = pick(expenses, range);
  const inPrev = pick(incomes, prev);
  const outPrev = pick(expenses, prev);
  const total = (list: Entry[]) => list.reduce((n, e) => n + e.amount, 0);
  const inc = total(inNow);
  const exp = total(outNow);
  const net = inc - exp;
  const incBefore = total(inPrev);
  const expBefore = total(outPrev);
  const netBefore = incBefore - expBefore;

  const { daily, slots } = slotsOf(inNow, outNow, range);
  const passed = slots.filter((s) => !s.future);
  const days = daysOf(range);
  const calendar = calendarOf(inNow, outNow, range);
  const weekdays = weekdaysOf(inNow, outNow);
  const catsIn = categoriesOf(inNow, inPrev, t('notSpecified'));
  const catsOut = categoriesOf(outNow, outPrev, t('notSpecified'));
  const incomeSet = new Set(inNow);
  const recent = [...inNow, ...outNow]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || createdOf(b).localeCompare(createdOf(a)))
    .slice(0, 8);

  // ---- ອາລົມຂອງງວດ ----
  const netChange = pctChange(net, netBefore);
  const mood = !inc && !exp
    ? { tone: 'empty', emoji: '📝', text: t('joMoodEmpty') }
    : net < 0
      ? { tone: 'loss', emoji: '⚠️', text: t('joMoodLoss').replace('{x}', `${symbol} ${formatNumber(-net)}`) }
      : netBefore <= 0
        ? { tone: 'up', emoji: '🚀', text: t('joMoodFresh').replace('{x}', `${symbol} ${formatNumber(net)}`) }
        : (netChange ?? 0) >= 0
          ? { tone: 'up', emoji: '🎉', text: t('joMoodUp').replace('{p}', (netChange ?? 0).toFixed(1)) }
          : { tone: 'down', emoji: '👍', text: t('joMoodDown').replace('{p}', Math.abs(netChange ?? 0).toFixed(1)) };
  const ratio = inc > 0 ? (exp / inc) * 100 : exp > 0 ? 100 : 0;
  const ratioTone = ratio <= 60 ? 'good' : ratio <= 90 ? 'warn' : 'bad';
  // ຄາດຄະເນທ້າຍງວດ ຕາມຈັງຫວະທີ່ຜ່ານມາ — ສະເພາະງວດທີ່ກຳລັງດຳເນີນ ແລະ ຜ່ານມາແລ້ວຢ່າງໜ້ອຍ 3 ມື້
  const forecast = days.elapsed >= 3 && days.elapsed < days.total && (inc || exp) ? (net / days.elapsed) * days.total : null;
  const periodLabel = period === 'custom'
    ? `${range.start.format('DD/MM/YYYY')} – ${range.end.format('DD/MM/YYYY')}`
    : t({ month: 'mvThisMonth', lastMonth: 'mvLastMonth', quarter: 'rpThisQuarter', year: 'mvThisYear' }[period]);

  // ---- ຈຸດເດັ່ນ ----
  const bestDay = calendar.reduce<typeof calendar[number] | null>((best, d) => (d.inc > (best?.inc ?? 0) ? d : best), null);
  const topOut = [...outNow].sort((a, b) => b.amount - a.amount)[0];
  const topIn = [...inNow].sort((a, b) => b.amount - a.amount)[0];
  const rise = biggestRise(catsOut);
  const noSpend = calendar.filter((d) => !d.future && !d.exp).length;
  const streak = longestStreak(calendar, (d) => d.inc > 0);
  const viaTransfer = inNow.length ? (inNow.filter((e) => e.transfer).reduce((n, e) => n + e.amount, 0) / Math.max(1, inc)) * 100 : null;
  const weekdayName = (date: Moment) => t(`weekday${date.day()}`);
  const facts: Fact[] = [
    bestDay && { key: 'best', icon: 'fa-trophy', tone: 'gold', title: t('joBestDay'), value: short(symbol, bestDay.inc), sub: `${weekdayName(bestDay.date)} ${bestDay.date.format('DD/MM')}` },
    topIn && { key: 'topIn', icon: 'fa-sack-dollar', tone: 'teal', title: t('joBiggestIncome'), value: short(symbol, topIn.amount), sub: topIn.title, onClick: () => setViewing({ kind: 'in', entry: topIn }) },
    topOut && { key: 'topOut', icon: 'fa-money-bill-wave', tone: 'red', title: t('joBiggestExpense'), value: short(symbol, topOut.amount), sub: topOut.title, onClick: () => setViewing({ kind: 'out', entry: topOut }) },
    rise && { key: 'rise', icon: 'fa-arrow-trend-up', tone: 'orange', title: t('joRisingCost'), value: rise.label, sub: `+${formatNumber(rise.total - rise.previous)} ${t('rpVsPrevious')}` },
    days.elapsed > 0 && { key: 'calm', icon: 'fa-shield-heart', tone: 'purple', title: t('joNoSpendDays'), value: `${noSpend} / ${days.elapsed} ${t('joDays')}`, sub: t('joNoSpendHint') },
    streak >= 2 && { key: 'streak', icon: 'fa-fire', tone: 'gold', title: t('joIncomeStreak'), value: `${streak} ${t('joDays')}`, sub: t('joStreakHint') },
    viaTransfer !== null && { key: 'transfer', icon: 'fa-building-columns', tone: 'blue', title: t('joViaTransfer'), value: `${viaTransfer.toFixed(0)}%`, sub: `${t('incomeReceiveCash')} ${(100 - viaTransfer).toFixed(0)}%` },
    inNow.length > 0 && { key: 'avg', icon: 'fa-receipt', tone: 'teal', title: t('joAvgTicket'), value: short(symbol, inc / inNow.length), sub: `${inNow.length} ${t('incomeItems')}` },
  ].filter(Boolean) as Fact[];
  const busiestOut = weekdays.reduce((best, r, i) => (r.exp > weekdays[best].exp ? i : best), 0);

  const periods: { key: Exclude<Period, 'custom'>; label: string }[] = [
    { key: 'month', label: t('mvThisMonth') },
    { key: 'lastMonth', label: t('mvLastMonth') },
    { key: 'quarter', label: t('rpThisQuarter') },
    { key: 'year', label: t('mvThisYear') },
  ];

  const tile = (i: number, tone: 'in' | 'out' | 'net' | 'count', icon: string, title: string, value: ReactNode, foot: ReactNode, spark?: number[]) => (
    <div className={`acc-jo-tile is-${tone}`} style={order(i)}>
      <span className="acc-jo-tile-icon"><i className={`fa-solid ${icon}`} /></span>
      <small>{title}</small>
      <b>{value}</b>
      <em>{foot}</em>
      {spark && <Sparkline values={spark} tone={tone === 'out' ? 'out' : tone === 'in' ? 'in' : 'net'} />}
    </div>
  );

  return (
    <div className="acc-rp acc-jo">
      {/* ---- ຊ່ວງເວລາ + ສະກຸນ ---- */}
      <div className="acc-rp-filters">
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
          {currencies.length > 1 && (
            <div className="acc-type-segment" role="tablist" aria-label={t('accountTypeCurrency')}>
              {currencies.map((c) => (
                <button key={c.key} type="button" role="tab" aria-selected={curKey === c.key}
                  className={curKey === c.key ? 'is-active' : ''} onClick={() => setCurrency(c.key)}
                >
                  {c.symbol && c.symbol !== c.key ? `${c.symbol} ` : ''}{c.key}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="acc-rp-btn acc-jo-refresh" onClick={() => setReloadKey((k) => k + 1)} title={t('glanceRefresh')} aria-label={t('glanceRefresh')}>
            <i className={`fa-solid fa-rotate${loading ? ' fa-spin' : ''}`} />
          </button>
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
      </div>

      {!loaded && loading ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : error && !loaded ? (
        <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
      ) : (
        <div className={`acc-rp-body acc-jo-body${loading ? ' is-refreshing' : ''}`} key={`${startKey}-${endKey}-${curKey}`}>
          {/* ---- ເງິນເຫຼືອ + ອາລົມຂອງງວດ ---- */}
          <section className={`acc-jo-hero is-${mood.tone}`}>
            <div className="acc-jo-hero-main">
              <span className="acc-jo-hero-kicker"><i className="fa-solid fa-calendar-day" /> {periodLabel}</span>
              <small>{t(net < 0 ? 'joNetShort' : 'joNetLeft')}</small>
              <b className="acc-jo-hero-value"><CountUp value={net} prefix={symbol ? `${symbol} ` : ''} /></b>
              <span className="acc-jo-hero-pills">
                <span><i className="fa-solid fa-arrow-down" /> {t('joIn')} <CountUp value={inc} /></span>
                <span><i className="fa-solid fa-arrow-up" /> {t('joOut')} <CountUp value={exp} /></span>
              </span>
              <p className="acc-jo-mood"><span className="acc-jo-mood-emoji" aria-hidden>{mood.emoji}</span>{mood.text}</p>
            </div>
            <div className="acc-jo-hero-side">
              <div className={`acc-jo-meter is-${ratioTone}`}>
                <span className="acc-jo-meter-head"><small>{t('joSpendRatio')}</small><b>{ratio.toFixed(1)}%</b></span>
                <span className="acc-jo-meter-track"><i style={{ width: `${Math.min(100, ratio)}%` }} /></span>
                <em>{t(`joRatio_${ratioTone}`)}</em>
              </div>
              {forecast !== null && (
                <div className="acc-jo-forecast">
                  <i className="fa-solid fa-wand-magic-sparkles" />
                  <span>
                    <small>{t('joForecast')}</small>
                    <b>≈ {symbol} {formatNumber(Math.round(forecast))}</b>
                    <em>{t('joForecastHint').replace('{n}', String(days.elapsed)).replace('{m}', String(days.total))}</em>
                  </span>
                </div>
              )}
              {canCreate && (
                <div className="acc-jo-quick">
                  <button type="button" className="is-in" onClick={() => onNavigate('income', true)}><i className="fa-solid fa-plus" /> {t('joAddIncome')}</button>
                  <button type="button" className="is-out" onClick={() => onNavigate('expense', true)}><i className="fa-solid fa-plus" /> {t('joAddExpense')}</button>
                </div>
              )}
            </div>
          </section>

          {/* ---- ບັດສະຫຼຸບ ---- */}
          <div className="acc-jo-tiles">
            {tile(1, 'in', 'fa-arrow-trend-up', t('fsTotalRevenue'), <>{symbol} <CountUp value={inc} /></>,
              <><DeltaPill current={inc} previous={incBefore} good /> {t('rpVsPrevious')} {compact(incBefore)}</>, passed.map((s) => s.inc))}
            {tile(2, 'out', 'fa-arrow-trend-down', t('fsTotalExpenses'), <>{symbol} <CountUp value={exp} /></>,
              <><DeltaPill current={exp} previous={expBefore} good={false} /> {t('rpVsPrevious')} {compact(expBefore)}</>, passed.map((s) => s.exp))}
            {tile(3, 'net', 'fa-scale-balanced', t('joPerDay'),
              <span className="acc-jo-tile-pair"><span className="is-in">+{compact(days.elapsed ? inc / days.elapsed : 0)}</span><span className="is-out">−{compact(days.elapsed ? exp / days.elapsed : 0)}</span></span>,
              t('joPerDayHint').replace('{n}', String(days.elapsed)), passed.map((s) => s.cumInc - s.cumExp))}
            {tile(4, 'count', 'fa-list-check', t('joEntries'), <CountUp value={inNow.length + outNow.length} />,
              <>{t('joIn')} {inNow.length} · {t('joOut')} {outNow.length}</>, passed.map((s) => s.incCount + s.expCount))}
          </div>

          {/* ---- ກຣາບຫຼັກ 3 ແບບ ---- */}
          <section className="acc-rp-card acc-jo-card" style={order(5)}>
            <header className="acc-jo-card-head">
              <h4><i className={`fa-solid ${FLOW_ICONS[flowMode]}`} /> {t(daily ? 'joFlowDaily' : 'joFlowMonthly')}</h4>
              <small className="acc-fs-legend">
                {flowMode === 'net' ? <>
                  <span><i className="is-in" /> {t('joNetPlus')}</span>
                  <span><i className="is-out" /> {t('joNetMinus')}</span>
                </> : <>
                  <span><i className={flowMode === 'cumulative' ? 'is-line' : 'is-in'} /> {t('joIn')}</span>
                  <span><i className={flowMode === 'cumulative' ? 'is-line is-out-line' : 'is-out'} /> {t('joOut')}</span>
                </>}
              </small>
              <div className="acc-type-segment acc-jo-mini-switch" role="tablist" aria-label={t('joChartType')}>
                {FLOW_MODES.map((m) => (
                  <button key={m} type="button" role="tab" aria-selected={flowMode === m} className={flowMode === m ? 'is-active' : ''} onClick={() => pickFlow(m)}>
                    <i className={`fa-solid ${FLOW_ICONS[m]}`} /> {t(`joFlow_${m}`)}
                  </button>
                ))}
              </div>
            </header>
            <FlowChart key={flowMode} slots={slots} mode={flowMode} />
            <p className="acc-jo-note"><i className="fa-solid fa-circle-info" /> {t(`joFlowNote_${flowMode}`)}</p>
          </section>

          {/* ---- ມາຈາກໃສ / ໄປໃສ ---- */}
          <div className="acc-jo-grid">
            <CategoryCard kind="in" rows={catsIn} index={6} />
            <CategoryCard kind="out" rows={catsOut} index={7} />
          </div>

          {/* ---- ປະຕິທິນເງິນ + ມື້ໃນອາທິດ ---- */}
          <div className="acc-jo-grid is-wide-left">
            <section className="acc-rp-card acc-jo-card" style={order(8)}>
              <header className="acc-jo-card-head">
                <h4><i className="fa-solid fa-calendar-days" /> {t('joCalendar')}</h4>
                <div className="acc-type-segment acc-jo-mini-switch" role="tablist">
                  {CAL_MODES.map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={calMode === m} className={calMode === m ? 'is-active' : ''} onClick={() => pickCal(m)}>
                      {t(`joCal_${m}`)}
                    </button>
                  ))}
                </div>
              </header>
              <MoneyCalendar key={calMode} days={calendar} mode={calMode} />
            </section>
            <section className="acc-rp-card acc-jo-card" style={order(9)}>
              <header className="acc-jo-card-head">
                <h4><i className="fa-solid fa-calendar-week" /> {t('joWeekdays')}</h4>
              </header>
              <WeekdayChart rows={weekdays} />
              {exp > 0 && (
                <p className="acc-jo-note is-hint">
                  <span aria-hidden>🛒</span> {t('joBusiestOut').replace('{d}', t(`weekday${(busiestOut + 1) % 7}`))}
                </p>
              )}
            </section>
          </div>

          {/* ---- ຈຸດເດັ່ນ ---- */}
          {facts.length > 0 && (
            <section className="acc-rp-card acc-jo-card" style={order(10)}>
              <header className="acc-jo-card-head">
                <h4><i className="fa-solid fa-lightbulb" /> {t('joHighlights')}</h4>
              </header>
              <Facts facts={facts} />
            </section>
          )}

          {/* ---- ອັນດັບ + ລາຍການລ່າສຸດ ---- */}
          <div className="acc-jo-grid">
            <Leaderboard payers={partiesOf(inNow)} payees={partiesOf(outNow)} index={11} />
            <RecentFeed entries={recent} kindOf={(e) => (incomeSet.has(e) ? 'in' : 'out')} onOpen={(e) => setViewing({ kind: incomeSet.has(e) ? 'in' : 'out', entry: e })} index={12} />
          </div>
        </div>
      )}

      {viewing && (viewing.kind === 'in'
        ? <IncomeDetail income={viewing.entry.raw as Income} onClose={() => setViewing(null)} />
        : <ExpenseDetail expense={viewing.entry.raw as Expense} onClose={() => setViewing(null)} />)}
    </div>
  );
};

export default JournalOverview;
