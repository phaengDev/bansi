import { useRef, useState } from 'react';
import { DatePicker, Form, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { postApi } from '../../utils/configApi';
import { InputField, newPasswordProps } from '../../utils/inputFields';
import { createModel, requiredField } from '../../utils/validate';
import { useT } from '../../context/LanguageContext';
import { ChoiceTiles, FormStep, SettingModal } from '../account/setting/settingKit';
import { runSave, toApiDate } from '../account/setting/settingApi';
import type { PlatformPackage } from './platformApi';

/** ທາງເລືອກແພັກເກດຕອນສ້າງ: 'trial' = ທົດລອງ 14 ມື້ (ແພັກເກດສູງສຸດ), 'all' = ທຸກໂມດູນ, ຕົວເລກ = ແພັກເກດນັ້ນ */
type PlanChoice = 'trial' | 'all' | number;
const PHONE = /^\d{6,20}$/;
const { StringType } = Schema.Types;

/**
 * ເພີ່ມບໍລິສັດ (POST /platform/company) — 3 ຂັ້ນ: ບໍລິສັດ, ແພັກເກດ, ຜູ້ດູແລຄົນທຳອິດ (ລະດັບສູງສຸດ, ສິດເຕັມ).
 * ລະບົບສ້າງເມນູ, ຕັ້ງຄ່າບັນຊີ ແລະ ຜັງບັນຊີເລີ່ມຕົ້ນໃຫ້ບໍລິສັດໃໝ່ເອງ
 */
const PlatformCompanyForm = ({ packages, onClose, onSaved }: {
  packages: PlatformPackage[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<PlanChoice>('trial');
  const [inputs, setInputs] = useState<any>({
    name_la: '', name_en: '', phone1: '', expires_at: null, user_name: 'admin', phones: '', password: '',
  });
  const model = createModel<any>({
    name_la: requiredField(t('inputRequired'), 'string'),
    phones: StringType().isRequired(t('inputRequired')).pattern(PHONE, t('platPhoneRule')),
    password: StringType().isRequired(t('inputRequired')).minLength(6, t('platPasswordRule')),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const body: Record<string, unknown> = {
      name_la: String(inputs.name_la).trim(),
      name_en: String(inputs.name_en ?? '').trim(),
      phone1: String(inputs.phone1 ?? '').trim(),
      admin: { user_name: String(inputs.user_name ?? '').trim() || 'admin', phones: String(inputs.phones).replace(/[\s-]/g, ''), password: inputs.password },
    };
    // ບໍ່ສົ່ງ package_id = ທົດລອງໃຊ້ (backend)
    if (plan !== 'trial') {
      body.package_id = plan === 'all' ? null : plan;
      body.expires_at = toApiDate(inputs.expires_at);
    }
    if (await runSave(() => postApi('/platform/company', body), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('platCompanyAdd')} hint={t('platCompanyAddHint')} icon="fa-building-circle-check" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done={!!String(inputs.name_la).trim()} title={t('platStepCompany')} hint={t('platStepCompanyHint')}>
          <InputField name="name_la" label={t('hrCompanyNameLa')} icon={<i className="fa-solid fa-building" />} />
          <InputField name="name_en" label={t('hrCompanyNameEn')} required={false} icon={<i className="fa-solid fa-language" />} />
          <InputField name="phone1" label={t('hrPhone')} required={false} icon={<i className="fa-solid fa-phone" />} />
        </FormStep>

        <FormStep no={2} done title={t('platStepPackage')} hint={t('platStepPackageNewHint')}>
          <ChoiceTiles<PlanChoice> className="is-wide" label={t('planPackage')} value={plan} onChange={setPlan}
            options={[
              { value: 'trial', label: t('planTrial'), icon: 'fa-flask', hint: t('platTrialHint') },
              ...packages.filter((p) => Number(p.status) === 1).map((p) => ({ value: p._uuid, label: p.name_la, icon: 'fa-box', hint: p.code })),
              { value: 'all', label: t('planAllModules'), icon: 'fa-infinity', hint: t('platAllHint') },
            ]}
          />
          {plan !== 'trial' && (
            <InputField name="expires_at" label={t('platExpiresAt')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false}
              placeholder={t('planNoExpiry')}
            />
          )}
        </FormStep>

        <FormStep no={3} done={PHONE.test(String(inputs.phones)) && String(inputs.password).length >= 6} title={t('platStepAdmin')} hint={t('platStepAdminHint')}>
          <InputField name="user_name" label={t('platAdminName')} required={false} icon={<i className="fa-solid fa-user-shield" />} />
          <InputField name="phones" label={t('platAdminPhone')} icon={<i className="fa-solid fa-mobile-screen" />} />
          <InputField name="password" label={t('platAdminPassword')} {...newPasswordProps} icon={<i className="fa-solid fa-key" />} />
        </FormStep>
      </Form>
    </SettingModal>
  );
};

export default PlatformCompanyForm;
