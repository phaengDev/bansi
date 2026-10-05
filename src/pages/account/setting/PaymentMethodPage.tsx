import { useRef, useState } from 'react';
import { Form, NumberInput, SelectPicker, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ChoiceTiles, FormSection, ListState, MetaChip, SettingCard, SettingModal, SettingToolbar, ToggleField } from './settingKit';
import { postfixProp, runSave, saveSetting, useSettingList, useStatusToggle } from './settingApi';

type PaymentMethod = {
  _uuid: number;
  method_code: string;
  name: string;
  method_type: number;
  account_id: number | null;
  require_ref: number;
  fee_percent: string | number;
  sort: number;
  description?: string;
  status: number;
  account?: { _uuid: number; acountName: string; acount_number?: string } | null;
};

type AccountOption = { _uuid: number; acountName: string; acount_number?: string; banks?: { abbr?: string } | null };

/** method_type — 1 ເງິນສົດ, 2 ໂອນທະນາຄານ, 3 QR, 4 ເຊັກ, 5 ບັດ */
const TYPES = [
  { value: 1, label: 'pmTypeCash', icon: 'fa-money-bill-wave', tone: 'is-emerald' },
  { value: 2, label: 'pmTypeTransfer', icon: 'fa-building-columns', tone: 'is-sky' },
  { value: 3, label: 'pmTypeQr', icon: 'fa-qrcode', tone: 'is-violet' },
  { value: 4, label: 'pmTypeCheque', icon: 'fa-money-check', tone: 'is-gold' },
  { value: 5, label: 'pmTypeCard', icon: 'fa-credit-card', tone: 'is-blue' },
];
const typeOf = (value: number) => TYPES.find((x) => x.value === Number(value)) ?? TYPES[0];

const accountLabel = (a: AccountOption) =>
  [a.banks?.abbr, a.acountName, a.acount_number].filter(Boolean).join(' · ');

const PaymentMethodForm = ({ data, accounts, count, onClose, onSaved }: {
  data: PaymentMethod | null;
  accounts: AccountOption[];
  count: number;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [requireRef, setRequireRef] = useState(data ? Number(data.require_ref) === 1 : false);
  const [type, setType] = useState<number>(data?.method_type ?? 1);
  const [inputs, setInputs] = useState<any>({
    method_code: data?.method_code ?? '',
    name: data?.name ?? '',
    account_id: data?.account_id ?? null,
    fee_percent: Number(data?.fee_percent ?? 0),
    sort: data?.sort ?? count + 1,
    description: data?.description ?? '',
  });

  const model = createModel<any>({
    method_code: requiredField(t('inputRequired'), 'string'),
    name: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      method_code: String(inputs.method_code).trim().toUpperCase(),
      method_type: type,
      account_id: inputs.account_id || null,
      fee_percent: Number(inputs.fee_percent) || 0,
      sort: Number(inputs.sort) || 0,
      require_ref: requireRef ? 1 : 0,
      ...(data ? {} : { status: 1 }),
    };
    if (await runSave(() => saveSetting('/payment-method', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'pmEdit' : 'pmAdd')} hint={t('pmHint')} icon="fa-money-bill-transfer" saving={saving} onClose={onClose} onSubmit={submit} wide>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide acs-code-name has-sort">
            <InputField name="method_code" label={t('code')} placeholder="CASH, TRANSFER…" className="acc-book-upper" />
            <InputField name="name" label={t('name')} />
            <InputField name="sort" label={t('pmSort')} accepter={NumberInput} required={false} />
          </div>
          <ChoiceTiles
            className="is-wide"
            label={t('pmType')}
            value={type}
            onChange={setType}
            options={TYPES.map((x) => ({ value: x.value, label: t(x.label), icon: x.icon }))}
          />
          <div className="is-wide">
            <InputField name="account_id" label={t('pmAccount')} accepter={SelectPicker} block required={false}
              placeholder={t('pmNoAccount')}
              data={accounts.map((a) => ({ label: accountLabel(a), value: a._uuid }))}
            />
          </div>
          <ToggleField label={t('pmRequireRef')} checked={requireRef} onChange={setRequireRef} onText={t('pmRequireRef')} offText={t('pmNoRef')} />
          <InputField name="fee_percent" label={t('pmFee')} accepter={NumberInput} required={false} {...postfixProp('%')} />
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ວິທີຊຳລະເງິນ — ເງິນສົດ, ໂອນ, QR, ເຊັກ, ບັດ. ແຕ່ລະວິທີຜູກບັນຊີເງິນຄັງເລີ່ມຕົ້ນ (ເງິນເຂົ້າ/ອອກບັນຊີໃດ)
 * ແລະ ບອກວ່າຕ້ອງປ້ອນເລກອ້າງອີງ (ເລກໂອນ/ເລກເຊັກ) ຫຼືບໍ່ — ຟອມລາຍຮັບ-ລາຍຈ່າຍຈະອ່ານຄ່ານີ້
 */
const PaymentMethodPage = () => {
  const t = useT();
  const { rows, loading, reload } = useSettingList<PaymentMethod>('/payment-method/fetch');
  const statusToggle = useStatusToggle('/payment-method', reload);
  const { rows: accounts } = useSettingList<AccountOption>('/treasury-account/option');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<PaymentMethod | null | undefined>(undefined);

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) => !q || `${r.method_code} ${r.name}`.toLowerCase().includes(q));

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('accountSetPaymentMethod'), value: rows.length },
          { label: t('active'), value: rows.filter((r) => Number(r.status) === 1).length, tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('pmAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-money-bill-transfer">
        <div className="acs-grid">
          {shown.map((r) => {
            const type = typeOf(r.method_type);
            const fee = Number(r.fee_percent) || 0;
            return (
              <SettingCard
                key={r._uuid}
                tone={type.tone}
                badge={<i className={`fa-solid ${type.icon}`} />}
                title={r.name}
                subtitle={`${r.method_code} · ${t(type.label)}`}
                meta={
                  <>
                    <MetaChip icon="fa-vault">{r.account ? r.account.acountName : t('pmNoAccount')}</MetaChip>
                    {Number(r.require_ref) === 1 && <MetaChip icon="fa-hashtag" tone="gold">{t('pmRequireRef')}</MetaChip>}
                    {fee > 0 && <MetaChip icon="fa-percent">{fee}%</MetaChip>}
                  </>
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

      {editing !== undefined && (
        <PaymentMethodForm data={editing} accounts={accounts} count={rows.length} onClose={() => setEditing(undefined)} onSaved={reload} />
      )}
    </div>
  );
};

export default PaymentMethodPage;
