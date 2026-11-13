import { useCallback, useEffect, useState } from 'react';
import { getApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { isNotReady } from '../gl/glApi';

/** ແຖວຈາກ GET /fixed-asset/fetch — ຄິດໄລ່ accumulated / nbv / monthly ໃຫ້ແລ້ວ */
export type FixedAsset = {
  _uuid: number;
  asset_code: string;
  name: string;
  asset_account_id: number;
  accum_account_id: number | null;
  expense_account_id: number | null;
  acquisition_date: string;
  depreciation_start: string;
  cost: number;
  salvage_value: number;
  useful_life_months: number;
  opening_accumulated: number;
  /** 0 = ບັນທຶກການຊື້ຜ່ານ ລາຍຈ່າຍ/ເຈົ້າໜີ້ ແລ້ວ, 1 = ຍອດຍົກມາ */
  acquisition_mode: number;
  opening_date: string | null;
  location: string | null;
  serial_no: string | null;
  note: string | null;
  /** 1 ໃຊ້ງານ, 2 ຈຳໜ່າຍແລ້ວ */
  status: number;
  disposal_date: string | null;
  disposal_note: string | null;
  monthly: number;
  accumulated: number;
  nbv: number;
  last_period: string | null;
  fully_depreciated: boolean;
};

export const DISPOSED = 2;

/** ທະບຽນຊັບສົມບັດ + ລະຫັດຖັດໄປ (FA-0001…) */
export const useFixedAssets = () => {
  const [rows, setRows] = useState<FixedAsset[]>([]);
  const [nextCode, setNextCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi('/fixed-asset/fetch');
      setRows(res.data?.data ?? []);
      setNextCode(res.data?.next_code ?? '');
      setError('');
    } catch (err) {
      if (isNotReady(err)) setNotReady(true);
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, nextCode, loading, error, notReady, reload };
};

/** ອາຍຸການໃຊ້ງານ ເປັນຂໍ້ຄວາມ — 66 ເດືອນ → "5 ປີ 6 ເດືອນ" */
export const lifeText = (months: number, t: (key: string) => string) => {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years && `${years} ${t('faYears')}`, rest && `${rest} ${t('faMonths')}`].filter(Boolean).join(' ') || `0 ${t('faMonths')}`;
};
