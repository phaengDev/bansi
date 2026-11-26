import { useEffect, useState, useSyncExternalStore } from 'react';
import { getApi, postApi } from '../../utils/configApi';
import { useLangField, useT } from '../../context/LanguageContext';
import { menuGroupOf, shortcutNameKeys, shortcuts, type Shortcut, type ShortcutId } from './DesktopShared';
import type { Employee } from '../hr/hrApi';
import { planBlocks, refreshCompanyPlan, useCompanyPlan, useIsPlatformAdmin } from './companyPlan';

/** ແຖວຈາກ GET /menu/main ແລະ /menu/all (tbl_main_menu types 2) — backend ບໍ່ສົ່ງ hash ລະຫັດຜ່ານ ສົ່ງແຕ່ locked */
type MainMenuRow = {
  _uuid: number;
  name_la: string;
  name_en?: string;
  name_cn?: string;
  icons?: string;
  path: string;
  locked?: boolean;
};

/** ເມນູທີ່ສະແດງໃນໜ້າ desktop — shortcut ຂອງໜ້າເວັບ (tone, popup, ໜ້າ) + ຊື່/ໄອຄອນ/ສະຖານະລັອກ ຈາກ backend */
export type AccountMenu = Shortcut & {
  /** _uuid ຂອງ tbl_main_menu — ບໍ່ມີ = ໃຊ້ລາຍການສຳຮອງຂອງໜ້າເວັບ (ຕັ້ງລະຫັດບໍ່ໄດ້) */
  menuId?: number;
  name: string;
  iconClass: string;
  locked: boolean;
  lockable: boolean;
};

/** ລັອກບໍ່ໄດ້ — ກົງກັບ UNLOCKABLE_PATHS ຂອງ backend (bansi/menuLockController) */
const UNLOCKABLE: ShortcutId[] = ['settings', 'calendar'];

/** ເມນູຂອງຂ້ອຍ (/me/… — ຂໍ້ມູນຂອງພະນັກງານເອງ) — ບໍ່ມາຈາກ tbl_main_menu, ຂຶ້ນສະເພາະບັນຊີທີ່ຜູກກັບພະນັກງານ */
const SELF_SERVICE = shortcuts.filter((shortcut) => menuGroupOf(shortcut.path) === 'me');
const isSelfService = (id: ShortcutId) => SELF_SERVICE.some((shortcut) => shortcut.id === id);
/** ຈັດການບໍລິສັດ — ບໍ່ມາຈາກ tbl_main_menu, ຂຶ້ນສະເພາະເຈົ້າຂອງລະບົບ */
const PLATFORM = shortcuts.find((shortcut) => shortcut.id === 'platform')!;
/** ເມນູທີ່ບໍ່ມາຈາກ tbl_main_menu (ບໍ່ຢູ່ໃນລາຍການສຳຮອງ ເມື່ອ DB ຍັງບໍ່ມີແຖວເມນູ) */
const isExtra = (id: ShortcutId) => isSelfService(id) || id === PLATFORM.id;

/**
 * ເມນູທີ່ຜູ້ໃຊ້ຄົນນີ້ເຂົ້າໄດ້ (backend ກັ່ນຕາມ tbl_users.menu_access ແລ້ວ). all = ໄດ້ທຸກເມນູ.
 * ໃຊ້ຮ່ວມກັນທັງ Shell, desktop ແລະ ໜ້າຕັ້ງລະຫັດ — ໂຫຼດຄືນແລ້ວທຸກບ່ອນເຫັນທັນທີ
 */
let menuState: { rows: MainMenuRow[]; all: boolean } | null = null;
/**
 * ພະນັກງານທີ່ບັນຊີນີ້ຜູກໄວ້ (GET /employee/me): undefined = ຍັງບໍ່ຮູ້, null = ບໍ່ໄດ້ຜູກ (ຫຼື ລາອອກແລ້ວ).
 * ຜູກແລ້ວ = ເຫັນ "ພື້ນທີ່ຂອງຂ້ອຍ" ແລະ ໃຊ້ຂໍ້ມູນຂອງຕົນເອງຄືໃນ app ພະນັກງານ (backend: selfEmployee)
 */
let selfState: Employee | null | undefined;
/** ໂຫຼດ /menu/main ສຳເລັດ ຫຼື ລົ້ມເຫຼວແລ້ວ (ກ່ອນນັ້ນສະຖານະລັອກ ແລະ ສິດຍັງບໍ່ຮູ້) */
let loaded = false;
const listeners = new Set<() => void>();

/**
 * ດຶງ GET /menu/main ແລ້ວແຈ້ງທຸກບ່ອນທີ່ໃຊ້ useAccountMenus(). ໂຫຼດບໍ່ໄດ້: ເທື່ອທຳອິດ = ບໍ່ສະແດງເມນູໃດ (ບໍ່ເດົາສິດ),
 * ເທື່ອຕໍ່ມາ = ໃຊ້ລາຍການເກົ່າ (ເນັດສະດຸດ ບໍ່ໃຫ້ປິດໜ້າຕ່າງທີ່ເປີດຢູ່)
 */
export const refreshAccountMenus = async () => {
  // ແພັກເກດຂອງບໍລິສັດ (ໂມດູນ / ໝົດອາຍຸ) ໂຫຼດພ້ອມກັນ — ມີ store ຂອງຕົນເອງ (companyPlan)
  refreshCompanyPlan().catch((error) => console.error(error));
  const [menus, self] = await Promise.allSettled([getApi('/menu/main'), getApi('/employee/me')]);
  if (menus.status === 'fulfilled') {
    menuState = { rows: menus.value.data?.data ?? [], all: menus.value.data?.all !== false };
  } else {
    console.error(menus.reason);
  }
  // 400 = ບໍ່ໄດ້ຜູກ / ລາອອກ → ບໍ່ມີພື້ນທີ່ຂອງຂ້ອຍ; ເນັດສະດຸດ (ບໍ່ມີ response) = ໃຊ້ຄ່າເກົ່າ
  if (self.status === 'fulfilled') selfState = Number(self.value.data?.data?._uuid) > 0 ? self.value.data.data : null;
  else if ((self.reason as { response?: unknown })?.response) selfState = null;
  loaded = true;
  listeners.forEach((notify) => notify());
};

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

/** ແຖວ backend → ເມນູຂອງໜ້າເວັບ ຕາມລຳດັບ _uuid, ຈັບຄູ່ກັບ shortcuts ດ້ວຍ path (ແຖວທີ່ path ບໍ່ກົງກັບໜ້າໃດ ຖືກຂ້າມ) */
const useToMenus = () => {
  const t = useT();
  const lf = useLangField();

  const toMenu = (shortcut: Shortcut, row?: MainMenuRow): AccountMenu => ({
    ...shortcut,
    menuId: row?._uuid,
    name: (row && lf(row, 'name')) || t(shortcutNameKeys[shortcut.id]),
    iconClass: row?.icons || `fa-solid ${shortcut.icon}`,
    locked: !!row?.locked,
    lockable: !!row && !UNLOCKABLE.includes(shortcut.id) && !isExtra(shortcut.id),
  });

  // path ຊ້ຳ (ແຖວເມນູຊ້ຳໃນ DB) = ເອົາແຖວທຳອິດ — ໄອຄອນ / ໜ້າຕ່າງ ມີອັນດຽວຕໍ່ເມນູ
  return { toMenu, fromRows: (rows: MainMenuRow[]) => rows.flatMap((row, i) => {
    if (rows.findIndex((other) => other.path === row.path) !== i) return [];
    const shortcut = shortcuts.find((item) => item.path === row.path);
    return shortcut ? [toMenu(shortcut, row)] : [];
  }) };
};

/**
 * ເມນູທີ່ຜູ້ໃຊ້ຄົນນີ້ເຂົ້າໄດ້. ຍັງໂຫຼດບໍ່ແລ້ວ ຫຼື ໂຫຼດບໍ່ໄດ້ → ບໍ່ມີເມນູ;
 * ໄດ້ທຸກເມນູ ແຕ່ DB ຍັງບໍ່ມີແຖວ types 2 → ໃຊ້ shortcuts ທັງໝົດຂອງໜ້າເວັບ ໃຫ້ desktop ຍັງໃຊ້ໄດ້ (ບໍ່ມີລັອກ)
 */
export const useAccountMenus = (): AccountMenu[] => {
  const state = useSyncExternalStore(subscribe, () => menuState);
  const self = useSyncExternalStore(subscribe, () => selfState);
  // ໜ້າຂອງຂ້ອຍຂອງໂມດູນທີ່ບໍລິສັດບໍ່ໄດ້ຊື້ (ເຊັ່ນ ບໍ່ມີເງິນເດືອນ → ບໍ່ມີ ເງິນເດືອນຂອງຂ້ອຍ) — backend ກັ່ນເມນູ DB ແລ້ວ
  const plan = useCompanyPlan();
  const platformAdmin = useIsPlatformAdmin();
  const { toMenu, fromRows } = useToMenus();
  if (!state) return [];
  const menus = !state.rows.length
    ? (state.all ? shortcuts.filter((shortcut) => !isExtra(shortcut.id) && !planBlocks(plan, shortcut.path)).map((shortcut) => toMenu(shortcut)) : [])
    : fromRows(state.rows);
  const mine = self ? SELF_SERVICE.filter((shortcut) => !planBlocks(plan, shortcut.path)).map((shortcut) => toMenu(shortcut)) : [];
  return [...menus, ...mine, ...(platformAdmin ? [toMenu(PLATFORM)] : [])];
};

/**
 * ເຫັນເງິນເດືອນຄົນອື່ນໄດ້ບໍ — ມີສິດເມນູ "ເງິນເດືອນ" (ກົງກັບ canSeeSalary ຂອງ backend: ບໍ່ມີສິດ = API ສົ່ງ null ມາແທນ).
 * ໃຊ້ຊ່ອນຊ່ອງ/ຖັນເງິນເດືອນໃນໜ້າພະນັກງານ, OT …
 */
export const useCanSeeSalary = () => useAccountMenus().some((menu) => menu.id === 'payroll');

/** ພະນັກງານທີ່ບັນຊີນີ້ຜູກໄວ້ — null = ບໍ່ໄດ້ຜູກ, undefined = ກຳລັງກວດ (ໜ້າພື້ນທີ່ຂອງຂ້ອຍໃຊ້ຫົວ/ຮູບ) */
export const useMyEmployee = () => useSyncExternalStore(subscribe, () => selfState);

/** ເມນູທີ່ທຸກບັນຊີໄດ້ສະເໝີ ບໍ່ຢູ່ໃນການຕິກສິດ — ກົງກັບ ALWAYS_ON_PATHS ຂອງ backend (menuController) */
export const ALWAYS_ON_PATHS = ['/calendar'];

/** ທຸກເມນູທີ່ຕິກສິດໄດ້ (GET /menu/all ບໍ່ລວມເມນູທີ່ໄດ້ສະເໝີ) — ຟອມຜູ້ໃຊ້ໃຊ້ຕິກວ່າບັນຊີໃດເຂົ້າເມນູໃດໄດ້; null = ກຳລັງໂຫຼດ */
export const useAllAccountMenus = (): AccountMenu[] | null => {
  const [rows, setRows] = useState<MainMenuRow[] | null>(null);
  const { fromRows } = useToMenus();
  useEffect(() => {
    let cancelled = false;
    getApi('/menu/all')
      .then((res) => !cancelled && setRows(res.data?.data ?? []))
      .catch((error) => {
        console.error(error);
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return rows && fromRows(rows.filter((row) => !ALWAYS_ON_PATHS.includes(row.path)));
};

/** ກຸ່ມຂອງເມນູ — ຢູ່ DesktopShared (ກອບເທິງ desktop ໃຊ້ນຳ); ສົ່ງຕໍ່ໃຫ້ຟອມສິດເຂົ້າເມນູ */
export { MENU_GROUPS, menuGroupOf } from './DesktopShared';

/** ເມນູທີ່ມີໜ້າຜູ້ໃຊ້ລະບົບ — ກົງກັບ USER_ADMIN_MENU_PATH ຂອງ backend: ບັນຊີຂອງຕົນເອງເອົາອອກບໍ່ໄດ້ */
export const USER_ADMIN_MENU_PATH = '/hr';

/** ຮູ້ສະຖານະລັອກຂອງເມນູແລ້ວບໍ່ — ພາບລວມໃນ desktop ລໍຖ້າອັນນີ້ ບໍ່ໃຫ້ສະແດງຕົວເລກຂອງເມນູທີ່ລັອກໄວ້ ກ່ອນຮູ້ວ່າມັນລັອກ */
export const useAccountMenusLoaded = () => useSyncExternalStore(subscribe, () => loaded);

/** 200 = ເຂົ້າໄດ້, 400 = ລະຫັດຜິດ (message ມາຈາກ backend) */
export const verifyMenuPassword = (menuId: number, password: string) =>
  postApi('/menu-lock/verify', { menu_id: menuId, password });

/** ຕັ້ງລະຫັດໃໝ່ ຫຼື ປ່ຽນ — ເມນູທີ່ລັອກຢູ່ແລ້ວຕ້ອງສົ່ງລະຫັດປັດຈຸບັນມານຳ */
export const saveMenuPassword = (menuId: number, password: string, currentPassword?: string) =>
  postApi('/menu-lock/save', { menu_id: menuId, password, current_password: currentPassword });

export const removeMenuPassword = (menuId: number, currentPassword: string) =>
  postApi('/menu-lock/remove', { menu_id: menuId, current_password: currentPassword });
