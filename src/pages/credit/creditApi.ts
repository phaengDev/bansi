import { useCallback, useEffect, useState } from 'react';
import { getApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import type { Loan, LoanCurrency, LoanDetail, LoanPayment } from '../account/loans/loanApi';

/**
 * ລະບົບສິນເຊື່ອ (GET/POST /credit/… ຂອງ api-bansi creditController — ຕາຕະລາງຕາມ sql/credit_system.sql)
 */

/** tbl_loan_application.status */
export const APP_STATUS: Record<number, { label: string; tone: string; icon: string }> = {
  1: { label: 'crStDraft', tone: 'is-draft', icon: 'fa-pen' },
  2: { label: 'crStPending', tone: 'is-pending', icon: 'fa-hourglass-half' },
  3: { label: 'crStApproved', tone: 'is-approved', icon: 'fa-circle-check' },
  4: { label: 'crStRejected', tone: 'is-rejected', icon: 'fa-circle-xmark' },
  5: { label: 'crStDisbursed', tone: 'is-disbursed', icon: 'fa-money-bill-transfer' },
  6: { label: 'crStCancelled', tone: 'is-cancelled', icon: 'fa-ban' },
};

export const PRODUCT_KINDS = [
  { value: 1, label: 'crKindCash', icon: 'fa-money-bill-wave' },
  { value: 2, label: 'crKindHire', icon: 'fa-cart-shopping' },
  { value: 3, label: 'crKindPawn', icon: 'fa-gem' },
];
export const BORROWER_TYPES = [
  { value: 3, label: 'crBorrowerAll' },
  { value: 1, label: 'crBorrowerPerson' },
  { value: 2, label: 'crBorrowerCompany' },
];
/** ໄລຍະຈ່າຍ: ເປັນມື້ (days) ຫຼື ເປັນເດືອນ (months) */
export const FREQUENCIES = [
  { key: 'D1', days: 1, months: 1, label: 'crFreqDay' },
  { key: 'W1', days: 7, months: 1, label: 'crFreqWeek' },
  { key: 'W2', days: 14, months: 1, label: 'crFreq2Weeks' },
  { key: 'M1', days: null, months: 1, label: 'lnFreq1' },
  { key: 'M3', days: null, months: 3, label: 'lnFreq3' },
  { key: 'M6', days: null, months: 6, label: 'lnFreq6' },
  { key: 'M12', days: null, months: 12, label: 'lnFreq12' },
] as const;
export const frequencyOf = (days: number | null | undefined, months: number) =>
  FREQUENCIES.find((f) => (days ? f.days === Number(days) : !f.days && f.months === Number(months))) ?? FREQUENCIES[3];

export const ID_TYPES = [
  { value: 1, label: 'crIdCard' },
  { value: 2, label: 'crIdFamilyBook' },
  { value: 3, label: 'crIdPassport' },
  { value: 4, label: 'crIdCompanyReg' },
];
export const COLLATERAL_TYPES = [
  { value: 1, label: 'crColLand', icon: 'fa-map' },
  { value: 2, label: 'crColHouse', icon: 'fa-house' },
  { value: 3, label: 'crColVehicle', icon: 'fa-car' },
  { value: 4, label: 'crColGold', icon: 'fa-gem' },
  { value: 5, label: 'crColDeposit', icon: 'fa-piggy-bank' },
  { value: 6, label: 'crColMachine', icon: 'fa-gears' },
  { value: 9, label: 'crColOther', icon: 'fa-box' },
];
export const collateralTypeOf = (value: number) => COLLATERAL_TYPES.find((c) => c.value === Number(value)) ?? COLLATERAL_TYPES[6];
export const RISK_LEVELS = [
  { value: 1, label: 'crRiskLow', tone: 'is-low' },
  { value: 2, label: 'crRiskMid', tone: 'is-mid' },
  { value: 3, label: 'crRiskHigh', tone: 'is-high' },
];

export type CreditProduct = {
  _uuid: number;
  product_code: string;
  name_la: string;
  name_en: string | null;
  product_kind: number;
  borrower_type: number;
  currency_id: number | null;
  min_amount: number;
  max_amount: number;
  min_term: number;
  max_term: number;
  annual_rate: number;
  method: number;
  day_basis: number;
  frequency_months: number;
  frequency_days: number | null;
  upfront_fee_rate: number;
  upfront_fee_fixed: number;
  penalty_rate: number;
  penalty_base: number;
  grace_days: number;
  prepayment_fee_rate: number;
  require_guarantor: number;
  require_collateral: number;
  max_ltv: number;
  max_debt_ratio: number;
  approval_levels: number;
  loan_account_id: number | null;
  interest_account_id: number | null;
  fee_account_id: number | null;
  penalty_account_id: number | null;
  note: string | null;
  status: number;
};

export type ClassRule = { loan_class: number; class_code: string; name_la: string; min_days: number; max_days: number | null; provision_rate: number; is_npl: number };

export type CreditCustomer = {
  _uuid: number;
  customer_code: string;
  customer_type: number;
  full_name: string;
  name_en: string | null;
  nationality?: string | null;
  /** ເລກເອກະສານຮູບປະຈຳຕົວ (tbl_loan_document) */
  photo?: string | null;
  gender: number | null;
  birth_date: string | null;
  id_type: number;
  id_no: string | null;
  id_issue_date: string | null;
  id_expiry_date: string | null;
  tax_number: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  village: string | null;
  address: string | null;
  district_id: number | null;
  province_id: number | null;
  district?: { district_name: string; province?: { province_name: string } } | null;
  marital_status: number | null;
  spouse_name: string | null;
  spouse_id_no: string | null;
  occupation: string | null;
  workplace: string | null;
  monthly_income: number;
  monthly_expense: number;
  credit_limit: number;
  risk_level: number;
  officer_id: number | null;
  blacklisted: number;
  blacklist_reason: string | null;
  note: string | null;
  status: number;
  /** ລາຍການ */
  loans?: number;
  active_loans?: number;
  outstanding?: number;
  overdue?: number;
  pending?: number;
};

export type Collateral = {
  _uuid: number;
  collateral_code: string | null;
  customer_id: number;
  application_id: number | null;
  loan_id: number | null;
  collateral_type: number;
  description: string;
  document_no: string | null;
  owner_name: string | null;
  location: string | null;
  market_value: number;
  appraised_value: number;
  appraisal_date: string | null;
  appraiser: string | null;
  insurance_expiry: string | null;
  storage: string | null;
  received_date: string | null;
  returned_date: string | null;
  status: number;
  note: string | null;
};

export type Guarantor = {
  _uuid?: number;
  customer_id?: number | null;
  full_name: string;
  relationship: string | null;
  id_no: string | null;
  phone: string | null;
  address: string | null;
  occupation: string | null;
  monthly_income: number;
  /** ຈຳນວນທີ່ຄ້ຳປະກັນ (0 = ທັງໝົດ) */
  guarantee_amount?: number;
};

export type Approval = {
  _uuid: number;
  level: number;
  approver_id: number;
  approver_name: string | null;
  decision: number;
  approved_amount: number | null;
  approved_term: number | null;
  approved_rate: number | null;
  comment: string | null;
  decided_at: string;
  /** decision 4 = ສົ່ງໃຫ້ພິຈາລະນາ: ຜູ້ຮັບ ແລະ ແບບ (1 ອັດຕະໂນມັດ / 2 ເລືອກເອງ) */
  forward_to?: number | null;
  forward_mode?: number | null;
  forward_name?: string | null;
};

export type Application = {
  _uuid: number;
  application_no: string;
  apply_date: string;
  customer_id: number;
  product_id: number;
  officer_id: number | null;
  requested_amount: number;
  requested_term: number;
  annual_rate: number;
  method: number;
  frequency_months: number;
  frequency_days: number | null;
  purpose: string | null;
  repayment_source: string | null;
  item_description: string | null;
  item_price: number;
  down_payment: number;
  debt_ratio: number | null;
  approved_amount: number | null;
  approved_term: number | null;
  approved_rate: number | null;
  approval_level: number;
  status: number;
  reject_reason: string | null;
  loan_id: number | null;
  note: string | null;
  created_by: number | null;
  customer: { _uuid: number; code?: string; customer_code?: string; name?: string; full_name?: string; phone: string | null } | null;
  product: { _uuid: number; code?: string; name?: string; approval_levels: number } | null;
  loan_code?: string | null;
  /** ຜູ້ທີ່ຄຳຮ້ອງລໍພິຈາລະນາຢູ່ (ລາຍການ) */
  assigned_to?: number | null;
  assigned_name?: string | null;
};

/** ສົ່ງໃຫ້ຜູ້ພິຈາລະນາ: ອັດຕະໂນມັດ (ຫົວໜ້າສາຍງານ) / ເລືອກເອງ (ຕຳແໜ່ງສູງກວ່າ) / ເປີດໃຫ້ທຸກຄົນ (ເມື່ອບໍ່ມີໃຜສູງກວ່າ) */
export type RouteMode = 'auto' | 'manual' | 'open';
export type RouteChoice = { mode: RouteMode; to: number | null };
export type RoutePerson = { _uuid: number; name: string; employee: string | null; position: string | null; level: number | null; limit?: number | null };
export type RouteOptions = {
  auto: RoutePerson | null;
  manual: RoutePerson[];
  lineManager: boolean;
  /** ຂັ້ນສຸດທ້າຍ: ຍອດ (ກີບ) ແລະ ຄົນທີ່ສູງກວ່າແຕ່ວົງເງິນອະນຸມັດບໍ່ພໍ (ບໍ່ຢູ່ໃນລາຍຊື່) */
  final?: boolean;
  amount_lak?: number;
  over_limit?: number;
};
/** ຂັ້ນທີ່ຈະສົ່ງໄປ + ຜະລິດຕະພັນ / ຍອດ ສຳລັບຄຳຮ້ອງທີ່ຍັງບໍ່ບັນທຶກ */
export type RouteContext = { level?: number; productId?: number | null; amount?: number };

export type ApplicationDetail = Application & {
  customer: CreditCustomer | null;
  product: CreditProduct | null;
  currency: LoanCurrency;
  collaterals: Collateral[];
  guarantors: Guarantor[];
  approvals: Approval[];
  created_by_name: string | null;
  /** ລໍຖ້າພິຈາລະນາ ແລະ ບໍ່ໄດ້ສົ່ງໃຫ້ຄົນໃດ (ຄຳຮ້ອງເກົ່າ / ເປີດໃຫ້ທຸກຄົນ): ຜູ້ທີ່ພິຈາລະນາຂັ້ນຕໍ່ໄປໄດ້ */
  approvers: { _uuid: number; name: string }[] | null;
  /** ລໍຖ້າພິຈາລະນາ ແລະ ສົ່ງໃຫ້ຄົນໃດຄົນໜຶ່ງ: ໃຜ, ໃຜສົ່ງ, ເມື່ອໃດ, mode 1 ອັດຕະໂນມັດ / 2 ເລືອກເອງ */
  assigned: { to: number; to_name: string | null; by: number | null; by_name: string | null; at: string | null; mode: number | null } | null;
  check: { issues: string[]; ltv: number | null; debt_ratio: number | null; monthly: number | null; collateral_value: number };
  schedule: { no: number; due_date: string; principal: number; interest: number; payment: number }[];
  fee: number;
  loan: { _uuid: number; loan_code: string } | null;
};

/** ກຸ່ມອາຍຸໜີ້ (ມື້ກາຍກຳນົດ) — key ກົງກັບ AGING ຂອງ backend (creditPenalty) */
export const AGING_BUCKETS = [
  { key: 'current', label: 'crAgeCurrent', tone: 'is-current' },
  { key: 'd1_30', label: 'crAge1', tone: 'is-a1' },
  { key: 'd31_60', label: 'crAge31', tone: 'is-a2' },
  { key: 'd61_90', label: 'crAge61', tone: 'is-a3' },
  { key: 'd91_180', label: 'crAge91', tone: 'is-a4' },
  { key: 'd180', label: 'crAge180', tone: 'is-a5' },
] as const;
export type AgingKey = (typeof AGING_BUCKETS)[number]['key'];
export const agingTone = (key: string | undefined) => AGING_BUCKETS.find((b) => b.key === key)?.tone ?? 'is-current';
/** ມື້ກາຍກຳນົດ → ກຸ່ມອາຍຸໜີ້ (ຄືກັບ agingOf ຂອງ backend) */
export const agingOfDays = (days: number): AgingKey =>
  days <= 0 ? 'current' : days <= 30 ? 'd1_30' : days <= 60 ? 'd31_60' : days <= 90 ? 'd61_90' : days <= 180 ? 'd91_180' : 'd180';

/** tbl_loan_payment.payment_type */
export const PAYMENT_TYPES: Record<number, { label: string; icon: string }> = {
  1: { label: 'crPayRegular', icon: 'fa-calendar-check' },
  2: { label: 'crPayPrepay', icon: 'fa-forward' },
  3: { label: 'crPayOff', icon: 'fa-flag-checkered' },
};

/** tbl_loan_collection.method / result */
export const FOLLOW_METHODS = [
  { value: 1, label: 'crFmCall', icon: 'fa-phone' },
  { value: 2, label: 'crFmSms', icon: 'fa-comment-sms' },
  { value: 3, label: 'crFmVisit', icon: 'fa-person-walking' },
  { value: 4, label: 'crFmLetter', icon: 'fa-envelope-open-text' },
  { value: 5, label: 'crFmLegal', icon: 'fa-gavel' },
];
export const FOLLOW_RESULTS = [
  { value: 1, label: 'crFrPromise', icon: 'fa-handshake', tone: 'is-promise' },
  { value: 2, label: 'crFrNoAnswer', icon: 'fa-phone-slash', tone: 'is-noanswer' },
  { value: 3, label: 'crFrRefused', icon: 'fa-hand', tone: 'is-refused' },
  { value: 4, label: 'crFrPaid', icon: 'fa-circle-check', tone: 'is-paid' },
];

export type PenaltyRow = { no: number; due_date: string; days_late: number; base: number; accrued: number; paid: number; waived: number; due: number };
export type PenaltyState = { rows: PenaltyRow[]; accrued: number; paid: number; waived: number; due: number; days_overdue: number };
export type Waiver = { _uuid: number; installment_no: number; date: string; amount: number; reason: string | null; by: string | null };
export type FollowUp = {
  _uuid: number;
  loan_id: number;
  contact_date: string;
  method: number;
  result: number;
  promise_date: string | null;
  promise_amount: number;
  note: string | null;
  by: string | null;
};
export type Split = {
  penalty: number;
  interest: number;
  principal: number;
  fee: number;
  total: number;
  payment_type: number;
  outstanding_after: number;
  /** ຈ່າຍຕົ້ນທຶນລ່ວງໜ້າ (ຮັບເກີນງວດຕໍ່ໄປ): ຕົ້ນທຶນ, ຄ່າທຳນຽມ, ຕາຕະລາງເດີມ ແລະ ທາງເລືອກ ຫຼຸດງວດ / ຫຼຸດເງິນຜ່ອນ */
  prepay?: PrepayPlan | null;
};
export type PrepayOption = { count: number; payment: number; last_due: string | null; interest: number };
export type PrepayPlan = {
  principal: number;
  fee: number;
  balance: number;
  regular_total: number;
  before: { count: number; payment: number; interest: number };
  term: PrepayOption;
  installment: PrepayOption;
};
export type PrepayMode = 'term' | 'installment';

export type Quote = {
  date: string;
  penalty_due: number;
  days_overdue: number;
  outstanding: number;
  presets: { next: number; due: number; payoff: number };
  next: { no: number; due_date: string; interest: number; principal: number } | null;
  due_count: number;
  split: Split | null;
  error: string | null;
  /** ຄ່າປັບ + ງວດທີ່ຄົບກຳນົດ + ງວດຕໍ່ໄປ — ຮັບເກີນນີ້ = ຈ່າຍຕົ້ນທຶນລ່ວງໜ້າ */
  regular_total?: number;
  prepayment_fee_rate?: number;
};

/** ສັນຍາສິນເຊື່ອ = ເງິນໃຫ້ກູ້ (tbl_loan direction 2) ທີ່ມາຈາກຄຳຮ້ອງ — ໃຊ້ຕາຕະລາງຜ່ອນ / ການຊຳລະ ຂອງເງິນກູ້ */
export type Contract = Loan & {
  customer_id: number;
  product_id: number | null;
  application_id: number | null;
  upfront_fee: number;
  frequency_days: number | null;
  /** ຄ່າປັບຄ້າງ / ຈ່າຍແລ້ວ, ມື້ກາຍກຳນົດຂອງງວດເກົ່າສຸດ, ກຸ່ມອາຍຸໜີ້ (ຮອດມື້ນີ້) */
  penalty_due: number;
  /** ຄຳຂໍຍົກເວັ້ນຄ່າປັບທີ່ລໍອະນຸມັດ */
  waive_pending?: number;
  paid_penalty: number;
  days_overdue: number;
  aging: AgingKey;
  close_reason: number | null;
  closed_balance: number;
  customer: { _uuid: number; code: string; name: string; phone: string | null } | null;
  product: { _uuid: number; code: string; name: string } | null;
};

export type ContractDetail = Omit<LoanDetail, 'payments'> & Omit<Contract, 'customer' | 'product'> & {
  customer: CreditCustomer | null;
  product: CreditProduct | null;
  officer: string | null;
  application: { _uuid: number; application_no: string } | null;
  collaterals: Collateral[];
  guarantors: Guarantor[];
  payments: ContractPayment[];
  penalty_rate: number;
  grace_days: number;
  penalty: PenaltyState;
  waivers: Waiver[];
  /** ຄຳຂໍຍົກເວັ້ນທີ່ລໍຄົນທີສອງອະນຸມັດ */
  waive_pending: { amount: number; reason: string | null; requested_by: number | null; by: string | null; at: string } | null;
  collections: FollowUp[];
  notices: Notice[];
  closure: Closure;
  /** ຍອດທີ່ຕັດໜີ້ສູນ / ຍ້າຍໄປສັນຍາໃໝ່ */
  closed_balance: number;
  close_reason: number | null;
  closed_date: string | null;
};

export type ContractPayment = LoanPayment & { penalty: number; payment_type: number; balance_after: number | null };

/** tbl_loan.close_reason: 1 ຈ່າຍຄົບ, 2 ປິດກ່ອນກຳນົດ, 3 ປັບໂຄງສ້າງ, 4 ຕັດໜີ້ສູນ */
export const CLOSE_REASONS: Record<number, { label: string; icon: string; tone: string }> = {
  1: { label: 'crClosePaid', icon: 'fa-circle-check', tone: 'is-full' },
  2: { label: 'crCloseEarly', icon: 'fa-flag-checkered', tone: 'is-full' },
  3: { label: 'crCloseRestructured', icon: 'fa-shuffle', tone: 'is-pending' },
  4: { label: 'crCloseWrittenOff', icon: 'fa-skull-crossbones', tone: 'is-black' },
};
export type Restructure = {
  _uuid: number; date: string; reason: string; other_id: number; other_code: string | null; old_outstanding: number;
  capitalized_interest: number; old_rate: number; new_rate: number; old_term: number; new_term: number; by: string | null;
};
export type Closure = {
  close_reason: number | null;
  writeoff: { _uuid: number; date: string; principal: number; interest: number; penalty: number; recovered: number; reason: string; by: string | null } | null;
  restructured_from: Restructure | null;
  restructured_into: Restructure | null;
};
export type Notice = { _uuid: number; loan_id: number; notice_type: number; channel: number; phone: string | null; message: string; sent_at: string };
export type CreditDocument = {
  _uuid: number; owner_type: string; owner_id: number; doc_type: string | null; title: string | null; file_name: string | null;
  mime: string | null; size: number | null; expiry_date: string | null; createdAt: string; by: string | null;
};
export const DOC_TYPES = [
  { value: 'ID_CARD', label: 'crIdCard', icon: 'fa-id-card' },
  { value: 'FAMILY_BOOK', label: 'crIdFamilyBook', icon: 'fa-book' },
  { value: 'PASSPORT', label: 'crIdPassport', icon: 'fa-passport' },
  { value: 'COMPANY_REG', label: 'crIdCompanyReg', icon: 'fa-building' },
  { value: 'CONTRACT', label: 'crDocContract', icon: 'fa-file-signature' },
  { value: 'LAND_TITLE', label: 'crDocLand', icon: 'fa-map' },
  { value: 'VEHICLE_REG', label: 'crDocVehicle', icon: 'fa-car' },
  { value: 'INCOME', label: 'crDocIncome', icon: 'fa-money-bill-trend-up' },
  { value: 'PHOTO', label: 'crDocPhoto', icon: 'fa-camera' },
  { value: 'OTHER', label: 'crColOther', icon: 'fa-file' },
];
export type ClassificationRow = {
  loan_id: number; loan_code: string; counterparty: string; currency: LoanCurrency; days_overdue: number; outstanding: number;
  overdue_principal: number; overdue_interest: number; loan_class: number; class_code: string; is_npl: boolean; provision_rate: number; provision_amount: number;
};
export type Classification = {
  period: string; end: string; posted: boolean; entry_number: string | null; latest: string | null; can_post: boolean; can_undo: boolean;
  rows: ClassificationRow[];
  summary: { loan_class: number; class_code: string; name_la: string; is_npl: boolean; provision_rate: number; contracts: number; outstanding: number; provision: number }[];
  allowance: { currency_id: number; currency: LoanCurrency; target: number; balance: number; delta: number }[];
  total: number; npl: number; npl_ratio: number;
};

/** ແຖວໃນໜ້າ ຕິດຕາມໜີ້ */
export type CollectionRow = Contract & { last_contact: FollowUp | null; contacts: number; last_notice: string | null };

/** ດຶງລາຍການ (GET) + ລະຫັດຖັດໄປ */
export const useCreditList = <T,>(path: string) => {
  const [rows, setRows] = useState<T[]>([]);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi(path);
      const { data, ...rest } = res.data ?? {};
      setRows(data ?? []);
      setExtra(rest);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { rows, extra, loading, error, reload };
};

export const customerAddress = (c: Pick<CreditCustomer, 'village' | 'district'>) =>
  [c.village, c.district?.district_name, c.district?.province?.province_name].filter(Boolean).join(', ');
