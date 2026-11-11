import { useEffect, useState } from 'react';
import { getApi } from '../../utils/configApi';

/** ຄຳຮ້ອງທີ່ລໍຖ້າ HR (GET /hr/pending) — advance_to_pay = ອະນຸມັດແລ້ວ ລໍຖ້າຈ່າຍເງິນ */
export type HrPending = { leave: number; correction: number; advance: number; advance_to_pay: number };

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
