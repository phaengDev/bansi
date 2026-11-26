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
};

export type ApplicationDetail = Application & {
  customer: CreditCustomer | null;
  product: CreditProduct | null;
  currency: LoanCurrency;
  collaterals: Collateral[];
  guarantors: Guarantor[];
  approvals: Approval[];
  created_by_name: string | null;
  check: { issues: string[]; ltv: number | null; debt_ratio: number | null; monthly: number | null; collateral_value: number };
  schedule: { no: number; due_date: string; principal: number; interest: number; payment: number }[];
  fee: number;
  loan: { _uuid: number; loan_code: string } | null;
};

/** ສັນຍາສິນເຊື່ອ = ເງິນໃຫ້ກູ້ (tbl_loan direction 2) ທີ່ມາຈາກຄຳຮ້ອງ — ໃຊ້ຕາຕະລາງຜ່ອນ / ການຊຳລະ ຂອງເງິນກູ້ */
export type Contract = Loan & {
  customer_id: number;
  product_id: number | null;
  application_id: number | null;
  upfront_fee: number;
  frequency_days: number | null;
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
  payments: (LoanPayment & { penalty: number })[];
  penalty_rate: number;
  grace_days: number;
};

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
