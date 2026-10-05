import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Form, Modal, NumberInput, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { getApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { toThousands } from '../../../utils/formater';
import { useT } from '../../../context/LanguageContext';
import type { AccountType } from '../setting/AccountTypeForm';
import { toneOf } from '../setting/accountTone';
import { FormStep, PickerField, codeLabel } from '../setting/settingKit';
import { CASH_CLASS_CODE } from '../journal/journalKit';
import { currencySymbol } from './currency';

export type TreasuryBank = {
  _uuid: number;
  abbr?: string;
  name_la?: string;
  logo?: string;
  /** backend ຕໍ່ URL ເຕັມຂອງໂລໂກ້ມາໃຫ້ແລ້ວ */
  url?: string;
};

export type TreasuryAccount = {
  _uuid: number;
  type_treasuryid: number;
  bankId: number | null;
  acountName: string;
  acount_number?: string;
  balance_treasury: number;
  balance_unable?: number;
  status: number;
  banks?: TreasuryBank | null;
  treasury?: AccountType;
};

type Props = {
  /** null = ເພີ່ມໃໝ່ */
  data: TreasuryAccount | null;
  /** ປະເພດບັນຊີທີ່ໃຊ້ງານ (tbl_type_treasury ພ້ອມ types + currency) — ປຶ້ມບັນຊີໃຊ້ສະກຸນເງິນຕາມອັນທີ່ເລືອກ */
  types: AccountType[];
  onClose: () => void;
  onSaved: () => void;
};

/** ໂລໂກ້ທະນາຄານ + ຊື່ — ໃຊ້ທັງໃນລາຍການເລືອກ ແລະ ຄ່າທີ່ເລືອກແລ້ວ */
const bankLabel = (label: ReactNode, item: any) => (
  <span className="acc-book-bank-opt">
    {item?.url ? <img src={item.url} alt="" /> : <i className="fa-solid fa-building-columns" />}
    <span>{label}</span>
  </span>
);

/**
 * ຟອມເພີ່ມ/ແກ້ໄຂບັນຊີເງິນຄັງ — POST /treasury-account/create, PUT /treasury-account/:id (id ເປັນ base64).
 * ຊ້າຍ: ບັດຕົວຢ່າງທີ່ອັບເດດຕາມທີ່ປ້ອນ + ສະຫຼຸບຍອດ + ສະຖານະ. ຂວາ: ຊ່ອງປ້ອນ.
 * ເລືອກ "ໝວດບັນຊີ" (tbl_type_account) ກ່ອນ ແລ້ວ "ປະເພດບັນຊີ" (tbl_type_treasury ຈາກ getTypeTreasury) ຈຶ່ງກັ່ນສະເພາະຂອງໝວດນັ້ນ.
 * ຕອນແກ້ໄຂ ປະເພດ ແລະ ຍອດເງິນປ່ຽນບໍ່ໄດ້ — ຍອດຜູກກັບສະກຸນເງິນແລ້ວ ແລະ ປ່ຽນຜ່ານການໂອນເງິນເທົ່ານັ້ນ.
 * ໝວດເງິນສົດ (101) ບໍ່ມີທະນາຄານ — ເຊື່ອງຊ່ອງເລືອກທະນາຄານ ແລະ ສົ່ງ bankId ເປັນ null.
 */
const TreasuryAccountForm = ({ data, types, onClose, onSaved }: Props) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [banks, setBanks] = useState<TreasuryBank[]>([]);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({
    typeId: data?.treasury?.typeId ?? null,
    type_treasuryid: data?.type_treasuryid ?? null,
    acountName: data?.acountName ?? '',
    acount_number: data?.acount_number ?? '',
    balance_treasury: data?.balance_treasury ?? 0,
    balance_unable: data?.balance_unable ?? 0,
    bankId: data?.bankId || null,
  });
  const [active, setActive] = useState(data ? Number(data.status) === 1 : true);

  useEffect(() => {
    getApi('/bank/fetch', { params: { limit: 1000 } })
      .then((res) => setBanks(res.data?.data || []))
      .catch((error) => console.error(error));
  }, []);

  const model = createModel<any>({
    typeId: requiredField(t('selectRequired'), 'number'),
    type_treasuryid: requiredField(t('selectRequired'), 'number'),
    acountName: requiredField(t('inputRequired'), 'string'),
  });

  // /type-treasury/fetch ສົ່ງມາສະເພາະອັນທີ່ໃຊ້ງານ — ຕອນແກ້ໄຂ ເພີ່ມປະເພດເດີມຂອງແຖວໃສ່ ເຜື່ອມັນຖືກປິດໄປແລ້ວ
  const typeList = data?.treasury && !types.some((r) => r._uuid === data.type_treasuryid)
    ? [...types, data.treasury]
    : types;

  /** ໝວດບັນຊີ — ເອົາສະເພາະໝວດທີ່ມີປະເພດບັນຊີ (tbl_type_treasury) ໃຫ້ເລືອກຕໍ່ */
  const classList = [...new Map(typeList.filter((r) => r.types).map((r) => [r.typeId, r.types!])).values()]
    .sort((a, b) => String(a.type_code).localeCompare(String(b.type_code)));
  // label ເປັນຂໍ້ຄວາມໃຫ້ຊ່ອງຄົ້ນຫາ — ສ່ວນທີ່ສະແດງແທ້ແມ່ນ codeLabel (code / name / cur / tone)
  const classOptions = classList.map((c) => ({
    label: `${c.type_code} ${c.type_name}`,
    value: c._uuid,
    code: c.type_code,
    name: c.type_name,
    tone: toneOf(c.type_code),
  }));

  const selectedClass = classList.find((c) => c._uuid === inputs.typeId);
  const isCash = selectedClass?.type_code === CASH_CLASS_CODE;
  const typeOptions = typeList
    .filter((r) => r.typeId === inputs.typeId)
    .map((r) => {
      const cur = r.currency ? `${r.currency.genus ? `${r.currency.genus} ` : ''}${r.currency.name}` : '';
      return {
        label: `${r.treasury_code} ${r.treasury_name} ${cur}`,
        value: r._uuid,
        code: r.treasury_code,
        name: r.treasury_name,
        cur,
        tone: toneOf(selectedClass?.type_code ?? ''),
      };
    });

  const bankOptions = banks.map((b) => ({
    label: `${b.name_la ?? ''}${b.abbr ? ` (${b.abbr})` : ''}`,
    value: b._uuid,
    url: b.url,
  }));

  const selectedType = typeList.find((r) => r._uuid === inputs.type_treasuryid);
  const currency = selectedType?.currency;
  const bank = isCash ? null : banks.find((b) => b._uuid === inputs.bankId) ?? (inputs.bankId === data?.bankId ? data?.banks : null);
  const usable = Number(inputs.balance_treasury) || 0;
  const unable = Number(inputs.balance_unable) || 0;
  const symbol = currencySymbol(currency);
  const money = (n: number) => `${symbol} ${toThousands(n)}`.trim();

  /** ປ່ຽນໝວດບັນຊີ → ລ້າງປະເພດບັນຊີທີ່ເລືອກໄວ້ ເພາະມັນເປັນຂອງໝວດເກົ່າ */
  const handleChange = (next: any) =>
    setInputs(next.typeId !== inputs.typeId ? { ...next, type_treasuryid: null } : next);

  const handleSubmit = async () => {
    if (!formRef.current?.check()) return;
    const body = {
      bankId: isCash ? null : inputs.bankId || null,
      // ຊື່ບັນຊີພາສາອັງກິດເກັບເປັນຕົວພິມໃຫຍ່ (ຕົວລາວບໍ່ມີພິມໃຫຍ່-ນ້ອຍ ຈຶ່ງບໍ່ປ່ຽນ)
      acountName: String(inputs.acountName ?? '').trim().toUpperCase(),
      acount_number: inputs.acount_number,
      status: active ? 1 : 0,
    };
    try {
      setSaving(true);
      if (data) {
        await putApi(`/treasury-account/${btoa(String(data._uuid))}`, body);
      } else {
        await postApi('/treasury-account/create', {
          ...body,
          type_treasuryid: inputs.type_treasuryid,
          balance_treasury: usable,
          balance_unable: unable,
        });
      }
      Notific.success('saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" className="acc-book-modal is-steps">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon">
            <i className={`fa-solid ${data ? 'fa-pen-to-square' : 'fa-vault'}`} />
          </span>
          <span>
            <Modal.Title>{data ? t('treasuryFormEdit') : t('treasuryFormAdd')}</Modal.Title>
            <small>{t('treasuryFormHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-book-layout">
          {/* ---- ຊ້າຍ: ບັດຕົວຢ່າງ + ສະຫຼຸບຍອດ + ສະຖານະ ---- */}
          <aside className="acc-book-aside">
            <span className="acc-book-aside-label">{t('treasuryPreview')}</span>
            <div className={`acc-book-cp${selectedType ? '' : ' is-empty'}${active ? '' : ' is-off'}`}>
              <div className="acc-book-cp-top">
                <span className="acc-book-cp-type">
                  <b>{selectedType?.treasury_code ?? '····'}</b>
                  <small>{selectedType?.treasury_name ?? t('treasuryFieldType')}</small>
                </span>
                <span className="acc-book-cp-bank" title={bank?.name_la ?? t('treasuryNoBank')}>
                  {bank?.url
                    ? <img src={bank.url} alt="" />
                    : bank ? <b>{bank.abbr ?? String(bank.name_la ?? '').slice(0, 4)}</b> : <i className="fa-solid fa-wallet" />}
                </span>
              </div>
              <div className="acc-book-cp-number">{inputs.acount_number || 'XXX-XXXX-XXXXX'}</div>
              <div className="acc-book-cp-bottom">
                <span className="acc-book-cp-name">
                  <small>{t('accountName')}</small>
                  <b>{inputs.acountName || '—'}</b>
                </span>
                {currency && <span className="acc-book-cp-cur">{currency.genus ? `${currency.genus} ` : ''}{currency.name}</span>}
              </div>
            </div>

            <dl className="acc-book-summary">
              <div>
                <dt><i className="is-usable" />{t('treasuryBalanceUsable')}</dt>
                <dd>{money(usable)}</dd>
              </div>
              <div>
                <dt><i className="is-unable" />{t('treasuryBalanceUnable')}</dt>
                <dd>{money(unable)}</dd>
              </div>
              <div className="is-total">
                <dt>{t('treasuryBalanceTotal')}</dt>
                <dd className={usable + unable < 0 ? 'is-negative' : ''}>{money(usable + unable)}</dd>
              </div>
            </dl>

            <label className={`acc-book-status${active ? ' is-on' : ''}`}>
              <span>
                <b>{active ? t('treasuryEnable') : t('treasuryDisable')}</b>
                <small>{t('status')}</small>
              </span>
              <Toggle checked={active} onChange={setActive} />
            </label>
          </aside>

          {/* ---- ຂວາ: ຊ່ອງປ້ອນ ---- */}
          <Form fluid ref={formRef} model={model} formValue={inputs} onChange={handleChange} className="acc-book-main">
            <FormStep no={1} done={!!inputs.type_treasuryid} title={t('treasurySectionType')} hint={t('treasuryStepTypeHint')}>
              <PickerField name="typeId" label={t('treasuryFieldClass')} data={classOptions}
                disabled={!!data} placeholder={t('select')} searchable={false}
                renderOption={codeLabel} renderValue={codeLabel}
              />
              <PickerField name="type_treasuryid" label={t('treasuryFieldType')} data={typeOptions}
                disabled={!!data || !inputs.typeId} placeholder={t('select')}
                renderOption={codeLabel} renderValue={codeLabel}
              />
            </FormStep>

            <FormStep no={2} done={!!String(inputs.acountName ?? '').trim()} title={t('treasurySectionInfo')} hint={t('treasuryStepInfoHint')}>
              {/* ສະແດງເປັນພິມໃຫຍ່ດ້ວຍ CSS ຂະນະພິມ (ບໍ່ປ່ຽນ value ທຸກຕົວອັກສອນ — cursor ຈະບໍ່ກະໂດດໄປທ້າຍ), ປ່ຽນແທ້ຕອນບັນທຶກ */}
              <InputField name="acountName" label={t('accountName')} placeholder={t('accountNameDots')}
                className="acc-book-upper" icon={<i className="fa-solid fa-signature" />}
              />
              <InputField name="acount_number" label={t('accountNumber')} placeholder="XXX-XXXX-XXXXX" required={false}
                icon={<i className="fa-solid fa-hashtag" />}
              />
              {!isCash && (
                <PickerField name="bankId" label={t('bank')} required={false} className="is-wide" data={bankOptions}
                  placeholder={t('treasuryNoBank')}
                  renderOption={bankLabel}
                  renderValue={(_: unknown, item: any) => bankLabel(item?.label, item)}
                />
              )}
            </FormStep>

            <FormStep no={3} title={t('treasuryBalance')} hint={t('treasuryStepBalanceHint')}
              note={data && <><i className="fa-solid fa-lock" /> {t('treasurySectionBalanceLocked')}</>}
            >
              {/* ຈຸດສີໜ້າ label ກົງກັບສະຫຼຸບຍອດທາງຊ້າຍ (ຂຽວ = ໃຊ້ໄດ້, ແດງ = ໃຊ້ບໍ່ໄດ້) */}
              <div className="acc-book-money is-usable">
                <InputField name="balance_treasury" label={t('treasuryBalanceUsable')} accepter={NumberInput}
                  required={false} disabled={!!data} formatter={toThousands} prefix={symbol || undefined} controls={false}
                />
              </div>
              <div className="acc-book-money is-unable">
                <InputField name="balance_unable" label={t('treasuryBalanceUnable')} accepter={NumberInput}
                  required={false} disabled={!!data} formatter={toThousands} prefix={symbol || undefined} controls={false}
                />
              </div>
            </FormStep>
          </Form>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={handleSubmit}>
          <i className="fa-solid fa-check" /> {t('save')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TreasuryAccountForm;
