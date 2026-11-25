import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { formatNumber, getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { isNotReady } from '../gl/glApi';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';

/**
 * ເງິນກູ້ (GET/POST /loan/… ຂອງ api-bansi loanController) — 1 ເງິນກູ້ຢືມ (ບໍລິສັດເປັນໜີ້), 2 ເງິນໃຫ້ກູ້ (ບໍລິສັດເປັນເຈົ້າໜີ້)
 */
export const BORROWED = 1;
export const LENT = 2;
export type Direction = typeof BORROWED | typeof LENT;

/** ວິທີຄິດດອກເບ້ຍ — ຄ່າກົງກັບ METHODS ຂອງ backend (utils/loanSchedule) */
export const LOAN_METHODS = [
  { value: 1, label: 'lnMethodAnnuity', hint: 'lnMethodAnnuityHint', icon: 'fa-equals' },
  { value: 2, label: 'lnMethodPrincipal', hint: 'lnMethodPrincipalHint', icon: 'fa-arrow-trend-down' },
  { value: 3, label: 'lnMethodFlat', hint: 'lnMethodFlatHint', icon: 'fa-grip-lines' },
  { value: 4, label: 'lnMethodBullet', hint: 'lnMethodBulletHint', icon: 'fa-flag-checkered' },
];
export const LOAN_FREQUENCIES = [
  { value: 1, label: 'lnFreq1' },
  { value: 3, label: 'lnFreq3' },
  { value: 6, label: 'lnFreq6' },
  { value: 12, label: 'lnFreq12' },
];

export type LoanCurrency = { _id: number; name: string; genus?: string | null } | null;

/** ສະຫຼຸບທີ່ backend ຄິດໃຫ້ (summarize) — ລາຍການ ແລະ ລາຍລະອຽດ */
export type LoanSummary = {
  outstanding: number;
  closed: boolean;
  paid_principal: number;
  paid_interest: number;
  paid_fee: number;
  total_interest: number;
  installments: number;
  paid_installments: number;
  next: { no: number; due_date: string; principal: number; interest: number; amount: number } | null;
  overdue_count: number;
  overdue_amount: number;
};

export type Loan = LoanSummary & {
  _uuid: number;
  loan_code: string;
  direction: Direction;
  counterparty: string;
  contract_no: string | null;
  currency_id: number | null;
  currency: LoanCurrency;
  principal: number;
  annual_rate: number;
  method: number;
  day_basis: number;
  frequency_months: number;
  term: number;
  start_date: string;
  first_due_date: string;
  /** 1 = ຮັບ/ຈ່າຍຜ່ານບັນຊີເງິນຄັງ, 2 = ຍອດຍົກມາ */
  start_mode: number;
  treasury_account_id: number | null;
  opening_date: string | null;
  loan_account_id: number;
  interest_account_id: number | null;
  purpose: string | null;
  note: string | null;
};

/** ສະຖານະຂອງງວດ (backend summarize) */
export type InstallmentState = 'paid' | 'settled' | 'closed' | 'overdue' | 'partial' | 'upcoming';

export type Installment = {
  no: number;
  period_start: string;
  due_date: string;
  principal: number;
  interest: number;
  payment: number;
  paid_principal: number;
  paid_interest: number;
  due_principal: number;
  due_interest: number;
  state: InstallmentState;
};

export type LoanPayment = {
  _uuid: number;
  number: string | null;
  pay_date: string;
  treasury_account_id: number;
  principal: number;
  interest: number;
  fee: number;
  total: number;
  reference: string | null;
  note: string | null;
  /** 1 ໃຊ້ງານ, 2 ຍົກເລີກ */
  status: number;
  treasury: { acountName: string; account_code?: string | null } | null;
  entry_number: string | null;
};

export type LoanDetail = Loan & {
  treasury: { acountName: string; account_code?: string | null } | null;
  /** ມີການຈ່າຍ ຫຼື ຄິດດອກເບ້ຍຄ້າງແລ້ວ — ແກ້ເງື່ອນໄຂ / ລຶບ ບໍ່ໄດ້ */
  locked: boolean;
  schedule: Installment[];
  payments: LoanPayment[];
};

/** ແຖວຕົວຢ່າງຈາກ POST /loan/preview */
export type ScheduleRow = { no: number; period_start: string; due_date: string; days: number; principal: number; interest: number; payment: number; balance: number };

export const STATE_CHIPS: Record<InstallmentState, { label: string; icon: string }> = {
  paid: { label: 'lnStatePaid', icon: 'fa-circle-check' },
  settled: { label: 'lnStateSettled', icon: 'fa-flag-checkered' },
  closed: { label: 'lnStateClosed', icon: 'fa-circle-minus' },
  overdue: { label: 'lnStateOverdue', icon: 'fa-triangle-exclamation' },
  partial: { label: 'lnStatePartial', icon: 'fa-circle-half-stroke' },
  upcoming: { label: 'lnStateUpcoming', icon: 'fa-clock' },
};

/** ທຸກເງິນກູ້ (ທັງສອງທາງ) + ລະຫັດຖັດໄປ */
export const useLoans = () => {
  const [rows, setRows] = useState<Loan[]>([]);
  const [nextCode, setNextCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi('/loan/fetch');
      setRows(res.data?.data ?? []);
      setNextCode(res.data?.next_code ?? '');
      setError('');
    } catch (err) {
      if (isNotReady(err)) setNotReady(true);
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, nextCode, loading, error, notReady, reload };
};

/** ບັນຊີເງິນຄັງທີ່ໃຊ້ງານ ພ້ອມຍອດ ແລະ ສະກຸນ (ຮັບ/ຈ່າຍເງິນກູ້) — currencyId = ສະເພາະສະກຸນນັ້ນ */
export const useTreasuryAccounts = (currencyId?: number | null) => {
  const [rows, setRows] = useState<TreasuryAccount[]>([]);
  useEffect(() => {
    let alive = true;
    postApi('/treasury-account/fetch', {})
      .then((res) => alive && setRows((res.data?.data ?? []).filter((a: TreasuryAccount) => Number(a.status) === 1)))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);
  return currencyId ? rows.filter((a) => Number(a.treasury?.currencyId) === Number(currencyId)) : rows;
};

/** ຈຳນວນເງິນ + ສັນຍາລັກສະກຸນ (₭ 1,000) */
export const money = (value: number, currency?: { genus?: string | null; name?: string | null } | null) => `${currency?.genus || currency?.name || '₭'} ${formatNumber(value)}`;

export const showDate = (value: string | null | undefined) => (value ? moment(value, 'YYYY-MM-DD').format('DD/MM/YYYY') : '—');

/** ໄລຍະເວລາ — 24 ງວດ ທຸກເດືອນ → "2 ປີ" */
export const termText = (term: number, frequency: number, t: (key: string) => string) => {
  const months = term * frequency;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years && `${years} ${t('faYears')}`, rest && `${rest} ${t('faMonths')}`].filter(Boolean).join(' ') || `0 ${t('faMonths')}`;
};
