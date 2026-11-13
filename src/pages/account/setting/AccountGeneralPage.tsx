import { useEffect, useState } from 'react';
import { Button, Form, Input, Loader, NumberInput, Textarea, Toggle } from 'rsuite';
import moment from 'moment';
import { Notific } from '../../../utils/Notification';
import { canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ChoiceTiles, FormStep } from './settingKit';
import { runSave } from './settingApi';
import {
  refreshAccountSetting, saveAccountSetting, useAccountSetting, useAccountSettingLoaded, type AccountSetting, type FeatureKey,
} from '../accountSettings';

/** ຟັງຊັນທີ່ເປີດ/ປິດໄດ້ — ບໍລິສັດທີ່ບໍ່ໃຊ້ ປິດໄວ້ ເມນູ/ໜ້າຂອງມັນຈະບໍ່ຂຶ້ນ */
const FEATURES: { key: FeatureKey; icon: string; title: string; hint: string }[] = [
  { key: 'use_vat', icon: 'fa-receipt', title: 'acgVat', hint: 'acgVatHint' },
  { key: 'use_fixed_assets', icon: 'fa-building', title: 'acgFixedAssets', hint: 'acgFixedAssetsHint' },
  { key: 'use_bank_reconciliation', icon: 'fa-scale-unbalanced-flip', title: 'acgBankRec', hint: 'acgBankRecHint' },
  { key: 'use_withholding', icon: 'fa-hand-holding-dollar', title: 'acgWithholding', hint: 'acgWithholdingHint' },
  { key: 'use_fx_revaluation', icon: 'fa-arrow-right-arrow-left', title: 'acgFxReval', hint: 'acgFxRevalHint' },
];

/** ນະໂຍບາຍບັນຊີຕົວຢ່າງ — ກົດປຸ່ມແລ້ວເຕີມໃສ່ຊ່ອງ ໃຫ້ແກ້ຕໍ່ໄດ້ */
export const POLICY_TEMPLATE_KEY = 'acgPolicyTemplate';

const Field = ({ label, children, hint, wide }: { label: string; children: React.ReactNode; hint?: string; wide?: boolean }) => (
  <div className={`rs-form-group${wide ? ' is-wide' : ''}`}>
    <label className="form-label">{label}</label>
    {children}
    {hint && <small className="pay-field-hint">{hint}</small>}
  </div>
);

/**
 * ຕັ້ງຄ່າທົ່ວໄປຂອງບັນຊີ — ຂໍ້ມູນຫົວ/ຜູ້ເຊັນງົບການເງິນ (ກົດໝາຍບັນຊີ ມາດຕາ 20), ຮູບແບບຕົວເລກ (ມາດຕາ 7),
 * ຟັງຊັນທີ່ບໍລິສັດໃຊ້, ອັດຕາອາກອນກຳໄລ ແລະ ນະໂຍບາຍບັນຊີ (ບົດອະທິບາຍງົບການເງິນ)
 */
const AccountGeneralPage = () => {
  const t = useT();
  const loaded = useAccountSettingLoaded();
  const current = useAccountSetting();
  const [values, setValues] = useState<AccountSetting | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshAccountSetting();
  }, []);
  useEffect(() => {
    if (loaded && !values) setValues(current);
  }, [loaded, current, values]);

  if (!values) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const set = <K extends keyof AccountSetting>(key: K, value: AccountSetting[K]) => setValues({ ...values, [key]: value });
  const on = (key: FeatureKey) => Number(values[key]) === 1;
  const dirty = JSON.stringify(values) !== JSON.stringify(current);

  const submit = () =>
    runSave(async () => {
      const { lock_date: _lock, ...patch } = values;
      await saveAccountSetting(patch);
      if (values.number_format !== current.number_format) Notific.warning('acgNumberReopen');
    }, setSaving);

  return (
    <div className="acs-page hr-company pay-settings">
      <Form fluid className="acc-book-main">
        <div className="pay-settings-grid">
          <div className="pay-settings-col">
            <FormStep no={1} done={!!(values.chief_accountant && values.director)} title={t('acgSigners')} hint={t('acgSignersHint')}>
              <Field label={t('acgTaxId')} wide>
                <Input value={values.tax_id ?? ''} onChange={(v) => set('tax_id', v)} disabled={!canEdit} placeholder="xxx-xxx-xxx" />
              </Field>
              <Field label={t('acgChiefAccountant')}>
                <Input value={values.chief_accountant ?? ''} onChange={(v) => set('chief_accountant', v)} disabled={!canEdit} />
              </Field>
              <Field label={t('acgDirector')}>
                <Input value={values.director ?? ''} onChange={(v) => set('director', v)} disabled={!canEdit} />
              </Field>
            </FormStep>

            <FormStep no={2} done title={t('acgNumberFormat')} hint={t('acgNumberFormatHint')}>
              <ChoiceTiles<1 | 2>
                className="is-wide"
                label={t('acgNumberFormat')}
                value={values.number_format}
                disabled={!canEdit}
                onChange={(v) => set('number_format', v)}
                options={[
                  { value: 1, label: '1,250,000.50', hint: t('acgNumberComma'), icon: 'fa-globe' },
                  { value: 2, label: '1.250.000,50', hint: t('acgNumberDot'), icon: 'fa-scale-balanced' },
                ]}
              />
            </FormStep>

            <FormStep no={3} done title={t('acgProfitTax')} hint={t('acgProfitTaxHint')}>
              <Field label={t('acgProfitTaxRate')}>
                <NumberInput value={Number(values.profit_tax_rate)} onChange={(v) => set('profit_tax_rate', Number(v) || 0)}
                  postfix="%" min={0} max={100} step={0.5} disabled={!canEdit}
                />
              </Field>
            </FormStep>
          </div>

          <div className="pay-settings-col">
            <FormStep no={4} done title={t('acgFeatures')} hint={t('acgFeaturesHint')}>
              {FEATURES.map((f) => (
                <label key={f.key} className={`is-wide pay-policy-row${on(f.key) ? ' is-on' : ''}`}>
                  <Toggle checked={on(f.key)} onChange={(checked) => set(f.key, checked ? 1 : 0)} disabled={!canEdit} />
                  <span>
                    <b><i className={`fa-solid ${f.icon}`} /> {t(f.title)}</b>
                    <small>{t(f.hint)}</small>
                  </span>
                  <em>{t(on(f.key) ? 'acgOn' : 'acgOff')}</em>
                </label>
              ))}
            </FormStep>

            <FormStep no={5} done={!!values.policies} title={t('acgPolicies')} hint={t('acgPoliciesHint')}
              note={canEdit && (
                <button type="button" className="acc-rp-btn" onClick={() => set('policies', t(POLICY_TEMPLATE_KEY))}>
                  <i className="fa-solid fa-wand-magic-sparkles" /> {t('acgPolicyUseTemplate')}
                </button>
              )}
            >
              <Field label={t('acgPolicies')} wide>
                <Textarea rows={10} value={values.policies ?? ''} onChange={(v) => set('policies', v)} disabled={!canEdit}
                  placeholder={t(POLICY_TEMPLATE_KEY)}
                />
              </Field>
            </FormStep>
          </div>
        </div>

        <div className="hr-company-bar">
          <span>
            {values.lock_date
              ? <><i className="fa-solid fa-lock" /> {t('acgLockedThrough')} {moment(values.lock_date).format('DD/MM/YYYY')}</>
              : <><i className="fa-solid fa-circle-info" /> {t('acgSavedNote')}</>}
          </span>
          <span className="hr-company-actions">
            <Button appearance="default" className="hr-company-cancel" disabled={!dirty || saving} onClick={() => setValues(current)}>
              <i className="fa-solid fa-arrow-rotate-left" /> {t('cancel')}
            </Button>
            <Button appearance="primary" className="hr-company-save" loading={saving} disabled={!canEdit || !dirty} onClick={submit}>
              <i className="fa-solid fa-check" /> {t('save')}
            </Button>
          </span>
        </div>
      </Form>
    </div>
  );
};

export default AccountGeneralPage;
