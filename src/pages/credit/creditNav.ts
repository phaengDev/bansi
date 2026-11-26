import { useSyncExternalStore } from 'react';

/**
 * ຂໍເປີດຄຳຮ້ອງຂໍກູ້ຈາກບ່ອນອື່ນ (ເຊັ່ນ ກົດແຈ້ງເຕືອນ "ມີຄຳຮ້ອງລໍທ່ານພິຈາລະນາ"): Shell ເປີດໜ້າຕ່າງ ຄຳຮ້ອງຂໍກູ້,
 * ໜ້າຄຳຮ້ອງເປີດລາຍລະອຽດຂອງ id ນັ້ນ ແລ້ວລ້າງຄຳຂໍ
 */
export type CreditAppRequest = { id: number };

let request: CreditAppRequest | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const openCreditApplication = (id: number) => {
  if (!(id > 0)) return;
  request = { id };
  notify();
};

export const useCreditAppRequest = () => useSyncExternalStore(subscribe, () => request);

/** ເປີດແລ້ວ — ລ້າງສະເພາະຄຳຂໍອັນດຽວກັນ */
export const clearCreditAppRequest = (done: CreditAppRequest) => {
  if (request !== done) return;
  request = null;
  notify();
};
