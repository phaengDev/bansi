import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import moment from 'moment';
import { formatNumber, getApi, postApi } from '../../utils/configApi';
import { useT } from '../../context/LanguageContext';
import type { TreasuryAccount } from './ledger/TreasuryAccountForm';
import { currencySymbol } from './ledger/currency';
import { CASH_CLASS_CODE } from './journal/journalKit';
import type { PartnerDoc } from './arap/arapApi';
import { isNotReady, type Balance, type ChartAccount } from './gl/glApi';
import { percentOf, percentText, planToDate, statusOf, type BudgetData } from './budget/budgetApi';
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
type BudgetLine = { id: number; name: string; amount: number; used: number };
/** null = ບໍ່ມີງົບທີ່ດຳເນີນງານ (ບໍ່ມີປີການເງິນ / ປີປິດບັນຊີແລ້ວ / ຍັງບໍ່ໄດ້ຕັ້ງງົບ) → ບໍ່ສະແດງບັດ */
type BudgetSummary = {
  name: string;
  total: number;
  used: number;
  /** ງົບທີ່ຄວນໃຊ້ໄປແລ້ວຮອດມື້ນີ້ (ເຄື່ອງໝາຍ "ຕາມແຜນ" ເທິງແຖບ) */
  plan: number;
  lines: number;
  over: number;
  near: number;
  /** ໝວດທີ່ໃຊ້ໄປຫຼາຍສຸດ (% ຂອງງົບ) */
  top: BudgetLine[];
} | null;

/** ຄຳຮ້ອງທີ່ລໍຖ້າ HR (GET /hr/pending) */
type HrPending = { leave: number; correction: number; advance: number; advance_to_pay: number };

type Glance = {
  hr?: HrPending | Failed;
  cash?: CashSummary | Failed;
  month?: MonthSummary | Failed;
  ar?: DebtSummary | Failed;
  ap?: DebtSummary | Failed;
  budget?: BudgetSummary | Failed;
  at: Date;
};

/** ເຈົ້າໜີ້ທີ່ຮອດກຳນົດພາຍໃນຈັກມື້ ຖືວ່າ "ໃກ້ຮອດ" */
const DUE_SOON_DAYS = 7;
/** ລາຍການ "ຕ້ອງຕິດຕາມ" ທີ່ສະແດງ (ທີ່ເຫຼືອບອກເປັນຈຳນວນ) */
const MAX_TODO = 5;
/** ໝວດງົບທີ່ສະແດງໃນບັດງົບປະມານ */
const MAX_BUDGET_LINES = 3;
/** ປີການເງິນທີ່ປິດບັນຊີແລ້ວ — ງົບຂອງປີນີ້ບໍ່ສະແດງ */
const FISCAL_CLOSED = 2;
/** ໂຫຼດໃໝ່ເອງທຸກໆ 1 ນາທີ (ສະເພາະຕອນເບິ່ງ tab ນີ້ຢູ່) */
const AUTO_REFRESH_MS = 60_000;
const HIDDEN_KEY = 'accountGlanceHidden';
/** ຕຳແໜ່ງທີ່ລາກໄປວາງ (px ຈາກມຸມຊ້າຍເທິງຂອງ desktop) — ບໍ່ມີ = ບ່ອນເດີມ (ຂວາ ໃຕ້ບັດຜູ້ໃຊ້) */
const POSITION_KEY = 'accountGlancePosition';
/** ໄລຍະຫ່າງຈາກຂອບ desktop ທີ່ລາກໄປໄດ້ສຸດ; ລຸ່ມສຸດເຫຼືອບ່ອນໃຫ້ taskbar + ພາບລວມຢ່າງໜ້ອຍ MIN_VISIBLE */
const EDGE = 8;
const TASKBAR_GAP = 72;
const MIN_VISIBLE = 140;
/** ຄວາມກວ້າງທີ່ລາກຂອບຊ້າຍ/ຂວາ ໄວ້ (px) — ບໍ່ມີ = ຕາມຈໍ (--glance-w ຂອງ CSS) */
const WIDTH_KEY = 'accountGlanceWidth';
const MIN_WIDTH = 320;
const MAX_WIDTH = 980;
/** ກົດລູກສອນຊ້າຍ/ຂວາ ທີ່ຂອບ = ຂະຫຍາຍ/ຫຍໍ້ເທື່ອລະ */
const KEY_STEP = 24;
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

/**
 * ງົບປະມານລາຍຈ່າຍຂອງປີການເງິນປັດຈຸບັນ (backend ເລືອກປີໃຫ້) — ສະເພາະປີທີ່ຍັງດຳເນີນງານ:
 * ບໍ່ມີປີ (404), ປີປິດບັນຊີແລ້ວ ຫຼື ຍັງບໍ່ໄດ້ຕັ້ງງົບ = null (ບໍ່ສະແດງ)
 */
const loadBudget = async (): Promise<BudgetSummary> => {
  let budget: BudgetData | undefined;
  try {
    budget = (await postApi('/budget/fetch', {})).data;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
    throw error;
  }
  if (!budget?.fiscal || Number(budget.fiscal.status) === FISCAL_CLOSED || !budget.data.length) return null;
  const rows = budget.data;
  const statuses = rows.map((r) => statusOf(r.amount, r.actual));
  return {
    name: budget.fiscal.fiscal_name || budget.fiscal.fiscal_code,
    total: rows.reduce((n, r) => n + r.amount, 0),
    used: rows.reduce((n, r) => n + r.actual, 0),
    plan: rows.reduce((n, r) => n + planToDate(r, budget.fiscal), 0),
    lines: rows.length,
    over: statuses.filter((s) => s === 'over').length,
    near: statuses.filter((s) => s === 'near').length,
    top: rows
      .filter((r) => r.actual > 0)
      .sort((a, b) => percentOf(b.amount, b.actual) - percentOf(a.amount, a.actual))
      .slice(0, MAX_BUDGET_LINES)
      .map((r) => ({ id: r._uuid, name: r.category?.type_name ?? '', amount: r.amount, used: r.actual })),
  };
};

const loadHrPending = async () => (await getApi('/hr/pending')).data?.data as HrPending;

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

type Point = { x: number; y: number };

const readPosition = (): Point | null => {
  try {
    const value = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null');
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : null;
  } catch {
    return null;
  }
};

const savePosition = (point: Point | null) => {
  try {
    if (point) localStorage.setItem(POSITION_KEY, JSON.stringify(point));
    else localStorage.removeItem(POSITION_KEY);
  } catch {
    // storage ຖືກປິດ — ຈື່ສະເພາະໃນໜ້ານີ້
  }
};

const readWidth = (): number | null => {
  try {
    const value = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(value) && value >= MIN_WIDTH ? Math.min(MAX_WIDTH, value) : null;
  } catch {
    return null;
  }
};

const saveWidth = (width: number | null) => {
  try {
    if (width) localStorage.setItem(WIDTH_KEY, String(width));
    else localStorage.removeItem(WIDTH_KEY);
  } catch {
    // storage ຖືກປິດ — ຈື່ສະເພາະໃນໜ້ານີ້
  }
};

type Side = 'left' | 'right';

/**
 * ລາກພາບລວມໄປວາງບ່ອນໃດກໍໄດ້ໃນ desktop (ຈັບທີ່ຫົວ) — ຈື່ໄວ້ໃນ browser ນີ້, ກົດສອງເທື່ອທີ່ຫົວ = ກັບບ່ອນເດີມ.
 * ລາກຂອບຊ້າຍ/ຂວາ = ຂະຫຍາຍເຂົ້າ-ອອກ (ກົດສອງເທື່ອທີ່ຂອບ = ກວ້າງເທົ່າເດີມ). ຄວາມກວ້າງຕັ້ງເປັນ --glance-w ຂອງ desktop
 * ໃຫ້ພື້ນທີ່ໄອຄອນຫຼົບຕາມ. ຢູ່ໃນຂອບ desktop ສະເໝີ (ຈໍປ່ຽນຂະໜາດກໍ່ດຶງກັບເຂົ້າມາ)
 */
const useGlanceDrag = () => {
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ pointerId: number; dx: number; dy: number; last: Point | null } | null>(null);
  const resizeRef = useRef<{ pointerId: number; side: Side; startX: number; startW: number; startLeft: number; top: number; moved: boolean } | null>(null);
  const [position, setPosition] = useState<Point | null>(readPosition);
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState<number | null>(readWidth);
  const [resizing, setResizing] = useState(false);

  // ຄວາມກວ້າງ → --glance-w ຂອງ desktop (ພາບລວມ + ພື້ນທີ່ໄອຄອນ ໃຊ້ຮ່ວມກັນ)
  useEffect(() => {
    const stage = panelRef.current?.offsetParent as HTMLElement | null;
    if (!stage) return;
    if (width) stage.style.setProperty('--glance-w', `${width}px`);
    else stage.style.removeProperty('--glance-w');
    return () => {
      stage.style.removeProperty('--glance-w');
    };
  }, [width]);

  const clamp = useCallback((point: Point): Point => {
    const panel = panelRef.current;
    const stage = panel?.offsetParent as HTMLElement | null;
    if (!panel || !stage) return point;
    const maxX = Math.max(EDGE, stage.clientWidth - panel.offsetWidth - EDGE);
    const maxY = Math.max(EDGE, stage.clientHeight - TASKBAR_GAP - MIN_VISIBLE);
    return { x: Math.round(Math.min(Math.max(point.x, EDGE), maxX)), y: Math.round(Math.min(Math.max(point.y, EDGE), maxY)) };
  }, []);

  // desktop ປ່ຽນຂະໜາດ → ດຶງພາບລວມກັບເຂົ້າມາໃນຂອບ
  useEffect(() => {
    const stage = panelRef.current?.offsetParent;
    if (!stage) return;
    const observer = new ResizeObserver(() => setPosition((prev) => {
      if (!prev) return prev;
      const next = clamp(prev);
      return next.x === prev.x && next.y === prev.y ? prev : next;
    }));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [clamp]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (event.button !== 0 || !panel || (event.target as HTMLElement).closest('button')) return;
    dragRef.current = { pointerId: event.pointerId, dx: event.clientX - panel.offsetLeft, dy: event.clientY - panel.offsetTop, last: null };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.last = clamp({ x: event.clientX - drag.dx, y: event.clientY - drag.dy });
    setPosition(drag.last);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.last) savePosition(drag.last);
    dragRef.current = null;
    setDragging(false);
  };

  const reset = () => {
    setPosition(null);
    savePosition(null);
  };

  /**
   * ຄວາມກວ້າງໃໝ່ຈາກຂອບທີ່ລາກ: ຂວາ = ຊ້າຍຢູ່ກັບທີ່; ຊ້າຍ = ຂວາຢູ່ກັບທີ່ (ບ່ອນເດີມຍັງຕິດຂວາຄືເກົ່າ, ຖືກຍ້າຍແລ້ວ = ເລື່ອນ x).
   * ບໍ່ໃຫ້ລົ້ນຂອບ desktop
   */
  const applyWidth = (side: Side, startLeft: number, startW: number, nextW: number, top: number) => {
    const stage = panelRef.current?.offsetParent as HTMLElement | null;
    const stageW = stage?.clientWidth ?? window.innerWidth;
    const right = startLeft + startW;
    const room = side === 'right' ? stageW - EDGE - startLeft : right - EDGE;
    const next = Math.round(Math.max(MIN_WIDTH, Math.min(nextW, MAX_WIDTH, room)));
    setWidth(next);
    // ຂວາ ຫຼື ຖືກຍ້າຍແລ້ວ → ຕຳແໜ່ງຊັດເຈນ; ຊ້າຍ ຢູ່ບ່ອນເດີມ → ຍັງຕິດຂວາ (ບໍ່ຕ້ອງມີຕຳແໜ່ງ)
    const point = side === 'right' ? { x: startLeft, y: top } : position ? { x: right - next, y: top } : null;
    if (point) setPosition(point);
    return { width: next, point };
  };

  const onResizeDown = (side: Side) => (event: PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (event.button !== 0 || !panel) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { pointerId: event.pointerId, side, startX: event.clientX, startW: panel.offsetWidth, startLeft: panel.offsetLeft, top: panel.offsetTop, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  };

  const onResizeMove = (event: PointerEvent<HTMLElement>) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== event.pointerId) return;
    const dx = event.clientX - r.startX;
    r.moved = true;
    applyWidth(r.side, r.startLeft, r.startW, r.side === 'right' ? r.startW + dx : r.startW - dx, r.top);
  };

  const onResizeUp = (event: PointerEvent<HTMLElement>) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== event.pointerId) return;
    const panel = panelRef.current;
    if (r.moved && panel) {
      saveWidth(panel.offsetWidth);
      if (r.side === 'right' || position) savePosition({ x: panel.offsetLeft, y: panel.offsetTop });
    }
    resizeRef.current = null;
    setResizing(false);
  };

  const onResizeKey = (side: Side) => (event: KeyboardEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (!panel || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const outward = side === 'right' ? event.key === 'ArrowRight' : event.key === 'ArrowLeft';
    const result = applyWidth(side, panel.offsetLeft, panel.offsetWidth, panel.offsetWidth + (outward ? KEY_STEP : -KEY_STEP), panel.offsetTop);
    saveWidth(result.width);
    if (result.point) savePosition(result.point);
  };

  const resetWidth = () => {
    setWidth(null);
    saveWidth(null);
  };

  const resizer = (side: Side) => ({
    onPointerDown: onResizeDown(side),
    onPointerMove: onResizeMove,
    onPointerUp: onResizeUp,
    onPointerCancel: onResizeUp,
    onKeyDown: onResizeKey(side),
    onDoubleClick: resetWidth,
  });

  const style = position
    ? { left: position.x, top: position.y, right: 'auto', maxHeight: `calc(100% - ${position.y}px - ${TASKBAR_GAP}px)` }
    : undefined;

  return {
    panelRef,
    dragging,
    resizing,
    resizer,
    style,
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onDoubleClick: reset },
  };
};

type Todo = { key: string; tone: 'danger' | 'warn'; icon: string; title: string; sub: string; amount: string; target: ShortcutId };

/**
 * ພາບລວມສິ່ງທີ່ຕ້ອງຮູ້ທັນທີ ຢູ່ຂວາຂອງ desktop: ເງິນທີ່ມີ, ກຳໄລເດືອນນີ້, ລູກໜີ້ ແລະ ເຈົ້າໜີ້ຄ້າງ,
 * ງົບປະມານທີ່ກຳລັງດຳເນີນງານ (ປີປິດບັນຊີແລ້ວ ບໍ່ສະແດງ) + ລາຍການຕ້ອງຕິດຕາມ.
 * ແຕ່ລະບັດຜູກກັບເມນູຂອງມັນ: ບໍ່ມີເມນູ = ບໍ່ສະແດງ, ເມນູລັອກ = ບໍ່ດຶງຂໍ້ມູນ (ກົດແລ້ວຖາມລະຫັດ), ກົດບັດ = ເປີດເມນູນັ້ນ.
 * ໂຫຼດໃໝ່: ປິດໜ້າຕ່າງ, ທຸກ 1 ນາທີ ຫຼື ກົດປຸ່ມ. ລາກທີ່ຫົວເພື່ອຍ້າຍ (useGlanceDrag)
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
  const { panelRef, dragging, resizing, resizer, style, handle } = useGlanceDrag();

  const accessOf = (id: ShortcutId): Access => {
    const menu = menus.find((m) => m.id === id);
    return !menu ? 'none' : menu.locked ? 'locked' : 'open';
  };
  const access = {
    cash: accessOf('cashBank'),
    month: accessOf('financialStatements'),
    ar: accessOf('receivables'),
    ap: accessOf('payables'),
    budget: accessOf('budget'),
  };
  // ຄຳຮ້ອງຂອງ HR ຂຶ້ນໃນ "ຕ້ອງຕິດຕາມ" ສະເພາະເມື່ອເປີດໜ້າຕ່າງນັ້ນໄດ້ (ບໍ່ນັບເຂົ້າ anyOpen — ບໍ່ມີບັດຂອງຕົນເອງ)
  const hrAccess = { attendance: accessOf('attendance') === 'open', payroll: accessOf('payroll') === 'open' };
  const accessKey = [...Object.values(access), hrAccess.attendance || hrAccess.payroll ? 'open' : 'none'].join('|');

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!menusLoaded) return;
    let cancelled = false;
    const [cash, month, ar, ap, budget, hr] = accessKey.split('|').map((a) => a === 'open');
    setLoading(true);
    Promise.all([
      settle(cash, loadCash),
      settle(month, loadMonth),
      settle(ar, () => loadDebt(1)),
      settle(ap, () => loadDebt(2)),
      settle(budget, loadBudget),
      settle(hr, loadHrPending),
    ]).then(([c, m, r, p, b, h]) => {
      if (cancelled) return;
      setData({ cash: c, month: m, ar: r, ap: p, budget: b, hr: h, at: new Date() });
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

  const card = (id: ShortcutId, key: keyof typeof access, tone: string, icon: string, title: string, body: () => ReactNode, wide = false) => {
    if (access[key] === 'none') return null;
    const value = data?.[key];
    return (
      <button type="button" className={`acc-glance-card is-${tone}${wide ? ' is-wide' : ''}`} onClick={() => openShortcut(id)}>
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

  /** ງົບ: ໃຊ້ໄປແລ້ວ / ງົບທັງໝົດ, ແຖບຄວາມຄືບໜ້າ (ເຄື່ອງໝາຍ = ຕາມແຜນຮອດມື້ນີ້), ໝວດທີ່ໃຊ້ຫຼາຍສຸດ ແລະ ຈຳນວນທີ່ຕ້ອງລະວັງ */
  const budgetBody = () => {
    const budget = data?.budget as NonNullable<BudgetSummary>;
    const status = statusOf(budget.total, budget.used);
    const planPct = budget.total > 0 ? Math.min(100, (budget.plan / budget.total) * 100) : 0;
    const bar = (amount: number, used: number, plan?: number) => (
      <span className="acc-glance-bar">
        <i className={`is-${statusOf(amount, used)}`} style={{ width: `${Math.min(100, percentOf(amount, used))}%` }} />
        {!!plan && <u style={{ left: `${plan}%` }} title={t('glanceBudgetPlan')} />}
      </span>
    );
    return (
      <>
        <span className="acc-glance-budget-head">
          <span className="acc-glance-money">
            <b>{money(BASE, budget.used)}</b>
            <small>{t('glanceBudgetOf')} {money(BASE, budget.total)} · {t('budgetRemaining')} {formatNumber(Math.round(budget.total - budget.used))}</small>
          </span>
          <em className={`acc-glance-pct is-${status}`}>{percentText(budget.total, budget.used)}</em>
        </span>
        {bar(budget.total, budget.used, planPct)}
        {!!budget.top.length && (
          <span className="acc-glance-budget-lines">
            {budget.top.map((line) => (
              <span key={line.id}>
                <small>{line.name}</small>
                {bar(line.amount, line.used)}
                <em className={`is-${statusOf(line.amount, line.used)}`}>{percentText(line.amount, line.used)}</em>
              </span>
            ))}
          </span>
        )}
        <span className="acc-glance-chips">
          {!!budget.over && <em className="is-bad"><i className="fa-solid fa-circle-exclamation" /> {t('glanceBudgetOver')} {budget.over}</em>}
          {!!budget.near && <em className="is-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('glanceBudgetNear')} {budget.near}</em>}
          {!budget.over && !budget.near && <em className="is-good"><i className="fa-solid fa-circle-check" /> {t('glanceBudgetOk')}</em>}
          <em className="is-muted">{budget.lines} {t('glanceBudgetLines')}</em>
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
  // ຄຳຮ້ອງຈາກພະນັກງານທີ່ລໍຖ້າ HR (ບໍ່ມີສິດ / API ລຸ້ນເກົ່າ = ບໍ່ຂຶ້ນ)
  const hr = isFailed(data?.hr) ? undefined : data?.hr;
  const hrTodo = (key: string, count: number | undefined, icon: string, title: string, target: 'attendance' | 'payroll') => {
    if (!count || !hrAccess[target]) return;
    todos.push({ key, tone: 'warn', icon, title: t(title), sub: t('glanceHrWaiting'), amount: `${count}`, target });
  };
  hrTodo('hr-leave', hr?.leave, 'fa-plane-departure', 'attLeaveRequests', 'attendance');
  hrTodo('hr-correction', hr?.correction, 'fa-fingerprint', 'attCorrections', 'attendance');
  hrTodo('hr-advance', hr?.advance, 'fa-hand-holding-dollar', 'advMenu', 'payroll');
  hrTodo('hr-advance-pay', hr?.advance_to_pay, 'fa-money-bill-transfer', 'advToPay', 'payroll');
  if (ar) debtTodos('ar', ar.overdue, 'danger');
  if (ap) debtTodos('ap', ap.overdue, 'danger');
  if (ap) debtTodos('ap', ap.dueSoon, 'warn');
  const anyOpen = Object.values(access).some((a) => a === 'open');

  return (
    <aside ref={panelRef} className={`acc-glance${dragging ? ' is-dragging' : ''}${resizing ? ' is-resizing' : ''}`} style={style} aria-label={t('glanceTitle')}>
      {(['left', 'right'] as const).map((side) => (
        <span key={side} className={`acc-glance-resize is-${side}`} role="separator" aria-orientation="vertical" tabIndex={0}
          title={t('glanceResizeHint')} aria-label={t('glanceResizeHint')} {...resizer(side)}
        >
          <i />
        </span>
      ))}
      <div className="acc-glance-body">
      <header className="acc-glance-head" title={t('glanceDragHint')} {...handle}>
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
        {/* ງົບ: ບໍ່ມີງົບທີ່ດຳເນີນງານ (null) → ບໍ່ສະແດງບັດ */}
        {data?.budget !== null && card('budget', 'budget', 'violet', 'fa-bullseye',
          `${t('accountAppBudget')}${data?.budget && !isFailed(data.budget) ? ` ${data.budget.name}` : ''}`, budgetBody, true)}
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
      </div>
    </aside>
  );
};

export default DesktopGlance;
