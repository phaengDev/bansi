import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { getApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';

/** ດຶງລາຍການຂອງໜ້າຕັ້ງຄ່າ — GET (ຫຼື POST ເມື່ອສົ່ງ body) ແລ້ວເອົາ res.data.data */
export const useSettingList = <T,>(path: string, method: 'get' | 'post' = 'get') => {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = method === 'post' ? await postApi(path, {}) : await getApi(path);
      setRows(res.data?.data || []);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [path, method]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows, loading, reload };
};

/** ເພີ່ມ (POST {base}/create) ຫຼື ແກ້ໄຂ (PUT {base}/{base64 id}) ຕາມທີ່ມີ id ຫຼືບໍ່ */
export const saveSetting = (base: string, id: number | null | undefined, payload: object) =>
  id ? putApi(`${base}/${btoa(String(id))}`, payload) : postApi(`${base}/create`, payload);

/**
 * ເປີດ/ປິດໃຊ້ງານຈາກບັດ/ແຖວເລີຍ (ຟອມບໍ່ມີຊ່ອງສະຖານະແລ້ວ) — PUT {base}/{id} ສະເພາະ { status }.
 * backend ຂອງທຸກ endpoint ນີ້ merge ກັບແຖວເດີມ ຈຶ່ງບໍ່ແຕະຖັນອື່ນ. busyId = ແຖວທີ່ກຳລັງບັນທຶກ
 */
export const useStatusToggle = (base: string, reload: () => void) => {
  const [busyId, setBusyId] = useState<number | null>(null);
  const toggle = async (id: number, on: boolean) => {
    const ok = await runSave(() => saveSetting(base, id, { status: on ? 1 : 0 }), (busy) => setBusyId(busy ? id : null));
    if (ok) reload();
  };
  return { busyId, toggle };
};

/** ບັນທຶກ + ແຈ້ງຜົນ — ຄືນ true ເມື່ອສຳເລັດ */
export const runSave = async (task: () => Promise<unknown>, setSaving: (v: boolean) => void) => {
  try {
    setSaving(true);
    await task();
    Notific.success('saveSuccessDone');
    return true;
  } catch (error) {
    console.error(error);
    Notific.error(getErrorMessage(error));
    return false;
  } finally {
    setSaving(false);
  }
};

/** ວັນທີ → "YYYY-MM-DD" ສົ່ງໃຫ້ backend (ບໍ່ສົ່ງ Date object ທີ່ຈະກາຍເປັນ UTC ແລະ ຖອຍໄປ 1 ວັນ) */
export const toApiDate = (value: Date | string | null | undefined) =>
  value ? moment(value).format('YYYY-MM-DD') : null;

/** "YYYY-MM-DD" ຈາກ API → Date ສຳລັບ DatePicker */
export const fromApiDate = (value: string | null | undefined) => (value ? moment(value, 'YYYY-MM-DD').toDate() : null);

/** ລະຫັດຕໍ່ໄປ ເຊັ່ນ IN-001 → IN-002 (ເອົາເລກທ້າຍສຸດທີ່ໃຫຍ່ສຸດ + 1) */
export const nextCode = (prefix: string, codes: string[], digits = 3) => {
  const max = codes.reduce((m, c) => {
    const match = String(c ?? '').match(/(\d+)$/);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(digits, '0')}`;
};

/**
 * postfix ຂອງ NumberInput (ເຊັ່ນ "%", "₭") — TextFieldProps ຂອງ InputField ບໍ່ໄດ້ປະກາດ prop ນີ້
 * ແຕ່ InputField ສົ່ງ prop ທີ່ເຫຼືອຕໍ່ໃຫ້ accepter ຢູ່ແລ້ວ: ໃຊ້ {...postfixProp('%')}
 */
export const postfixProp = (postfix: string) => ({ postfix }) as object;
