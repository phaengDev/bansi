import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import type { FiscalYear } from '../../../utils/selectOption';

/**
 * ງົບປະມານລາຍຈ່າຍ (api-bansi /budget/*) — ຕັ້ງຕາມປະເພດລາຍຈ່າຍ ຕໍ່ປີການເງິນ, ແບ່ງລາຍເດືອນໄດ້, ເປັນ LAK.
 * ຍອດໃຊ້ຈິງ = ຍອດຈ່າຍອອກແທ້ (ລວມອາກອນ) ຂອງລາຍຈ່າຍທີ່ໃຊ້ງານ ແປງເປັນ LAK ຕາມອັດຕາຂອງວັນທີຈ່າຍ (backend ຄິດໃຫ້)
 */

// ປີການເງິນ — ປະເພດ ແລະ hook ດຶງລາຍການຢູ່ utils/selectOption (status 2 = ປິດບັນຊີແລ້ວ, ງົບແກ້ບໍ່ໄດ້)
export type { FiscalYear };

export type BudgetCategory = { _uuid: number; type_code: string; type_name: string; status?: number };

/** "YYYY-MM" → ຍອດ */
export type MonthAmounts = Record<string, number>;

export type BudgetRow = {
  _uuid: number;
  fiscal_id: number;
  category_id: number;
  category: BudgetCategory | null;
  /** ງົບທັງປີ (= ຜົນລວມທຸກເດືອນ ເມື່ອແບ່ງລາຍເດືອນ) */
  amount: number;
  is_monthly: 0 | 1;
  description: string | null;
  /** ງົບແຕ່ລະເດືອນ — ວ່າງເມື່ອບໍ່ໄດ້ແບ່ງ */
  months: MonthAmounts;
  actual: number;
  actual_months: MonthAmounts;
  /** ຈຳນວນລາຍຈ່າຍທີ່ນັບ */
  count: number;
};

/** ປະເພດລາຍຈ່າຍທີ່ມີການຈ່າຍໃນປີ ແຕ່ຍັງບໍ່ໄດ້ຕັ້ງງົບ */
export type Unbudgeted = Pick<BudgetRow, 'category_id' | 'category' | 'actual' | 'actual_months' | 'count'>;

export type BudgetData = {
  fiscal: FiscalYear;
  /** ທຸກເດືອນຂອງປີການເງິນ "YYYY-MM" */
  months: string[];
  data: BudgetRow[];
  unbudgeted: Unbudgeted[];
  /** ລາຍຈ່າຍທີ່ບໍ່ໄດ້ນັບ ເພາະສະກຸນເງິນຍັງບໍ່ມີອັດຕາແລກປ່ຽນ */
  missing_rate: number;
};

/** ຜົນຂອງ POST /budget/check — ຟອມລາຍຈ່າຍສະແດງງົບຂອງປະເພດທີ່ເລືອກ */
export type BudgetCheck =
  | { has_budget: false; fiscal_code: string | null }
  | {
      has_budget: true;
      budget_id: number;
      fiscal_code: string;
      period: string;
      budget: number;
      used: number;
      /** ລາຍຈ່າຍນີ້ເປັນ LAK — null = ສະກຸນຂອງບັນຊີຍັງບໍ່ມີອັດຕາແລກປ່ຽນ */
      amount_lak: number | null;
      /** ງົບຄົງເຫຼືອຫຼັງບັນທຶກລາຍຈ່າຍນີ້ (ລົບ = ເກີນງົບ) */
      after: number;
      month: { budget: number; used: number; after: number } | null;
      missing_rate: number;
    };

export type BudgetStatus = 'idle' | 'using' | 'near' | 'full' | 'over';

/** ໃຊ້ໄປແລ້ວຕັ້ງແຕ່ % ນີ້ = ໃກ້ໝົດງົບ */
export const NEAR_LIMIT = 80;

export const BUDGET_STATUS: Record<BudgetStatus, { label: string; icon: string }> = {
  idle: { label: 'budgetStatusIdle', icon: 'fa-hourglass-start' },
  using: { label: 'budgetStatusUsing', icon: 'fa-spinner' },
  near: { label: 'budgetStatusNear', icon: 'fa-triangle-exclamation' },
  full: { label: 'budgetStatusFull', icon: 'fa-circle-check' },
  over: { label: 'budgetStatusOver', icon: 'fa-circle-exclamation' },
};

/** ລຳດັບຕົວກັ່ນ ແລະ ການລຽງ (ຕ້ອງລະວັງກ່ອນ) */
export const STATUS_ORDER: BudgetStatus[] = ['over', 'near', 'full', 'using', 'idle'];

const EPSILON = 0.005;

export const statusOf = (budget: number, used: number): BudgetStatus => {
  if (used > budget + EPSILON) return 'over';
  if (budget > 0 && Math.abs(budget - used) < EPSILON) return 'full';
  if (used <= 0) return 'idle';
  return (used / budget) * 100 >= NEAR_LIMIT ? 'near' : 'using';
};

/** % ທີ່ໃຊ້ໄປ — ງົບ 0 ແຕ່ມີການໃຊ້ = ຖືວ່າ 100%+ */
export const percentOf = (budget: number, used: number) => (budget > 0 ? (used / budget) * 100 : used > 0 ? 100 : 0);

export const percentText = (budget: number, used: number) => {
  if (budget <= 0) return used > 0 ? '—' : '0%';
  const pct = percentOf(budget, used);
  return `${pct >= 10 || pct === 0 ? Math.round(pct) : pct.toFixed(1)}%`;
};

/** ສັດສ່ວນຂອງປີການເງິນທີ່ຜ່ານໄປແລ້ວ (0–1) — ປີທີ່ຍັງບໍ່ເລີ່ມ 0, ປີທີ່ສິ້ນສຸດແລ້ວ 1 */
export const elapsedOf = (fiscal: FiscalYear) => {
  const start = moment(fiscal.start_date, 'YYYY-MM-DD');
  const end = moment(fiscal.end_date, 'YYYY-MM-DD').endOf('day');
  const total = end.diff(start, 'days') + 1;
  const done = moment().diff(start, 'days') + 1;
  return Math.min(Math.max(done, 0), total) / total;
};

/**
 * ງົບທີ່ຄວນໃຊ້ໄປແລ້ວຮອດມື້ນີ້ — ແບ່ງລາຍເດືອນ: ລວມງົບເດືອນທີ່ຜ່ານມາ + ເດືອນນີ້ຕາມສ່ວນຂອງມື້;
 * ງົບທັງປີ: ງົບ × ສ່ວນຂອງປີທີ່ຜ່ານໄປ. ໃຊ້ວາງເຄື່ອງໝາຍ "ຕາມແຜນ" ເທິງແຖບຄວາມຄືບໜ້າ
 */
export const planToDate = (row: Pick<BudgetRow, 'amount' | 'is_monthly' | 'months'>, fiscal: FiscalYear) => {
  if (!row.is_monthly) return row.amount * elapsedOf(fiscal);
  const today = moment();
  const current = today.format('YYYY-MM');
  return Object.entries(row.months).reduce((sum, [period, amount]) => {
    if (period < current) return sum + amount;
    if (period > current) return sum;
    return sum + amount * (today.date() / today.daysInMonth());
  }, 0);
};

/** ຈຳນວນເງິນ LAK ເຕັມ (0 = "0" ບໍ່ແມ່ນຂີດ ຄື money() ຂອງ GL — ງົບ 0 ມີຄວາມໝາຍ) */
export const kip = (value: number) => `₭ ${formatNumber(Math.round(Number(value) || 0))}`;

/** ເດືອນ "YYYY-MM" → "MM/YY" (ຫົວຖັນ) */
export const monthLabel = (period: string) => moment(period, 'YYYY-MM').format('MM/YY');

/** ງົບ + ຍອດໃຊ້ຈິງ ຂອງປີການເງິນ — fiscalId null = ປີປັດຈຸບັນ (backend ເລືອກໃຫ້) */
export const useBudgets = (fiscalId: number | null) => {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await postApi('/budget/fetch', fiscalId ? { fiscal_id: fiscalId } : {});
      setData(res.data ?? null);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fiscalId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
};
