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

/** ລະດັບຜູ້ໃຊ້ (tbl_typeuser._uuid) — 1 ສູງສຸດ, 2 ທຳມະດາ, 3 ທົ່ວໄປ; ຜູ້ໃຊ້ໃໝ່ເລີ່ມທີ່ທົ່ວໄປ */
export const USER_LEVELS: Record<number, { icon: string }> = {
  1: { icon: 'fa-crown' },
  2: { icon: 'fa-user-tie' },
  3: { icon: 'fa-user' },
};
export const DEFAULT_USER_LEVEL = 3;
export const userLevelIcon = (level: number) => USER_LEVELS[Number(level)]?.icon ?? 'fa-user';
export const PERMISSIONS = [
  { key: 'creates', label: 'hrPermCreate', icon: 'fa-plus' },
  { key: 'updates', label: 'hrPermUpdate', icon: 'fa-pen' },
  { key: 'deletes', label: 'hrPermDelete', icon: 'fa-trash' },
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number]['key'];
/** ສິດອະນຸມັດຜ່ານ app (1 = ໄດ້) — ສະເພາະບັນຊີທີ່ຜູກພະນັກງານ; ໄດ້ຮັບແຈ້ງເຕືອນຄຳຂໍໃໝ່ ແລະ ອະນຸມັດໃນ app */
export const APP_APPROVALS = [
  { key: 'approve_leave', label: 'hrApproveLeave', icon: 'fa-umbrella-beach' },
  { key: 'approve_correction', label: 'hrApproveCorrection', icon: 'fa-fingerprint' },
  { key: 'approve_advance', label: 'hrApproveAdvance', icon: 'fa-hand-holding-dollar' },
] as const;
export type ApprovalKey = (typeof APP_APPROVALS)[number]['key'];

export const WORKING = 1;
export const RESIGNED = 2;
/** label = ສັ້ນ (ລາຍການ, ລາຍລະອຽດ), long = ໃນ dropdown ໜ້າຊ່ອງຊື່ ເຊັ່ນ "ເພດຍິງ" */
export const GENDERS = [
  { value: 1, label: 'hrGenderMale', long: 'hrSexMale', icon: 'fa-mars' },
  { value: 2, label: 'hrGenderFemale', long: 'hrSexFemale', icon: 'fa-venus' },
];

// ປະເພດຂອງຊ່ອງເລືອກ (ທະນາຄານ, ແຂວງ, ປະເພດຜູ້ໃຊ້) ຢູ່ utils/selectOption ພ້ອມ hook ດຶງຂໍ້ມູນ
export type { Bank, Province, UserType };

/** GET /employee/summary/:id — ສະຫຼຸບຂ້າມໂມດູນຂອງພະນັກງານ */
export type EmployeeSummary = {
  year: string;
  advance_balance: number;
  leave: { _uuid: number; name: string; used: number; pending: number; max_per_year: number | null; remaining: number | null }[];
  pending: number;
  last_payroll: { period: string; pay_date: string | null; net: number } | null;
};

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
  approve_leave?: number;
  approve_correction?: number;
  approve_advance?: number;
  /** ເມນູທີ່ໃຊ້ໄດ້ — tbl_main_menu._uuid; null = ທຸກເມນູ */
  menu_access?: number[] | null;
  typeuser?: UserType | null;
  employee?: EmployeeRef | null;
};

/** ຕຳແໜ່ງ = ລາຍຊື່ກາງ (ບໍ່ຂຶ້ນກັບພະແນກ) — level = Level 1, 2, 3… (1 = ສູງສຸດ, ບໍ່ຈຳກັດຂັ້ນ; null = ຍັງບໍ່ກຳນົດ) */
export type Position = {
  _uuid: number;
  position_name: string;
  level: number | null;
  sort: number;
  status: number;
  /** ພະນັກງານທີ່ເຮັດວຽກຢູ່ */
  employees?: number;
};

/** "Level 3" — ບໍ່ມີ = null (ໃຫ້ຜູ້ເອີ້ນສະແດງ "ຍັງບໍ່ກຳນົດ") */
export const levelText = (level: number | null | undefined) => (level ? `Level ${level}` : null);

export type Department = {
  _uuid: number;
  depart_code: string;
  depart_name: string;
  description: string | null;
  sort: number;
  status: number;
  /** 1 = ຂັ້ນບໍລິຫານ (ຄະນະບໍລິຫານ) — ຄຸມທຸກພະແນກ, ຢູ່ເທິງສຸດຂອງໂຄງຮ່າງ, ບໍ່ນັບເປັນພະແນກ */
  executive?: number;
  /** ພະນັກງານທີ່ເຮັດວຽກຢູ່ */
  employees?: number;
};

/** ເມືອງ + ແຂວງຂອງເມືອງ — ບໍລິສັດ ແລະ ພະນັກງານເກັບແຕ່ district_id (ແຂວງມາກັບເມືອງ) */
export type DistrictRef = {
  _uuid: number;
  district_name: string;
  province_id: number;
  province?: { _uuid: number; province_name: string } | null;
};

export type EmployeeDocument = {
  _uuid: number;
  original_name: string;
  mime_type: string | null;
  file_size: number;
  createdAt: string;
  /** id_card · driving_license · cv · contract · certificate · other */
  doc_type: string;
};

/** ປະເພດເອກະສານ (key ຂອງ lao-dict) — ລຽງຕາມລຳດັບທີ່ສະແດງ */
export const DOC_TYPES = [
  { key: 'id_card', label: 'hrDocIdCard', icon: 'fa-id-card' },
  { key: 'driving_license', label: 'hrDocDriving', icon: 'fa-car' },
  { key: 'cv', label: 'hrDocCv', icon: 'fa-file-lines' },
  { key: 'contract', label: 'hrDocContract', icon: 'fa-file-signature' },
  { key: 'certificate', label: 'hrDocCertificate', icon: 'fa-award' },
  { key: 'other', label: 'hrDocOther', icon: 'fa-folder' },
] as const;

/** ປະຫວັດຫຍໍ້ — kind 1 ປະສົບການເຮັດວຽກ · 2 ການສຶກສາ · 3 ການຝຶກອົບຮົມ; end_date null = ຍັງເຮັດຢູ່ */
export type ResumeLine = {
  _uuid: number;
  kind: number;
  title: string;
  subtitle: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  original_name: string | null;
  mime_type: string | null;
  file_size: number | null;
};
export const RESUME_KINDS = [
  { value: 1, label: 'hrResumeWork', icon: 'fa-briefcase' },
  { value: 2, label: 'hrResumeEducation', icon: 'fa-graduation-cap' },
  { value: 3, label: 'hrResumeTraining', icon: 'fa-chalkboard-user' },
] as const;

/** ທັກສະຂອງພະນັກງານ (ພ້ອມໝວດ ແລະ ລະດັບທັງໝົດຂອງໝວດ) */
export type EmployeeSkill = { _uuid: number; skill_id: number; level: string | null; name: string; type_id: number; type_name: string; type_sort: number; levels: string[] };
export type SkillType = { _uuid: number; name: string; levels: string[]; sort: number; status: number; skills: { _uuid: number; name: string; status: number; sort: number; employees?: number }[] };

/** ສະຖານະຄອບຄົວ */
export const MARITAL_STATUSES = [
  { value: 1, label: 'hrMaritalSingle' },
  { value: 2, label: 'hrMaritalMarried' },
  { value: 3, label: 'hrMaritalDivorced' },
  { value: 4, label: 'hrMaritalWidowed' },
] as const;
export const WAGE_TYPES = [
  { value: 1, label: 'hrWageMonthly' },
  { value: 2, label: 'hrWageHourly' },
] as const;
export const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];

/** ລາຍການຕັ້ງຄ່າ (tbl_hr_option) */
export type HrOption = { _uuid: number; kind: string; name: string; sort: number; status: number; employees?: number };
export type HrOptionKind = 'employee_type' | 'education_level';

/** ຕົວເລືອກທີ່ເປີດໃຊ້ ແຍກຕາມ kind (ຟອມພະນັກງານ) */
export const useHrOptions = () => {
  const [data, setData] = useState<Record<HrOptionKind, { _uuid: number; name: string }[]>>({ employee_type: [], education_level: [] });
  useEffect(() => {
    let alive = true;
    getApi('/hr-option/option')
      .then((res) => alive && setData({ employee_type: [], education_level: [], ...(res.data?.data ?? {}) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return data;
};

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
  district_id: number | null;
  village: string | null;
  profile: string | null;
  description: string | null;
  position?: { _uuid: number; position_name: string } | null;
  // ---- ຂໍ້ມູນເພີ່ມເຕີມ (ບໍ່ບັງຄັບ) ----
  nationality: string | null;
  ethnicity: string | null;
  religion: string | null;
  birth_place: string | null;
  blood_type: string | null;
  id_card_no: string | null;
  id_card_expiry: string | null;
  passport_no: string | null;
  passport_expiry: string | null;
  sso_no: string | null;
  marital_status: number | null;
  spouse_name: string | null;
  spouse_birthday: string | null;
  spouse_phone: string | null;
  children: number | null;
  education_level_id: number | null;
  educationLevel?: { _uuid: number; name: string } | null;
  education_field: string | null;
  education_school: string | null;
  graduation_year: number | null;
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
  home_distance_km: number | null;
  employee_type_id: number | null;
  employeeType?: { _uuid: number; name: string } | null;
  contract_no: string | null;
  contract_fixed_term: number;
  contract_end: string | null;
  probation_end: string | null;
  wage_type: number;
  skills: EmployeeSkill[];
  resumes: ResumeLine[];
  /** ຫົວໜ້າ (ລາຍງານຕໍ່) — ໂຄງຮ່າງການຈັດຕັ້ງ */
  reports_to_id: number | null;
  reportsTo?: (EmployeeRef & { position?: { _uuid: number; position_name: string } | null }) | null;
  district?: DistrictRef | null;
  documents: EmployeeDocument[];
  /** 1 = ຍັງໃຊ້ລະຫັດ app ເລີ່ມຕົ້ນ (123) — ພະນັກງານຍັງບໍ່ໄດ້ປ່ຽນ */
  must_change_password: number;
  /** ບັນຊີຜູ້ໃຊ້ທີ່ຜູກກັບພະນັກງານນີ້ */
  user: { user_uuid: number; user_name: string; phones: string; status: number } | null;
};

/** ເບີໂທພະນັກງານ = ຊື່ເຂົ້າ app ແລະ ເບີຮັບ OTP — ຕ້ອງປ້ອນ 20 + 8 ຕົວເລກ (ກົງກັບ APP_PHONE ຂອງ api-bansi) */
export const APP_PHONE = /^20\d{8}$/;
/** ລະຫັດຜ່ານ app ຕອນສ້າງພະນັກງານ / HR ຕັ້ງຄືນ */
export const DEFAULT_APP_PASSWORD = '123';

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
 * ຂໍ້ຄວາມທີ່ສຳເນົາຈາກ Google Maps → { lat, lng }; ບໍ່ພົບ / ເກີນຂອບເຂດ = null.
 * ຮັບ "17.97, 102.64" ຫຼື ລິ້ງເຕັມ: ໝຸດສະຖານທີ່ (!3d…!4d…), /search/lat,+lng, /place/lat,lng, ?q=lat,lng,
 * ຈຸດກາງຈໍ (/@lat,lng,17z). ລິ້ງສັ້ນ maps.app.goo.gl ບໍ່ມີພິກັດ — ໃຊ້ resolveMapLink ກ່ອນ
 */
export const parseLatLng = (text: string) => {
  let s = text.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // ລິ້ງມີ % ທີ່ຖອດບໍ່ໄດ້ — ໃຊ້ຂໍ້ຄວາມເດີມ
  }
  const m = s.match(LAT_LNG)
    ?? s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
    ?? s.match(/[@=/](-?\d{1,2}\.\d+),[\s+]*(-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = parseCoord(m[1], 90);
  const lng = parseCoord(m[2], 180);
  return lat !== null && lng !== null ? { lat, lng } : null;
};

/** ລິ້ງສັ້ນ Google Maps (ປຸ່ມ Share → Copy link) — ມີແຕ່ລະຫັດ ບໍ່ມີພິກັດ */
export const MAP_SHORT_LINK = /https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[A-Za-z0-9_-]+/;

/** ລິ້ງສັ້ນ → ລິ້ງເຕັມຜ່ານ api-bansi (browser ຕາມ redirect ຂ້າມໂດເມນບໍ່ໄດ້) → { lat, lng } | null */
export const resolveMapLink = async (text: string) => {
  const res = await postApi('/company/map-link', { url: text });
  return parseLatLng(String(res.data?.data?.url ?? ''));
};

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
  /** ເຄື່ອງແບບປະຈຳວັນ 7 ຄ່າ (ດັດຊະນີ = Date.getDay()) — 0 ບໍ່ກຳນົດ, 1 ໂປໂລບໍລິສັດ, 2 ເສື້ອເຊີດ, 3 ເສື້ອທຳມະດາ */
  uniform_days: number[];
  /** URL ຮູບເສື້ອແທ້ 3 ແບບ — ດັດຊະນີ = ປະເພດ - 1, null = ຍັງບໍ່ມີຮູບ (ໃຊ້ໄອຄອນ) */
  uniform_photos: (string | null)[];
  district?: DistrictRef | null;
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

/** ຊະນິດເອກະສານທີ່ອັບໂຫຼດໄດ້ — ກົງກັບ DOCUMENT_TYPES ຂອງ api-bansi */
export const DOCUMENT_FILE = /\.(jpe?g|png|webp|pdf|docx?|xlsx?)$/i;
export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx';

/** ໄອຄອນຂອງເອກະສານ */
export const docIcon = (doc: { mime_type?: string | null; original_name: string }) => {
  const kind = doc.mime_type || doc.original_name;
  if (/pdf/i.test(kind)) return 'fa-file-pdf';
  if (/image/i.test(kind)) return 'fa-file-image';
  if (/presentation|powerpoint|\.pptx?$/i.test(kind)) return 'fa-file-powerpoint';
  return /sheet|excel|xlsx?$/i.test(kind) ? 'fa-file-excel' : 'fa-file-word';
};

export const MAX_FILE = 5 * 1024 * 1024;
export const MAX_DOCUMENTS = 5;
