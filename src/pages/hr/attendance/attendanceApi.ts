import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import type { EmployeeRef } from '../hrApi';

/**
 * ການເຂົ້າ-ອອກວຽກ — api-bansi: /attendance/*, /holiday/*. ພະນັກງານສະແກນຜ່ານ app ມືຖື (POST /attendance/scan);
 * ໜ້ານີ້ສຳລັບ HR ຕິດຕາມ ແລະ ບັນທຶກແທນ. ສະຖານະແຕ່ລະມື້ຄິດຢູ່ backend (controllers/hr/workCalendar.ts)
 */

/** status ຂອງແຖວ — 1 ມາວຽກ, 2 ລາພັກ (ໄດ້ເງິນເດືອນ), 3 ລາພັກບໍ່ໄດ້ເງິນເດືອນ */
export const PRESENT = 1;
export const PAID_LEAVE = 2;
export const UNPAID_LEAVE = 3;

export type DayState = 'present' | 'late' | 'absent' | 'leave' | 'unpaid' | 'off' | 'offwork' | 'pending' | 'future' | 'none';

/** ປ້າຍ (key ພາສາ), ຕົວຫຍໍ້ໃນຕາລາງເດືອນ, ໄອຄອນ — ສີຢູ່ CSS .att-state.is-{state} */
export const DAY_STATES: Record<DayState, { label: string; short: string; icon: string }> = {
  present: { label: 'attStatePresent', short: 'attShortPresent', icon: 'fa-circle-check' },
  late: { label: 'attStateLate', short: 'attShortLate', icon: 'fa-clock' },
  absent: { label: 'attStateAbsent', short: 'attShortAbsent', icon: 'fa-circle-xmark' },
  leave: { label: 'attStateLeave', short: 'attShortLeave', icon: 'fa-umbrella-beach' },
  unpaid: { label: 'attStateUnpaid', short: 'attShortUnpaid', icon: 'fa-money-bill-1-wave' },
  off: { label: 'attStateOff', short: '', icon: 'fa-mug-hot' },
  offwork: { label: 'attStateOffwork', short: 'attShortOffwork', icon: 'fa-briefcase' },
  pending: { label: 'attStatePending', short: '', icon: 'fa-hourglass-half' },
  future: { label: 'attStateFuture', short: '', icon: 'fa-ellipsis' },
  none: { label: 'attStateNone', short: '', icon: 'fa-minus' },
};

/** ສະຖານະທີ່ HR ແກ້ໄດ້ (ມື້ທີ່ຍັງບໍ່ຮອດ / ບໍ່ໄດ້ເປັນພະນັກງານ ແກ້ບໍ່ໄດ້) */
export const editableState = (state: DayState) => state !== 'future' && state !== 'none';

export type AttendanceRecord = {
  _uuid: number;
  employee_id: number;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  in_distance: number | null;
  out_distance: number | null;
  in_accuracy: number | null;
  out_accuracy: number | null;
  late_minutes: number;
  early_minutes: number;
  status: number;
  source: number;
  note: string | null;
  updatedAt: string;
};

export type AttendanceEmployee = EmployeeRef & {
  department_id: number;
  position?: { _uuid: number; position_name: string } | null;
  start_date: string | null;
  end_date: string | null;
};

export type MonthStats = {
  workdays: number;
  employed_days: number;
  present_days: number;
  late_days: number;
  late_minutes: number;
  early_minutes: number;
  leave_days: number;
  unpaid_days: number;
  absent_days: number;
  offday_work_days: number;
  pending_days: number;
};

export type DayInfo = { date: string; workday: boolean; holiday: string | null };

export type DailyRow = { employee: AttendanceEmployee; record: AttendanceRecord | null; state: DayState };
export type DailyData = {
  date: string;
  workday: boolean;
  holiday: string | null;
  work_start: string;
  work_end: string;
  grace: number;
  /** ເດືອນນີ້ຈ່າຍເງິນເດືອນແລ້ວ — ແກ້ບໍ່ໄດ້ */
  locked: boolean;
  data: DailyRow[];
  summary: Partial<Record<DayState, number>> & { total: number };
};

export type MonthlyRow = { employee: AttendanceEmployee; stats: MonthStats; states: DayState[] };
export type MonthlyData = {
  period: string;
  today: string;
  work_start: string;
  work_end: string;
  grace: number;
  locked: boolean;
  days: DayInfo[];
  data: MonthlyRow[];
};

export type EmployeeMonthData = {
  period: string;
  locked: boolean;
  employee: AttendanceEmployee;
  work_start: string;
  work_end: string;
  grace: number;
  days: (DayInfo & { state: DayState; record: AttendanceRecord | null })[];
  summary: MonthStats;
};

/** ປະເພດວັນພັກ (tbl_holiday.kind) — ທາງການ = ລັດຖະການກຳນົດ, ບໍ່ເປັນທາງການ = ບໍລິສັດປະກາດເອງ (ໄປທ່ຽວ, ພັກພິເສດ) */
export const HOLIDAY_OFFICIAL = 1;
export const HOLIDAY_COMPANY = 2;
export type Holiday = { _uuid: number; holiday_date: string; name: string; kind: number };

/**
 * ປະເພດການລາພັກ (tbl_leave_type) — paid 1 = ໄດ້ເງິນເດືອນ; max_per_year / max_per_request = ມື້ເຮັດວຽກສູງສຸດ,
 * null = ບໍ່ຈຳກັດ (backend ກວດຕອນພະນັກງານຂໍ ແລະ ຕອນອະນຸມັດ, ນັບຄຳຂໍທີ່ລໍຖ້າ + ອະນຸມັດແລ້ວ)
 */
export type LeaveType = {
  _uuid: number;
  name: string;
  paid: number;
  max_per_year: number | null;
  max_per_request: number | null;
  description: string | null;
  sort: number;
  status: number;
  /** ຈຳນວນຄຳຂໍທີ່ອ້າງອີງ — ມີ = ລຶບບໍ່ໄດ້ (ປິດໃຊ້ງານແທນ) */
  request_count?: number;
};

/** ມື້ຂອງປະເພດໃນປີ: used ອະນຸມັດແລ້ວ, pending ລໍຖ້າ, remaining null = ບໍ່ຈຳກັດ */
export type LeaveBalance = Pick<LeaveType, '_uuid' | 'name' | 'paid' | 'description' | 'max_per_year' | 'max_per_request'> & {
  used: number;
  pending: number;
  remaining: number | null;
};

/** ສີ/ໄອຄອນຕາມ ໄດ້-ບໍ່ໄດ້ເງິນເດືອນ — ຄືສີ att-state (is-leave / is-unpaid) */
export const leaveTone = (paid: number | boolean) => (Number(paid) === 1
  ? { tone: 'is-leave', card: 'is-sky', icon: 'fa-umbrella-beach', label: 'leavePaid', hint: 'leavePaidHint' }
  : { tone: 'is-unpaid', card: 'is-violet', icon: 'fa-money-bill-transfer', label: 'leaveUnpaid', hint: 'leaveUnpaidHint' });

/**
 * ປະເພດ OT (tbl_overtime.kind) — ອັດຕາ % ຂອງຄ່າແຮງຕໍ່ຊົ່ວໂມງຕັ້ງຢູ່ ຕັ້ງຄ່າເງິນເດືອນ (ກົດໝາຍແຮງງານ: 150 / 200 / 250 / 300%).
 * ກາງຄືນ = 22:00–05:00; ວັນພັກ = ວັນພັກປະຈຳອາທິດ ຫຼື ວັນພັກ
 */
export const OT_KINDS: Record<number, { label: string; icon: string; tone: string }> = {
  1: { label: 'otKindNormal', icon: 'fa-sun', tone: 'is-normal' },
  2: { label: 'otKindNight', icon: 'fa-moon', tone: 'is-night' },
  3: { label: 'otKindDayoff', icon: 'fa-umbrella-beach', tone: 'is-dayoff' },
  4: { label: 'otKindDayoffNight', icon: 'fa-star-and-crescent', tone: 'is-dayoff-night' },
};

/** ວິທີຈ່າຍ OT (tbl_overtime.pay_type) — ຕາມອັດຕາ (ເງິນເດືອນ × %), ກຳນົດເງິນຕໍ່ຊົ່ວໂມງ, ເໝົາຈ່າຍ (ບໍ່ກ່ຽວກັບຊົ່ວໂມງ) */
export const OT_PAY_RATE = 1;
export const OT_PAY_HOURLY = 2;
export const OT_PAY_LUMP = 3;
export const OT_PAY_TYPES: Record<number, { label: string; hint: string; icon: string }> = {
  [OT_PAY_RATE]: { label: 'otPayRate', hint: 'otPayRateHint', icon: 'fa-percent' },
  [OT_PAY_HOURLY]: { label: 'otPayHourly', hint: 'otPayHourlyHint', icon: 'fa-clock' },
  [OT_PAY_LUMP]: { label: 'otPayLump', hint: 'otPayLumpHint', icon: 'fa-sack-dollar' },
};

/** ປະເພດທີ່ແນະນຳ ຈາກມື້ (ມື້ເຮັດວຽກ / ວັນພັກ) ແລະ ເວລາເລີ່ມ (ເລີ່ມ 22:00–05:00 = ກາງຄືນ) */
export const suggestOtKind = (workday: boolean, start: string) => {
  const night = !!start && (start >= '22:00' || start < '05:00');
  return workday ? (night ? 2 : 1) : (night ? 4 : 3);
};

export type Overtime = {
  _uuid: number;
  employee_id: number;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  hours: number;
  kind: number;
  pay_type: number;
  /** ຕໍ່ຊົ່ວໂມງ (pay_type 2) ຫຼື ຍອດເໝົາ (3); ຕາມອັດຕາ = 0 */
  amount: number;
  /** ເງິນຂອງລາຍການທີ່ກຳນົດເງິນເອງ — ຕາມອັດຕາ = 0 (ຄິດຕອນເຮັດເງິນເດືອນ) */
  fixed_amount: number;
  /** ເງິນຂອງລາຍການ (ຕາມອັດຕາ = ໂດຍປະມານຈາກເງິນເດືອນພື້ນຖານ) */
  pay: number;
  note: string | null;
  employee: EmployeeRef | null;
};

export type OvertimeSummary = {
  employee_id: number;
  employee: EmployeeRef | null;
  records: number;
  hours: number;
  /** Σ ຊົ່ວໂມງ × % ÷ 100 */
  weighted_hours: number;
  by_kind: Record<number, number>;
  /** ເງິນທີ່ກຳນົດເອງ (ຕໍ່ຊົ່ວໂມງ + ເໝົາຈ່າຍ) */
  fixed_amount: number;
  /** ຄ່າ OT ໂດຍປະມານ (ກີບ) ຕາມເງິນເດືອນພື້ນຖານ ແລະ ຕັ້ງຄ່າປັດຈຸບັນ */
  estimate: number;
};

export type OvertimeData = {
  period: string;
  /** ເດືອນນີ້ຈ່າຍເງິນເດືອນແລ້ວ — ບັນທຶກ/ແກ້ບໍ່ໄດ້ */
  paid: boolean;
  data: Overtime[];
  summary: OvertimeSummary[];
  days: DayInfo[];
  rates: Record<number, number>;
  hours_per_day: number;
};

/** ຊົ່ວໂມງ (ທົດສະນິຍົມ) → "3 ຊມ 30 ນທ" */
export const hoursText = (hours: number, t: (key: string) => string) => minutesText(Math.round((Number(hours) || 0) * 60), t);

/** POST ທີ່ຂຶ້ນກັບ body (ວັນທີ / ເດືອນ) — ປ່ຽນ body = ໂຫຼດໃໝ່; ຂໍ້ມູນເກົ່າຍັງສະແດງລະຫວ່າງໂຫຼດ */
export const usePostData = <T,>(path: string, body: Record<string, unknown> | null) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const key = body ? JSON.stringify(body) : null;

  const reload = useCallback(async () => {
    if (!key) return;
    try {
      setLoading(true);
      const res = await postApi(path, JSON.parse(key));
      setData(res.data);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [path, key]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, reload };
};

/** ນາທີ → "1 ຊມ 05 ນທ" / "25 ນທ" */
export const minutesText = (minutes: number, t: (key: string) => string) => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} ${t('attMin')}`;
  return `${Math.floor(m / 60)} ${t('attHour')} ${String(m % 60).padStart(2, '0')} ${t('attMin')}`;
};

export const toApiDay = (value: Date | string) => moment(value).format('YYYY-MM-DD');
export const toPeriod = (value: Date | string) => moment(value).format('YYYY-MM');
export const dayLabel = (date: string) => moment(date, 'YYYY-MM-DD').format('DD/MM/YYYY');
export const periodLabel = (period: string) => moment(`${period}-01`, 'YYYY-MM-DD').format('MM/YYYY');
/** ຊື່ວັນ (key ພາສາ weekday0…6) */
export const weekdayKey = (date: string) => `weekday${moment(date, 'YYYY-MM-DD').day()}`;
