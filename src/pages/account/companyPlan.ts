import { useSyncExternalStore } from 'react';
import { getApi } from '../../utils/configApi';

/**
 * ແພັກເກດຂອງບໍລິສັດ (GET /company/plan ຂອງ api-bansi utils/plans) — ໂມດູນທີ່ຊື້, ວັນໝົດອາຍຸ, ຈຳນວນທີ່ໃຊ້ໄດ້.
 * ໃຊ້ຮ່ວມກັນ: ເມນູ (accountMenus ຊ່ອນໜ້າ /me/… ຂອງໂມດູນທີ່ບໍ່ມີ), ປ້າຍໃນ taskbar, ບັດແພັກເກດໃນຂໍ້ມູນບໍລິສັດ.
 * server ລຸ້ນທີ່ຍັງບໍ່ມີແພັກເກດ (404) = null → ບໍ່ຈຳກັດຫຍັງ
 */
export type ModuleCode = 'accounting' | 'arap' | 'budget' | 'lao_compliance' | 'loans' | 'credit' | 'hr' | 'attendance' | 'payroll' | 'tasks' | 'ai';

export type CompanyPlan = {
  /** true = ບໍ່ມີແພັກເກດ (ທຸກໂມດູນ) */
  all_modules: boolean;
  package: { code: string; name_la: string; name_en: string | null } | null;
  modules: ModuleCode[];
  /** path ຂອງເມນູທີ່ບໍລິສັດບໍ່ໄດ້ຊື້ */
  blocked_menus: string[];
  expires_at: string | null;
  /** 0 = ມື້ສຸດທ້າຍ, ລົບ = ໝົດມາແລ້ວ, null = ບໍ່ໝົດອາຍຸ */
  days_left: number | null;
  trial: boolean;
  expired: boolean;
  limits: { users: number | null; employees: number | null };
  usage: { users: number; employees: number };
};

/** ລາຍການໂມດູນ (ລະຫັດກົງກັບ MODULES ຂອງ backend) — ຊື່ / ໄອຄອນ ສຳລັບສະແດງ */
export const PLAN_MODULES: { code: ModuleCode; label: string; icon: string; tone: string }[] = [
  { code: 'accounting', label: 'planModAccounting', icon: 'fa-calculator', tone: 'cyan' },
  { code: 'arap', label: 'planModArap', icon: 'fa-hand-holding-dollar', tone: 'gold' },
  { code: 'budget', label: 'planModBudget', icon: 'fa-bullseye', tone: 'coral' },
  { code: 'lao_compliance', label: 'planModCompliance', icon: 'fa-clipboard-check', tone: 'violet' },
  { code: 'loans', label: 'planModLoans', icon: 'fa-sack-dollar', tone: 'coral' },
  { code: 'credit', label: 'planModCredit', icon: 'fa-file-signature', tone: 'emerald' },
  { code: 'hr', label: 'planModHr', icon: 'fa-id-card', tone: 'sky' },
  { code: 'attendance', label: 'planModAttendance', icon: 'fa-user-clock', tone: 'sky' },
  { code: 'payroll', label: 'planModPayroll', icon: 'fa-money-check-dollar', tone: 'emerald' },
  { code: 'tasks', label: 'planModTasks', icon: 'fa-list-check', tone: 'slate' },
  { code: 'ai', label: 'planModAi', icon: 'fa-robot', tone: 'violet' },
];

/** ເຕືອນໃນ taskbar ເມື່ອເຫຼືອບໍ່ເກີນຈັກມື້ */
export const PLAN_WARN_DAYS = 14;

/** localStorage: ໝົດອາຍຸ = ອ່ານໄດ້ຢ່າງດຽວ — utils/localStorage ອ່ານຕອນໂຫຼດໜ້າ (canCreate / canEdit / canDelete) */
export const PLAN_READ_ONLY_KEY = 'planReadOnly';

/** undefined = ຍັງບໍ່ຮູ້, null = server ບໍ່ມີແພັກເກດ (ບໍ່ຈຳກັດ) */
let planState: CompanyPlan | null | undefined;
/** ເປັນເຈົ້າຂອງລະບົບ (GET /platform/me) — ເຫັນໜ້າຕ່າງ ຈັດການບໍລິສັດ */
let platformState = false;
const listeners = new Set<() => void>();

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

/**
 * ສະຖານະອ່ານໄດ້ຢ່າງດຽວປ່ຽນ (ຫາກໍ່ໝົດອາຍຸ / ຕໍ່ອາຍຸແລ້ວ) → ຈື່ແລ້ວໂຫຼດໜ້າໃໝ່ເທື່ອດຽວ ໃຫ້ປຸ່ມເພີ່ມ/ແກ້/ລຶບ ທຸກໜ້າຕາມ.
 * ຂຽນ storage ບໍ່ໄດ້ = ບໍ່ໂຫຼດໃໝ່ (ກັນວົນ) — API ຍັງປະຕິເສດການຂຽນເອງ
 */
const syncReadOnly = (expired: boolean) => {
  try {
    const stored = localStorage.getItem(PLAN_READ_ONLY_KEY) === '1';
    if (stored === expired) return;
    if (expired) localStorage.setItem(PLAN_READ_ONLY_KEY, '1');
    else localStorage.removeItem(PLAN_READ_ONLY_KEY);
    if ((localStorage.getItem(PLAN_READ_ONLY_KEY) === '1') === expired) window.location.reload();
  } catch {
    // storage ຖືກປິດ
  }
};

/** ໂຫຼດແພັກເກດ + ສິດເຈົ້າຂອງລະບົບ (ເອີ້ນພ້ອມ refreshAccountMenus) */
export const refreshCompanyPlan = async () => {
  const [plan, platform] = await Promise.allSettled([getApi('/company/plan'), getApi('/platform/me')]);
  // ຮູບແບບບໍ່ຖືກ (server ອື່ນ / ລຸ້ນເກົ່າ) = ບໍ່ຈຳກັດ
  if (plan.status === 'fulfilled') {
    const data = plan.value.data?.data;
    planState = data && Array.isArray(data.modules) && Array.isArray(data.blocked_menus) ? data : null;
  }
  // ບໍ່ມີ route (server ລຸ້ນເກົ່າ) = ບໍ່ຈຳກັດ; ເນັດສະດຸດ = ໃຊ້ຄ່າເກົ່າ
  else if ((plan.reason as { response?: { status?: number } })?.response?.status === 404) planState = null;
  platformState = platform.status === 'fulfilled' && platform.value.data?.data?.admin === true;
  if (planState) syncReadOnly(planState.expired);
  listeners.forEach((notify) => notify());
};

export const useCompanyPlan = () => useSyncExternalStore(subscribe, () => planState);
export const useIsPlatformAdmin = () => useSyncExternalStore(subscribe, () => platformState);

/** ບໍລິສັດມີໂມດູນນີ້ບໍ — ຍັງບໍ່ຮູ້ / server ບໍ່ມີແພັກເກດ = ມີ */
export const planHas = (plan: CompanyPlan | null | undefined, code: ModuleCode) => !plan || plan.modules.includes(code);

/** ເມນູ (path) ນີ້ຢູ່ນອກແພັກເກດບໍ */
export const planBlocks = (plan: CompanyPlan | null | undefined, path: string) => !!plan?.blocked_menus?.includes(path);
