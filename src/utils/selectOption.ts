import { useEffect, useMemo, useState } from "react";
import { getApi } from "./configApi";
import { getErrorMessage } from './useCRUD';

// ===================== reusable hooks =====================
type Option = { label: string; value: any } & Record<string, any>;
/** ລາຍການ option ທີ່ພ່ວງ `.loading` ມານຳ (ໃຊ້ເປັນ array ໄດ້ຄືເກົ່າ) */
export type OptionList = Option[] & { loading: boolean };

/** ດຶງຂໍ້ມູນເທື່ອດຽວຕໍ່ `key` ແລ້ວແປງແຕ່ລະແຖວເປັນ option — `res.data.data ?? res.data` */
function useApiOptions(
  key: unknown[],
  request: () => Promise<unknown>,
  mapFn: (item: any) => Option,
): OptionList {
  const [state, setState] = useState<{ raw: unknown; loading: boolean }>({ raw: null, loading: true });

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true }));
    request()
      .then((raw) => alive && setState({ raw, loading: false }))
      .catch((e) => {
        console.error(getErrorMessage(e));
        if (alive) setState({ raw: null, loading: false });
      });
    return () => { alive = false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, key);

  return useMemo(() => {
    const raw = state.raw as { data?: unknown } | unknown[] | null;
    const list = Array.isArray(raw) ? raw : (raw as { data?: unknown } | null)?.data;
    const options = (Array.isArray(list) ? list.map(mapFn) : []) as OptionList;
    options.loading = state.loading;
    return options;
  }, [state, mapFn]);
}

const toCurrencyOption = (i: any): Option => ({
  label: i.name, value: i._id, icon: i.icon, genus: i.genus, rate: Number(i.reate ?? 0),
});

/** ສະກຸນເງິນ (GET /currency) — icon = ທຸງ, genus = ສັນຍາລັກ (₭, $, ฿), rate = ອັດຕາແລກປ່ຽນປັດຈຸບັນ */
export function useCurrency() {
  return useApiOptions(["currency"], () => getApi(`/currency`).then((r) => r.data), toCurrencyOption);
}
