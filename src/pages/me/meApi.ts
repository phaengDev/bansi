import type { AttendanceRecord, MonthStats } from '../hr/attendance/attendanceApi';
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
