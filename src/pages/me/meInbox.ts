import { useEffect, useSyncExternalStore } from 'react';
import { getApi } from '../../utils/configApi';
import type { ApprovalKind, MyApprovals, MyNotificationData } from './meApi';

/**
 * ກ່ອງຂອງຂ້ອຍ — ຄຳຂໍທີ່ລໍຂ້ອຍອະນຸມັດ (GET /approve/me) ແລະ ແຈ້ງເຕືອນ (GET /notification/me).
 * ໂຫຼດບ່ອນດຽວແລ້ວໃຊ້ຮ່ວມກັນ: ຕົວເລກໃນໄອຄອນ desktop, ແຖບຊ້າຍຂອງໜ້າຕ່າງ ແລະ ໜ້າແຈ້ງເຕືອນ.
 * ໂຫຼດທຸກນາທີ ແລະ ຕອນກັບມາເບິ່ງແທັບ ຂະນະທີ່ມີບ່ອນໃຊ້ຢູ່; ອະນຸມັດ / ອ່ານແລ້ວ → refreshMyInbox()
 */
export type MyInbox = { approvals: MyApprovals | null; notifications: MyNotificationData | null; loaded: boolean };

const KINDS: ApprovalKind[] = ['team', 'leave', 'correction', 'advance'];
const POLL_MS = 60_000;
const NO_APPROVALS: MyApprovals = {
  rights: { team: false, leave: false, correction: false, advance: false },
  pending: { team: 0, leave: 0, correction: 0, advance: 0 },
};

let state: MyInbox = { approvals: null, notifications: null, loaded: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

let running: Promise<void> | null = null;
/** ໂຫຼດໃໝ່ (ກຳລັງໂຫຼດຢູ່ = ລໍອັນເກົ່າ) — ອັນໃດລົ້ມ (ເນັດຂາດ / ບໍ່ໄດ້ຜູກ) ຄົງຄ່າເກົ່າໄວ້ */
export const refreshMyInbox = () => {
  running ??= (async () => {
    const [approvals, notifications] = await Promise.allSettled([getApi('/approve/me'), getApi('/notification/me')]);
    // ຮັບສະເພາະຮູບແບບທີ່ຖືກ (API ເກົ່າ / ຜິດພາດ = ຄືບໍ່ມີສິດ / ບໍ່ມີແຈ້ງເຕືອນ — ບໍ່ໃຫ້ໜ້າພັງ)
    const a = approvals.status === 'fulfilled' ? approvals.value.data : undefined;
    const n = notifications.status === 'fulfilled' ? notifications.value.data : undefined;
    state = {
      approvals: a === undefined ? state.approvals : a?.rights && a?.pending ? a : NO_APPROVALS,
      notifications: n === undefined ? state.notifications : Array.isArray(n?.data) ? { data: n.data, unread: Number(n.unread) || 0 } : { data: [], unread: 0 },
      loaded: true,
    };
    emit();
  })().finally(() => {
    running = null;
  });
  return running;
};

/** ອ່ານແລ້ວ (ກ່ອນເຊີບເວີຕອບ) — ຕົວເລກຫຼຸດທັນທີ; id ບໍ່ໃສ່ = ທັງໝົດ */
export const markReadLocally = (id?: number) => {
  const current = state.notifications;
  if (!current) return;
  const data = current.data.map((n) => (id === undefined || n._uuid === id ? { ...n, is_new: false } : n));
  state = { ...state, notifications: { data, unread: id === undefined ? 0 : Math.max(0, current.unread - (current.data.some((n) => n._uuid === id && n.is_new) ? 1 : 0)) } };
  emit();
};

let users = 0;
let timer: number | undefined;
const onVisible = () => {
  if (document.visibilityState === 'visible') refreshMyInbox();
};
const start = () => {
  refreshMyInbox();
  timer = window.setInterval(refreshMyInbox, POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
};
const stop = () => {
  window.clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisible);
};

/** enabled = false (ບັນຊີບໍ່ໄດ້ຜູກກັບພະນັກງານ) — ບໍ່ໂຫຼດ */
export const useMyInbox = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined;
    users += 1;
    if (users === 1) start();
    return () => {
      users -= 1;
      if (!users) stop();
    };
  }, [enabled]);
  return useSyncExternalStore(subscribe, () => state);
};

/** ສິດອະນຸມັດປະເພດໃດໜຶ່ງ (ລວມເປັນຫົວໜ້າທີມ) — null = ຍັງບໍ່ຮູ້ */
export const canApprove = (inbox: MyInbox) => (inbox.approvals ? KINDS.some((k) => inbox.approvals!.rights[k]) : null);

/** ຈຳນວນທີ່ລໍຂ້ອຍອະນຸມັດ (ທຸກປະເພດທີ່ມີສິດ) */
export const pendingApprovals = (inbox: MyInbox) =>
  inbox.approvals ? KINDS.reduce((sum, k) => sum + (inbox.approvals!.rights[k] ? Number(inbox.approvals!.pending[k]) || 0 : 0), 0) : 0;

export const unreadNotifications = (inbox: MyInbox) => inbox.notifications?.unread ?? 0;

export const APPROVAL_KINDS = KINDS;
