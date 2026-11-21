import { useSyncExternalStore } from 'react';
import type { ShortcutId } from '../account/DesktopShared';
import { MY_INBOX_MENU, MY_PAY_MENU, MY_TASKS_MENU, MY_TEAM_MENU, MY_WORK_MENU, type SidebarPopupGroup } from '../account/config/SidebarPopup';
import type { MyIntent } from './meApi';

/**
 * ເມນູຂອງຂ້ອຍ (ໜ້າຕ່າງ) ແລະ ໜ້າໃນແຕ່ລະເມນູ — ສ່ວນທີ່ຕໍ່ເນື່ອງກັນຢູ່ເມນູດຽວ. ໜ້າໜຶ່ງເປີດໜ້າຂອງເມນູອື່ນໄດ້ຜ່ານ openMyPage
 * (ເຊັ່ນ "ມື້ນີ້" → ເບີກເງິນລ່ວງໜ້າ): Shell ເປີດໜ້າຕ່າງນັ້ນ ແລ້ວໜ້າຕ່າງໄປທີ່ໜ້າທີ່ຂໍ ພ້ອມສິ່ງທີ່ຈະເຮັດ (intent)
 */
export const MY_WINDOWS: { id: ShortcutId; menu: SidebarPopupGroup[] }[] = [
  { id: 'myWork', menu: MY_WORK_MENU },
  { id: 'myPay', menu: MY_PAY_MENU },
  { id: 'myTasks', menu: MY_TASKS_MENU },
  { id: 'myTeam', menu: MY_TEAM_MENU },
  { id: 'myInbox', menu: MY_INBOX_MENU },
];

export const hasPage = (menu: SidebarPopupGroup[], key: string) => menu.some((group) => group.items.some((item) => item.key === key));
const windowOfPage = (key: string) => MY_WINDOWS.find((w) => hasPage(w.menu, key))?.id;

export type MyPageRequest = { window: ShortcutId; key: string; intent?: MyIntent };

let request: MyPageRequest | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** ຂໍເປີດໜ້າ `key` (ຢູ່ເມນູໃດກໍ່ໄດ້) — ໜ້າຕ່າງປາຍທາງຮັບແລ້ວລ້າງ */
export const openMyPage = (key: string, intent?: MyIntent) => {
  const window = windowOfPage(key);
  if (!window) return;
  request = { window, key, intent };
  notify();
};

export const useMyPageRequest = () => useSyncExternalStore(subscribe, () => request);

/** ໜ້າຕ່າງປາຍທາງໄປທີ່ໜ້ານັ້ນແລ້ວ — ລ້າງ (ສະເພາະຄຳຂໍອັນດຽວກັນ ບໍ່ລ້າງອັນໃໝ່ທີ່ມາລະຫວ່າງນັ້ນ) */
export const clearMyPageRequest = (done: MyPageRequest) => {
  if (request !== done) return;
  request = null;
  notify();
};
