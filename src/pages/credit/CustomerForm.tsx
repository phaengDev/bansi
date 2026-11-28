import { useMemo, useRef, useState } from 'react';
import { DatePicker, Form, NumberInput, Schema, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../utils/configApi';
import { InputField } from '../../utils/inputFields';
import NameWithGenderField from '../../components/Elements/NameWithGenderField';
import { useDistricts, useEmployees, useProvinces } from '../../utils/selectOption';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { AutoCodeField, ChoiceTiles, FormStep, PickerField, SettingModal } from '../account/setting/settingKit';
import { runSave } from '../account/setting/settingApi';
import { ID_TYPES, RISK_LEVELS, type CreditCustomer } from './creditApi';

const { StringType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const toKey = (d: Date | null | undefined) => (d ? moment(d).format('YYYY-MM-DD') : null);
const toDate = (s: string | null | undefined) => (s ? moment(s, 'YYYY-MM-DD').toDate() : null);
const PERSON = 1;
const COMPANY = 2;

type Inputs = Record<string, any>;

/**
 * ຟອມລູກຄ້າສິນເຊື່ອ (KYC) — 1 ຕົວຕົນ, 2 ເອກະສານ, 3 ຕິດຕໍ່/ທີ່ຢູ່, 4 ຄອບຄົວ/ລາຍຮັບ, 5 ສິນເຊື່ອ (ວົງເງິນ, ຄວາມສ່ຽງ, ບັນຊີດຳ).
 * ເລກບັດຊ້ຳກັບລູກຄ້າຄົນອື່ນ = backend ບໍ່ໃຫ້ບັນທຶກ (ກັນລູກຄ້າຊ້ຳ)
 */
const CustomerForm = ({ row, nextCode, onClose, onSaved }: {
  row: CreditCustomer | null;
  nextCode: string;
  onClose: () => void;
  onSaved: (id: number) => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [type, setType] = useState(row?.customer_type ?? PERSON);
  const [gender, setGender] = useState<number>(row?.gender ?? 1);
  const [idType, setIdType] = useState(row?.id_type ?? 1);
  const [marital, setMarital] = useState<number>(row?.marital_status ?? 1);
  const [risk, setRisk] = useState(row?.risk_level ?? 1);
  const [blacklisted, setBlacklisted] = useState(Number(row?.blacklisted) === 1);
  const [active, setActive] = useState(row ? Number(row.status) === 1 : true);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Inputs>(() => ({
    full_name: row?.full_name ?? '',
    name_en: row?.name_en ?? '',
    nationality: row?.nationality ?? 'ລາວ',
    birth_date: toDate(row?.birth_date),
    id_no: row?.id_no ?? '',
    id_issue_date: toDate(row?.id_issue_date),
    id_expiry_date: toDate(row?.id_expiry_date),
    tax_number: row?.tax_number ?? '',
    phone: row?.phone ?? '',
    phone2: row?.phone2 ?? '',
    email: row?.email ?? '',
    province_id: row?.province_id ?? null,
    district_id: row?.district_id ?? null,
    village: row?.village ?? '',
    address: row?.address ?? '',
    spouse_name: row?.spouse_name ?? '',
    spouse_id_no: row?.spouse_id_no ?? '',
    occupation: row?.occupation ?? '',
    workplace: row?.workplace ?? '',
    monthly_income: row?.monthly_income ?? null,
    monthly_expense: row?.monthly_expense ?? null,
    credit_limit: row?.credit_limit || null,
    officer_id: row?.officer_id ?? null,
    blacklist_reason: row?.blacklist_reason ?? '',
    note: row?.note ?? '',
  }));
  const provinces = useProvinces();
  const districts = useDistricts(inputs.province_id);
  const employees = useEmployees();
  const person = type === PERSON;
  const income = num(inputs.monthly_income);
  const spare = income - num(inputs.monthly_expense);
  const idExpired = inputs.id_expiry_date && moment(inputs.id_expiry_date).isBefore(moment(), 'day');

  const model = useMemo(() => Schema.Model<any>({
    full_name: StringType().isRequired(t('inputRequired')),
    phone: StringType().isRequired(t('inputRequired')),
    ...(blacklisted ? { blacklist_reason: StringType().isRequired(t('crBlacklistReasonRequired')) } : {}),
  }), [blacklisted, t]);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      customer_type: type, gender: person ? gender : null, id_type: idType, marital_status: person ? marital : null,
      birth_date: toKey(inputs.birth_date), id_issue_date: toKey(inputs.id_issue_date), id_expiry_date: toKey(inputs.id_expiry_date),
      monthly_income: num(inputs.monthly_income), monthly_expense: num(inputs.monthly_expense), credit_limit: num(inputs.credit_limit),
      risk_level: risk, blacklisted: blacklisted ? 1 : 0, status: active ? 1 : 0,
    };
    let id = row?._uuid ?? 0;
    const ok = await runSave(async () => {
      const res = row ? await putApi(`/credit/customer/${row._uuid}`, payload) : await postApi('/credit/customer', payload);
      id = res.data?.data?._uuid ?? id;
    }, setSaving);
    if (ok) {
      onSaved(id);
      onClose();
    }
  };

  const date = (name: string, label: string, extra: Record<string, unknown> = {}) => (
    <InputField name={name} label={label} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} {...extra} />
  );

  return (
    <SettingModal title={t(row ? 'crCustomerEdit' : 'crCustomerAdd')} hint={t('crCustomerHint')} icon="fa-address-card" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide
    >
      <Form fluid ref={formRef} model={model} formValue={inputs}
        onChange={(next) => setInputs(next.province_id !== inputs.province_id ? { ...next, district_id: null } : next)}
      >
        <FormStep no={1} done={!!String(inputs.full_name).trim()} title={t('crStepIdentity')} hint={t('crStepIdentityHint')}>
          <ChoiceTiles<number> className="is-wide" label={t('crCustomerType')} value={type} onChange={(v) => { setType(v); if (v === COMPANY) setIdType(4); }}
            options={[
              { value: PERSON, label: t('crBorrowerPerson'), icon: 'fa-user' },
              { value: COMPANY, label: t('crBorrowerCompany'), icon: 'fa-building' },
            ]}
          />
          <div className="is-wide acs-code-name">
            <AutoCodeField label={t('faCode')} code={row?.customer_code ?? nextCode} locked={!!row} autoText={t('crCodeAuto')} lockedText={t('crCodeLocked')} compact />
            {person ? (
              // ເພດເລືອກຢູ່ທາງໜ້າຊ່ອງຊື່ (ຄືຟອມພະນັກງານ)
              <NameWithGenderField name="full_name" label={`${t('crGender')} · ${t('crFullName')}`} placeholder={t('crFullNamePlaceholder')}
                gender={gender} onGender={setGender}
              />
            ) : (
              <InputField name="full_name" label={t('crCompanyName')} placeholder={t('crCompanyNamePlaceholder')} icon={<i className="fa-solid fa-building" />} />
            )}
          </div>
          <InputField name="name_en" label={t('crNameEn')} required={false} icon={<i className="fa-solid fa-language" />} />
          {person && <InputField name="nationality" label={t('crNationality')} required={false} icon={<i className="fa-solid fa-flag" />} />}
          {person ? date('birth_date', t('crBirthDate'), { shouldDisableDate: (d: Date) => moment(d).isAfter(moment(), 'day') }) : (
            <InputField name="tax_number" label={t('crTaxNumber')} required={false} icon={<i className="fa-solid fa-receipt" />} />
          )}
        </FormStep>

        <FormStep no={2} done={!!String(inputs.id_no).trim()} title={t('crStepDocument')} hint={t('crStepDocumentHint')}
          note={idExpired && <span className="text-danger"><i className="fa-solid fa-triangle-exclamation" /> {t('crIdExpired')}</span>}
        >
          <ChoiceTiles<number> className="is-wide" label={t('crIdType')} value={idType} onChange={setIdType}
            options={ID_TYPES.map((x) => ({ value: x.value, label: t(x.label) }))}
          />
          <div className="is-wide">
            <InputField name="id_no" label={t('crIdNo')} required={false} icon={<i className="fa-solid fa-id-card" />} />
          </div>
          {date('id_issue_date', t('crIdIssue'))}
          {date('id_expiry_date', t('crIdExpiry'))}
        </FormStep>

        <FormStep no={3} done={!!String(inputs.phone).trim()} title={t('crStepContact')} hint={t('crStepContactHint')}>
          <InputField name="phone" label={t('phone')} icon={<i className="fa-solid fa-phone" />} />
          <InputField name="phone2" label={t('crPhone2')} required={false} icon={<i className="fa-solid fa-phone-volume" />} />
          <PickerField name="province_id" label={t('hrProvince')} data={provinces} required={false} placeholder={t('select')} />
          <PickerField name="district_id" label={t('hrDistrict')} data={districts} required={false} disabled={!inputs.province_id}
            placeholder={inputs.province_id ? t('select') : t('hrPickProvinceFirst')}
          />
          <InputField name="village" label={t('hrVillage')} required={false} icon={<i className="fa-solid fa-house" />} />
          <InputField name="email" label={t('email')} required={false} icon={<i className="fa-solid fa-envelope" />} />
          <div className="is-wide">
            <InputField name="address" label={t('crAddressMore')} required={false} icon={<i className="fa-solid fa-location-dot" />} />
          </div>
        </FormStep>

        <FormStep no={4} done={income > 0} title={t(person ? 'crStepIncome' : 'crStepBusiness')} hint={t('crStepIncomeHint')}>
          {person && (
            <ChoiceTiles<number> className="is-wide" label={t('crMarital')} value={marital} onChange={setMarital}
              options={[1, 2, 3, 4].map((v) => ({ value: v, label: t(`crMarital${v}`) }))}
            />
          )}
          {person && marital === 2 && (
            <>
              <InputField name="spouse_name" label={t('crSpouseName')} required={false} icon={<i className="fa-solid fa-user-group" />} />
              <InputField name="spouse_id_no" label={t('crSpouseId')} required={false} icon={<i className="fa-solid fa-id-card" />} />
            </>
          )}
          <InputField name="occupation" label={t(person ? 'crOccupation' : 'crBusinessType')} required={false} icon={<i className="fa-solid fa-briefcase" />} />
          <InputField name="workplace" label={t(person ? 'crWorkplace' : 'crBusinessPlace')} required={false} icon={<i className="fa-solid fa-building" />} />
          <div className="acc-fa-money">
            <InputField name="monthly_income" label={t('crMonthlyIncome')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} prefix="₭" />
          </div>
          <div className="acc-fa-money">
            <InputField name="monthly_expense" label={t('crMonthlyExpense')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} prefix="₭" />
          </div>
          {income > 0 && (
            <p className={`is-wide acc-gl-hint${spare <= 0 ? ' is-warn' : ''}`}>
              <i className="fa-solid fa-wallet" /> {t('crSpareIncome')} <b>₭ {spare.toLocaleString('en-US')}</b>
            </p>
          )}
        </FormStep>

        <FormStep no={5} done title={t('crStepCredit')} hint={t('crStepCreditHint')}>
          <div className="acc-fa-money">
            <InputField name="credit_limit" label={t('crCreditLimit')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} prefix="₭"
              placeholder={t('crNoLimit')}
            />
          </div>
          <PickerField name="officer_id" label={t('crOfficer')} data={employees} required={false} placeholder={t('select')} />
          <ChoiceTiles<number> className="is-wide" label={t('crRisk')} value={risk} onChange={setRisk}
            options={RISK_LEVELS.map((r) => ({ value: r.value, label: t(r.label) }))}
          />
          <div className="rs-form-group">
            <label className="form-label">{t('crBlacklist')}</label>
            <div className={`acs-toggle-field${blacklisted ? ' is-danger' : ''}`}>
              <Toggle checked={blacklisted} onChange={setBlacklisted} />
              <span>{t(blacklisted ? 'crBlacklistOn' : 'crBlacklistOff')}</span>
            </div>
          </div>
          {row && (
            <div className="rs-form-group">
              <label className="form-label">{t('status')}</label>
              <div className={`acs-toggle-field${active ? ' is-on' : ''}`}>
                <Toggle checked={active} onChange={setActive} />
                <span>{t(active ? 'active' : 'inactive')}</span>
              </div>
            </div>
          )}
          {blacklisted && (
            <div className="is-wide">
              <InputField name="blacklist_reason" label={t('crBlacklistReason')} icon={<i className="fa-solid fa-ban" />} />
            </div>
          )}
          <div className="is-wide">
            <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

export default CustomerForm;
