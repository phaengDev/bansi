import type { AttendanceRecord, LeaveBalance, MonthStats } from '../hr/attendance/attendanceApi';
import type { Correction, LeaveRequest } from '../hr/attendance/requestKit';
import type { SalaryAdvance } from '../hr/payroll/advanceApi';
import type { AttendanceDay } from '../hr/attendance/attendanceKit';
import type { EmployeeRef } from '../hr/hrApi';

/**
 * ພື້ນທີ່ຂອງຂ້ອຍ — ຂໍ້ມູນຂອງພະນັກງານເອງຜ່ານ route /…/me (ຄືກັນກັບ app ພະນັກງານ). backend ຮັບ token ຂອງຜູ້ໃຊ້ລະບົບ
 * ທີ່ຜູກກັບພະນັກງານ (selfEmployee) — ບໍ່ຜູກ = 400. ການສະແກນເຂົ້າ-ອອກວຽກເຮັດໃນມືຖືເທົ່ານັ້ນ (GPS/QR), ໃນຄອມເບິ່ງໄດ້ຢ່າງດຽວ
 */

/** GET /attendance/me?month=YYYY-MM */
export type MyAttendanceData = {
  employee: EmployeeRef;
  company: {
    name_la: string;
    name_en: string | null;
    work_start: string;
    work_end: string;
    break_start: string | null;
    break_end: string | null;
    /** ວັນພັກປະຈຳອາທິດ (0 = ອາທິດ … 6 = ເສົາ) */
    days_off: number[];
  } | null;
  today: { date: string; workday: boolean; holiday: string | null; record: AttendanceRecord | null };
  period: string;
  days: AttendanceDay[];
  summary: MonthStats;
  /** ນາທີຜ່ອນຜັນ (api ລຸ້ນເກົ່າ = ບໍ່ມີ) */
  grace?: number;
};

/** GET /holiday/me?year=YYYY */
export type MyHolidays = {
  year: number;
  today: string;
  data: { holiday_date: string; name: string; workday: boolean; kind: number }[];
};

/** GET /leave/me?year=YYYY — ຄຳຂໍຂອງຕົນເອງ + ປະເພດທີ່ຂໍໄດ້ພ້ອມມື້ທີ່ເຫຼືອ */
export type MyLeaveData = {
  year: string;
  data: LeaveRequest[];
  types: LeaveBalance[];
  summary: { pending: number; paid_days: number; unpaid_days: number };
};

/** GET /correction/me?year=YYYY */
export type MyCorrectionData = {
  year: string;
  data: Correction[];
  summary: { pending: number };
};

/** GET /advance/me — ລາຍການ + ຍອດຄ້າງ + ເງື່ອນໄຂຂອງຟອມ (max_amount null = ບໍ່ຈຳກັດ) */
export type MyAdvanceData = {
  data: SalaryAdvance[];
  balance: number;
  rules: { enabled: boolean; max_percent: number; max_amount: number | null; max_installments: number; start_period: string; pending: boolean };
};

/** ເປີດໜ້າໃນພື້ນທີ່ຂອງຂ້ອຍ ພ້ອມສິ່ງທີ່ຈະເຮັດ — ເຊັ່ນ ເປີດຟອມຂໍໃໝ່ (ຈາກປຸ່ມລັດໃນ "ມື້ນີ້") ຫຼື ແຈ້ງລືມສະແກນຂອງມື້ໜຶ່ງ */
export type MyIntent = { action: 'new'; date?: string };
export type MyOpen = (key: string, intent?: MyIntent) => void;

/** ໄອດີໃນ URL ຂອງ backend (decodeId = atob) */
export const idOf = (row: { _uuid: number }) => btoa(String(row._uuid));
