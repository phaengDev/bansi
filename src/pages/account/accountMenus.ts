import { useSyncExternalStore } from 'react';
import { getApi, postApi } from '../../utils/configApi';
import { useLangField, useT } from '../../context/LanguageContext';
import { shortcutNameKeys, shortcuts, type Shortcut, type ShortcutId } from './DesktopShared';

/** ແຖວຈາກ GET /menu/main (tbl_main_menu types 2) — backend ບໍ່ສົ່ງ hash ລະຫັດຜ່ານ ສົ່ງແຕ່ locked */
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

// ແຖວເມນູໃຊ້ຮ່ວມກັນທັງ Shell, desktop ແລະ ໜ້າຕັ້ງລະຫັດ — ໂຫຼດຄືນແລ້ວທຸກບ່ອນເຫັນທັນທີ
let rows: MainMenuRow[] | null = null;
/** ໂຫຼດ /menu/main ສຳເລັດ ຫຼື ລົ້ມເຫຼວແລ້ວ (ກ່ອນນັ້ນສະຖານະລັອກຍັງບໍ່ຮູ້) */
let loaded = false;
const listeners = new Set<() => void>();

/** ດຶງ GET /menu/main ແລ້ວແຈ້ງທຸກບ່ອນທີ່ໃຊ້ useAccountMenus() */
export const refreshAccountMenus = async () => {
  try {
    const res = await getApi('/menu/main');
    rows = res.data?.data ?? [];
  } catch (error) {
    console.error(error);
    rows = null;
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

/**
 * ເມນູບັນຊີຕາມລຳດັບ _uuid ຂອງ backend, ຈັບຄູ່ກັບ shortcuts ດ້ວຍ path (ແຖວທີ່ path ບໍ່ກົງກັບໜ້າໃດ ຖືກຂ້າມ).
 * ຍັງບໍ່ມີແຖວ types 2 ຫຼື ໂຫຼດບໍ່ໄດ້ → ໃຊ້ shortcuts ທັງໝົດຂອງໜ້າເວັບ ໃຫ້ desktop ຍັງໃຊ້ໄດ້ (ບໍ່ມີລັອກ)
 */
export const useAccountMenus = (): AccountMenu[] => {
  const data = useSyncExternalStore(subscribe, () => rows);
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

  if (!data?.length) return shortcuts.map((shortcut) => toMenu(shortcut));
  return data.flatMap((row) => {
    const shortcut = shortcuts.find((item) => item.path === row.path);
    return shortcut ? [toMenu(shortcut, row)] : [];
  });
};

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
