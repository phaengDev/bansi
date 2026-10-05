import { useRef, useState } from 'react';
import { DatePicker, Form, NumberInput, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { formatNumber } from '../../../utils/configApi';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ChoiceTiles, FormSection, ListState, MetaChip, SettingCard, SettingModal, SettingToolbar, ToggleField } from './settingKit';
import { fromApiDate, postfixProp, runSave, saveSetting, toApiDate, useSettingList, useStatusToggle } from './settingApi';

type Tax = {
  _uuid: number;
  tax_code: string;
  name: string;
  rate: string | number;
  tax_kind: number;
  calc_method: number;
  is_default: number;
  effective_date?: string | null;
  description?: string;
  status: number;
};

/** tax_kind — 1 VAT, 2 ຫັກ ນ ບ່ອນຈ່າຍ, 3 ລາຍໄດ້/ກຳໄລ, 4 ອື່ນໆ */
const KINDS = [
  { value: 1, label: 'taxKindVat', icon: 'fa-receipt', tone: 'is-blue' },
  { value: 2, label: 'taxKindWht', icon: 'fa-hand-holding-dollar', tone: 'is-gold' },
  { value: 3, label: 'taxKindIncome', icon: 'fa-chart-line', tone: 'is-violet' },
  { value: 4, label: 'taxKindOther', icon: 'fa-percent', tone: 'is-sky' },
];
const kindOf = (value: number) => KINDS.find((k) => k.value === Number(value)) ?? KINDS[0];

/** ຍອດຕົວຢ່າງທີ່ໃຊ້ອະທິບາຍວິທີຄິດໄລ່ */
const SAMPLE = 1_000_000;

/**
 * ຄິດໄລ່ອາກອນ — calc_method 1 = ລາຄາລວມອາກອນແລ້ວ (ແຍກອາກອນອອກ), 2 = ບວກອາກອນເພີ່ມເທິງລາຄາ.
 * ຄືນ { base (ກ່ອນອາກອນ), tax, total }
 */
const calcTax = (amount: number, rate: number, method: number) => {
  if (method === 1) {
    const base = amount / (1 + rate / 100);
    return { base, tax: amount - base, total: amount };
  }
  const tax = (amount * rate) / 100;
  return { base: amount, tax, total: amount + tax };
};

const TaxExample = ({ rate, method }: { rate: number; method: number }) => {
  const t = useT();
  const r = calcTax(SAMPLE, rate, method);
  return (
    <div className="acs-example">
      <small>{t('taxExample')}</small>
      <span>{t('taxBase')} <b>{formatNumber(Math.round(r.base))}</b></span>
      <span>+ {t('taxAmount')} <b className="is-tax">{formatNumber(Math.round(r.tax))}</b></span>
      <span>= {t('total')} <b>{formatNumber(Math.round(r.total))}</b></span>
    </div>
  );
};

const TaxForm = ({ data, onClose, onSaved }: { data: Tax | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [isDefault, setIsDefault] = useState(data ? Number(data.is_default) === 1 : false);
  const [kind, setKind] = useState<number>(data?.tax_kind ?? 1);
  const [method, setMethod] = useState<number>(data?.calc_method ?? 2);
  const [inputs, setInputs] = useState<any>({
    tax_code: data?.tax_code ?? '',
    rate: Number(data?.rate ?? 0),
    name: data?.name ?? '',
    effective_date: fromApiDate(data?.effective_date),
    description: data?.description ?? '',
  });

  const model = createModel<any>({
    tax_code: requiredField(t('inputRequired'), 'string'),
    name: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      tax_code: String(inputs.tax_code).trim().toUpperCase(),
      rate: Number(inputs.rate) || 0,
      tax_kind: kind,
      calc_method: method,
      is_default: isDefault ? 1 : 0,
      effective_date: toApiDate(inputs.effective_date),
      ...(data ? {} : { status: 1 }),
    };
    if (await runSave(() => saveSetting('/tax', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'taxEdit' : 'taxAdd')} hint={t('taxHint')} icon="fa-percent" saving={saving} onClose={onClose} onSubmit={submit} wide>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide acs-code-name">
            <InputField name="tax_code" label={t('code')} placeholder="VAT10" className="acc-book-upper" />
            <InputField name="name" label={t('name')} />
          </div>
          <ChoiceTiles
            className="is-wide"
            label={t('taxKind')}
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({ value: k.value, label: t(k.label), icon: k.icon }))}
          />
          <ChoiceTiles
            className="is-wide"
            label={t('taxCalc')}
            value={method}
            onChange={setMethod}
            options={[
              { value: 2, label: t('taxExclusive'), icon: 'fa-plus' },
              { value: 1, label: t('taxInclusive'), icon: 'fa-equals' },
            ]}
          />
          <InputField name="rate" label={t('taxRate')} accepter={NumberInput} {...postfixProp('%')} />
          <InputField name="effective_date" label={t('taxEffective')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block required={false} />
          <div className="is-wide"><TaxExample rate={Number(inputs.rate) || 0} method={method} /></div>
          <div className="is-wide">
            <ToggleField label={t('taxDefault')} checked={isDefault} onChange={setIsDefault} onText={`${t('taxDefault')} · ${t('taxDefaultHint')}`} offText={t('taxNotDefault')} />
          </div>
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ອາກອນ — ອັດຕາ, ປະເພດ ແລະ ວິທີຄິດໄລ່ (ລວມໃນລາຄາ / ບວກເພີ່ມ). ອາກອນທີ່ຕັ້ງເປັນຄ່າເລີ່ມຕົ້ນ
 * ຈະຖືກເລືອກໃຫ້ອັດຕະໂນມັດໃນເອກະສານ (ມີໄດ້ອັນດຽວຕໍ່ປະເພດ — backend ຍົກເລີກອັນເກົ່າໃຫ້)
 */
const TaxPage = () => {
  const t = useT();
  const { rows, loading, reload } = useSettingList<Tax>('/tax/fetch');
  const statusToggle = useStatusToggle('/tax', reload);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Tax | null | undefined>(undefined);

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) => !q || `${r.tax_code} ${r.name}`.toLowerCase().includes(q));

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('accountSetTax'), value: rows.length },
          { label: t('active'), value: rows.filter((r) => Number(r.status) === 1).length, tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('taxAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-percent">
        <div className="acs-grid is-wide">
          {shown.map((r) => {
            const kind = kindOf(r.tax_kind);
            const rate = Number(r.rate) || 0;
            const sample = calcTax(SAMPLE, rate, Number(r.calc_method));
            return (
              <SettingCard
                key={r._uuid}
                tone={kind.tone}
                badge={<span className="acs-rate">{rate}<small>%</small></span>}
                title={r.name}
                subtitle={`${r.tax_code} · ${t(kind.label)}`}
                meta={
                  <>
                    <MetaChip icon={Number(r.calc_method) === 1 ? 'fa-equals' : 'fa-plus'}>
                      {t(Number(r.calc_method) === 1 ? 'taxInclusive' : 'taxExclusive')}
                    </MetaChip>
                    {Number(r.is_default) === 1 && <MetaChip icon="fa-star" tone="gold">{t('taxDefault')}</MetaChip>}
                    {r.effective_date && <MetaChip icon="fa-calendar-day">{r.effective_date.split('-').reverse().join('/')}</MetaChip>}
                  </>
                }
                aside={
                  <div className="acs-aside-figure">
                    <small>{formatNumber(SAMPLE)} →</small>
                    <b>+{formatNumber(Math.round(sample.tax))}</b>
                  </div>
                }
                active={Number(r.status) === 1}
                onToggle={(on) => statusToggle.toggle(r._uuid, on)}
                toggling={statusToggle.busyId === r._uuid}
                canEdit={canEdit}
                onEdit={() => setEditing(r)}
              />
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && <TaxForm data={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
    </div>
  );
};

export default TaxPage;
