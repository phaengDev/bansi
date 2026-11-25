import { useCallback, useEffect, useState } from 'react';
import { firstRailKey, type SidebarPopupGroup } from './config/SidebarPopup';

/**
 * "ຈື່ໜ້າຕ່າງທີ່ເປີດໄວ້" (ຕັ້ງຄ່າ Desktop) — ເປີດ = ໂຫຼດໜ້າເວັບໃໝ່ (F5) ແລ້ວໜ້າຕ່າງທີ່ເປີດຢູ່ ກັບມາຄືເກົ່າ
 * (ລວມທັງຫຍໍ້ລົງ taskbar) ແລະ ແຕ່ລະໜ້າຕ່າງກັບໄປເມນູຊ້າຍອັນເກົ່າ. ເກັບໃນ browser ນີ້ (localStorage);
 * ອອກຈາກລະບົບ = ລຶບໝົດ (Shell.handleLogout ລ້າງ localStorage)
 */
export const KEEP_WINDOWS_KEY = 'accountKeepWindows';
const OPEN_WINDOWS_KEY = 'accountOpenWindows';
const RAIL_PREFIX = 'accountRail:';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage ຖືກປິດ — ຈື່ບໍ່ໄດ້ ແຕ່ໃຊ້ງານໄດ້ປົກກະຕິ
  }
};

export const keepWindowsOn = () => read(KEEP_WINDOWS_KEY) === '1';

/** ປິດ = ລືມທຸກຢ່າງທີ່ຈື່ໄວ້ (ໜ້າຕ່າງ + ເມນູຊ້າຍ) */
export const saveKeepWindows = (on: boolean) => {
  write(KEEP_WINDOWS_KEY, on ? '1' : '0');
  if (on) return;
  write(OPEN_WINDOWS_KEY, null);
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(RAIL_PREFIX)).forEach((key) => localStorage.removeItem(key));
  } catch {
    // ບໍ່ມີ storage
  }
};

export type SavedWindow = { id: string; minimized: boolean };

/** ໜ້າຕ່າງທີ່ເປີດຢູ່ຕອນກ່ອນໂຫຼດໃໝ່ — ລຽງຕາມລຳດັບທີ່ເປີດ (ອັນສຸດທ້າຍ = ຢູ່ໜ້າສຸດ) */
export const readOpenWindows = (): SavedWindow[] => {
  try {
    const list = JSON.parse(read(OPEN_WINDOWS_KEY) ?? '[]');
    return Array.isArray(list)
      ? list.filter((w) => w && typeof w.id === 'string').map((w) => ({ id: w.id, minimized: !!w.minimized }))
      : [];
  } catch {
    return [];
  }
};

export const saveOpenWindows = (list: SavedWindow[]) => write(OPEN_WINDOWS_KEY, JSON.stringify(list));

/**
 * ເມນູຊ້າຍທີ່ເລືອກຢູ່ຂອງໜ້າຕ່າງ (ແທນ useState(firstRailKey(...))) — ເລືອກແລ້ວຈື່ໄວ້ສະເໝີ, ແຕ່ເປີດມາກັບໄປອັນເກົ່າ
 * ສະເພາະເມື່ອເປີດ "ຈື່ໜ້າຕ່າງ" ແລະ ເມນູນັ້ນຍັງມີຢູ່; ບໍ່ດັ່ງນັ້ນ = fallback (ປົກກະຕິແມ່ນເມນູທຳອິດ)
 */
const RAIL_EVENT = 'rail-key-request';
/** ໜ້າທີ່ຖືກຂໍຈາກທາງນອກ (ຍັງບໍ່ໄດ້ໃຊ້) ຕາມ window */
const requestedRail: Record<string, string> = {};

/** ໃຫ້ໜ້າຕ່າງ `windowId` ເປີດໄປທີ່ໜ້າ `key` ຂອງແຖບຊ້າຍ (ເຊັ່ນ "ຕ້ອງຕິດຕາມ" → ຕັ້ງຄ່າ → ຂໍ້ມູນບໍລິສັດ) — ເອີ້ນກ່ອນເປີດໜ້າຕ່າງ */
export const requestRailKey = (windowId: string, key: string) => {
  requestedRail[windowId] = key;
  window.dispatchEvent(new CustomEvent(RAIL_EVENT, { detail: windowId }));
};

export const useRailKey = (windowId: string, groups: SidebarPopupGroup[], fallback = firstRailKey(groups)) => {
  const valid = (key: string | undefined | null) => !!key && groups.some((group) => group.items.some((item) => item.key === key));
  const [key, setKey] = useState(() => {
    const asked = requestedRail[windowId];
    if (valid(asked)) {
      delete requestedRail[windowId];
      return asked;
    }
    if (!keepWindowsOn()) return fallback;
    const saved = read(RAIL_PREFIX + windowId);
    return saved && groups.some((group) => group.items.some((item) => item.key === saved)) ? saved : fallback;
  });
  const select = useCallback((next: string) => {
    setKey(next);
    write(RAIL_PREFIX + windowId, next);
  }, [windowId]);
  // ໜ້າຕ່າງເປີດຢູ່ແລ້ວ ແລະ ຖືກຂໍໃຫ້ໄປໜ້າອື່ນ
  useEffect(() => {
    const onRequest = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== windowId) return;
      const asked = requestedRail[windowId];
      delete requestedRail[windowId];
      if (valid(asked)) select(asked);
    };
    window.addEventListener(RAIL_EVENT, onRequest);
    return () => window.removeEventListener(RAIL_EVENT, onRequest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowId, select]);
  return [key, select] as const;
};
