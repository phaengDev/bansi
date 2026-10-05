import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import moment from 'moment';
import { formatNumber, getApi, postApi } from '../../utils/configApi';
import { useT } from '../../context/LanguageContext';
import type { TreasuryAccount } from './ledger/TreasuryAccountForm';
import { currencySymbol } from './ledger/currency';
import { CASH_CLASS_CODE } from './journal/journalKit';
import type { PartnerDoc } from './arap/arapApi';
import { isNotReady, type Balance, type ChartAccount } from './gl/glApi';
import { useAccountMenusLoaded, type AccountMenu } from './accountMenus';
import type { ShortcutId } from './DesktopShared';

/** ສະຖານະຂອງເມນູຕໍ່ພາບລວມ: ບໍ່ມີສິດ (ບໍ່ສະແດງ) / ລັອກ (ບໍ່ດຶງ ບໍ່ສະແດງຕົວເລກ) / ເປີດ */
type Access = 'none' | 'locked' | 'open';
/** ໂຫຼດບໍ່ສຳເລັດ: notReady = ຍັງບໍ່ໄດ້ສ້າງຕາຕະລາງ (503), error = ອື່ນໆ */
type Failed = 'notReady' | 'error';

type CashSummary = {
  currencies: { key: string; symbol: string; total: number; cash: number; bank: number }[];
  negative: { id: number; name: string; symbol: string; balance: number }[];
};
type MonthSummary = { revenue: number; expense: number; prevRevenue: number; prevExpense: number; todayIn: number; todayOut: number } | null;
type DebtDoc = { id: number; number: string; partner: string; due: string; days: number; amount: number };
type DebtSummary = { total: number; docs: number; partners: number; overdue: DebtDoc[]; dueSoon: DebtDoc[] };

type Glance = {
  cash?: CashSummary | Failed;
  month?: MonthSummary | Failed;
  ar?: DebtSummary | Failed;
  ap?: DebtSummary | Failed;
  at: Date;
};

/** ເຈົ້າໜີ້ທີ່ຮອດກຳນົດພາຍໃນຈັກມື້ ຖືວ່າ "ໃກ້ຮອດ" */
const DUE_SOON_DAYS = 7;
/** ລາຍການ "ຕ້ອງຕິດຕາມ" ທີ່ສະແດງ (ທີ່ເຫຼືອບອກເປັນຈຳນວນ) */
const MAX_TODO = 5;
/** ໂຫຼດໃໝ່ເອງທຸກໆ 1 ນາທີ (ສະເພາະຕອນເບິ່ງ tab ນີ້ຢູ່) */
const AUTO_REFRESH_MS = 60_000;
const HIDDEN_KEY = 'accountGlanceHidden';
const BASE = '₭';

const failOf = (error: unknown): Failed => (isNotReady(error) ? 'notReady' : 'error');
const isFailed = <T,>(value: T | Failed | undefined): value is Failed => value === 'notReady' || value === 'error';
const day = (m: moment.Moment) => m.format('YYYY-MM-DD');

/** ຍອດເງິນສົດ/ທະນາຄານ ແຍກຕາມສະກຸນເງິນ (ສົດ ຫຼື ທະນາຄານ ຄິດຈາກໝວດ 101) + ບັນຊີທີ່ຍອດຕິດລົບ */
const loadCash = async (): Promise<CashSummary> => {
  const res = await postApi('/treasury-account/fetch', {});
  const rows: TreasuryAccount[] = (res.data?.data ?? []).filter((r: TreasuryAccount) => Number(r.status) === 1);
  const map = new Map<string, CashSummary['currencies'][number]>();
  const negative: CashSummary['negative'] = [];
  rows.forEach((r) => {
    const currency = r.treasury?.currency;
    const key = currency?.name ?? '';
    const symbol = currencySymbol(currency) || key;
    const total = (Number(r.balance_treasury) || 0) + (Number(r.balance_unable) || 0);
    const row = map.get(key) ?? { key, symbol, total: 0, cash: 0, bank: 0 };
    row.total += total;
    if (r.treasury?.types?.type_code === CASH_CLASS_CODE) row.cash += total;
    else row.bank += total;
    map.set(key, row);
    if (total < 0) negative.push({ id: r._uuid, name: r.acountName, symbol, balance: total });
  });
  // ກີບກ່ອນ ແລ້ວຕາມຍອດຫຼາຍ → ໜ້ອຍ
  const currencies = [...map.values()].sort((a, b) => Number(b.key === 'LAK') - Number(a.key === 'LAK') || b.total - a.total);
  return { currencies, negative };
};

/**
 * ລາຍຮັບ (ກຸ່ມ 4) / ລາຍຈ່າຍ (ກຸ່ມ 5) ຈາກສະໝຸດບັນຊີ (LAK): ຕົ້ນເດືອນ → ມື້ນີ້, ຊ່ວງດຽວກັນຂອງເດືອນກ່ອນ ແລະ ມື້ນີ້.
 * null = ເດືອນນີ້ ແລະ ເດືອນກ່ອນ ຍັງບໍ່ມີລາຍການ
 */
const loadMonth = async (): Promise<MonthSummary> => {
  const today = moment();
  // ມື້ດຽວກັນຂອງເດືອນກ່ອນ (moment ປັດລົງເປັນທ້າຍເດືອນເອງ ເຊັ່ນ 31/03 → 28/02)
  const prevEnd = today.clone().subtract(1, 'month');
  const balances = (start: moment.Moment, end: moment.Moment) =>
    postApi('/gl/balances', { start_date: day(start), end_date: day(end) }).then((res) => (res.data?.data ?? []) as Balance[]);
  const [chart, now, prev, todays] = await Promise.all([
    getApi('/chart-account/fetch').then((res) => (res.data?.data ?? []) as ChartAccount[]),
    balances(today.clone().startOf('month'), today),
    balances(prevEnd.clone().startOf('month'), prevEnd),
    balances(today, today),
  ]);
  const groupOf = new Map(chart.map((a) => [a._uuid, Number(a.account_group)]));
  // ລາຍຮັບ = ມີ − ໜີ້, ລາຍຈ່າຍ = ໜີ້ − ມີ
  const sum = (list: Balance[], group: 4 | 5) => list
    .filter((b) => groupOf.get(b.account_id) === group)
    .reduce((n, b) => n + (group === 4 ? b.credit - b.debit : b.debit - b.credit), 0);
  if (![...now, ...prev].some((b) => b.debit || b.credit)) return null;
  return {
    revenue: sum(now, 4),
    expense: sum(now, 5),
    prevRevenue: sum(prev, 4),
    prevExpense: sum(prev, 5),
    todayIn: sum(todays, 4),
    todayOut: sum(todays, 5),
  };
};

/** ໃບທີ່ຍັງຄ້າງ (ລູກໜີ້ kind 1 / ເຈົ້າໜີ້ kind 2) — ຍອດເປັນ LAK ຕາມອັດຕາຂອງໃບ ຄືກັບ /partner/fetch */
const loadDebt = async (kind: 1 | 2): Promise<DebtSummary> => {
  const res = await postApi('/partner-doc/fetch', { kind, open_only: true });
  const today = moment().startOf('day');
  const docs: DebtDoc[] = (res.data?.data ?? []).map((d: PartnerDoc) => ({
    id: d._uuid,
    number: d.doc_number,
    partner: d.partner?.name ?? '',
    due: d.due_date,
    // ບວກ = ເກີນກຳນົດມາແລ້ວຈັກມື້, ລົບ = ຍັງເຫຼືອຈັກມື້
    days: today.diff(moment(d.due_date, 'YYYY-MM-DD'), 'days'),
    amount: (Number(d.open) || 0) * (Number(d.exchange_rate) || 1),
  }));
  return {
    total: docs.reduce((n, d) => n + d.amount, 0),
    docs: docs.length,
    partners: new Set(docs.map((d) => d.partner)).size,
    overdue: docs.filter((d) => d.days > 0).sort((a, b) => b.days - a.days),
    dueSoon: docs.filter((d) => d.days <= 0 && d.days >= -DUE_SOON_DAYS).sort((a, b) => b.days - a.days),
  };
};

const settle = <T,>(enabled: boolean, load: () => Promise<T>) =>
  enabled ? load().catch((error): Failed => failOf(error)) : Promise.resolve(undefined);

const money = (symbol: string, value: number) => `${value < 0 ? '−' : ''}${symbol} ${formatNumber(Math.round(Math.abs(value)))}`;
const sumOf = (docs: DebtDoc[]) => docs.reduce((n, d) => n + d.amount, 0);
const changeOf = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 100) : null);

/** ເຊື່ອງ/ສະແດງ ພາບລວມ — ຈື່ໄວ້ໃນ browser ນີ້ */
export const useGlanceHidden = () => {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  const update = (next: boolean) => {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, next ? '1' : '0');
    } catch {
      // storage ຖືກປິດ — ຈື່ສະເພາະໃນໜ້ານີ້
    }
  };
  return [hidden, update] as const;
};

type Todo = { key: string; tone: 'danger' | 'warn'; icon: string; title: string; sub: string; amount: string; target: ShortcutId };

/**
 * ພາບລວມສິ່ງທີ່ຕ້ອງຮູ້ທັນທີ ຢູ່ຂວາຂອງ desktop: ເງິນທີ່ມີ, ກຳໄລເດືອນນີ້, ລູກໜີ້ ແລະ ເຈົ້າໜີ້ຄ້າງ + ລາຍການຕ້ອງຕິດຕາມ.
 * ແຕ່ລະບັດຜູກກັບເມນູຂອງມັນ: ບໍ່ມີເມນູ = ບໍ່ສະແດງ, ເມນູລັອກ = ບໍ່ດຶງຂໍ້ມູນ (ກົດແລ້ວຖາມລະຫັດ), ກົດບັດ = ເປີດເມນູນັ້ນ.
 * ໂຫຼດໃໝ່: ປິດໜ້າຕ່າງ, ທຸກ 1 ນາທີ ຫຼື ກົດປຸ່ມ
 */
const DesktopGlance = ({ menus, openShortcut, openWindows, onHide }: {
  menus: AccountMenu[];
  openShortcut: (id: ShortcutId) => void;
  openWindows: number;
  onHide: () => void;
}) => {
  const t = useT();
  const menusLoaded = useAccountMenusLoaded();
  const [data, setData] = useState<Glance | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const lastWindows = useRef(openWindows);

  const accessOf = (id: ShortcutId): Access => {
    const menu = menus.find((m) => m.id === id);
    return !menu ? 'none' : menu.locked ? 'locked' : 'open';
  };
  const access = {
    cash: accessOf('cashBank'),
    month: accessOf('financialStatements'),
    ar: accessOf('receivables'),
    ap: accessOf('payables'),
  };
  const accessKey = Object.values(access).join('|');

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!menusLoaded) return;
    let cancelled = false;
    const [cash, month, ar, ap] = accessKey.split('|').map((a) => a === 'open');
    setLoading(true);
    Promise.all([
      settle(cash, loadCash),
      settle(month, loadMonth),
      settle(ar, () => loadDebt(1)),
      settle(ap, () => loadDebt(2)),
    ]).then(([c, m, r, p]) => {
      if (cancelled) return;
      setData({ cash: c, month: m, ar: r, ap: p, at: new Date() });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [menusLoaded, accessKey, tick]);

  // ປິດໜ້າຕ່າງ (ອາດຫາກໍ່ບັນທຶກລາຍການ) → ໂຫຼດໃໝ່
  useEffect(() => {
    if (openWindows < lastWindows.current) refresh();
    lastWindows.current = openWindows;
  }, [openWindows, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const muted = (text: string, icon = 'fa-circle-info') => <span className="acc-glance-muted"><i className={`fa-solid ${icon}`} /> {text}</span>;
  const failedText = (value: Failed) => muted(t(value === 'notReady' ? 'glanceNotReady' : 'glanceError'), 'fa-triangle-exclamation');

  const card = (id: ShortcutId, key: keyof typeof access, tone: string, icon: string, title: string, body: () => ReactNode) => {
    if (access[key] === 'none') return null;
    const value = data?.[key];
    return (
      <button type="button" className={`acc-glance-card is-${tone}`} onClick={() => openShortcut(id)}>
        <span className="acc-glance-card-head">
          <span className="acc-glance-card-icon"><i className={`fa-solid ${icon}`} /></span>
          <span className="acc-glance-card-title">{title}</span>
          <i className="fa-solid fa-chevron-right acc-glance-card-go" />
        </span>
        {access[key] === 'locked'
          ? muted(t('glanceLocked'), 'fa-lock')
          : !data ? <span className="acc-glance-skeleton" />
            : isFailed(value) ? failedText(value) : body()}
      </button>
    );
  };

  // ---- ເນື້ອໃນແຕ່ລະບັດ ----
  const cashBody = () => {
    const cash = data?.cash as CashSummary;
    if (!cash.currencies.length) return muted(t('glanceNoAccounts'));
    return cash.currencies.slice(0, 3).map((c, index) => (
      <span key={c.key} className={`acc-glance-money${index ? ' is-minor' : ''}`}>
        <b className={c.total < 0 ? 'is-negative' : ''}>{money(c.symbol, c.total)}</b>
        {!!c.cash && !!c.bank && (
          <small>{t('incomeReceiveCash')} {formatNumber(Math.round(c.cash))} · {t('bank')} {formatNumber(Math.round(c.bank))}</small>
        )}
      </span>
    ));
  };

  const monthBody = () => {
    const month = data?.month as MonthSummary;
    if (!month) return muted(t('glanceNoGl'));
    const net = month.revenue - month.expense;
    const trend = (now: number, before: number, upIsGood: boolean) => {
      const pct = changeOf(now, before);
      if (pct === null || pct === 0) return null;
      const good = pct > 0 === upIsGood;
      return (
        <em className={good ? 'is-good' : 'is-bad'} title={t('glanceVsLast')}>
          <i className={`fa-solid ${pct > 0 ? 'fa-arrow-up' : 'fa-arrow-down'}`} /> {Math.abs(pct)}%
        </em>
      );
    };
    return (
      <>
        <span className="acc-glance-money">
          <b className={net < 0 ? 'is-negative' : 'is-positive'}>{money(BASE, net)}</b>
          <small>{t(net < 0 ? 'glanceLoss' : 'glanceNet')}</small>
        </span>
        <span className="acc-glance-rows">
          <span><small>{t('glanceRevenue')}</small> {formatNumber(Math.round(month.revenue))} {trend(month.revenue, month.prevRevenue, true)}</span>
          <span><small>{t('glanceExpense')}</small> {formatNumber(Math.round(month.expense))} {trend(month.expense, month.prevExpense, false)}</span>
          {(!!month.todayIn || !!month.todayOut) && (
            <span className="is-wrap"><small>{t('glanceToday')}</small> +{formatNumber(Math.round(month.todayIn))} / −{formatNumber(Math.round(month.todayOut))}</span>
          )}
        </span>
      </>
    );
  };

  const debtBody = (key: 'ar' | 'ap') => () => {
    const debt = data?.[key] as DebtSummary;
    if (!debt.docs) return muted(t('glanceNothingDue'), 'fa-circle-check');
    return (
      <>
        <span className="acc-glance-money">
          <b>{money(BASE, debt.total)}</b>
          <small>{debt.docs} {t('glanceDocs')} · {debt.partners} {t('glancePartners')}</small>
        </span>
        <span className="acc-glance-chips">
          {!!debt.overdue.length && (
            <em className="is-bad"><i className="fa-solid fa-clock" /> {t('glanceOverdue')} {formatNumber(Math.round(sumOf(debt.overdue)))} · {debt.overdue.length}</em>
          )}
          {key === 'ap' && !!debt.dueSoon.length && (
            <em className="is-warn" title={t('glanceDueSoonHint')}><i className="fa-solid fa-hourglass-half" /> {t('glanceDueSoon')} {formatNumber(Math.round(sumOf(debt.dueSoon)))} · {debt.dueSoon.length}</em>
          )}
          {!debt.overdue.length && (key === 'ar' || !debt.dueSoon.length) && (
            <em className="is-good"><i className="fa-solid fa-circle-check" /> {t('glanceNoOverdue')}</em>
          )}
        </span>
      </>
    );
  };

  // ---- ຕ້ອງຕິດຕາມ: ເກີນກຳນົດ (ແດງ) ກ່ອນ ແລ້ວໃກ້ຮອດກຳນົດ (ເຫຼືອງ) ----
  const todos: Todo[] = [];
  const daysText = (d: DebtDoc) => (d.days > 0
    ? `${t('glanceOverdue')} ${d.days} ${t('glanceDays')}`
    : d.days === 0 ? t('glanceDueToday') : `${t('glanceDueIn')} ${-d.days} ${t('glanceDays')}`);
  const debtTodos = (key: 'ar' | 'ap', docs: DebtDoc[], tone: Todo['tone']) => docs.forEach((d) => todos.push({
    key: `${key}${d.id}`,
    tone,
    icon: key === 'ar' ? 'fa-hand-holding-dollar' : 'fa-file-invoice-dollar',
    title: `${t(key === 'ar' ? 'glanceCollect' : 'glancePay')} · ${d.partner || d.number}`,
    sub: `${d.number} · ${daysText(d)}`,
    amount: money(BASE, d.amount),
    target: key === 'ar' ? 'receivables' : 'payables',
  }));
  const ar = isFailed(data?.ar) ? undefined : data?.ar;
  const ap = isFailed(data?.ap) ? undefined : data?.ap;
  const cash = isFailed(data?.cash) ? undefined : data?.cash;
  cash?.negative.forEach((a) => todos.push({
    key: `neg${a.id}`, tone: 'danger', icon: 'fa-wallet', title: a.name, sub: t('glanceNegative'), amount: money(a.symbol, a.balance), target: 'cashBank',
  }));
  if (ar) debtTodos('ar', ar.overdue, 'danger');
  if (ap) debtTodos('ap', ap.overdue, 'danger');
  if (ap) debtTodos('ap', ap.dueSoon, 'warn');
  const anyOpen = Object.values(access).some((a) => a === 'open');

  return (
    <aside className="acc-glance" aria-label={t('glanceTitle')}>
      <header className="acc-glance-head">
        <span>
          <b>{t('glanceTitle')}</b>
          <small>
            {data ? `${t('glanceUpdated')} ${moment(data.at).format('HH:mm')}` : t('loadingDots')}
          </small>
        </span>
        <button type="button" onClick={refresh} disabled={loading} title={t('glanceRefresh')} aria-label={t('glanceRefresh')}>
          <i className={`fa-solid fa-rotate-right${loading ? ' fa-spin' : ''}`} />
        </button>
        <button type="button" onClick={onHide} title={t('glanceHide')} aria-label={t('glanceHide')}>
          <i className="fa-solid fa-xmark" />
        </button>
      </header>

      <div className="acc-glance-grid">
        {card('cashBank', 'cash', 'sky', 'fa-building-columns', t('accountAppCashBank'), cashBody)}
        {card('financialStatements', 'month', 'emerald', 'fa-chart-pie', `${t('glanceMonth')} ${moment().format('MM/YYYY')}`, monthBody)}
        {card('receivables', 'ar', 'gold', 'fa-hand-holding-dollar', t('glanceAr'), debtBody('ar'))}
        {card('payables', 'ap', 'coral', 'fa-file-invoice-dollar', t('glanceAp'), debtBody('ap'))}
      </div>

      {anyOpen && data && (
        <section className="acc-glance-todo">
          <h4>{t('glanceAttention')} {!!todos.length && <small>{todos.length}</small>}</h4>
          {!todos.length ? (
            <p className="acc-glance-clear"><i className="fa-solid fa-circle-check" /> {t('glanceAllGood')}</p>
          ) : (
            <>
              {todos.slice(0, MAX_TODO).map((todo) => (
                <button key={todo.key} type="button" className={`acc-glance-item is-${todo.tone}`} onClick={() => openShortcut(todo.target)}>
                  <i className={`fa-solid ${todo.icon}`} />
                  <span>
                    <b>{todo.title}</b>
                    <small>{todo.sub}</small>
                  </span>
                  <em>{todo.amount}</em>
                </button>
              ))}
              {todos.length > MAX_TODO && <p className="acc-glance-more">+{todos.length - MAX_TODO} {t('glanceMoreItems')}</p>}
            </>
          )}
        </section>
      )}
    </aside>
  );
};

export default DesktopGlance;
