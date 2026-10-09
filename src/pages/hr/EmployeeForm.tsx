import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, DatePicker, Form, InputGroup, Modal, NumberInput, Schema, SelectPicker, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { InputField } from '../../utils/inputFields';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { FormStep, PickerField } from '../account/setting/settingKit';
import { fromApiDate } from '../account/setting/settingApi';
import { GENDERS, MAX_FILE, fileSizeText, fullName, type Employee } from './hrApi';
import { useBanks, useDepartments, useDistricts, usePositions, useProvinces } from '../../utils/selectOption';
import { bankLabel } from './hrKit';

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
    start_date: fromApiDate(data?.start_date) ?? (data ? null : new Date()),
    basic_salary: data?.basic_salary ?? null,
    bank_id: data?.bank_id ?? null,
    bank_account_no: data?.bank_account_no ?? '',
    bank_account_name: data?.bank_account_name ?? '',
    province_id: data?.province_id ?? null,
    district_id: data?.district_id ?? null,
    village: data?.village ?? '',
    description: data?.description ?? '',
  });
  const positions = usePositions(inputs.department_id);
  const districts = useDistricts(inputs.province_id);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  // ພະແນກ / ຕຳແໜ່ງ / ທະນາຄານ ທີ່ປິດໃຊ້ງານແລ້ວບໍ່ຢູ່ໃນ option — ສະແດງຄ່າເດີມຂອງພະນັກງານນຳ
  const departmentOptions = withCurrent(departments, data?.department && { value: data.department_id, label: data.department.depart_name });
  const positionOptions = withCurrent(positions, data?.position && data.department_id === inputs.department_id
    && { value: data.position._uuid, label: data.position.position_name });
  const bankOptions = withCurrent(banks, data?.bank && { ...data.bank, value: data.bank._uuid, label: `${data.bank.abbr} ${data.bank.name_la}` });

  const model = Schema.Model<any>({
    first_name: StringType().isRequired(t('inputRequired')),
    email: StringType().isEmail(t('hrEmailInvalid')),
    bank_account_no: StringType().pattern(/^\d[\d\s-]{3,60}\d$/, t('hrBankAccountNoInvalid')),
    department_id: NumberType().isRequired(t('selectRequired')),
  });

  /** ປ່ຽນພະແນກ → ລ້າງຕຳແໜ່ງ; ປ່ຽນແຂວງ → ລ້າງເມືອງ */
  const handleChange = (next: any) => {
    if (next.department_id !== inputs.department_id) next = { ...next, position_id: null };
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
    const body = new FormData();
    const text = (value: unknown) => String(value ?? '').trim();
    body.append('emp_code', text(inputs.emp_code).toUpperCase());
    body.append('first_name', text(inputs.first_name));
    body.append('last_name', text(inputs.last_name));
    body.append('gender', String(gender));
    body.append('birthday', apiDate(inputs.birthday));
    body.append('phone', text(inputs.phone));
    body.append('email', text(inputs.email));
    body.append('department_id', String(inputs.department_id));
    body.append('position_id', inputs.position_id ? String(inputs.position_id) : '');
    body.append('start_date', apiDate(inputs.start_date));
    body.append('basic_salary', String(Number(inputs.basic_salary) || 0));
    body.append('bank_id', inputs.bank_id ? String(inputs.bank_id) : '');
    body.append('bank_account_no', inputs.bank_id ? text(inputs.bank_account_no) : '');
    body.append('bank_account_name', inputs.bank_id ? text(inputs.bank_account_name) : '');
    body.append('province_id', inputs.province_id ? String(inputs.province_id) : '');
    body.append('district_id', inputs.district_id ? String(inputs.district_id) : '');
    body.append('village', text(inputs.village));
    body.append('description', text(inputs.description));
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
  const currentCv = data?.documents.filter((d) => CV_NAME.test(d.original_name)).at(-1);

  const personalDone = !!String(inputs.first_name).trim();
  const workDone = !!inputs.department_id;
  const bankDone = !!inputs.bank_id && !!String(inputs.bank_account_no).trim();
  const addressDone = !!inputs.province_id;

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
                <InputField name="phone" label={t('hrPhone')} required={false} icon={<i className="fa-solid fa-phone" />} placeholder="020 xxxx xxxx" />
                <InputField name="email" label={t('hrEmail')} required={false} icon={<i className="fa-solid fa-envelope" />} placeholder="name@example.com" />
              </div>
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 2: ວຽກ ---- */}
          <FormStep no={2} done={workDone} title={t('hrWork')} hint={t('hrWorkHint')}>
            <PickerField name="department_id" label={t('hrDepartment')} data={departmentOptions} placeholder={t('select')} cleanable={false}
              locale={{ noResultsText: t('hrNoDepartmentYet') }}
            />
            <PickerField name="position_id" label={t('hrPosition')} data={positionOptions} required={false}
              placeholder={inputs.department_id ? t('select') : t('hrPickDepartmentFirst')} disabled={!inputs.department_id}
              locale={{ noResultsText: t('hrNoPositions') }}
            />
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
              required={false} placeholder={inputs.province_id ? t('select') : t('hrPickProvinceFirst')} disabled={!inputs.province_id}
            />
            <div className="is-wide">
              <InputField name="village" label={t('hrVillage')} required={false} icon={<i className="fa-solid fa-location-dot" />} />
            </div>
            <div className="is-wide">
              <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 5: CV (ອັບໂຫຼດຫຼັງບັນທຶກພະນັກງານ) ---- */}
          <FormStep no={5} done={!!cv || !!currentCv} title={t('hrCv')} hint={t('hrCvHint')}>
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
