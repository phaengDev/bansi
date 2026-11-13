import { useSyncExternalStore } from 'react';
import { applyNumberStyle, getApi, putApi, type NumberStyle } from '../../utils/configApi';

/** GET /account-setting — ຕັ້ງຄ່າບັນຊີຂອງບໍລິສັດ (ແຖວດຽວ) */
export type AccountSetting = {
  number_format: NumberStyle;
  tax_id: string | null;
  chief_accountant: string | null;
  director: string | null;
  use_vat: number;
  use_fixed_assets: number;
  use_withholding: number;
  use_fx_revaluation: number;
  use_bank_reconciliation: number;
  /** ປິດງວດຮອດວັນທີນີ້ (YYYY-MM-DD) — null = ຍັງບໍ່ປິດງວດໃດ */
  lock_date: string | null;
  profit_tax_rate: number | string;
  policies: string | null;
};

/** ຟັງຊັນທີ່ບໍລິສັດເປີດ/ປິດໄດ້ — ປິດ = ເມນູ ແລະ ໜ້າທີ່ກ່ຽວຂ້ອງບໍ່ຂຶ້ນ */
export type FeatureKey = 'use_vat' | 'use_fixed_assets' | 'use_withholding' | 'use_fx_revaluation' | 'use_bank_reconciliation';

/** ຄ່າຕັ້ງຕົ້ນ (ກົງກັບ model ຂອງ backend) — ໃຊ້ກ່ອນໂຫຼດແລ້ວ ຫຼື ໂຫຼດບໍ່ໄດ້ */
export const DEFAULT_ACCOUNT_SETTING: AccountSetting = {
  number_format: 1,
  tax_id: null,
  chief_accountant: null,
  director: null,
  use_vat: 1,
  use_fixed_assets: 1,
  use_withholding: 0,
  use_fx_revaluation: 0,
  use_bank_reconciliation: 1,
  lock_date: null,
  profit_tax_rate: 20,
  policies: null,
};

let setting: AccountSetting | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const accept = (row: Partial<AccountSetting> | null | undefined) => {
  setting = { ...DEFAULT_ACCOUNT_SETTING, ...(row ?? {}) };
  setting.number_format = Number(setting.number_format) === 2 ? 2 : 1;
  applyNumberStyle(setting.number_format);
  notify();
};

/** ດຶງຕັ້ງຄ່າຈາກ api ແລ້ວແຈ້ງທຸກບ່ອນທີ່ໃຊ້ (Shell ເອີ້ນຕອນເປີດ desktop) */
export const refreshAccountSetting = async () => {
  try {
    const res = await getApi('/account-setting');
    accept(res.data?.data);
  } catch (error) {
    console.error(error);
    if (!setting) accept(null);
  }
};

/** ບັນທຶກສະເພາະຊ່ອງທີ່ປ່ຽນ — throw ຖ້າ api ປະຕິເສດ */
export const saveAccountSetting = async (patch: Partial<AccountSetting>) => {
  const res = await putApi('/account-setting', patch);
  accept(res.data?.data);
};

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** ຕັ້ງຄ່າປັດຈຸບັນ (ຍັງບໍ່ໂຫຼດ = ຄ່າຕັ້ງຕົ້ນ) — component ທີ່ໃຊ້ render ໃໝ່ເມື່ອປ່ຽນ ລວມທັງຮູບແບບຕົວເລກ */
export const useAccountSetting = (): AccountSetting => useSyncExternalStore(subscribe, () => setting) ?? DEFAULT_ACCOUNT_SETTING;

/** ໂຫຼດແລ້ວບໍ່ — ໜ້າທີ່ຂຶ້ນກັບຟັງຊັນ (ເຊັ່ນ ເມນູ) ລໍຖ້າອັນນີ້ ບໍ່ໃຫ້ເມນູທີ່ປິດໄວ້ກະພິບຂຶ້ນ */
export const useAccountSettingLoaded = () => useSyncExternalStore(subscribe, () => setting !== null);

export const featureOn = (s: AccountSetting, key: FeatureKey) => Number(s[key]) === 1;
