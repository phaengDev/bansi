import { useEffect, useSyncExternalStore } from 'react';
import { CONFIG, getApi } from '../../utils/configApi';
import type { ApprovalKind, MyApprovals, MyNotification, MyNotificationData } from './meApi';

/**
 * ກ່ອງຂອງຂ້ອຍ — ຄຳຂໍທີ່ລໍຂ້ອຍອະນຸມັດ (GET /approve/me) ແລະ ແຈ້ງເຕືອນ (GET /notification/me).
 * ໂຫຼດບ່ອນດຽວແລ້ວໃຊ້ຮ່ວມກັນ: ຕົວເລກໃນໄອຄອນ desktop, ແຖບຊ້າຍຂອງໜ້າຕ່າງ ແລະ ໜ້າແຈ້ງເຕືອນ.
 * ໂຫຼດທຸກນາທີ ແລະ ຕອນກັບມາເບິ່ງແທັບ ຂະນະທີ່ມີບ່ອນໃຊ້ຢູ່; ອະນຸມັດ / ອ່ານແລ້ວ → refreshMyInbox().
 * ແຈ້ງເຕືອນໃໝ່ມາທັນທີຜ່ານ /notification/me/stream — arrived = ອັນລ່າສຸດທີ່ຫາກໍ່ມາ (ປຸ່ມ "ຂອງຂ້ອຍ" ສະແດງຟອງ)
 */
export type MyInbox = { approvals: MyApprovals | null; notifications: MyNotificationData | null; loaded: boolean; arrived: MyNotification | null };

const KINDS: ApprovalKind[] = ['team', 'leave', 'correction', 'advance'];
const POLL_MS = 60_000;
const NO_APPROVALS: MyApprovals = {
  rights: { team: false, leave: false, correction: false, advance: false },
  pending: { team: 0, leave: 0, correction: 0, advance: 0 },
};

let state: MyInbox = { approvals: null, notifications: null, loaded: false, arrived: null };
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
      ...state,
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

/** ແຈ້ງເຕືອນໃໝ່ຈາກ stream — ເພີ່ມເທິງສຸດ, ຕົວເລກ +1 ທັນທີ; ກ່ຽວກັບການອະນຸມັດ → ໂຫຼດຕົວເລກລໍອະນຸມັດໃໝ່ */
const receive = (raw: MyNotification) => {
  const current = state.notifications ?? { data: [], unread: 0 };
  if (!raw?._uuid || current.data.some((n) => n._uuid === raw._uuid)) return;
  const n: MyNotification = { _uuid: raw._uuid, type: raw.type, title: raw.title, body: raw.body, ref: raw.ref, is_new: true, createdAt: raw.createdAt };
  state = { ...state, notifications: { data: [n, ...current.data], unread: current.unread + 1 }, arrived: n };
  emit();
  if (n.type === 'approval' || (n.ref ?? '').startsWith('approve')) refreshMyInbox();
};

/** ລືມອັນທີ່ຫາກໍ່ມາ (ຟອງປິດແລ້ວ) */
export const dismissArrived = () => {
  if (!state.arrived) return;
  state = { ...state, arrived: null };
  emit();
};

/**
 * ຟັງ GET /notification/me/stream (Server-Sent Events) ຜ່ານ fetch — EventSource ສົ່ງ token ໃນ header ບໍ່ໄດ້.
 * ຫຼຸດ (ເນັດ / server restart) → ຕໍ່ໃໝ່ 10 s, 20 s … ສູງສຸດ 60 s; 4xx (ບໍ່ໄດ້ຜູກພະນັກງານ / token ໝົດ) = ຢຸດ
 */
let stream: AbortController | null = null;
let retry: number | undefined;
let backoff = 10_000;
const connect = async () => {
  const token = localStorage.getItem('token');
  if (!token || typeof ReadableStream === 'undefined') return;
  const controller = new AbortController();
  stream = controller;
  try {
    const res = await fetch(`${CONFIG.URLAPI}/notification/me/stream`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (res.status >= 400 && res.status < 500) return;
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
    backoff = 10_000;
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value.replace(/\r\n/g, '\n');
      let cut = buffer.indexOf('\n\n');
      while (cut >= 0) {
        const block = buffer.slice(0, cut);
        buffer = buffer.slice(cut + 2);
        const event = /^event: ?(.*)$/m.exec(block)?.[1];
        const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        if (event === 'notification' && data) {
          try {
            receive(JSON.parse(data) as MyNotification);
          } catch {
            /* ແຖວເສຍ — ຂ້າມ */
          }
        }
        cut = buffer.indexOf('\n\n');
      }
    }
  } catch {
    if (controller.signal.aborted) return;
  }
  if (stream !== controller) return;
  stream = null;
  retry = window.setTimeout(connect, backoff);
  backoff = Math.min(backoff * 2, 60_000);
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
  connect();
};
const stop = () => {
  window.clearInterval(timer);
  document.removeEventListener('visibilitychange', onVisible);
  window.clearTimeout(retry);
  stream?.abort();
  stream = null;
  backoff = 10_000;
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
