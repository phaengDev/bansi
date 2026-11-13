import { useEffect, useState, useSyncExternalStore } from 'react';
import { getApi, postApi } from '../../utils/configApi';
import { useLangField, useT } from '../../context/LanguageContext';
import { shortcutNameKeys, shortcuts, type Shortcut, type ShortcutId } from './DesktopShared';

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

/**
 * ເມນູທີ່ຜູ້ໃຊ້ຄົນນີ້ເຂົ້າໄດ້ (backend ກັ່ນຕາມ tbl_users.menu_access ແລ້ວ). all = ໄດ້ທຸກເມນູ.
 * ໃຊ້ຮ່ວມກັນທັງ Shell, desktop ແລະ ໜ້າຕັ້ງລະຫັດ — ໂຫຼດຄືນແລ້ວທຸກບ່ອນເຫັນທັນທີ
 */
let menuState: { rows: MainMenuRow[]; all: boolean } | null = null;
/** ໂຫຼດ /menu/main ສຳເລັດ ຫຼື ລົ້ມເຫຼວແລ້ວ (ກ່ອນນັ້ນສະຖານະລັອກ ແລະ ສິດຍັງບໍ່ຮູ້) */
let loaded = false;
const listeners = new Set<() => void>();

/**
 * ດຶງ GET /menu/main ແລ້ວແຈ້ງທຸກບ່ອນທີ່ໃຊ້ useAccountMenus(). ໂຫຼດບໍ່ໄດ້: ເທື່ອທຳອິດ = ບໍ່ສະແດງເມນູໃດ (ບໍ່ເດົາສິດ),
 * ເທື່ອຕໍ່ມາ = ໃຊ້ລາຍການເກົ່າ (ເນັດສະດຸດ ບໍ່ໃຫ້ປິດໜ້າຕ່າງທີ່ເປີດຢູ່)
 */
export const refreshAccountMenus = async () => {
  try {
    const res = await getApi('/menu/main');
    menuState = { rows: res.data?.data ?? [], all: res.data?.all !== false };
  } catch (error) {
    console.error(error);
  }
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
    lockable: !!row && !UNLOCKABLE.includes(shortcut.id),
  });

  return { toMenu, fromRows: (rows: MainMenuRow[]) => rows.flatMap((row) => {
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
  const { toMenu, fromRows } = useToMenus();
  if (!state) return [];
  if (!state.rows.length) return state.all ? shortcuts.map((shortcut) => toMenu(shortcut)) : [];
  return fromRows(state.rows);
};

/** ທຸກເມນູ (GET /menu/all) — ຟອມຜູ້ໃຊ້ໃຊ້ຕິກວ່າບັນຊີໃດເຂົ້າເມນູໃດໄດ້; null = ກຳລັງໂຫຼດ */
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
  return rows && fromRows(rows);
};

/** ກຸ່ມຂອງເມນູ (ຕາມ path) — ຟອມສິດເຂົ້າເມນູຕິກທັງກຸ່ມໄດ້ */
export const MENU_GROUPS = [
  { key: 'account', label: 'hrMenuGroupAccount', icon: 'fa-calculator', match: (path: string) => path.startsWith('/account/') },
  { key: 'hr', label: 'hrMenuGroupHr', icon: 'fa-people-group', match: (path: string) => path === '/hr' || path.startsWith('/hr/') },
  { key: 'other', label: 'hrMenuGroupOther', icon: 'fa-shapes', match: () => true },
] as const;
export const menuGroupOf = (path: string) => MENU_GROUPS.find((group) => group.match(path))!.key;

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
