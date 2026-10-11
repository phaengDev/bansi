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

export type Holiday = { _uuid: number; holiday_date: string; name: string };

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
