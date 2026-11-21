import type { AttendanceRecord, LeaveBalance, MonthStats } from '../hr/attendance/attendanceApi';
import type { Correction, LeaveRequest } from '../hr/attendance/requestKit';
import type { SalaryAdvance } from '../hr/payroll/advanceApi';
import type { PayrollLine } from '../hr/payroll/payrollApi';
import type { Task, TaskFile, TaskItem } from '../hr/task/taskApi';
import type { AttendanceDay } from '../hr/attendance/attendanceKit';
import type { EmployeeRef } from '../hr/hrApi';
import type { LeaveFile } from '../hr/attendance/LeaveFiles';

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
/** ສິ່ງທີ່ໜ້າປາຍທາງເຮັດເມື່ອເປີດ: new = ເປີດຟອມຂໍໃໝ່, open = ເປີດລາຍການ id (ເຊັ່ນ ວຽກຈາກແຈ້ງເຕືອນ), tab = ໄປແຖບນັ້ນ */
export type MyIntent = { action: 'new'; date?: string } | { action: 'open'; id: number } | { action: 'tab'; tab: string };
export type MyOpen = (key: string, intent?: MyIntent) => void;

/** ໄອດີໃນ URL ຂອງ backend (decodeId = atob) */
export const idOf = (row: { _uuid: number }) => btoa(String(row._uuid));

/** GET /payroll/me?year=YYYY — ສະລິບທີ່ຈ່າຍແລ້ວ (ເດືອນໃໝ່ສຸດກ່ອນ) + ບໍລິສັດ (ຫົວສະລິບ) */
export type MyPayslip = PayrollLine & { payroll: { _uuid: number; period: string; workdays: number; number: string | null; pay_date: string | null } };
export type MyPayslipData = {
  data: MyPayslip[];
  company: { name_la: string; name_en: string | null; logo_url: string | null } | null;
};

/**
 * GET /payroll/me/preview?month=YYYY-MM — ເງິນເດືອນຫຼວງໜ້າ: estimate = ຍັງບໍ່ມີໃບເງິນເດືອນ (ຄິດຈາກການເຂົ້າວຽກເຖິງມື້ນີ້,
 * ມື້ທີ່ຍັງບໍ່ຮອດນັບວ່າມາວຽກ), draft = HR ກຳລັງກວດ, paid = ຈ່າຍແລ້ວ (ແຖວຈິງ)
 */
export type MyPayPreview = {
  period: string;
  status: 'estimate' | 'draft' | 'paid';
  pay_date: string | null;
  today: string;
  complete: boolean;
  line: PayrollLine;
};

/** ວຽກໃນພື້ນທີ່ຂອງຂ້ອຍ (GET /task/me, /task/me/assigned) — ໂຄງດຽວກັບວຽກໃນໜ້າ HR + ຜູ້ມອບໝາຍ */
export type MyTask = Task & {
  items?: TaskItem[];
  files?: TaskFile[];
  assigned_by_employee_id?: number | null;
  assigned_by?: { employee_id: number | null; name: string; profile_url: string | null } | null;
};
/** ລູກທີມທີ່ມອບໝາຍວຽກໃຫ້ໄດ້ (ຕາມໂຄງຮ່າງ) */
export type MyTeamMember = { _uuid: number; emp_code: string; first_name: string; last_name: string | null; profile_url: string | null; position: string | null; department: string | null; depth: number };
export type MyTasksData = { data: MyTask[]; open: number; today: string; team?: MyTeamMember[] };

/** ແຜນວຽກຂອງຕົນເອງ (GET /employee/me/workplan) */
export type WorkPlanUpdate = { at: string; progress: number; kind: string; note: string | null };
export type WorkPlan = {
  _uuid: number;
  title: string;
  note: string | null;
  start_date: string;
  end_date: string;
  done: boolean | number;
  progress: number;
  done_at: string | null;
  createdAt: string;
  update_count: number;
  last_update: WorkPlanUpdate | null;
  updates?: WorkPlanUpdate[];
  important: boolean | null;
  urgent: boolean | null;
};
export type WorkPlanScope = 'active' | 'upcoming' | 'history';
export type WorkPlanPage = { today: string; data: WorkPlan[]; has_more: boolean; counts: { active: number; upcoming: number; history: number; overdue: number } };

/** ໂນດສ່ວນຕົວ (GET /note/me) — marks / ink ເປັນ JSON ຂອງ app (ສີ/ໂຕໜາ/ໄຮໄລ້ ຂອງບາງຄຳ, ຮູບຂີດແຕ້ມ) */
export type MyNote = {
  _uuid: number;
  folder_id: number | null;
  title: string | null;
  body: string | null;
  marks: string | null;
  ink: string | null;
  color: string | null;
  pinned: boolean | number;
  createdAt: string;
  updatedAt: string;
};
export type MyNoteFolder = { _uuid: number; name: string; count: number };
export type MyNoteBook = { data: MyNote[]; folders: MyNoteFolder[] };

/**
 * ອະນຸມັດຄຳຂໍ (GET /approve/me) — ສິດທີ່ HR ຕິກໃຫ້ໃນຟອມຜູ້ໃຊ້ (leave / correction / advance) + team = ເປັນຫົວໜ້າທີມ
 * (ອະນຸມັດລາພັກຂອງລູກທີມຂັ້ນທຳອິດ). ບໍ່ເຫັນ ແລະ ອະນຸມັດຄຳຂໍຂອງຕົນເອງບໍ່ໄດ້
 */
export type ApprovalKind = 'team' | 'leave' | 'correction' | 'advance';
export type MyApprovals = { rights: Record<ApprovalKind, boolean>; pending: Record<ApprovalKind, number> };
export type ApprovalState = 'pending' | 'approved' | 'rejected' | 'cancelled';
/** ຄຳຂໍໃນຮູບແບບດຽວກັນທຸກປະເພດ (backend ຂຽນຫົວຂໍ້ / ລາຍລະອຽດ / ຄຳເຕືອນໃຫ້ແລ້ວ) */
export type ApprovalItem = {
  _uuid: number;
  kind: ApprovalKind;
  state: ApprovalState;
  title: string;
  lines: string[];
  warn: string[];
  reason: string | null;
  files: LeaveFile[];
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  reviewer: string | null;
  person: { _uuid: number; emp_code: string; name: string; profile_url: string | null; department: string | null; position: string | null };
};
/** GET /approve/me/:kind — ລໍຖ້າ (ເກົ່າສຸດກ່ອນ) + ທີ່ຕັດສິນແລ້ວໃນ 30 ມື້ */
export type ApprovalList = { pending: ApprovalItem[]; recent: ApprovalItem[] };

/** GET /employee/me/colleagues — ສະເພາະຂໍ້ມູນຕິດຕໍ່ວຽກ (ບໍ່ມີເງິນເດືອນ / ຂໍ້ມູນສ່ວນຕົວ) */
export type Colleague = {
  _uuid: number;
  emp_code: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  profile_url: string | null;
  department: { _uuid: number; depart_name: string } | null;
  position: { _uuid: number; position_name: string } | null;
  birthday_today: boolean;
  on_leave_today: boolean;
  is_me: boolean;
};
export type ColleagueData = { today: string; data: Colleague[]; summary: { total: number; on_leave: number; birthdays: number } };

/** GET /notification/me — ໃໝ່ສຸດກ່ອນ (ບໍ່ເກີນ 100); ref = "<ປະເພດ>:<id>" ຂອງສິ່ງທີ່ແຈ້ງ (ເປີດໜ້ານັ້ນ) */
export type MyNotification = { _uuid: number; type: string; title: string; body: string | null; ref: string | null; is_new: boolean; createdAt: string };
export type MyNotificationData = { data: MyNotification[]; unread: number };
