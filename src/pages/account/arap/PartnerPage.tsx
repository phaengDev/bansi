import { useRef, useState } from 'react';
import { Form, NumberInput, SelectPicker, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { postApi, putApi } from '../../../utils/configApi';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ChoiceTiles, FormSection, ListState, MetaChip, SettingCard, SettingModal, SettingToolbar } from '../setting/settingKit';
import { nextCode, runSave, useStatusToggle } from '../setting/settingApi';
import { money } from '../gl/glApi';
import { GlNotReady, accountOptionLabel, useAccountOptions, useChartAccounts } from '../gl/glKit';
import { AR, KINDS, isPartnerOf, usePartners, type Kind, type Partner } from './arapApi';

const TYPES = [
  { value: 1, label: 'arapTypeCustomer', icon: 'fa-user-tie' },
  { value: 2, label: 'arapTypeSupplier', icon: 'fa-truck-field' },
  { value: 3, label: 'arapTypeBoth', icon: 'fa-handshake' },
];

/** ຟອມຄູ່ຄ້າ — ລະຫັດ, ຊື່, ການຕິດຕໍ່, ກຳນົດຊຳລະ ແລະ ບັນຊີລູກໜີ້/ເຈົ້າໜີ້ສະເພາະ (ບໍ່ເລືອກ = ບັນຊີເລີ່ມຕົ້ນ) */
export const PartnerForm = ({ kind, data, initialName = '', partners, onClose, onSaved }: {
  kind: Kind;
  data: Partner | null;
  /** ຊື່ຕັ້ງຕົ້ນຕອນເພີ່ມໃໝ່ — ຊື່ທີ່ພິມເອງໃນຟອມລາຍຮັບ/ລາຍຈ່າຍ */
  initialName?: string;
  partners: Partner[];
  onClose: () => void;
  /** created = ແຖວໃໝ່ທີ່ຫາກໍ່ສ້າງ (ຟອມໃບບິນໃຊ້ເລືອກໃຫ້ທັນທີ) */
  onSaved: (created?: Partner) => void;
}) => {
  const t = useT();
  const { rows: accounts } = useChartAccounts();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<number>(data?.partner_type ?? kind);
  const [creditDays, setCreditDays] = useState<number>(data?.credit_days ?? 30);
  const [receivable, setReceivable] = useState<number | null>(data?.receivable_account_id ?? null);
  const [payable, setPayable] = useState<number | null>(data?.payable_account_id ?? null);
  const [inputs, setInputs] = useState<any>({
    partner_code: data?.partner_code ?? nextCode(kind === AR ? 'C' : 'S', partners.map((p) => p.partner_code)),
    name: data?.name ?? initialName,
    contact_person: data?.contact_person ?? '',
    phone: data?.phone ?? '',
    email: data?.email ?? '',
    tax_number: data?.tax_number ?? '',
    address: data?.address ?? '',
    description: data?.description ?? '',
  });
  const arOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === 1);
  const apOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === 2);

  const model = createModel<any>({
    partner_code: requiredField(t('inputRequired'), 'string'),
    name: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      partner_type: type,
      credit_days: creditDays,
      receivable_account_id: type === 2 ? null : receivable,
      payable_account_id: type === 1 ? null : payable,
      ...(data ? {} : { status: 1 }),
    };
    let created: Partner | undefined;
    const ok = await runSave(async () => {
      if (data) return putApi(`/partner/${btoa(String(data._uuid))}`, payload);
      const res = await postApi('/partner/create', payload);
      created = res.data?.data;
      return res;
    }, setSaving);
    if (ok) {
      onSaved(created);
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'arapPartnerEdit' : 'arapPartnerAdd')} hint={t('arapPartnerHint')} icon={KINDS[kind].partnerIcon}
      saving={saving} onClose={onClose} onSubmit={submit} wide
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          {/* ລະຫັດ (ສັ້ນ) ຄູ່ກັບຊື່ (ຍາວ) ຢູ່ແຖວດຽວກັນ */}
          <div className="is-wide acs-code-name">
            <InputField name="partner_code" label={t('code')} className="acc-book-upper" />
            <InputField name="name" label={t('arapPartnerName')} />
          </div>
          <ChoiceTiles className="is-wide" label={t('arapPartnerType')} value={type} onChange={setType}
            options={TYPES.map((x) => ({ value: x.value, label: t(x.label), icon: x.icon }))}
          />
        </FormSection>
        <FormSection title={t('arapContact')}>
          <InputField name="contact_person" label={t('arapContactPerson')} required={false} />
          <InputField name="phone" label={t('phone')} required={false} />
          <InputField name="email" label="Email" required={false} />
          <InputField name="tax_number" label={t('arapTaxNumber')} required={false} />
          <div className="is-wide"><InputField name="address" label={t('address')} required={false} /></div>
        </FormSection>
        <FormSection title={t('arapTerms')}>
          <div className="rs-form-group">
            <label className="form-label">{t('arapCreditDays')}</label>
            <NumberInput value={creditDays} min={0} onChange={(v) => setCreditDays(Math.max(0, Number(v) || 0))} postfix={t('days')} />
          </div>
          {type !== 2 && (
            <div className="rs-form-group">
              <label className="form-label">{t('arapReceivableAccount')}</label>
              <SelectPicker block data={arOptions} value={receivable} onChange={(v) => setReceivable(v as number | null)}
                placeholder={t('glUseDefault')} renderOption={accountOptionLabel} renderValue={(_, item) => accountOptionLabel(_, item)}
                popupClassName="acc-book-menu"
              />
            </div>
          )}
          {type !== 1 && (
            <div className="rs-form-group">
              <label className="form-label">{t('arapPayableAccount')}</label>
              <SelectPicker block data={apOptions} value={payable} onChange={(v) => setPayable(v as number | null)}
                placeholder={t('glUseDefault')} renderOption={accountOptionLabel} renderValue={(_, item) => accountOptionLabel(_, item)}
                popupClassName="acc-book-menu"
              />
            </div>
          )}
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/** ລາຍຊື່ລູກຄ້າ (AR) / ຜູ້ສະໜອງ (AP) ພ້ອມຍອດຄ້າງ ແລະ ເກີນກຳນົດ */
const PartnerPage = ({ kind, onStatement }: { kind: Kind; onStatement: (partner: Partner) => void }) => {
  const t = useT();
  const cfg = KINDS[kind];
  const { rows, loading, notReady, reload } = usePartners();
  const statusToggle = useStatusToggle('/partner', reload);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Partner | null | undefined>(undefined);

  if (notReady) return <GlNotReady />;

  const mine = rows.filter((p) => isPartnerOf(kind, p));
  const q = keyword.trim().toLowerCase();
  const shown = mine.filter((p) => !q || `${p.partner_code} ${p.name} ${p.phone ?? ''} ${p.contact_person ?? ''}`.toLowerCase().includes(q));
  const openOf = (p: Partner) => (kind === AR ? p.ar_open : p.ap_open);
  const overdueOf = (p: Partner) => (kind === AR ? p.ar_overdue : p.ap_overdue);
  const docsOf = (p: Partner) => (kind === AR ? p.ar_docs : p.ap_docs);

  return (
    <div className="acs-page acc-gl">
      <SettingToolbar
        stats={[
          { label: t(cfg.partners), value: mine.length },
          { label: t('arapWithBalance'), value: mine.filter((p) => openOf(p) > 0).length, tone: 'gold' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('arapPartnerAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />
      <ListState loading={loading && !rows.length} empty={!shown.length} icon={cfg.partnerIcon}>
        <div className="acs-grid">
          {shown.map((p) => (
            <SettingCard
              key={p._uuid}
              tone={cfg.tone}
              badge={<i className={`fa-solid ${p.partner_type === 3 ? 'fa-handshake' : cfg.partnerIcon}`} />}
              title={<>{p.name} <small className="acc-gl-mono text-muted">{p.partner_code}</small></>}
              subtitle={[p.contact_person, p.phone].filter(Boolean).join(' · ') || undefined}
              meta={
                <>
                  {p.credit_days > 0 && <MetaChip icon="fa-calendar-days">{p.credit_days} {t('days')}</MetaChip>}
                  {docsOf(p) > 0 && <MetaChip icon={cfg.docIcon}>{docsOf(p)} {t('arapOpenDocs')}</MetaChip>}
                  {overdueOf(p) > 0 && <MetaChip icon="fa-triangle-exclamation" tone="coral">{t('arapStatusOverdue')} {money(overdueOf(p))}</MetaChip>}
                </>
              }
              aside={openOf(p) > 0 ? <span className="acc-arap-aside"><small>{t(cfg.open)}</small><b>{money(openOf(p))}</b></span> : undefined}
              active={Number(p.status) === 1}
              onToggle={(on) => statusToggle.toggle(p._uuid, on)}
              toggling={statusToggle.busyId === p._uuid}
              canEdit={canEdit}
              onEdit={() => setEditing(p)}
              actions={
                <button type="button" className="acc-class-edit acs-action is-text" onClick={() => onStatement(p)}>
                  <i className="fa-solid fa-file-lines" /><span>{t('arapStatement')}</span>
                </button>
              }
            />
          ))}
        </div>
      </ListState>
      {editing !== undefined && (
        <PartnerForm kind={kind} data={editing} partners={rows} onClose={() => setEditing(undefined)} onSaved={() => reload()} />
      )}
    </div>
  );
};

export default PartnerPage;
