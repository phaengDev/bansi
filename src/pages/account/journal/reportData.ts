import moment, { type Moment } from 'moment';
import { currencySymbol } from '../ledger/currency';
import { incomeDateOf, type Income } from './IncomeForm';
import { expenseDateOf, type Expense, type ExpenseItem } from './ExpenseForm';
import { TRANSFER } from './journalKit';

/**
 * ຂໍ້ມູນຂອງໜ້າລາຍງານ (EntryReport) — ແປງລາຍຮັບ / ລາຍຈ່າຍ ເປັນຮູບດຽວກັນ (Entry) ແລ້ວສະຫຼຸບຢູ່ໜ້າເວັບ
 * ຈາກ POST /income/fetch ແລະ /expense/fetch (ບໍ່ມີ API ລາຍງານແຍກ)
 */
export type ReportKind = 'income' | 'expense';

export type Entry = {
  id: number;
  number: string;
  date: Moment;
  /** YYYY-MM-DD */
  dateKey: string;
  title: string;
  category: { id: number; code: string; name: string } | null;
  account: { id: number; name: string; bank: string | null; url: string | null } | null;
  currency: { key: string; symbol: string };
  /** true = ເງິນໂອນ, false = ເງິນສົດ */
  transfer: boolean;
  /** ຜູ້ໂອນ (ລາຍຮັບ) / ຜູ້ຮັບເງິນ (ລາຍຈ່າຍ) */
  party: string | null;
  /** ຈຳນວນກ່ອນອາກອນ / ອາກອນ / ຍອດແທ້ທີ່ເຂົ້າ-ອອກບັນຊີ */
  base: number;
  tax: number;
  amount: number;
  active: boolean;
  user: string | null;
  items: ExpenseItem[];
  /** ແຖວເດີມ — ເປີດ IncomeDetail / ExpenseDetail */
  raw: Income | Expense;
};

const ACTIVE = 1;

const currencyOf = (cur?: { name?: string; genus?: string } | null) => ({
  key: cur?.name ?? '—',
  symbol: currencySymbol(cur),
});

const accountOf = (acc: Income['acount'] | Expense['acount']) =>
  acc
    ? { id: acc._uuid, name: acc.acountName, bank: acc.banks?.abbr ?? null, url: acc.banks?.url ?? null }
    : null;

export const fromIncome = (r: Income): Entry => {
  const date = incomeDateOf(r);
  return {
    id: r._uuid,
    number: r.number,
    date,
    dateKey: date.format('YYYY-MM-DD'),
    title: r.incom_title,
    category: r.typein ? { id: r.typein._uuid, code: r.typein.type_code, name: r.typein.type_name } : null,
    account: accountOf(r.acount),
    currency: currencyOf(r.acount?.treasury?.currency),
    transfer: Number(r.receive_type) === TRANSFER,
    // ລູກຄ້າ (ໃນລາຍຊື່ ຫຼື ພິມເອງ) ກ່ອນ — ລາຍການເກົ່າທີ່ບໍ່ມີ ໃຊ້ຊື່ບັນຊີຜູ້ໂອນແທນ
    party: r.partner?.name || r.payer_name || [r.payer_account_name, r.payerBank?.abbr].filter(Boolean).join(' · ') || null,
    base: Number(r.balances) || 0,
    tax: Number(r.tax) || 0,
    amount: Number(r.balance_income) || 0,
    active: Number(r.status) === ACTIVE,
    user: r.user?.user_name ?? null,
    items: [],
    raw: r,
  };
};

export const fromExpense = (r: Expense): Entry => {
  const date = expenseDateOf(r);
  return {
    id: r._uuid,
    number: r.number,
    date,
    dateKey: date.format('YYYY-MM-DD'),
    title: r.expense_title,
    category: r.typeout ? { id: r.typeout._uuid, code: r.typeout.type_code, name: r.typeout.type_name } : null,
    account: accountOf(r.acount),
    currency: currencyOf(r.acount?.treasury?.currency),
    transfer: Number(r.pay_type) === TRANSFER,
    party: r.partner?.name || r.payee_name || r.payeeBank?.abbr || null,
    base: Number(r.subtotal) || 0,
    tax: Number(r.tax) || 0,
    amount: Number(r.balance_expense) || 0,
    active: Number(r.status) === ACTIVE,
    user: r.user?.user_name ?? null,
    items: r.items ?? [],
    raw: r,
  };
};

// ---- ຊ່ວງເວລາ ----
export type Period = 'month' | 'lastMonth' | 'quarter' | 'year' | 'custom';
export type Range = { start: Moment; end: Moment };

export const rangeOf = (period: Exclude<Period, 'custom'>): Range => {
  const now = moment();
  if (period === 'lastMonth') {
    const last = now.clone().subtract(1, 'month');
    return { start: last.clone().startOf('month'), end: last.clone().endOf('month') };
  }
  const unit = period === 'month' ? 'month' : period === 'quarter' ? 'quarter' : 'year';
  return { start: now.clone().startOf(unit), end: now.clone().endOf(unit) };
};

/** ຊ່ວງກ່ອນໜ້າ ສຳລັບທຽບ — ເດືອນ/ໄຕມາດ/ປີ ຍ້ອນຫຼັງ 1 ໜ່ວຍ; ກຳນົດເອງ = ຈຳນວນມື້ເທົ່າກັນ ກ່ອນວັນເລີ່ມ */
export const previousRange = (period: Period, range: Range): Range => {
  if (period === 'month' || period === 'lastMonth') {
    const prev = range.start.clone().subtract(1, 'month');
    return { start: prev.clone().startOf('month'), end: prev.clone().endOf('month') };
  }
  if (period === 'quarter' || period === 'year') {
    const unit = period === 'quarter' ? 'quarter' : 'year';
    const prev = range.start.clone().subtract(1, unit);
    return { start: prev.clone().startOf(unit), end: prev.clone().endOf(unit) };
  }
  const days = range.end.clone().startOf('day').diff(range.start.clone().startOf('day'), 'days') + 1;
  const end = range.start.clone().subtract(1, 'day').endOf('day');
  return { start: end.clone().subtract(days - 1, 'days').startOf('day'), end };
};

// ---- ສະຫຼຸບ ----
export type Bucket = { key: string; label: string; sub?: string; url?: string | null; total: number; count: number };

/** ລວມຕາມ key — ລຽງຍອດຫຼາຍສຸດກ່ອນ */
export const groupSum = (entries: Entry[], keyOf: (e: Entry) => { key: string; label: string; sub?: string; url?: string | null }) => {
  const map = new Map<string, Bucket>();
  entries.forEach((e) => {
    const k = keyOf(e);
    const bucket = map.get(k.key) ?? { ...k, total: 0, count: 0 };
    bucket.total += e.amount;
    bucket.count += 1;
    map.set(k.key, bucket);
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
};

/**
 * ແທ່ງກຣາຟຕາມເວລາ — ຊ່ວງບໍ່ເກີນ 62 ມື້ = ລາຍວັນ, ເກີນນັ້ນ = ລາຍເດືອນ. ທຸກຊ່ອງໃນຊ່ວງມີແທ່ງ (ບໍ່ມີລາຍການ = 0)
 */
export const trendOf = (entries: Entry[], range: Range) => {
  const days = range.end.clone().startOf('day').diff(range.start.clone().startOf('day'), 'days') + 1;
  const daily = days <= 62;
  const unit = daily ? 'day' : 'month';
  const fmt = daily ? 'YYYY-MM-DD' : 'YYYY-MM';
  const slots: { key: string; label: string; tip: string; total: number; count: number }[] = [];
  for (let d = range.start.clone().startOf(unit); d.isSameOrBefore(range.end, unit); d.add(1, unit)) {
    slots.push({
      key: d.format(fmt),
      label: daily ? d.format('D') : d.format('MM'),
      tip: daily ? d.format('DD/MM/YYYY') : d.format('MM/YYYY'),
      total: 0,
      count: 0,
    });
  }
  const index = new Map(slots.map((s, i) => [s.key, i]));
  entries.forEach((e) => {
    const i = index.get(e.date.format(fmt));
    if (i === undefined) return;
    slots[i].total += e.amount;
    slots[i].count += 1;
  });
  return { daily, slots };
};

/** ລາຍການຍ່ອຍຂອງລາຍຈ່າຍ ລວມຕາມຊື່ + ຫົວໜ່ວຍ — ຈ່າຍຫຍັງຫຼາຍສຸດ */
export const topItems = (entries: Entry[], limit = 10) => {
  const map = new Map<string, { name: string; unit: string | null; qty: number; total: number; count: number }>();
  entries.forEach((e) =>
    e.items.forEach((item) => {
      const key = `${item.item_name.trim().toLowerCase()}|${item.unit ?? ''}`;
      const row = map.get(key) ?? { name: item.item_name.trim(), unit: item.unit, qty: 0, total: 0, count: 0 };
      row.qty += Number(item.quantity) || 0;
      row.total += Number(item.amount) || 0;
      row.count += 1;
      map.set(key, row);
    })
  );
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
};

/** % ປ່ຽນແປງທຽບຊ່ວງກ່ອນ — ຊ່ວງກ່ອນເປັນ 0 = ບໍ່ມີຕົວທຽບ (null) */
export const changeOf = (current: number, previous: number) =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;
