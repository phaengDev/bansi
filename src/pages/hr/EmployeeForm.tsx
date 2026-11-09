import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, DatePicker, Form, InputGroup, Modal, NumberInput, Schema, SelectPicker, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { InputField } from '../../utils/inputFields';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { FormStep, PickerField, SwitchRow } from '../account/setting/settingKit';
import { ReportLineBox, bossOption, bossValue, useBossOptions } from './org/OrgBits';
import { buildOrgTree, suggestBoss, useOrgData } from './org/orgModel';
import { levelText } from './hrApi';
import { fromApiDate } from '../account/setting/settingApi';
import {
  APP_PHONE, BLOOD_TYPES, GENDERS, MARITAL_STATUSES, MAX_FILE, WAGE_TYPES, fileSizeText, fullName, useHrOptions, type Employee,
} from './hrApi';
import { useBanks, useDepartments, useDistricts, usePositions, useProvinces } from '../../utils/selectOption';
import { bankLabel } from './hrKit';

/** TextFieldProps ຂອງ InputField ບໍ່ໄດ້ປະກາດ — ສົ່ງຕໍ່ໃຫ້ Input: ເບີ 20 + 8 ຕົວເລກ = 10 ຕົວ, ແປ້ນຕົວເລກໃນມືຖື */
const phoneProps = { maxLength: 10, inputMode: 'numeric' } as object;

const { StringType, NumberType } = Schema.Types;
const IMAGE = /^image\/(jpeg|png|webp)$/;
const CV_FILE = /\.(pdf|docx?|jpe?g|png|webp)$/i;
/** ຊື່ໄຟລ໌ທີ່ມີຄຳວ່າ CV ເຊັ່ນ "CV_bounmy.pdf", "my-cv.docx" */
const CV_NAME = /(^|[^a-z])cv([^a-z]|$)/i;

const cvIcon = (name: string) =>
  /\.pdf$/i.test(name) ? 'fa-file-pdf' : /\.docx?$/i.test(name) ? 'fa-file-word' : 'fa-file-image';

type Props = {
  /** null = ເພີ່ມໃໝ່ */
  data: Employee | null;
  /** ລະຫັດທີ່ backend ຈະອອກໃຫ້ ຖ້າບໍ່ປ້ອນ (ສະແດງເປັນ placeholder) */
  nextCode?: string;
  onClose: () => void;
  onSaved: (employee: Employee) => void;
};

const apiDate = (value: Date | null | undefined) => (value ? moment(value).format('YYYY-MM-DD') : '');

type PickerItem = { value: unknown; label: string } & Record<string, unknown>;

/** ເພີ່ມຄ່າປັດຈຸບັນ (ທີ່ອາດຖືກປິດໃຊ້ງານແລ້ວ ຈຶ່ງບໍ່ຢູ່ໃນ option) ໄວ້ທາງໜ້າລາຍການ */
const withCurrent = (list: PickerItem[], current: PickerItem | null | undefined | false) =>
  current && !list.some((o) => o.value === current.value) ? [current, ...list] : list;

/** ຮູບພະນັກງານແບບວົງມົນ — ກົດທີ່ວົງເພື່ອເລືອກ / ປ່ຽນຮູບ, ປຸ່ມ × ລຶບຮູບ */
const PhotoPicker = ({ url, onPick, onClear }: {
  url: string | null | undefined;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) => {
  const t = useT();
  return (
    <div className="hr-photo-pick">
      <div className="hr-photo-frame">
        <label className={`hr-photo-circle${url ? ' has-photo' : ''}`} title={t(url ? 'hrPhotoChange' : 'hrPhotoPick')}>
          {url ? (
            <>
              <img src={url} alt="" />
              <span className="hr-photo-overlay"><i className="fa-solid fa-camera" /> {t('hrPhotoChange')}</span>
            </>
          ) : (
            <span className="hr-photo-empty">
              <i className="fa-solid fa-camera" />
              <b>{t('hrPhotoPick')}</b>
            </span>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />
        </label>
        {url && (
          <button type="button" className="hr-photo-clear" title={t('hrPhotoRemove')} aria-label={t('hrPhotoRemove')} onClick={onClear}>
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>
      <small>JPG, PNG, WEBP · ≤ 5MB</small>
    </div>
  );
};

/** ຊ່ອງຊື່ ທີ່ມີ dropdown ເລືອກເພດຢູ່ທາງໜ້າ ເຊັ່ນ [ເພດຍິງ ▾] ບົວລາຍ */
const NameWithGender = ({ gender, onGender }: { gender: number; onGender: (value: number) => void }) => {
  const t = useT();
  const options = GENDERS.map((g) => ({ value: g.value, label: t(g.long), icon: g.icon }));
  const genderLabel = (_: unknown, item: any) => item && (
    <span className={`hr-gender-value is-${item.value === 2 ? 'female' : 'male'}`}>
      <i className={`fa-solid ${item.icon}`} /> {item.label}
    </span>
  );
  return (
    <Form.Group controlId="first_name-1" className="mb-2">
      <Form.Label className="fs-5 form-label">
        {t('hrGender')} · {t('hrFirstName')}<span className="text-danger">*</span>
      </Form.Label>
      <InputGroup className="hr-name-field">
        <InputGroup.Addon className="hr-gender">
          <SelectPicker data={options} value={gender} onChange={(value) => value && onGender(value)}
            cleanable={false} searchable={false} appearance="subtle" size="sm" aria-label={t('hrGender')}
            popupClassName="acc-book-menu" renderValue={genderLabel} renderOption={genderLabel}
          />
        </InputGroup.Addon>
        <Form.Control name="first_name" placeholder={t('hrFirstName')} />
      </InputGroup>
    </Form.Group>
  );
};

/**
 * ຟອມພະນັກງານ — POST /employee/create, PUT /employee/:id (multipart, ຮູບ field "profile").
 * ພະແນກ → ຕຳແໜ່ງ (ສະເພາະຂອງພະແນກນັ້ນ), ແຂວງ → ເມືອງ. ບໍ່ສົ່ງສະຖານະ — ເພີ່ມໃໝ່ = ເຮັດວຽກຢູ່,
 * ລາອອກ / ກັບເຂົ້າວຽກ ເຮັດຢູ່ໜ້າລາຍລະອຽດ (EmployeeDetail).
 * CV: ບັນທຶກພະນັກງານແລ້ວຈຶ່ງອັບໂຫຼດເປັນເອກະສານຄັດຕິດ (POST /employee/document/:id) ຊື່ໄຟລ໌ນຳໜ້າ "CV_"
 */
const EmployeeForm = ({ data, nextCode, onClose, onSaved }: Props) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const departments = useDepartments();
  const provinces = useProvinces();
  const banks = useBanks();
  const [gender, setGender] = useState<number>(data?.gender ?? 1);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [cv, setCv] = useState<File | null>(null);
  const [inputs, setInputs] = useState<any>({
    emp_code: data?.emp_code ?? '',
    first_name: data?.first_name ?? '',
    last_name: data?.last_name ?? '',
    birthday: fromApiDate(data?.birthday),
    phone: data?.phone ?? '',
    email: data?.email ?? '',
    department_id: data?.department_id ?? null,
    position_id: data?.position_id ?? null,
    reports_to_id: data?.reports_to_id ?? null,
    // ---- ຂໍ້ມູນເພີ່ມເຕີມ (ບໍ່ບັງຄັບ) ----
    employee_type_id: data?.employee_type_id ?? null,
    contract_no: data?.contract_no ?? '',
    contract_end: fromApiDate(data?.contract_end),
    probation_end: fromApiDate(data?.probation_end),
    id_card_no: data?.id_card_no ?? '',
    id_card_expiry: fromApiDate(data?.id_card_expiry),
    passport_no: data?.passport_no ?? '',
    passport_expiry: fromApiDate(data?.passport_expiry),
    sso_no: data?.sso_no ?? '',
    nationality: data?.nationality ?? '',
    ethnicity: data?.ethnicity ?? '',
    religion: data?.religion ?? '',
    birth_place: data?.birth_place ?? '',
    blood_type: data?.blood_type ?? null,
    spouse_name: data?.spouse_name ?? '',
    spouse_birthday: fromApiDate(data?.spouse_birthday),
    spouse_phone: data?.spouse_phone ?? '',
    children: data?.children ?? null,
    education_level_id: data?.education_level_id ?? null,
    education_field: data?.education_field ?? '',
    education_school: data?.education_school ?? '',
    graduation_year: data?.graduation_year ?? null,
    emergency_name: data?.emergency_name ?? '',
    emergency_relation: data?.emergency_relation ?? '',
    emergency_phone: data?.emergency_phone ?? '',
    home_distance_km: data?.home_distance_km ?? null,
    start_date: fromApiDate(data?.start_date) ?? (data ? null : new Date()),
    basic_salary: data?.basic_salary ?? null,
    bank_id: data?.bank_id ?? null,
    bank_account_no: data?.bank_account_no ?? '',
    bank_account_name: data?.bank_account_name ?? '',
    // ແຂວງບໍ່ໄດ້ບັນທຶກ — ໃຊ້ກັ່ນລາຍການເມືອງເທົ່ານັ້ນ (ເອົາມາຈາກເມືອງທີ່ບັນທຶກໄວ້)
    province_id: data?.district?.province_id ?? null,
    district_id: data?.district_id ?? null,
    village: data?.village ?? '',
    description: data?.description ?? '',
  });
  const positions = usePositions();
  const hrOptions = useHrOptions();
  const [fixedTerm, setFixedTerm] = useState(Number(data?.contract_fixed_term) === 1);
  const [wageType, setWageType] = useState<number>(data?.wage_type ?? 1);
  const [marital, setMarital] = useState<number | null>(data?.marital_status ?? null);
  // ສ່ວນທີ່ບໍ່ບັງຄັບ ພັບໄວ້ — ເປີດເອງເມື່ອມີຂໍ້ມູນແລ້ວ
  const filled = (...keys: (keyof Employee)[]) => !!data && keys.some((k) => data[k] !== null && data[k] !== undefined && data[k] !== '');
  const [open, setOpen] = useState(() => ({
    contract: filled('employee_type_id', 'contract_no', 'contract_end', 'probation_end') || Number(data?.wage_type) === 2,
    identity: filled('id_card_no', 'passport_no', 'sso_no', 'nationality', 'ethnicity', 'religion', 'birth_place', 'blood_type'),
    family: filled('marital_status', 'children'),
    education: filled('education_level_id', 'education_field', 'education_school', 'graduation_year'),
    emergency: filled('emergency_name', 'emergency_phone', 'home_distance_km'),
  }));
  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }));
  const optionsOf = (kind: 'employee_type' | 'education_level', current?: { _uuid: number; name: string } | null) =>
    withCurrent(hrOptions[kind].map((o) => ({ value: o._uuid, label: o.name })), current && { value: current._uuid, label: current.name });
  // ສາຍບັງຄັບບັນຊາຂອງຕຳແໜ່ງທີ່ເລືອກ — ຫົວໜ້າ ແລະ ລູກທີມ (ຕັ້ງຢູ່ ພະແນກ ແລະ ຕຳແໜ່ງ)
  const org = useOrgData();
  const orgTree = useMemo(() => buildOrgTree(org.data), [org.data]);
  const districts = useDistricts(inputs.province_id);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // ພະແນກ / ຕຳແໜ່ງ / ທະນາຄານ ທີ່ປິດໃຊ້ງານແລ້ວບໍ່ຢູ່ໃນ option — ສະແດງຄ່າເດີມຂອງພະນັກງານນຳ
  const departmentOptions = withCurrent(departments, data?.department && { value: data.department_id, label: data.department.depart_name });
  // ຕຳແໜ່ງ = ລາຍຊື່ກາງ ຈັດກຸ່ມຕາມ Level (ບໍ່ຂຶ້ນກັບພະແນກ)
  const positionOptions = withCurrent(
    positions.map((p) => ({ ...p, group: levelText(p.level) ?? t('hrLevelUnset') })),
    data?.position && { value: data.position._uuid, label: data.position.position_name },
  );
  // ຫົວໜ້າສາຍງານ — ລະບົບແນະນຳຄົນທີ່ Level ສູງກວ່າທີ່ໃກ້ສຸດ (ພະແນກດຽວກັນກ່ອນ); ບໍ່ລວມຕົນເອງ ແລະ ລູກທີມຂອງຕົນ
  const suggestFor = (form: any) => suggestBoss(org.data, { _uuid: data?._uuid, department_id: form.department_id, position_id: form.position_id });
  const suggested = suggestFor(inputs);
  const bossOptions = useBossOptions(org.data, orgTree, data?._uuid, suggested);
  const positionLevel = positions.find((p) => p._uuid === inputs.position_id)?.level;
  const bankOptions = withCurrent(banks, data?.bank && { ...data.bank, value: data.bank._uuid, label: `${data.bank.abbr} ${data.bank.name_la}` });

  const model = Schema.Model<any>({
    first_name: StringType().isRequired(t('inputRequired')),
    email: StringType().isEmail(t('hrEmailInvalid')),
    // ເບີໂທ = ຊື່ເຂົ້າ app ພະນັກງານ — ບັງຄັບ 20 + 8 ຕົວເລກ
    phone: StringType().isRequired(t('inputRequired')).addRule((value) => APP_PHONE.test(String(value).replace(/\D/g, '')), t('hrPhone20')),
    bank_account_no: StringType().pattern(/^\d[\d\s-]{3,60}\d$/, t('hrBankAccountNoInvalid')),
    department_id: NumberType().isRequired(t('selectRequired')),
  });

  /** ປ່ຽນພະແນກ/ຕຳແໜ່ງ → ໃສ່ຫົວໜ້າສາຍງານທີ່ແນະນຳ (ປ່ຽນເອງໄດ້); ປ່ຽນແຂວງ → ລ້າງເມືອງ */
  const handleChange = (next: any) => {
    if (next.department_id !== inputs.department_id || next.position_id !== inputs.position_id) {
      const level = positions.find((p) => p._uuid === next.position_id)?.level;
      if (level) next = { ...next, reports_to_id: suggestFor(next) };
    }
    if (next.province_id !== inputs.province_id) next = { ...next, district_id: null };
    // ລ້າງທະນາຄານ → ລ້າງເລກ ແລະ ຊື່ບັນຊີ
    if (!next.bank_id && inputs.bank_id) next = { ...next, bank_account_no: '', bank_account_name: '' };
    setInputs(next);
  };

  const pickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!IMAGE.test(file.type)) return Notific.warning('hrPhotoType');
    if (file.size > MAX_FILE) return Notific.warning('incomeFileSize');
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhoto(null);
    setPreview(null);
    if (data?.profile) setRemovePhoto(true);
  };

  const pickCv = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!CV_FILE.test(file.name)) return Notific.warning('hrCvType');
    if (file.size > MAX_FILE) return Notific.warning('incomeFileSize');
    setCv(file);
  };

  /** ອັບໂຫຼດ CV ຫຼັງບັນທຶກ — ຄືນຂໍ້ມູນພະນັກງານລ່າສຸດ (ມີ CV ໃນເອກະສານ); ບໍ່ສຳເລັດ = ພະນັກງານຍັງບັນທຶກແລ້ວ */
  const uploadCv = async (saved: Employee) => {
    if (!cv || !saved?._uuid) return saved;
    const file = CV_NAME.test(cv.name) ? cv : new File([cv], `CV_${cv.name}`, { type: cv.type });
    const body = new FormData();
    body.append('files', file);
    body.append('doc_type', 'cv');
    try {
      const res = await postApi(`/employee/document/${btoa(String(saved._uuid))}`, body);
      return (res.data?.data ?? saved) as Employee;
    } catch (error) {
      console.error(error);
      Notific.error(`${t('hrCvUploadFailed')} — ${getErrorMessage(error)}`);
      return saved;
    }
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    // ເລືອກທະນາຄານແລ້ວ ຕ້ອງມີເລກບັນຊີ (schema ບໍ່ກວດຊ່ອງຫວ່າງທີ່ບໍ່ບັງຄັບ)
    if (inputs.bank_id && !String(inputs.bank_account_no ?? '').trim()) return Notific.warning('hrBankAccountNoRequired');
    // ແຂວງບໍ່ໄດ້ບັນທຶກແຍກ — ເລືອກແຂວງແລ້ວຕ້ອງເລືອກເມືອງນຳ ບໍ່ດັ່ງນັ້ນແຂວງຈະຫາຍ
    if (inputs.province_id && !inputs.district_id) return Notific.warning('hrCompanyDistrictRequired');
    const body = new FormData();
    const text = (value: unknown) => String(value ?? '').trim();
    body.append('emp_code', text(inputs.emp_code).toUpperCase());
    body.append('first_name', text(inputs.first_name));
    body.append('last_name', text(inputs.last_name));
    body.append('gender', String(gender));
    body.append('birthday', apiDate(inputs.birthday));
    body.append('phone', String(inputs.phone ?? '').replace(/\D/g, ''));
    body.append('email', text(inputs.email));
    body.append('department_id', String(inputs.department_id));
    body.append('position_id', inputs.position_id ? String(inputs.position_id) : '');
    body.append('reports_to_id', inputs.reports_to_id ? String(inputs.reports_to_id) : '');
    body.append('start_date', apiDate(inputs.start_date));
    body.append('basic_salary', String(Number(inputs.basic_salary) || 0));
    body.append('bank_id', inputs.bank_id ? String(inputs.bank_id) : '');
    body.append('bank_account_no', inputs.bank_id ? text(inputs.bank_account_no) : '');
    body.append('bank_account_name', inputs.bank_id ? text(inputs.bank_account_name) : '');
    body.append('district_id', inputs.district_id ? String(inputs.district_id) : '');
    body.append('village', text(inputs.village));
    body.append('description', text(inputs.description));
    // ---- ຂໍ້ມູນເພີ່ມເຕີມ (ບໍ່ບັງຄັບ) ----
    const id = (v: unknown) => (v ? String(v) : '');
    body.append('employee_type_id', id(inputs.employee_type_id));
    body.append('contract_no', text(inputs.contract_no));
    body.append('contract_fixed_term', fixedTerm ? '1' : '0');
    body.append('contract_end', fixedTerm ? apiDate(inputs.contract_end) : '');
    body.append('probation_end', apiDate(inputs.probation_end));
    body.append('wage_type', String(wageType));
    for (const key of ['id_card_no', 'passport_no', 'sso_no', 'nationality', 'ethnicity', 'religion', 'birth_place', 'education_field',
      'education_school', 'emergency_name', 'emergency_relation', 'emergency_phone']) body.append(key, text(inputs[key]));
    body.append('id_card_expiry', apiDate(inputs.id_card_expiry));
    body.append('passport_expiry', apiDate(inputs.passport_expiry));
    body.append('blood_type', inputs.blood_type ?? '');
    body.append('marital_status', id(marital));
    body.append('spouse_name', marital === 2 ? text(inputs.spouse_name) : '');
    body.append('spouse_birthday', marital === 2 ? apiDate(inputs.spouse_birthday) : '');
    body.append('spouse_phone', marital === 2 ? text(inputs.spouse_phone) : '');
    body.append('children', inputs.children === null || inputs.children === '' ? '' : String(inputs.children));
    body.append('education_level_id', id(inputs.education_level_id));
    body.append('graduation_year', inputs.graduation_year ? String(inputs.graduation_year) : '');
    body.append('home_distance_km', inputs.home_distance_km === null || inputs.home_distance_km === '' ? '' : String(inputs.home_distance_km));
    if (photo) body.append('profile', photo);
    if (data && removePhoto && !photo) body.append('remove_profile', '1');
    try {
      setSaving(true);
      const res = data
        ? await putApi(`/employee/${btoa(String(data._uuid))}`, body)
        : await postApi('/employee/create', body);
      Notific.success('saveSuccessDone');
      onSaved(await uploadCv(res.data?.data));
      onClose();
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const photoUrl = preview ?? (removePhoto ? null : data?.profile_url);
  const currentCv = data?.documents.filter((d) => d.doc_type === 'cv' || CV_NAME.test(d.original_name)).at(-1);

  const personalDone = !!String(inputs.first_name).trim();
  const workDone = !!inputs.department_id;
  const bankDone = !!inputs.bank_id && !!String(inputs.bank_account_no).trim();
  const addressDone = !!inputs.district_id;

  return (
    <Modal open onClose={onClose} size="lg" className="acc-book-modal is-steps hr-employee-form">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className={`fa-solid ${data ? 'fa-user-pen' : 'fa-user-plus'}`} /></span>
          <span>
            <Modal.Title>{t(data ? 'hrEmployeeEdit' : 'hrEmployeeAdd')}</Modal.Title>
            <small>{data ? `${data.emp_code} · ${fullName(data)}` : t('hrEmployeeHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <Form fluid ref={formRef} model={model} formValue={inputs} onChange={handleChange} className="acc-book-main">
          {/* ---- ຂັ້ນ 1: ຮູບ (ຊ້າຍ) + ຂໍ້ມູນສ່ວນຕົວ (ຂວາ) ---- */}
          <FormStep no={1} done={personalDone} title={t('hrPersonal')} hint={t('hrPersonalHint')}>
            <div className="is-wide hr-profile">
              <PhotoPicker url={photoUrl} onPick={pickPhoto} onClear={clearPhoto} />
              <div className="hr-profile-fields">
                <InputField name="emp_code" label={t('hrEmployeeCode')} required={false} className="acc-book-upper"
                  icon={<i className="fa-solid fa-hashtag" />}
                  placeholder={data ? undefined : `${nextCode ?? 'EMP-0001'} (${t('hrAutoCode')})`}
                />
                <InputField name="birthday" label={t('hrBirthday')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false}
                  placeholder="dd/mm/yyyy" shouldDisableDate={(date) => moment(date).isAfter(moment(), 'day')}
                />
                <NameWithGender gender={gender} onGender={setGender} />
                <InputField name="last_name" label={t('hrLastName')} required={false} placeholder={t('hrLastName')} />
                <InputField name="phone" label={t('hrPhoneApp')} icon={<i className="fa-solid fa-phone" />} placeholder="20XXXXXXXX" {...phoneProps} />
                <InputField name="email" label={t('hrEmail')} required={false} icon={<i className="fa-solid fa-envelope" />} placeholder="name@example.com" />
              </div>
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 2: ວຽກ ---- */}
          <FormStep no={2} done={workDone} title={t('hrWork')} hint={t('hrWorkHint')}>
            <PickerField name="department_id" label={t('hrDepartment')} data={departmentOptions} placeholder={t('select')} cleanable={false}
              locale={{ noResultsText: t('hrNoDepartmentYet') }}
            />
            <PickerField name="position_id" label={t('hrPosition')} data={positionOptions} required={false} groupBy="group"
              placeholder={t('select')} locale={{ noResultsText: t('hrNoPositions') }}
            />
            <div className="is-wide hr-boss-field">
              <PickerField name="reports_to_id" label={t('hrReportsTo')} data={bossOptions} required={false} groupBy="group"
                placeholder={t('hrNoBossPick')} renderOption={bossOption} renderValue={bossValue} popupClassName="acc-book-menu hr-org-menu"
              />
              <small className="hr-boss-hint">
                {positionLevel === 1 ? t('hrTopNoBoss')
                  : !inputs.position_id ? t('hrBossPickPosition')
                  : !positionLevel ? t('hrBossNoLevel')
                  : suggested && suggested === inputs.reports_to_id ? <><i className="fa-solid fa-wand-magic-sparkles" /> {t('hrBossSuggestedNote')}</>
                  : t('hrBossNote')}
              </small>
              {data?._uuid && orgTree.byPerson.has(data._uuid) && <ReportLineBox tree={orgTree} personId={data._uuid} showBoss={false} />}
            </div>
            <InputField name="start_date" label={t('hrStartDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false}
              placeholder="dd/mm/yyyy"
            />
            <InputField name="basic_salary" label={t('hrBasicSalary')} accepter={NumberInput} required={false} formatter={amountFormatter}
              controls={false} prefix="₭"
            />
          </FormStep>

          {/* ---- ຂັ້ນ 3: ບັນຊີຮັບເງິນເດືອນ (ໂອນທ້າຍເດືອນ) ---- */}
          <FormStep no={3} done={bankDone} title={t('hrSalaryAccount')} hint={t('hrSalaryAccountHint')}>
            <PickerField name="bank_id" label={t('hrBank')} data={bankOptions} required={false} placeholder={t('hrNoSalaryAccount')}
              renderOption={bankLabel} renderValue={bankLabel}
            />
            <InputField name="bank_account_no" label={t('hrBankAccountNo')} required={false} icon={<i className="fa-solid fa-credit-card" />}
              placeholder={inputs.bank_id ? '010-12-00-xxxxxxxx-001' : t('hrPickBankFirst')} disabled={!inputs.bank_id}
            />
            <div className="is-wide">
              <InputField name="bank_account_name" label={t('hrBankAccountName')} required={false} icon={<i className="fa-solid fa-signature" />}
                placeholder={inputs.bank_id ? t('hrBankAccountNamePlaceholder') : t('hrPickBankFirst')} disabled={!inputs.bank_id}
              />
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 4: ທີ່ຢູ່ + ໝາຍເຫດ ---- */}
          <FormStep no={4} done={addressDone} title={t('hrAddressStep')} hint={t('hrAddressHint')}>
            <PickerField name="province_id" label={t('hrProvince')} data={provinces}
              required={false} placeholder={t('select')}
            />
            <PickerField name="district_id" label={t('hrDistrict')} data={districts}
              required={!!inputs.province_id} placeholder={inputs.province_id ? t('select') : t('hrPickProvinceFirst')} disabled={!inputs.province_id}
            />
            <div className="is-wide">
              <InputField name="village" label={t('hrVillage')} required={false} icon={<i className="fa-solid fa-location-dot" />} />
            </div>
            <div className="is-wide">
              <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 5: CV (ອັບໂຫຼດຫຼັງບັນທຶກພະນັກງານ) ---- */}
          {/* ---- ຂໍ້ມູນເພີ່ມເຕີມ (ບໍ່ບັງຄັບ — ພັບໄວ້, ກົດຫົວຂໍ້ເພື່ອເປີດ) ---- */}
          <FormStep no={5} title={t('hrContract')} hint={t('hrContractHint')} collapsed={!open.contract} onToggle={() => toggle('contract')}
            summary={[optionsOf('employee_type', data?.employeeType).find((o) => o.value === inputs.employee_type_id)?.label, fixedTerm ? t('hrFixedTerm') : null,
              t(WAGE_TYPES.find((w) => w.value === wageType)!.label)].filter(Boolean).join(' · ')}
          >
            <PickerField name="employee_type_id" label={t('hrEmployeeType')} data={optionsOf('employee_type', data?.employeeType)} required={false} searchable={false}
              placeholder={t('select')} locale={{ noResultsText: t('hrOptionsEmpty') }}
            />
            <InputField name="contract_no" label={t('hrContractNo')} required={false} />
            <SwitchRow checked={fixedTerm} onChange={setFixedTerm} className="is-wide hr-inline-toggle">
              <span><b>{t('hrFixedTerm')}</b><small>{t('hrFixedTermHint')}</small></span>
            </SwitchRow>
            {fixedTerm && <InputField name="contract_end" label={t('hrContractEnd')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} placeholder="dd/mm/yyyy" />}
            <InputField name="probation_end" label={t('hrProbationEnd')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} placeholder="dd/mm/yyyy" />
            <div className="is-wide hr-segment-field">
              <span className="form-label">{t('hrWageType')}</span>
              <div className="acc-type-segment" role="radiogroup">
                {WAGE_TYPES.map((w) => (
                  <button key={w.value} type="button" role="radio" aria-checked={wageType === w.value} className={wageType === w.value ? 'is-active' : ''}
                    onClick={() => setWageType(w.value)}
                  >{t(w.label)}</button>
                ))}
              </div>
              {wageType === 2 && <small className="hr-field-note"><i className="fa-solid fa-circle-info" /> {t('hrWageHourlyNote')}</small>}
            </div>
          </FormStep>

          <FormStep no={6} title={t('hrIdentity')} hint={t('hrIdentityHint')} collapsed={!open.identity} onToggle={() => toggle('identity')}
            summary={[inputs.id_card_no, inputs.passport_no, inputs.nationality].filter(Boolean).join(' · ') || t('hrOptionalEmpty')}
          >
            <InputField name="id_card_no" label={t('hrIdCardNo')} required={false} />
            <InputField name="id_card_expiry" label={t('hrIdCardExpiry')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} placeholder="dd/mm/yyyy" />
            <InputField name="passport_no" label={t('hrPassportNo')} required={false} />
            <InputField name="passport_expiry" label={t('hrPassportExpiry')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} placeholder="dd/mm/yyyy" />
            <InputField name="sso_no" label={t('hrSsoNo')} required={false} />
            <PickerField name="blood_type" label={t('hrBloodType')} data={BLOOD_TYPES.map((b) => ({ value: b, label: b }))} required={false} searchable={false}
              placeholder={t('select')}
            />
            <InputField name="nationality" label={t('hrNationality')} required={false} />
            <InputField name="ethnicity" label={t('hrEthnicity')} required={false} />
            <InputField name="religion" label={t('hrReligion')} required={false} />
            <InputField name="birth_place" label={t('hrBirthPlace')} required={false} />
          </FormStep>

          <FormStep no={7} title={t('hrFamily')} hint={t('hrFamilyHint')} collapsed={!open.family} onToggle={() => toggle('family')}
            summary={[marital ? t(MARITAL_STATUSES.find((m) => m.value === marital)!.label) : null,
              inputs.children !== null && inputs.children !== '' ? `${t('hrChildren')} ${inputs.children}` : null].filter(Boolean).join(' · ') || t('hrOptionalEmpty')}
          >
            <div className="is-wide hr-segment-field">
              <span className="form-label">{t('hrMaritalStatus')}</span>
              <div className="acc-type-segment" role="radiogroup">
                {MARITAL_STATUSES.map((m) => (
                  <button key={m.value} type="button" role="radio" aria-checked={marital === m.value} className={marital === m.value ? 'is-active' : ''}
                    onClick={() => setMarital(marital === m.value ? null : m.value)}
                  >{t(m.label)}</button>
                ))}
              </div>
            </div>
            {marital === 2 && (
              <>
                <InputField name="spouse_name" label={t('hrSpouseName')} required={false} />
                <InputField name="spouse_birthday" label={t('hrSpouseBirthday')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} placeholder="dd/mm/yyyy" />
                <InputField name="spouse_phone" label={t('hrSpousePhone')} required={false} />
              </>
            )}
            <InputField name="children" label={t('hrChildren')} accepter={NumberInput} required={false} />
          </FormStep>

          <FormStep no={8} title={t('hrEducation')} hint={t('hrEducationHint')} collapsed={!open.education} onToggle={() => toggle('education')}
            summary={[optionsOf('education_level', data?.educationLevel).find((o) => o.value === inputs.education_level_id)?.label, inputs.education_field]
              .filter(Boolean).join(' · ') || t('hrOptionalEmpty')}
          >
            <PickerField name="education_level_id" label={t('hrEducationLevel')} data={optionsOf('education_level', data?.educationLevel)} required={false}
              searchable={false} placeholder={t('select')} locale={{ noResultsText: t('hrOptionsEmpty') }}
            />
            <InputField name="education_field" label={t('hrEducationField')} required={false} />
            <InputField name="education_school" label={t('hrEducationSchool')} required={false} />
            <InputField name="graduation_year" label={t('hrGraduationYear')} accepter={NumberInput} required={false} controls={false} placeholder="2020" />
          </FormStep>

          <FormStep no={9} title={t('hrEmergency')} hint={t('hrEmergencyHint')} collapsed={!open.emergency} onToggle={() => toggle('emergency')}
            summary={[inputs.emergency_name, inputs.emergency_phone].filter(Boolean).join(' · ') || t('hrOptionalEmpty')}
          >
            <InputField name="emergency_name" label={t('hrEmergencyName')} required={false} />
            <InputField name="emergency_relation" label={t('hrEmergencyRelation')} required={false} placeholder={t('hrEmergencyRelationHint')} />
            <InputField name="emergency_phone" label={t('hrEmergencyPhone')} required={false} icon={<i className="fa-solid fa-phone" />} />
            <InputField name="home_distance_km" label={t('hrHomeDistance')} accepter={NumberInput} required={false} icon={<span className="hr-unit">km</span>} iconPosition="end" />
          </FormStep>

          <FormStep no={10} done={!!cv || !!currentCv} title={t('hrCv')} hint={t('hrCvHint')}>
            <div className="is-wide acc-jr-file">
              {cv ? (
                <div className="acc-jr-file-card">
                  <span className="acc-jr-file-thumb"><i className={`fa-solid ${cvIcon(cv.name)}`} /></span>
                  <span className="acc-jr-file-name">
                    <b>{cv.name}</b>
                    <small>{fileSizeText(cv.size)}</small>
                  </span>
                  <button type="button" className="acc-jr-file-remove" onClick={() => setCv(null)}
                    aria-label={t('incomeFileRemove')} title={t('incomeFileRemove')}
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              ) : (
                <label className="acs-logo-pick">
                  <span className="acs-logo-preview"><i className="fa-solid fa-file-lines" /></span>
                  <span className="acs-logo-text">
                    <b><i className="fa-solid fa-upload" /> {t(currentCv ? 'hrCvPickNew' : 'hrCvPick')}</b>
                    <small>PDF, Word, JPG, PNG · ≤ 5MB</small>
                  </span>
                  <input type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp" hidden onChange={pickCv} />
                </label>
              )}
              {currentCv && !cv && (
                <small className="hr-cv-current"><i className="fa-solid fa-paperclip" /> {t('hrCvCurrent')}: {currentCv.original_name}</small>
              )}
            </div>
          </FormStep>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={submit}>
          <i className="fa-solid fa-check" /> {t('save')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EmployeeForm;
