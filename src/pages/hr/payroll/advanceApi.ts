import { deleteApi, postApi, putApi } from '../../../utils/configApi';
import type { EmployeeRef } from '../hrApi';
import type { PayrollAccount } from './payrollApi';

/**
 * ເງິນເບີກລ່ວງໜ້າ — api-bansi: /advance/*. ລໍຖ້າອະນຸມັດ → ອະນຸມັດ (ລໍຖ້າຈ່າຍ) → ຈ່າຍແລ້ວ (ເງິນອອກ + ລົງບັນຊີ, ຫັກຄືນຈາກເງິນເດືອນ) → ຄືນຄົບ
 */
export const ADV_PENDING = 1;
export const ADV_APPROVED = 2;
export const ADV_ACTIVE = 3;
export const ADV_SETTLED = 4;
export const ADV_REJECTED = 5;
export const ADV_CANCELLED = 6;

/** ຕົວເລືອກ + ສີ (ຢືມ .att-state) ຂອງແຕ່ລະສະຖານະ */
export const ADVANCE_STATUSES: Record<number, { label: string; tone: string; icon: string }> = {
  [ADV_PENDING]: { label: 'advStatusPending', tone: 'is-late', icon: 'fa-hourglass-half' },
  [ADV_APPROVED]: { label: 'advStatusApproved', tone: 'is-leave', icon: 'fa-circle-check' },
  [ADV_ACTIVE]: { label: 'advStatusActive', tone: 'is-unpaid', icon: 'fa-rotate' },
  [ADV_SETTLED]: { label: 'advStatusSettled', tone: 'is-present', icon: 'fa-circle-check' },
  [ADV_REJECTED]: { label: 'advStatusRejected', tone: 'is-absent', icon: 'fa-circle-xmark' },
  [ADV_CANCELLED]: { label: 'advStatusCancelled', tone: 'is-off', icon: 'fa-ban' },
};

export type AdvanceRepayment = {
  _uuid: number;
  /** 1 ຫັກຈາກເງິນເດືອນ, 2 ຮັບຄືນເງິນສົດ/ໂອນ */
  kind: number;
  amount: number;
  repay_date: string;
  period: string | null;
  note: string | null;
};

export type SalaryAdvance = {
  _uuid: number;
  number: string | null;
  employee_id: number;
  requested_amount: number;
  amount: number;
  installments: number;
  monthly_deduction: number;
  start_period: string;
  reason: string;
  repaid: number;
  /** ຍອດຄ້າງ (backend ຄິດໃຫ້) */
  balance: number;
  status: number;
  /** 1 app ພະນັກງານ, 2 HR ບັນທຶກແທນ */
  source: number;
  account_id: number | null;
  account?: PayrollAccount | null;
  pay_date: string | null;
  review_note: string | null;
  createdAt: string;
  employee?: (EmployeeRef & { basic_salary?: number; position?: { position_name: string } | null }) | null;
  repayments?: AdvanceRepayment[];
};

export type AdvanceData = {
  data: SalaryAdvance[];
  summary: { pending: number; approved: number; active: number; settled: number; rejected: number; cancelled: number; outstanding: number };
};

const idOf = (row: { _uuid: number }) => btoa(String(row._uuid));
const dataOf = (res: { data?: { data?: SalaryAdvance } }) => res.data?.data as SalaryAdvance;

export const advanceApi = {
  create: (body: Record<string, unknown>) => postApi('/advance/create', body).then(dataOf),
  approve: (row: SalaryAdvance, body: Record<string, unknown>) => putApi(`/advance/approve/${idOf(row)}`, body).then(dataOf),
  reject: (row: SalaryAdvance, note: string) => putApi(`/advance/reject/${idOf(row)}`, { note }).then(dataOf),
  cancel: (row: SalaryAdvance) => putApi(`/advance/cancel/${idOf(row)}`, {}).then(dataOf),
  pay: (row: SalaryAdvance, body: Record<string, unknown>) => putApi(`/advance/pay/${idOf(row)}`, body).then(dataOf),
  unpay: (row: SalaryAdvance) => putApi(`/advance/unpay/${idOf(row)}`, {}).then(dataOf),
  schedule: (row: SalaryAdvance, body: Record<string, unknown>) => putApi(`/advance/schedule/${idOf(row)}`, body).then(dataOf),
  repay: (row: SalaryAdvance, body: Record<string, unknown>) => postApi(`/advance/repay/${idOf(row)}`, body).then(dataOf),
  deleteRepayment: (repayment: AdvanceRepayment) => deleteApi(`/advance/repayment/${idOf(repayment)}`).then(dataOf),
};
