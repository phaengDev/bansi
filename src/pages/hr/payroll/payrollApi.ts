import { useCallback, useEffect, useState } from 'react';
import { formatNumber, getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import type { Company } from '../hrApi';
import type { SubRef } from '../../account/journal/journalKit';

/**
 * ເງິນເດືອນ — api-bansi: /payroll/*. ໃບເງິນເດືອນ 1 ໃບ ຕໍ່ ເດືອນ: ຮ່າງ (ແກ້ / ຄິດໄລ່ໃໝ່ໄດ້) → ຈ່າຍແລ້ວ
 * (ເງິນອອກຈາກບັນຊີເງິນຄັງ + ລົງບັນຊີຄູ່). ສູດຄິດຢູ່ backend (controllers/hr/payrollRules.ts) ບ່ອນດຽວ —
 * ຟອມແກ້ລາຍຄົນຂໍຜົນຈາກ POST /payroll/line/preview/:id
 */

export const DRAFT = 1;
export const PAID = 2;

/**
 * ນະໂຍບາຍສະເພາະຄົນຂອງແຕ່ລະກຸ່ມການຫັກ (deduction_mode, sso_mode, tax_mode) — ກົງກັບ MODE_* ຂອງ backend:
 * ຕາມບໍລິສັດ (ຄ່າເລີ່ມຕົ້ນ), ຫັກສະເໝີ, ບໍ່ຫັກ, ປ້ອນເອງ
 */
export const MODE_MANUAL = 0;
export const MODE_POLICY = 1;
export const MODE_NONE = 2;
export const MODE_ALWAYS = 3;
export type ModeKey = 'deduction_mode' | 'sso_mode' | 'tax_mode';

export type PayrollLine = {
  _uuid: number;
  payroll_id: number;
  employee_id: number;
  emp_code: string;
  employee_name: string;
  department_name: string | null;
  position_name: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  basic_salary: number;
  workdays: number;
  employed_days: number;
  present_days: number;
  leave_days: number;
  unpaid_days: number;
  absent_days: number;
  late_days: number;
  late_minutes: number;
  base_pay: number;
  absence_deduction: number;
  late_deduction: number;
  allowance: number;
  overtime: number;
  /** ຊົ່ວໂມງ OT ຂອງເດືອນ ແລະ ຊົ່ວໂມງຄູນອັດຕາ (ຕອນສ້າງ / ຄິດໄລ່ໃໝ່) */
  ot_hours: number;
  ot_weighted_hours: number;
  /** OT ທີ່ກຳນົດເງິນເອງ (ຕໍ່ຊົ່ວໂມງ + ເໝົາຈ່າຍ) */
  ot_fixed_amount: number;
  /** MODE_POLICY = ຄິດຈາກບັນທຶກ OT, MODE_MANUAL = ປ້ອນເອງ */
  overtime_mode: number;
  bonus: number;
  gross: number;
  sso_base: number;
  sso_employee: number;
  sso_employer: number;
  taxable: number;
  tax: number;
  other_deduction: number;
  /** ງວດເງິນເບີກທີ່ຕ້ອງຫັກເດືອນນີ້, ຍອດຄ້າງກ່ອນຫັກ, ຍອດທີ່ຫັກຈິງ */
  advance_due: number;
  advance_balance: number;
  advance_deduction: number;
  /** MODE_POLICY = ຕາມງວດ, MODE_MANUAL = ປ້ອນເອງ */
  advance_mode: number;
  net: number;
  deduction_mode: number;
  sso_mode: number;
  tax_mode: number;
  note: string | null;
};

export type PayrollAccount = {
  _uuid: number;
  acountName: string;
  acount_number?: string | null;
  banks?: { abbr?: string; name_la?: string } | null;
};

export type Payroll = {
  _uuid: number;
  period: string;
  workdays: number;
  status: number;
  employees: number;
  total_base: number;
  total_attendance_deduction: number;
  total_additions: number;
  total_gross: number;
  total_sso_employee: number;
  total_sso_employer: number;
  total_tax: number;
  total_other_deduction: number;
  total_advance_deduction: number;
  total_net: number;
  number: string | null;
  pay_date: string | null;
  account_id: number | null;
  description: string | null;
  account?: PayrollAccount | null;
  /** ລາຍຈ່າຍທີ່ບັນທຶກຄູ່ຕອນຈ່າຍ (ຕິກ "ບັນທຶກເປັນລາຍຈ່າຍ") */
  expense?: { _uuid: number; number: string; sub?: SubRef | null } | null;
  /** ເດືອນສິ້ນສຸດແລ້ວ — ຍັງບໍ່ສິ້ນສຸດ ມື້ທີ່ຍັງບໍ່ຮອດບໍ່ນັບເປັນຂາດວຽກ */
  complete: boolean;
  lines?: PayrollLine[];
  updatedAt: string;
};

export type TaxBracket = { upto: number | null; rate: number };

/** ນະໂຍບາຍເປີດ/ປິດ (false = ລະບົບຄິດເປັນ 0) + ອັດຕາ — ຕັ້ງຢູ່ໜ້າຕັ້ງຄ່າເງິນເດືອນ */
export type PayrollSettings = {
  sso_enabled: boolean;
  sso_employee_rate: number;
  sso_employer_rate: number;
  sso_salary_cap: number;
  tax_enabled: boolean;
  tax_brackets: TaxBracket[];
  ot_tax_free_salary: number;
  late_grace_minutes: number;
  deduct_absent: boolean;
  deduct_late: boolean;
  /** ຊົ່ວໂມງເຮັດວຽກຕໍ່ມື້ (ຄ່າແຮງຕໍ່ຊົ່ວໂມງຂອງ OT) + % ຕາມປະເພດ OT */
  ot_hours_per_day: number;
  ot_rate_normal: number;
  ot_rate_night: number;
  ot_rate_dayoff: number;
  ot_rate_dayoff_night: number;
  /** ພະນັກງານຂໍເບີກຜ່ານ app ໄດ້ບໍ່, ເພດານ % ຂອງເງິນເດືອນ (0 = ບໍ່ຈຳກັດ), ຜ່ອນໄດ້ສູງສຸດ (ເດືອນ) */
  advance_enabled: boolean;
  advance_max_percent: number;
  advance_max_installments: number;
  /** ໝວດລາຍຈ່າຍທີ່ເງິນເດືອນນັບເຂົ້າງົບປະມານ (null = ບໍ່ນັບ) */
  budget_category_id: number | null;
  updatedAt: string | null;
};

/** ຜົນຈາກ POST /payroll/line/preview/:id */
export type LineResult = Pick<PayrollLine,
  'basic_salary' | 'base_pay' | 'absence_deduction' | 'late_deduction' | 'allowance' | 'overtime' | 'bonus' | 'gross'
  | 'sso_base' | 'sso_employee' | 'sso_employer' | 'taxable' | 'tax' | 'other_deduction' | 'advance_due' | 'advance_balance' | 'advance_deduction' | 'net'>;

export const kip = (value: number) => formatNumber(Math.round(Number(value) || 0));
/** formatter ຂອງ NumberInput ເງິນກີບ — ບໍ່ມີທົດສະນິຍົມ (backend ປັດເປັນກີບເຕັມ); ຊ່ອງຫວ່າງຍັງຫວ່າງ */
// ຂັ້ນດ້ວຍຈຸດ (,) ສະເໝີ ບໍ່ຂຶ້ນກັບຮູບແບບຕົວເລກຂອງບໍລິສັດ — InputNumber ອ່ານຄ່າທີ່ພິມກັບຄືນດ້ວຍການຕັດ "," ອອກ
export const kipFormatter = (value: unknown) =>
  value === '' || value === null || value === undefined
    ? ''
    : Math.round(Number(String(value).replace(/,/g, '')) || 0).toLocaleString('en-US');
export const accountText = (a?: PayrollAccount | null) =>
  a ? [a.banks?.abbr, a.acountName, a.acount_number].filter(Boolean).join(' · ') : '';

/** ຫັກຈາກພະນັກງານທັງໝົດ (ປກສ + ອາກອນ + ຫັກອື່ນ + ເງິນເບີກ) */
export const employeeDeductions = (p: Pick<Payroll, 'total_sso_employee' | 'total_tax' | 'total_other_deduction' | 'total_advance_deduction'>) =>
  p.total_sso_employee + p.total_tax + p.total_other_deduction + p.total_advance_deduction;

export const usePayrolls = (year: number | null) => {
  const [rows, setRows] = useState<Payroll[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await postApi('/payroll/fetch', year ? { year } : {});
      setRows(res.data?.data ?? []);
      setCurrentPeriod(res.data?.current_period ?? null);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, currentPeriod, loading, reload };
};

export const usePayroll = (id: number) => {
  const [data, setData] = useState<Payroll | null>(null);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi(`/payroll/${btoa(String(id))}`);
      setData(res.data?.data ?? null);
      setSettings(res.data?.settings ?? null);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, settings, loading, reload, setData };
};

/** ຂໍ້ມູນບໍລິສັດສຳລັບຫົວສະລິບເງິນເດືອນ (ໂຫຼດເທື່ອດຽວ) */
export const useCompany = () => {
  const [company, setCompany] = useState<Company | null>(null);
  useEffect(() => {
    getApi('/company').then((res) => setCompany(res.data?.data ?? null)).catch(() => setCompany(null));
  }, []);
  return company;
};
