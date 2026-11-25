import { useRef, useState } from 'react';
import { DatePicker, Form, NumberInput } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { putApi } from '../../utils/configApi';
import { InputField } from '../../utils/inputFields';
import { useT } from '../../context/LanguageContext';
import { ChoiceTiles, FormStep, SettingModal, ToggleField } from '../account/setting/settingKit';
import { fromApiDate, runSave, toApiDate } from '../account/setting/settingApi';
import type { ModuleCode } from '../account/companyPlan';
import { ModulePicker } from './platformKit';
import { extendFrom, numberOrNull, type PlatformCompany, type PlatformModule, type PlatformPackage } from './platformApi';

/** ຄ່າຂອງ ChoiceTiles: ລະຫັດແພັກເກດ ຫຼື 0 = ທຸກໂມດູນ (ບໍ່ມີແພັກເກດ) */
const ALL = 0;

/**
 * ແພັກເກດຂອງບໍລິສັດ (PUT /platform/company/:id/plan) — 3 ຂັ້ນ: ແພັກເກດ, ໄລຍະໃຊ້ງານ (ວັນໝົດອາຍຸ / ທົດລອງ),
 * ໂມດູນເພີ່ມ + ຈຳນວນສະເພາະບໍລິສັດ (ພັບໄວ້)
 */
const PlatformPlanForm = ({ company, packages, modules, onClose, onSaved }: {
  company: PlatformCompany;
  packages: PlatformPackage[];
  modules: PlatformModule[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [packageId, setPackageId] = useState<number>(company.package_id ?? ALL);
  const [trial, setTrial] = useState(Number(company.plan_trial) === 1);
  const [addons, setAddons] = useState<ModuleCode[]>(company.plan_addons ?? []);
  const [extraOpen, setExtraOpen] = useState(!!(company.plan_addons?.length || company.plan_max_users !== null || company.plan_max_employees !== null));
  const [inputs, setInputs] = useState<any>({
    expires_at: fromApiDate(company.plan_expires_at),
    max_users: company.plan_max_users ?? '',
    max_employees: company.plan_max_employees ?? '',
  });

  // ແພັກເກດທີ່ຍັງຂາຍ + ອັນທີ່ບໍລິສັດຖືຢູ່ (ເຖິງເຊົາຂາຍແລ້ວ)
  const choices = packages.filter((p) => Number(p.status) === 1 || p._uuid === company.package_id);
  const chosen = packages.find((p) => p._uuid === packageId) ?? null;
  const included = chosen ? chosen.modules : modules.map((m) => m.code);
  const expires: Date | null = inputs.expires_at;
  const extend = (amount: number, unit: 'month' | 'year') => setInputs({ ...inputs, expires_at: extendFrom(expires, amount, unit) });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const body = {
      package_id: packageId === ALL ? null : packageId,
      expires_at: toApiDate(expires),
      trial,
      addons: packageId === ALL ? [] : addons.filter((code) => !included.includes(code)),
      max_users: numberOrNull(inputs.max_users),
      max_employees: numberOrNull(inputs.max_employees),
    };
    if (await runSave(() => putApi(`/platform/company/${company._uuid}/plan`, body), setSaving)) {
      onSaved();
      onClose();
    }
  };

  const daysText = expires
    ? `${moment(expires).format('DD/MM/YYYY')} · ${t('planDaysLeft').replace('{n}', String(moment(expires).startOf('day').diff(moment().startOf('day'), 'days')))}`
    : t('planNoExpiry');

  return (
    <SettingModal title={`${t('platPlanEdit')} · ${company.name_la}`} hint={t('platPlanHint')} icon="fa-box-open" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide
    >
      <Form fluid ref={formRef} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done title={t('platStepPackage')} hint={t('platStepPackageHint')}>
          <ChoiceTiles<number> className="is-wide" label={t('planPackage')} value={packageId} onChange={setPackageId}
            options={[
              ...choices.map((p) => ({
                value: p._uuid, label: p.name_la, icon: 'fa-box',
                hint: `${p.modules.length} ${t('platModulesUnit')}${Number(p.status) === 1 ? '' : ` · ${t('platRetired')}`}`,
              })),
              { value: ALL, label: t('planAllModules'), icon: 'fa-infinity', hint: t('platAllHint') },
            ]}
          />
        </FormStep>

        <FormStep no={2} done title={t('platStepPeriod')} hint={daysText}>
          <InputField name="expires_at" label={t('platExpiresAt')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false}
            placeholder={t('planNoExpiry')}
          />
          <ToggleField label={t('planTrial')} checked={trial} onChange={setTrial} onText={t('platTrialOn')} offText={t('platTrialOff')} />
          <div className="is-wide plat-quick">
            <button type="button" className="acc-rp-btn" onClick={() => extend(1, 'month')}><i className="fa-solid fa-plus" /> {t('platAddMonth')}</button>
            <button type="button" className="acc-rp-btn" onClick={() => extend(3, 'month')}><i className="fa-solid fa-plus" /> {t('platAdd3Months')}</button>
            <button type="button" className="acc-rp-btn" onClick={() => extend(1, 'year')}><i className="fa-solid fa-plus" /> {t('platAddYear')}</button>
            <button type="button" className="acc-rp-btn" onClick={() => setInputs({ ...inputs, expires_at: null })}><i className="fa-solid fa-infinity" /> {t('planNoExpiry')}</button>
          </div>
        </FormStep>

        <FormStep no={3} done={extraOpen} title={t('platStepExtra')} hint={t('platStepExtraHint')}
          collapsed={!extraOpen} onToggle={() => setExtraOpen((v) => !v)}
          summary={addons.length ? `${addons.length} ${t('platModulesUnit')}` : t('platNoExtra')}
        >
          <ModulePicker modules={modules} value={addons} onChange={setAddons} included={included} disabled={packageId === ALL} />
          <InputField name="max_users" label={t('platMaxUsers')} accepter={NumberInput} required={false} controls={false}
            placeholder={`${t('platFromPackage')}: ${chosen?.max_users ?? '∞'}`}
          />
          <InputField name="max_employees" label={t('platMaxEmployees')} accepter={NumberInput} required={false} controls={false}
            placeholder={`${t('platFromPackage')}: ${chosen?.max_employees ?? '∞'}`}
          />
        </FormStep>
      </Form>
    </SettingModal>
  );
};

export default PlatformPlanForm;
