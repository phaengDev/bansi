import { useEffect, useMemo, useState } from "react";
import { getApi } from "./configApi";
import { getErrorMessage } from './useCRUD';

/**
 * ຂໍ້ມູນສຳລັບຊ່ອງເລືອກ (SelectPicker, ChoiceTiles…) ທັງໝົດຂອງລະບົບ — ດຶງຈາກ api-bansi ບ່ອນດຽວນີ້.
 * ທຸກ hook ຄືນ array ຂອງ option: ຖັນເດີມຂອງແຖວ (ເຊັ່ນ rate ຂອງອາກອນ) + label / value (ໃສ່ SelectPicker ໄດ້ເລີຍ)
 * ແລະ `.loading`. ແຂວງ/ເມືອງ ໂຫຼດເທື່ອດຽວຕໍ່ການເປີດໜ້າເວັບ (ບໍ່ປ່ຽນ); ອັນອື່ນໂຫຼດໃໝ່ທຸກເທື່ອທີ່ component ເປີດ
 * ເພື່ອໃຫ້ເຫັນຂໍ້ມູນທີ່ຫາກໍ່ແກ້ໃນໜ້າຕັ້ງຄ່າ — ຄຳຂໍ url ດຽວກັນທີ່ຍິງພ້ອມກັນ (ເຊັ່ນ useDepartments + usePositions) ໃຊ້ຄຳຕອບດຽວ
 */

// ===================== ປະເພດຂໍ້ມູນຂອງແຕ່ລະລາຍການ =====================

/** ປະເພດລາຍຮັບ (kind 1) / ລາຍຈ່າຍ (kind 2) — tbl_finance_categories */
export type FinanceCategory = { _uuid: number; type_code: string; type_name: string };
/** ໝວດບັນຊີ (tbl_type_account) — 101 = ເງິນສົດ */
export type AccountClass = { _uuid: number; type_code: string; type_name: string; status: number };
export type Tax = { _uuid: number; tax_code: string; name: string; rate: string | number; calc_method: number; is_default: number };
export type FiscalYear = {
  _uuid: number;
  fiscal_code: string;
  fiscal_name: string | null;
  start_date: string;
  end_date: string;
  is_current: number;
  /** 1 ເປີດ, 2 ປິດບັນຊີແລ້ວ */
  status: number;
};
export type JournalType = { _uuid: number; journal_code: string; name: string };
/** ບັນຊີເງິນຄັງທີ່ໃຊ້ງານ (GET /treasury-account/option) */
export type TreasuryAccountOption = {
  _uuid: number;
  acountName: string;
  acount_number?: string | null;
  banks?: { _uuid: number; abbr?: string; name_la?: string; url?: string | null } | null;
};
/** ທະນາຄານ (tbl_banks) — url = ໂລໂກ້ */
export type Bank = { _uuid: number; abbr: string; name_la: string; name_en?: string; url?: string | null };
export type District = { _uuid: number; district_name: string };
export type Province = { _uuid: number; province_name: string; districts: District[] };
export type PositionOption = { _uuid: number; position_name: string };
/** ພະແນກທີ່ໃຊ້ງານ + ຕຳແໜ່ງທີ່ໃຊ້ງານ */
export type DepartmentOption = { _uuid: number; depart_code: string; depart_name: string; positions: PositionOption[] };
/** ພະນັກງານທີ່ເຮັດວຽກຢູ່ — user_id = ບັນຊີຜູ້ໃຊ້ທີ່ຜູກແລ້ວ (null = ຍັງບໍ່ມີ) */
export type EmployeeOption = {
  _uuid: number;
  emp_code: string;
  first_name: string;
  last_name: string | null;
  phone?: string | null;
  profile_url?: string | null;
  department?: { _uuid: number; depart_name: string } | null;
  user_id: number | null;
};
export type UserType = { _uuid: number; names: string };

// ===================== ກົນໄກກາງ =====================

export type OptionOf<T> = T & { label: string; value: any };
/** ລາຍການ option ທີ່ພ່ວງ `.loading` ມານຳ (ໃຊ້ເປັນ array ໄດ້ຄືເກົ່າ) */
export type OptionList<T = Record<string, any>> = OptionOf<T>[] & { loading: boolean };

const pending = new Map<string, Promise<unknown>>();
const permanent = new Map<string, Promise<unknown>>();

/** GET url → res.data — keep = ເກັບໄວ້ຕະຫຼອດ (ຂໍ້ມູນທີ່ບໍ່ປ່ຽນ); ບໍ່ດັ່ງນັ້ນແບ່ງປັນສະເພາະຕອນກຳລັງໂຫຼດ */
const fetchShared = (url: string, keep: boolean) => {
  const store = keep ? permanent : pending;
  const existing = store.get(url);
  if (existing) return existing;
  const request = getApi(url).then((res) => res.data as unknown);
  store.set(url, request);
  request.then(
    () => { if (!keep) pending.delete(url); },
    () => { store.delete(url); },
  );
  return request;
};

/** ດຶງ url (null = ຍັງບໍ່ດຶງ) ແລ້ວແປງແຕ່ລະແຖວເປັນ option — ຮັບໄດ້ທັງ `res.data.data` ແລະ `res.data` ທີ່ເປັນ array */
function useApiOptions<T>(url: string | null, toOption: (item: T) => OptionOf<T>, keep = false): OptionList<T> {
  const [state, setState] = useState<{ url: string | null; raw: unknown }>({ url: null, raw: null });

  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetchShared(url, keep)
      .then((raw) => alive && setState({ url, raw }))
      .catch((e) => {
        console.error(getErrorMessage(e));
        if (alive) setState({ url, raw: null });
      });
    return () => { alive = false; };
  }, [url, keep]);

  return useMemo(() => {
    // ຄຳຕອບຂອງ url ກ່ອນໜ້າ (ເຊັ່ນ ປ່ຽນ kind) ບໍ່ນັບ — ຖືວ່າກຳລັງໂຫຼດ
    const fresh = state.url === url;
    const raw = (fresh ? state.raw : null) as { data?: unknown } | unknown[] | null;
    const list = Array.isArray(raw) ? raw : raw?.data;
    const options = (Array.isArray(list) ? (list as T[]).map(toOption) : []) as OptionList<T>;
    options.loading = !!url && !fresh;
    return options;
  }, [state, url, toOption]);
}

/** ລາຍການຍ່ອຍທີ່ຂຶ້ນກັບອັນທີ່ເລືອກ (ແຂວງ → ເມືອງ, ພະແນກ → ຕຳແໜ່ງ) — ຮັກສາ `.loading` ຂອງລາຍການແມ່ */
const childOptions = <P, C>(
  parents: OptionList<P>,
  parentId: unknown,
  children: (parent: OptionOf<P>) => C[],
  toOption: (item: C) => OptionOf<C>,
): OptionList<C> => {
  const parent = parentId ? parents.find((p) => p.value === Number(parentId)) : undefined;
  const options = (parent ? children(parent).map(toOption) : []) as OptionList<C>;
  options.loading = parents.loading;
  return options;
};

const byCode = (a: { type_code?: string }, b: { type_code?: string }) =>
  String(a.type_code ?? '').localeCompare(String(b.type_code ?? ''), undefined, { numeric: true });

// ===================== ແປງແຖວເປັນ option (ຢູ່ນອກ hook ໃຫ້ useMemo ບໍ່ຄິດໃໝ່ທຸກ render) =====================

const toCurrencyOption = (i: any) => ({ label: i.name, value: i._id, icon: i.icon, genus: i.genus, rate: Number(i.reate ?? 0) });
const toCodeName = <T extends { _uuid: number; type_code: string; type_name: string }>(i: T) =>
  ({ ...i, label: `${i.type_code} ${i.type_name}`, value: i._uuid });
const toTax = (i: Tax) => ({ ...i, label: `${i.name} (${Number(i.rate)}%)`, value: i._uuid });
const toFiscalYear = (i: FiscalYear) => ({ ...i, label: i.fiscal_name || i.fiscal_code, value: i._uuid });
const toJournalType = (i: JournalType) => ({ ...i, label: `${i.journal_code} · ${i.name}`, value: i._uuid });
const toTreasuryAccount = (i: TreasuryAccountOption) =>
  ({ ...i, label: [i.banks?.abbr, i.acountName, i.acount_number].filter(Boolean).join(' · '), value: i._uuid });
const toBank = (i: Bank) => ({ ...i, label: `${i.abbr} ${i.name_la}`, value: i._uuid });
const toProvince = (i: Province) => ({ ...i, label: i.province_name, value: i._uuid });
const toDistrict = (i: District) => ({ ...i, label: i.district_name, value: i._uuid });
const toDepartment = (i: DepartmentOption) => ({ ...i, positions: i.positions ?? [], label: i.depart_name, value: i._uuid });
const toPosition = (i: PositionOption) => ({ ...i, label: i.position_name, value: i._uuid });
const toEmployee = (i: EmployeeOption) =>
  ({ ...i, label: `${i.emp_code} ${[i.first_name, i.last_name].filter(Boolean).join(' ')}`, value: i._uuid });
const toUserType = (i: UserType) => ({ ...i, label: i.names, value: i._uuid });

// ===================== ບັນຊີ / ການເງິນ =====================

/** ສະກຸນເງິນ (GET /currency) — icon = ທຸງ, genus = ສັນຍາລັກ (₭, $, ฿), rate = ອັດຕາແລກປ່ຽນປັດຈຸບັນ */
export function useCurrency() {
  return useApiOptions<any>('/currency', toCurrencyOption);
}

/** ປະເພດລາຍຮັບ (kind 1) ຫຼື ລາຍຈ່າຍ (kind 2) ທີ່ໃຊ້ງານ — label "ລະຫັດ ຊື່" */
export const useFinanceCategories = (kind: 1 | 2) =>
  useApiOptions<FinanceCategory>(`/finance-category/option/${kind}`, toCodeName);

/** ໝວດບັນຊີ ລຽງຕາມລະຫັດ (101 ເງິນສົດ, 102 ທະນາຄານ …) */
export const useAccountClasses = () => {
  const list = useApiOptions<AccountClass>('/type-account/option', toCodeName);
  return useMemo(() => Object.assign([...list].sort(byCode), { loading: list.loading }), [list]);
};

/** ອາກອນທີ່ໃຊ້ງານ — label "ຊື່ (ອັດຕາ%)" */
export const useTaxes = () => useApiOptions<Tax>('/tax/option', toTax);

/** ປີການເງິນທັງໝົດ (ລວມປີທີ່ປິດແລ້ວ) ໃໝ່ສຸດກ່ອນ */
export const useFiscalYears = () => useApiOptions<FiscalYear>('/fiscal-year/option', toFiscalYear);

/** ປະເພດປຶ້ມບັນຊີທີ່ໃຊ້ງານ — label "GJ · ປຶ້ມລາຍວັນທົ່ວໄປ" */
export const useJournalTypes = () => useApiOptions<JournalType>('/journal-type/option', toJournalType);

/** ບັນຊີເງິນຄັງທີ່ໃຊ້ງານ (ບໍ່ມີຍອດເງິນ) — label "ທະນາຄານ · ຊື່ບັນຊີ · ເລກບັນຊີ" */
export const useTreasuryAccountOptions = () => useApiOptions<TreasuryAccountOption>('/treasury-account/option', toTreasuryAccount);

/** ທະນາຄານທີ່ໃຊ້ງານ ພ້ອມໂລໂກ້ (url) */
export const useBanks = () => useApiOptions<Bank>('/bank', toBank);

// ===================== ທີ່ຢູ່ =====================

/** 18 ແຂວງ (ພ້ອມເມືອງຂອງແຕ່ລະແຂວງ) — ໂຫຼດເທື່ອດຽວຕໍ່ການເປີດໜ້າເວັບ */
export const useProvinces = () => useApiOptions<Province>('/address/province', toProvince, true);

/** ເມືອງຂອງແຂວງທີ່ເລືອກ — ບໍ່ມີແຂວງ = ລາຍການຫວ່າງ (ໃຊ້ຂໍ້ມູນດຽວກັບ useProvinces ບໍ່ດຶງຊ້ຳ) */
export const useDistricts = (provinceId: number | string | null | undefined) => {
  const provinces = useProvinces();
  return useMemo(() => childOptions(provinces, provinceId, (p) => p.districts ?? [], toDistrict), [provinces, provinceId]);
};

// ===================== ອົງກອນ / HR =====================

/** ພະແນກທີ່ໃຊ້ງານ ພ້ອມຕຳແໜ່ງທີ່ໃຊ້ງານ */
export const useDepartments = () => useApiOptions<DepartmentOption>('/department/option', toDepartment);

/** ຕຳແໜ່ງຂອງພະແນກທີ່ເລືອກ — ບໍ່ມີພະແນກ = ລາຍການຫວ່າງ */
export const usePositions = (departmentId: number | string | null | undefined) => {
  const departments = useDepartments();
  return useMemo(() => childOptions(departments, departmentId, (d) => d.positions, toPosition), [departments, departmentId]);
};

/** ພະນັກງານທີ່ເຮັດວຽກຢູ່ — label "EMP-0001 ຊື່ ນາມສະກຸນ" */
export const useEmployees = () => useApiOptions<EmployeeOption>('/employee/option', toEmployee);

/** ປະເພດຜູ້ໃຊ້ (1 ຜູ້ດູແລລະບົບ, 2 ຜູ້ໃຊ້ທົ່ວໄປ) */
export const useUserTypes = () => useApiOptions<UserType>('/user/type', toUserType);
