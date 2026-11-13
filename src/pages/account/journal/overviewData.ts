import moment, { type Moment } from 'moment';
import { changeOf, trendOf, type Entry, type Range } from './reportData';

/**
 * ຂໍ້ມູນຂອງໜ້າ ພາບລວມ ລາຍຮັບ-ລາຍຈ່າຍ (JournalOverview) — ຄິດຢູ່ໜ້າເວັບຈາກ Entry ຂອງ reportData
 * (ສະເພາະທີ່ໃຊ້ງານ, ສະກຸນດຽວ). ບໍ່ມີ API ແຍກ
 */

export const within = (date: Moment, range: Range) => !date.isBefore(range.start, 'day') && !date.isAfter(range.end, 'day');
const sum = (list: Entry[]) => list.reduce((n, e) => n + e.amount, 0);

/** ຊ່ອງເວລາ (ລາຍວັນ ≤ 62 ມື້, ບໍ່ດັ່ງນັ້ນ ລາຍເດືອນ) — ຮັບ, ຈ່າຍ, ສຸດທິ, ສະສົມ */
export type Slot = {
  key: string;
  label: string;
  tip: string;
  inc: number;
  exp: number;
  incCount: number;
  expCount: number;
  cumInc: number;
  cumExp: number;
  /** ຍັງບໍ່ຮອດ (ຫຼັງມື້ນີ້) */
  future: boolean;
};

export const slotsOf = (incomes: Entry[], expenses: Entry[], range: Range) => {
  const inTrend = trendOf(incomes, range);
  const outTrend = trendOf(expenses, range);
  const todayKey = moment().format(inTrend.daily ? 'YYYY-MM-DD' : 'YYYY-MM');
  let cumInc = 0;
  let cumExp = 0;
  const slots: Slot[] = inTrend.slots.map((s, i) => {
    const out = outTrend.slots[i];
    cumInc += s.total;
    cumExp += out.total;
    return {
      key: s.key, label: s.label, tip: s.tip,
      inc: s.total, exp: out.total, incCount: s.count, expCount: out.count,
      cumInc, cumExp, future: s.key > todayKey,
    };
  });
  return { daily: inTrend.daily, slots };
};

/** ມື້ທີ່ຜ່ານມາແລ້ວໃນຊ່ວງ (ລວມມື້ນີ້) — ໃຊ້ຄິດສະເລ່ຍຕໍ່ມື້ ແລະ ຄາດຄະເນ */
export const daysOf = (range: Range) => {
  const total = range.end.clone().startOf('day').diff(range.start.clone().startOf('day'), 'days') + 1;
  const today = moment().startOf('day');
  const last = moment.min(range.end.clone().startOf('day'), today);
  const elapsed = last.isBefore(range.start, 'day') ? 0 : last.diff(range.start.clone().startOf('day'), 'days') + 1;
  return { total, elapsed: Math.min(total, elapsed) };
};

/** ຍອດລາຍວັນ (YYYY-MM-DD → ຮັບ/ຈ່າຍ) */
export const byDay = (incomes: Entry[], expenses: Entry[]) => {
  const map = new Map<string, { inc: number; exp: number; incCount: number; expCount: number }>();
  const add = (e: Entry, kind: 'inc' | 'exp') => {
    const day = map.get(e.dateKey) ?? { inc: 0, exp: 0, incCount: 0, expCount: 0 };
    day[kind] += e.amount;
    if (kind === 'inc') day.incCount += 1;
    else day.expCount += 1;
    map.set(e.dateKey, day);
  };
  incomes.forEach((e) => add(e, 'inc'));
  expenses.forEach((e) => add(e, 'exp'));
  return map;
};

export type CalendarDay = { key: string; date: Moment; inc: number; exp: number; incCount: number; expCount: number; future: boolean };

/** ທຸກມື້ໃນຊ່ວງ ພ້ອມຍອດ — ປະຕິທິນເງິນ */
export const calendarOf = (incomes: Entry[], expenses: Entry[], range: Range): CalendarDay[] => {
  const map = byDay(incomes, expenses);
  const today = moment().startOf('day');
  const list: CalendarDay[] = [];
  for (let d = range.start.clone().startOf('day'); d.isSameOrBefore(range.end, 'day'); d.add(1, 'day')) {
    const key = d.format('YYYY-MM-DD');
    const v = map.get(key);
    list.push({ key, date: d.clone(), inc: v?.inc ?? 0, exp: v?.exp ?? 0, incCount: v?.incCount ?? 0, expCount: v?.expCount ?? 0, future: d.isAfter(today, 'day') });
  }
  return list;
};

/** ຍອດຕາມມື້ໃນອາທິດ (0 = ຈັນ … 6 = ອາທິດ) */
export const weekdaysOf = (incomes: Entry[], expenses: Entry[]) => {
  const rows = Array.from({ length: 7 }, () => ({ inc: 0, exp: 0 }));
  const idx = (e: Entry) => (e.date.isoWeekday() + 6) % 7;
  incomes.forEach((e) => { rows[idx(e)].inc += e.amount; });
  expenses.forEach((e) => { rows[idx(e)].exp += e.amount; });
  return rows;
};

export type CategoryRow = { key: string; label: string; code: string; total: number; previous: number; count: number; share: number };

/** ຕາມປະເພດ ງວດນີ້ ທຽບງວດກ່ອນ — ລຽງຍອດຫຼາຍສຸດກ່ອນ */
export const categoriesOf = (now: Entry[], before: Entry[], unnamed: string): CategoryRow[] => {
  const map = new Map<string, CategoryRow>();
  const row = (e: Entry) => {
    const key = String(e.category?.id ?? 0);
    const r = map.get(key) ?? { key, label: e.category?.name ?? unnamed, code: e.category?.code ?? '', total: 0, previous: 0, count: 0, share: 0 };
    map.set(key, r);
    return r;
  };
  now.forEach((e) => { const r = row(e); r.total += e.amount; r.count += 1; });
  before.forEach((e) => { row(e).previous += e.amount; });
  const total = sum(now);
  return [...map.values()]
    .filter((r) => r.total || r.previous)
    .map((r) => ({ ...r, share: total ? (r.total / total) * 100 : 0 }))
    .sort((a, b) => b.total - a.total || b.previous - a.previous);
};

export type Party = { key: string; name: string; total: number; count: number };

/** ຜູ້ໂອນ (ລາຍຮັບ) / ຜູ້ຮັບເງິນ (ລາຍຈ່າຍ) ທີ່ມີຍອດຫຼາຍສຸດ */
export const partiesOf = (list: Entry[], limit = 5): Party[] => {
  const map = new Map<string, Party>();
  list.forEach((e) => {
    const name = e.party?.trim();
    if (!name) return;
    const key = name.toLowerCase();
    const p = map.get(key) ?? { key, name, total: 0, count: 0 };
    p.total += e.amount;
    p.count += 1;
    map.set(key, p);
  });
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
};

/** ມື້ຕິດຕໍ່ກັນທີ່ຍາວສຸດ ທີ່ມີ test ເປັນຈິງ (ສະເພາະມື້ທີ່ຜ່ານມາແລ້ວ) */
export const longestStreak = (days: CalendarDay[], test: (d: CalendarDay) => boolean) => {
  let best = 0;
  let run = 0;
  days.filter((d) => !d.future).forEach((d) => {
    run = test(d) ? run + 1 : 0;
    best = Math.max(best, run);
  });
  return best;
};

/** ການປ່ຽນແປງທີ່ສຳຄັນ — ໝວດທີ່ເພີ່ມຂຶ້ນຫຼາຍສຸດ (ຍອດ) */
export const biggestRise = (rows: CategoryRow[]) =>
  rows.filter((r) => r.total > r.previous).sort((a, b) => (b.total - b.previous) - (a.total - a.previous))[0] ?? null;

export const pctChange = changeOf;

/** ລະດັບສີຂອງປະຕິທິນ 0–4 (ຮາກທີສອງ — ມື້ໃຫຍ່ມື້ດຽວບໍ່ກົດມື້ອື່ນໃຫ້ຈາງໝົດ) */
export const levelOf = (value: number, peak: number) => {
  if (!value || peak <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil(Math.sqrt(Math.abs(value) / peak) * 4)));
};
