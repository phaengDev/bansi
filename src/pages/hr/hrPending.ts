import { useEffect, useState } from 'react';
import { getApi } from '../../utils/configApi';

/** ຄຳຮ້ອງທີ່ລໍຖ້າ HR (GET /hr/pending) — advance_to_pay = ອະນຸມັດແລ້ວ ລໍຖ້າຈ່າຍເງິນ */
export type HrPending = {
  leave: number;
  correction: number;
  advance: number;
  advance_to_pay: number;
  /** ຈຳນວນຄົນທີ່ມີເອກະສານ / ສັນຍາ ໃກ້ໝົດອາຍຸ (API ລຸ້ນເກົ່າ = ບໍ່ມີ) */
  expiring?: number;
  /** ເອກະສານບໍລິສັດ ໝົດແລ້ວ / ໝົດພາຍໃນ 60 ມື້ */
  company_docs?: number;
};

/** ລາຍການໃກ້ໝົດອາຍຸ (GET /employee/expiring) — days ລົບ = ໝົດແລ້ວ */
export type ExpiryKind = 'contract' | 'probation' | 'id_card' | 'passport';
export type ExpiringItem = { employee_id: number; emp_code: string; name: string; kind: ExpiryKind; date: string; days: number };

const TAB_EVENT = 'employees-tab-request';
let wantedTab: 'expiring' | null = null;

/** ເປີດໜ້າພະນັກງານທີ່ແຖບ "ໃກ້ໝົດອາຍຸ" (ຈາກ "ຕ້ອງຕິດຕາມ" ໃນ desktop) — ເອີ້ນກ່ອນເປີດໜ້າຕ່າງ */
export const requestEmployeesTab = (tab: 'expiring') => {
  wantedTab = tab;
  window.dispatchEvent(new Event(TAB_EVENT));
};

/** ໜ້າພະນັກງານຮັບແຖບທີ່ຖືກຂໍ (ຕອນເປີດ ຫຼື ເປີດຢູ່ແລ້ວ) */
export const useRequestedEmployeesTab = (apply: (tab: 'expiring') => void) => {
  useEffect(() => {
    const take = () => {
      if (!wantedTab) return;
      apply(wantedTab);
      wantedTab = null;
    };
    take();
    window.addEventListener(TAB_EVENT, take);
    return () => window.removeEventListener(TAB_EVENT, take);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

const EVENT = 'hr-pending-refresh';

/** HR ອະນຸມັດ / ປະຕິເສດ / ຈ່າຍ ແລ້ວ — ໃຫ້ຕົວເລກລໍຖ້າ (ເມນູຊ້າຍ, ໄອຄອນ desktop) ໂຫຼດໃໝ່ທັນທີ */
export const refreshHrPending = () => window.dispatchEvent(new Event(EVENT));

/**
 * ຈຳນວນຄຳຮ້ອງທີ່ລໍຖ້າ — ໂຫຼດທຸກນາທີ (ພະນັກງານສົ່ງຄຳຂໍໃໝ່ຈາກ app), ຕອນກັບມາເບິ່ງແທັບ ແລະ ຫຼັງ refreshHrPending().
 * ບໍ່ມີສິດ (403) / ເນັດຂາດ = null (ບໍ່ສະແດງຕົວເລກ)
 */
export const useHrPending = () => {
  const [data, setData] = useState<HrPending | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await getApi('/hr/pending');
        if (alive) setData(res.data?.data ?? null);
      } catch {
        // ບໍ່ມີສິດແກ້ໄຂ / ເນັດຂາດ — ບໍ່ສະແດງຕົວເລກ
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener(EVENT, load);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener(EVENT, load);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return data;
};
