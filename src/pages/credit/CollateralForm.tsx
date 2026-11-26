import { useMemo, useRef, useState } from 'react';
import { DatePicker, Form, NumberInput, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../utils/configApi';
import { InputField } from '../../utils/inputFields';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { ChoiceTiles, FormStep, SettingModal } from '../account/setting/settingKit';
import { runSave } from '../account/setting/settingApi';
import { COLLATERAL_TYPES, type Collateral } from './creditApi';

const { StringType, NumberType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const toKey = (d: Date | null | undefined) => (d ? moment(d).format('YYYY-MM-DD') : null);
const toDate = (s: string | null | undefined) => (s ? moment(s, 'YYYY-MM-DD').toDate() : null);

/** ຊື່ຊ່ອງເລກເອກະສານ ຕາມປະເພດຫຼັກຊັບ (ໃບຕາດິນ, ທະບຽນລົດ …) */
const DOC_LABEL: Record<number, string> = { 1: 'crDocLand', 2: 'crDocLand', 3: 'crDocVehicle', 4: 'crDocGold', 5: 'crDocDeposit' };

/**
 * ຫຼັກຊັບຄ້ຳປະກັນ — 1 ປະເພດ/ລາຍລະອຽດ/ເອກະສານ, 2 ມູນຄ່າ (ຕະຫຼາດ / ປະເມີນ — LTV ໃຊ້ມູນຄ່າປະເມີນ), 3 ການເກັບຮັກສາ.
 * ຫຼັກຊັບເປັນຂອງລູກຄ້າ — ເລືອກໃຊ້ຄ້ຳຄຳຮ້ອງໃດກໍ່ໄດ້ (ຄັ້ງລະໜຶ່ງ)
 */
const CollateralForm = ({ customerId, row, onClose, onSaved }: {
  customerId: number;
  row: Collateral | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [type, setType] = useState(row?.collateral_type ?? 1);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>(() => ({
    description: row?.description ?? '',
    document_no: row?.document_no ?? '',
    owner_name: row?.owner_name ?? '',
    location: row?.location ?? '',
    market_value: row?.market_value || null,
    appraised_value: row?.appraised_value || null,
    appraisal_date: toDate(row?.appraisal_date) ?? new Date(),
    appraiser: row?.appraiser ?? '',
    insurance_expiry: toDate(row?.insurance_expiry),
    storage: row?.storage ?? '',
    received_date: toDate(row?.received_date) ?? new Date(),
    note: row?.note ?? '',
  }));
  const market = num(inputs.market_value);
  const appraised = num(inputs.appraised_value);
  const haircut = market > 0 && appraised > 0 ? Math.round((1 - appraised / market) * 100) : null;

  const model = useMemo(() => Schema.Model<any>({
    description: StringType().isRequired(t('inputRequired')),
    appraised_value: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0.01, t('crAppraisedPositive')),
  }), [t]);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs, customer_id: customerId, collateral_type: type,
      market_value: market, appraised_value: appraised,
      appraisal_date: toKey(inputs.appraisal_date), insurance_expiry: toKey(inputs.insurance_expiry), received_date: toKey(inputs.received_date),
    };
    let id = row?._uuid ?? 0;
    const ok = await runSave(async () => {
      const res = row ? await putApi(`/credit/collateral/${row._uuid}`, payload) : await postApi('/credit/collateral', payload);
      id = res.data?.data?._uuid ?? id;
    }, setSaving);
    if (ok) {
      onSaved(id);
      onClose();
    }
  };

  const date = (name: string, label: string) => (
    <InputField name={name} label={label} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} />
  );

  return (
    <SettingModal title={t(row ? 'crCollateralEdit' : 'crCollateralAdd')} hint={t('crCollateralHint')} icon="fa-house-lock" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done={!!String(inputs.description).trim()} title={t('crStepCollateral')} hint={t('crStepCollateralHint')}>
          <ChoiceTiles<number> className="is-wide" label={t('crCollateralType')} value={type} onChange={setType}
            options={COLLATERAL_TYPES.map((c) => ({ value: c.value, label: t(c.label), icon: c.icon }))}
          />
          <div className="is-wide">
            <InputField name="description" label={t('crCollateralDesc')} placeholder={t(`${COLLATERAL_TYPES.find((c) => c.value === type)?.label ?? 'crColOther'}Placeholder`)}
              icon={<i className={`fa-solid ${COLLATERAL_TYPES.find((c) => c.value === type)?.icon ?? 'fa-box'}`} />}
            />
          </div>
          <InputField name="document_no" label={t(DOC_LABEL[type] ?? 'crDocNo')} required={false} icon={<i className="fa-solid fa-file-contract" />} />
          <InputField name="owner_name" label={t('crOwnerName')} required={false} icon={<i className="fa-solid fa-user-tag" />} />
          <div className="is-wide">
            <InputField name="location" label={t('crLocation')} required={false} icon={<i className="fa-solid fa-location-dot" />} />
          </div>
        </FormStep>

        <FormStep no={2} done={appraised > 0} title={t('crStepValue')} hint={t('crStepValueHint')}>
          <div className="acc-fa-money">
            <InputField name="market_value" label={t('crMarketValue')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} prefix="₭" />
          </div>
          <div className="acc-fa-money">
            <InputField name="appraised_value" label={t('crAppraisedValue')} accepter={NumberInput} formatter={amountFormatter} controls={false} prefix="₭" />
          </div>
          {date('appraisal_date', t('crAppraisalDate'))}
          <InputField name="appraiser" label={t('crAppraiser')} required={false} icon={<i className="fa-solid fa-user-tie" />} />
          {haircut !== null && haircut > 0 && (
            <p className="is-wide acc-gl-hint"><i className="fa-solid fa-scissors" /> {t('crHaircut').replace('{p}', String(haircut))}</p>
          )}
        </FormStep>

        <FormStep no={3} done title={t('crStepStorage')} hint={t('crStepStorageHint')}>
          {date('received_date', t('crReceivedDate'))}
          <InputField name="storage" label={t('crStorage')} required={false} icon={<i className="fa-solid fa-vault" />} />
          {date('insurance_expiry', t('crInsuranceExpiry'))}
          <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
        </FormStep>
      </Form>
    </SettingModal>
  );
};

export default CollateralForm;
