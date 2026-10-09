import { useCallback, useEffect, useState } from 'react';
import { getApi, postApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import type { Bank, Province, UserType } from '../../utils/selectOption';

/**
 * ຂໍ້ມູນພື້ນຖານ (HR) — api-bansi: /user/*, /department/*, /employee/*, /address/province.
 * ການແກ້ໄຂທຸກຢ່າງ backend ກວດສິດ ເພີ່ມ/ແກ້/ລຶບ ຂອງຜູ້ໃຊ້ຈາກຖານຂໍ້ມູນຊ້ຳ (403 = ບໍ່ມີສິດ)
 */

/** ສິດ 1 = ອະນຸຍາດ, 2 = ບໍ່ອະນຸຍາດ (ຄືກັບ utils/localStorage getPermission) */
export const ALLOW = 1;
export const DENY = 2;
export const PERMISSIONS = [
  { key: 'creates', label: 'hrPermCreate', icon: 'fa-plus' },
  { key: 'updates', label: 'hrPermUpdate', icon: 'fa-pen' },
  { key: 'deletes', label: 'hrPermDelete', icon: 'fa-trash' },
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const WORKING = 1;
export const RESIGNED = 2;
/** label = ສັ້ນ (ລາຍການ, ລາຍລະອຽດ), long = ໃນ dropdown ໜ້າຊ່ອງຊື່ ເຊັ່ນ "ເພດຍິງ" */
export const GENDERS = [
  { value: 1, label: 'hrGenderMale', long: 'hrSexMale', icon: 'fa-mars' },
  { value: 2, label: 'hrGenderFemale', long: 'hrSexFemale', icon: 'fa-venus' },
];

// ປະເພດຂອງຊ່ອງເລືອກ (ທະນາຄານ, ແຂວງ, ປະເພດຜູ້ໃຊ້) ຢູ່ utils/selectOption ພ້ອມ hook ດຶງຂໍ້ມູນ
export type { Bank, Province, UserType };

export type EmployeeRef = {
  _uuid: number;
  emp_code: string;
  first_name: string;
  last_name: string | null;
  work_status?: number;
  phone?: string | null;
  profile_url?: string | null;
  department?: { _uuid: number; depart_name: string } | null;
};

export type User = {
  user_uuid: number;
  user_name: string;
  phones: string;
  type_user: number;
  employee_id: number | null;
  status: number;
  creates: number;
  updates: number;
  deletes: number;
  typeuser?: UserType | null;
  employee?: EmployeeRef | null;
};

export type Position = { _uuid: number; department_id: number; position_name: string; sort: number; status: number; employees?: number };

export type Department = {
  _uuid: number;
  depart_code: string;
  depart_name: string;
  description: string | null;
  sort: number;
  status: number;
  /** ພະນັກງານທີ່ເຮັດວຽກຢູ່ */
  employees?: number;
  positions: Position[];
};

export type EmployeeDocument = { _uuid: number; original_name: string; mime_type: string | null; file_size: number; createdAt: string };

export type Employee = EmployeeRef & {
  gender: number;
  birthday: string | null;
  email: string | null;
  department_id: number;
  position_id: number | null;
  start_date: string | null;
  end_date: string | null;
  work_status: number;
  basic_salary: number;
  /** ບັນຊີຮັບເງິນເດືອນ — ໂອນເງິນເດືອນທ້າຍເດືອນເຂົ້າບັນຊີນີ້ */
  bank_id: number | null;
  bank_account_name: string | null;
  bank_account_no: string | null;
  bank?: Bank | null;
  province_id: number | null;
  district_id: number | null;
  village: string | null;
  profile: string | null;
  description: string | null;
  position?: { _uuid: number; position_name: string } | null;
  province?: { _uuid: number; province_name: string } | null;
  district?: { _uuid: number; district_name: string } | null;
  documents: EmployeeDocument[];
  /** ບັນຊີຜູ້ໃຊ້ທີ່ຜູກກັບພະນັກງານນີ້ */
  user: { user_uuid: number; user_name: string; phones: string; status: number } | null;
};

/** "17.9757, 102.6331" — ພິກັດທີ່ສຳເນົາຈາກ Google Maps (ກົດຂວາທີ່ຈຸດ) → [, lat, lng] */
export const LAT_LNG = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

/** ໄລຍະສະແກນ (ແມັດ) — ກົງກັບ companyController ຂອງ api-bansi */
export const MIN_RADIUS = 10;
export const MAX_RADIUS = 1000;

/** ຂໍ້ຄວາມ → ພິກັດ (|ຄ່າ| ≤ limit: 90 = latitude, 180 = longitude); ຫວ່າງ / ຜິດ = null */
export const parseCoord = (value: unknown, limit: number) => {
  const text = String(value ?? '').trim();
  const n = Number(text);
  return text && Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
};

export const fixedCoord = (n: number) => n.toFixed(7);

/**
 * ຮູບດາວທຽມນິ່ງ (Esri World Imagery export, ຟຣີ) ກວ້າງ widthMeters ແມັດ ມີຈຸດຢູ່ກາງ — ຂະໜາດ 480×300.
 * ຄິດ bbox ເປັນ Web Mercator (ແມັດໃນແຜນທີ່ = ແມັດແທ້ ÷ cos(lat))
 */
export const satelliteSnapshot = (lat: number, lng: number, widthMeters: number) => {
  const R = 6378137;
  const x = R * (lng * Math.PI / 180);
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
  const w = widthMeters / Math.cos(lat * Math.PI / 180);
  const h = w * (300 / 480);
  const bbox = [x - w / 2, y - h / 2, x + w / 2, y + h / 2].map((v) => v.toFixed(2)).join(',');
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=480,300&format=jpg&f=image`;
};

/**
 * ຂໍ້ມູນບໍລິສັດ (GET/PUT /company, ແຖວດຽວ) — ພິກັດ + scan_radius (ແມັດ) = ຂອບເຂດສະແກນເຂົ້າ-ອອກວຽກ.
 * ທີ່ຢູ່ເກັບແຕ່ district_id — ແຂວງມາກັບເມືອງ (district.province)
 */
export type Company = {
  _uuid: number;
  name_la: string;
  name_en: string | null;
  logo_url: string | null;
  phone1: string | null;
  phone2: string | null;
  district_id: number | null;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  scan_radius: number;
  /** "HH:mm" */
  work_start: string;
  work_end: string;
  /** ວັນພັກປະຈຳອາທິດ — 0 ອາທິດ … 6 ເສົາ (Date.getDay()) */
  days_off: number[];
  district?: {
    _uuid: number;
    district_name: string;
    province_id: number;
    province?: { _uuid: number; province_name: string } | null;
  } | null;
  updatedAt: string;
};

export const fullName = (e: Pick<EmployeeRef, 'first_name' | 'last_name'> | null | undefined) =>
  e ? [e.first_name, e.last_name].filter(Boolean).join(' ') : '';

/** ຕົວອັກສອນທຳອິດ ສຳລັບຮູບແທນ (ບໍ່ມີຮູບ) */
export const initialOf = (name: string | null | undefined) => Array.from(String(name ?? '').trim())[0] ?? '?';

/** ຜູ້ໃຊ້ທີ່ login ຢູ່ (localStorage userid ຈາກໜ້າ login) */
export const selfId = () => Number(localStorage.getItem('userid')) || 0;

/** ລາຍການ GET ທົ່ວໄປ — data + ຄ່າອື່ນຂອງຄຳຕອບ (ເຊັ່ນ next_code ຂອງພະນັກງານ) */
export const useHrList = <T,>(path: string, method: 'get' | 'post' = 'get') => {
  const [rows, setRows] = useState<T[]>([]);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      const res = method === 'post' ? await postApi(path, {}) : await getApi(path);
      const { data, ...rest } = res.data ?? {};
      setRows(data ?? []);
      setExtra(rest);
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

  return { rows, extra, loading, reload };
};

/** ດາວໂຫຼດໄຟລ໌ທີ່ຕ້ອງ login (ສົ່ງ token ຜ່ານ axios ແລ້ວບັນທຶກເປັນ blob) */
export const downloadWithAuth = async (url: string, fileName: string) => {
  try {
    const res = await getApi(url, { responseType: 'blob' });
    const href = URL.createObjectURL(res.data as Blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch (error) {
    console.error(error);
    Notific.error('hrDownloadFailed');
  }
};

export const fileSizeText = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const MAX_FILE = 5 * 1024 * 1024;
export const MAX_DOCUMENTS = 5;
