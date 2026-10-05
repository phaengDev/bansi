import { useMemo, useRef, useState } from 'react';
import { Form, SelectPicker, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { useCurrency } from '../../../utils/selectOption';
import { putApi, postApi } from '../../../utils/configApi';
import { useLangField, useT } from '../../../context/LanguageContext';
import { ChoiceTiles, FormSection, PickerField, SettingModal } from '../setting/settingKit';
import { runSave } from '../setting/settingApi';
import { ACCOUNT_TYPES, CREDIT, DEBIT, groupOf, type ChartAccount } from './glApi';
import { accountOptionLabel } from './glKit';

/**
 * ລະຫັດແນະນຳໃຕ້ບັນຊີແມ່ — ມີລູກແລ້ວ = ລະຫັດລູກໃຫຍ່ສຸດ + 1 (ທີ່ຍັງວ່າງ);
 * ຍັງບໍ່ມີ = ແທນເລກ 0 ທຳອິດທາງທ້າຍຂອງລະຫັດແມ່ດ້ວຍ 1 (1100 → 1110, 5000 → 5100)
 */
const suggestCode = (parent: ChartAccount | undefined, accounts: ChartAccount[]) => {
  if (!parent) return '';
  const taken = new Set(accounts.map((a) => a.account_code));
  const siblings = accounts
    .filter((a) => a.parent_id === parent._uuid && /^\d+$/.test(a.account_code))
    .map((a) => Number(a.account_code));
  let next: number;
  if (siblings.length) next = Math.max(...siblings) + 1;
  else {
    const code = parent.account_code;
    const trimmed = code.replace(/0+$/, '');
    next = /^\d+$/.test(code) && trimmed.length < code.length
      ? Number(`${trimmed}1${'0'.repeat(code.length - trimmed.length - 1)}`)
      : Number(`${code}1`);
  }
  while (taken.has(String(next))) next += 1;
  return String(next);
};

const ChartAccountForm = ({ data, parentId, accounts, onClose, onSaved }: {
  /** null = ເພີ່ມໃໝ່ */
  data: ChartAccount | null;
  /** ເພີ່ມບັນຊີລູກຂອງບັນຊີຫົວນີ້ */
  parentId?: number | null;
  accounts: ChartAccount[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const lf = useLangField();
  const currencies = useCurrency();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const isSystem = Number(data?.is_system) === 1;

  const headers = accounts.filter((a) => Number(a.is_postable) === 0 && a._uuid !== data?._uuid);
  const initialParent = data ? data.parent_id : parentId ?? null;
  const [inputs, setInputs] = useState<any>({
    parent_id: initialParent,
    account_code: data?.account_code ?? suggestCode(headers.find((h) => h._uuid === initialParent), accounts),
    name_la: data?.name_la ?? '',
    name_en: data?.name_en ?? '',
    name_cn: data?.name_cn ?? '',
    currency_id: data?.currency_id ?? null,
    description: data?.description ?? '',
  });
  const codeGroup = Number(String(inputs.account_code ?? '').trim()[0]);
  const group = codeGroup >= 1 && codeGroup <= 5 ? codeGroup : 0;
  // ເພີ່ມບັນຊີລູກ → ເອົາໝວດຍ່ອຍຂອງບັນຊີແມ່ເປັນຄ່າເລີ່ມຕົ້ນ
  const [type, setType] = useState<string>(data?.account_type ?? headers.find((h) => h._uuid === initialParent)?.account_type ?? '');
  const [side, setSide] = useState<number | null>(data?.normal_side ?? null);
  const [postable, setPostable] = useState<number>(data ? Number(data.is_postable) : 1);

  const types = group ? ACCOUNT_TYPES[group] : [];
  const typeValue = types.some((x) => x.value === type) ? type : types[0]?.value ?? '';
  const sideValue = side ?? (group ? groupOf(group).side : DEBIT);

  const parentOptions = useMemo(() => headers.map((h) => ({
    value: h._uuid,
    label: `${h.account_code} ${lf(h, 'name')}`,
    code: h.account_code,
    name: lf(h, 'name'),
    group: h.account_group,
  })), [headers, lf]);

  const model = createModel<any>({
    account_code: requiredField(t('inputRequired'), 'string'),
    name_la: requiredField(t('inputRequired'), 'string'),
  });

  const changeParent = (value: number | null) => {
    const parent = headers.find((h) => h._uuid === value);
    setInputs((prev: any) => ({
      ...prev,
      parent_id: value,
      // ຍັງບໍ່ໄດ້ແກ້ລະຫັດເອງ → ແນະນຳລະຫັດໃໝ່ຕາມບັນຊີແມ່
      account_code: data ? prev.account_code : suggestCode(parent, accounts) || prev.account_code,
    }));
    if (parent) setType(parent.account_type);
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      account_code: String(inputs.account_code).trim(),
      account_type: typeValue,
      normal_side: sideValue,
      is_postable: postable,
      ...(data ? {} : { status: 1 }),
    };
    const ok = await runSave(
      () => (data ? putApi(`/chart-account/${btoa(String(data._uuid))}`, payload) : postApi('/chart-account/create', payload)),
      setSaving,
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'glAccountEdit' : 'glAccountAdd')} hint={t('glAccountHint')} icon="fa-sitemap"
      saving={saving} onClose={onClose} onSubmit={submit} wide
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('glAccountPosition')}
          note={group ? <span className={`acc-gl-group-note acc-tone ${groupOf(group).tone}`}>
            <i className={`fa-solid ${groupOf(group).icon}`} /> {t(groupOf(group).label)}
          </span> : undefined}
        >
          <PickerField name="parent_id" label={t('glParentAccount')} data={parentOptions} required={false} className="is-wide"
            placeholder={t('glNoParent')} onChange={changeParent} renderOption={accountOptionLabel}
            renderValue={(_: unknown, item: any) => accountOptionLabel(_, item)}
          />
        </FormSection>

        <FormSection title={t('acsNames')}>
          <div className="is-wide acs-code-name">
            <InputField name="account_code" label={t('glAccountCode')} placeholder="1110" disabled={isSystem} />
            <InputField name="name_la" label={t('glNameLa')} />
          </div>
          <p className="acc-gl-hint is-wide"><i className="fa-solid fa-circle-info" /> {t('glCodeRule')}</p>
          <InputField name="name_en" label={t('glNameEn')} required={false} />
          <InputField name="name_cn" label={t('glNameCn')} required={false} />
        </FormSection>

        {group > 0 && (
          <FormSection title={t('glAccountNature')}>
            <ChoiceTiles className="is-wide" label={t('glAccountType')} value={typeValue} onChange={setType}
              options={types.map((x) => ({ value: x.value, label: t(x.label) }))}
            />
            <ChoiceTiles label={t('glAccountKind')} value={postable} onChange={setPostable} disabled={isSystem}
              options={[
                { value: 1, label: t('glPostable'), icon: 'fa-pen-to-square', hint: t('glPostableHint') },
                { value: 0, label: t('glHeader'), icon: 'fa-folder-tree', hint: t('glHeaderHint') },
              ]}
            />
            <ChoiceTiles label={t('glNormalSide')} value={sideValue} onChange={setSide}
              options={[
                { value: DEBIT, label: t('glSideDebit'), hint: 'Dr' },
                { value: CREDIT, label: t('glSideCredit'), hint: 'Cr' },
              ]}
            />
          </FormSection>
        )}

        <FormSection title={t('acsInfo')}>
          <div className="rs-form-group is-wide">
            <label className="form-label">{t('glCurrencyLock')}</label>
            <SelectPicker block data={currencies as any[]} value={inputs.currency_id} placeholder={t('glAnyCurrency')}
              onChange={(value) => setInputs((prev: any) => ({ ...prev, currency_id: value }))} popupClassName="acc-book-menu"
            />
          </div>
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

export default ChartAccountForm;
