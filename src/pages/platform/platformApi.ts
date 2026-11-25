import { useCallback, useEffect, useState } from 'react';
import moment from 'moment';
import { getApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import type { ModuleCode } from '../account/companyPlan';

/**
 * ຈັດການບໍລິສັດ / ແພັກເກດ (ສະເພາະເຈົ້າຂອງລະບົບ — /platform/… ຂອງ api-bansi, PLATFORM_ADMIN_PHONES)
 */

/** ໂມດູນ (GET /platform/package → modules) — requires = ໂມດູນທີ່ຕ້ອງມີນຳ */
export type PlatformModule = { code: ModuleCode; name_la: string; name_en: string; requires: ModuleCode[] };

export type PlatformPackage = {
  _uuid: number;
  code: string;
  name_la: string;
  name_en: string | null;
  description: string | null;
  modules: ModuleCode[];
  max_users: number | null;
  max_employees: number | null;
  price_month: number | null;
  price_year: number | null;
  sort: number;
  status: number;
};

export type PlatformCompany = {
  _uuid: number;
  name_la: string;
  name_en: string | null;
  phone1: string | null;
  status: number;
  createdAt: string;
  package_id: number | null;
  plan_expires_at: string | null;
  plan_trial: number;
  plan_addons: ModuleCode[];
  plan_max_users: number | null;
  plan_max_employees: number | null;
  package: { _uuid: number; code: string; name_la: string; max_users: number | null; max_employees: number | null } | null;
  days_left: number | null;
  expired: boolean;
  users: number;
  employees: number;
};

/** ບໍລິສັດ + ແພັກເກດ + ລາຍການໂມດູນ — ໂຫຼດພ້ອມກັນ (ໜ້າບໍລິສັດໃຊ້ຊື່ແພັກເກດ, ໜ້າແພັກເກດໃຊ້ຈຳນວນບໍລິສັດ) */
export const usePlatformData = () => {
  const [companies, setCompanies] = useState<PlatformCompany[] | null>(null);
  const [packages, setPackages] = useState<PlatformPackage[]>([]);
  const [modules, setModules] = useState<PlatformModule[]>([]);

  const reload = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([getApi('/platform/company'), getApi('/platform/package')]);
      setCompanies(c.data?.data ?? []);
      setPackages(p.data?.data ?? []);
      setModules(p.data?.modules ?? []);
    } catch (error) {
      console.error(error);
      setCompanies((prev) => prev ?? []);
      Notific.error(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { companies, packages, modules, reload };
};

/** ລວມໂມດູນທີ່ຕ້ອງມີນຳ (ເງິນເດືອນ → ພະນັກງານ …) ຄືກັບ backend withRequired */
export const withRequired = (codes: ModuleCode[], modules: PlatformModule[]) => {
  const set = new Set(codes);
  modules.forEach((m) => {
    if (set.has(m.code)) m.requires.forEach((code) => set.add(code));
  });
  return modules.map((m) => m.code).filter((code) => set.has(code));
};

/** ເອົາໂມດູນອອກ ພ້ອມໂມດູນທີ່ຂຶ້ນກັບມັນ (ເອົາພະນັກງານອອກ → ເງິນເດືອນ, ເຂົ້າ-ອອກວຽກ … ອອກນຳ) */
export const withoutModule = (codes: ModuleCode[], code: ModuleCode, modules: PlatformModule[]) => {
  const drop = new Set<ModuleCode>([code]);
  let grew = true;
  while (grew) {
    grew = false;
    modules.forEach((m) => {
      if (!drop.has(m.code) && m.requires.some((r) => drop.has(r))) {
        drop.add(m.code);
        grew = true;
      }
    });
  }
  return codes.filter((c) => !drop.has(c));
};

/** ຈຳນວນສູງສຸດທີ່ໃຊ້ຈິງ: ຂອງບໍລິສັດ (ຖ້າຕັ້ງ) ຫຼື ຂອງແພັກເກດ — null = ບໍ່ຈຳກັດ */
export const limitOf = (company: PlatformCompany, key: 'users' | 'employees') =>
  (key === 'users' ? company.plan_max_users ?? company.package?.max_users : company.plan_max_employees ?? company.package?.max_employees) ?? null;

/** ຕໍ່ອາຍຸ: ນັບຕໍ່ຈາກວັນໝົດອາຍຸເດີມ (ຖ້າຍັງບໍ່ກາຍ) ຫຼື ມື້ນີ້ */
export const extendFrom = (expires: Date | null, amount: number, unit: 'month' | 'year') => {
  const today = moment().startOf('day');
  const base = expires && moment(expires).isSameOrAfter(today) ? moment(expires) : today.clone().subtract(1, 'day');
  return base.add(amount, unit).toDate();
};

/** ຄ່າຕົວເລກຈາກຟອມ → number (ບໍ່ຕິດລົບ) ຫຼື null (ຫວ່າງ) */
export const numberOrNull = (value: unknown) =>
  (value === '' || value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.max(0, Number(value)));
