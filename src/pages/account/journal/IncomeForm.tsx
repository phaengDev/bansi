import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, DatePicker, Form, Modal, NumberInput, Schema, Textarea } from 'rsuite';
import moment from 'moment';
import type { FormInstance } from 'rsuite';
import { formatNumber, getApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { InputField } from '../../../utils/inputFields';
import { toThousands } from '../../../utils/formater';
import { useT } from '../../../context/LanguageContext';
import type { AccountType } from '../setting/AccountTypeForm';
import { ChoiceTiles, FormStep, PickerField, codeLabel } from '../setting/settingKit';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import { currencySymbol } from '../ledger/currency';
import { ACCOUNT_POPUP_STYLE, accountOption, renderAccountOption } from '../ledger/accountOption';
import {
  CASH, CASH_CLASS_CODE, MAX_FILE, TRANSFER, classIdOf, computeTax, isAllowedFile, isFutureDay,
  type AccountClass, type Category, type Tax, type TaxMode,
} from './journalKit';
import CustomerField, { type CustomerValue, type PartnerRef } from './CustomerField';

export { CASH, TRANSFER };

const { StringType, NumberType, DateType } = Schema.Types;

/** ວັນທີຮັບເງິນຂອງລາຍຮັບ — ແຖວເກົ່າທີ່ບໍ່ມີ income_date ໃຊ້ວັນທີຂອງ createdAt ແທນ (ຄື backend) */
export const incomeDateOf = (row: { income_date?: string | null; createdAt: string }) =>
  row.income_date ? moment(row.income_date, 'YYYY-MM-DD') : moment(row.createdAt);

/** ແຖວຈາກ POST /income/fetch — ມີປະເພດ (typein), ບັນຊີ (acount + banks.url + treasury.currency), ຜູ້ບັນທຶກ */
export type Income = {
  _uuid: number;
  number: string;
  /** ວັນທີຮັບເງິນ YYYY-MM-DD — ແຖວເກົ່າເປັນ null */
  income_date?: string | null;
  incom_title: string;
  type_incom_fk: number;
  type_acountid: number;
  acount_id_fk: number;
  /** 1 = ເງິນສົດ, 2 = ເງິນໂອນ */
  receive_type?: number;
  /** ເງິນໂອນ: ທະນາຄານ / ຊື່ບັນຊີ / ເລກບັນຊີ ຂອງຜູ້ໂອນ (ບໍ່ບັງຄັບ) */
  payer_bank_id?: number | null;
  payer_account_name?: string | null;
  payer_account_number?: string | null;
  payerBank?: { _uuid: number; abbr?: string; name_la?: string; url?: string | null } | null;
  /** ລູກຄ້າທີ່ຮັບເງິນຈາກ (tbl_partner) — ບໍ່ບັງຄັບ, ບໍ່ຕັດໜີ້ */
  partner_id?: number | null;
  partner?: PartnerRef | null;
  /** ຊື່ລູກຄ້າ — ສຳເນົາຊື່ຂອງ partner ຫຼື ຊື່ທີ່ພິມເອງ (partner_id = null) */
  payer_name?: string | null;
  /** ຈຳນວນທີ່ປ້ອນ */
  balances: number;
  tax: number;
  /** ຍອດທີ່ເຂົ້າບັນຊີແທ້ */
  balance_income: number;
  description?: string | null;
  file_doct?: string | null;
  file_url?: string | null;
  status: number;
  createdAt: string;
  updatedAt?: string;
  typein?: { _uuid: number; type_code: string; type_name: string } | null;
  acount?: (TreasuryAccount & { treasury?: AccountType }) | null;
  user?: { user_uuid: number; user_name: string } | null;
};

type Props = {
  /** null = ບັນທຶກໃໝ່ */
  data: Income | null;
  /** ບັນຊີເງິນຄັງທັງໝົດ (ມີ banks + treasury.currency) — ເລືອກໄດ້ສະເພາະອັນທີ່ໃຊ້ງານ */
  accounts: TreasuryAccount[];
  onClose: () => void;
  onSaved: () => void;
};

/**
 * ຟອມບັນທຶກລາຍຮັບ — POST /income/create, PUT /income/:id (multipart, ໄຟລ໌ "file_doct").
 * ຂັ້ນ 1 ລາຍການ + ປະເພດ, ຂັ້ນ 2 ບັນຊີຮັບເງິນ + ຈຳນວນ + ອາກອນ (ບໍ່ມີ / ເລືອກຈາກຕັ້ງຄ່າ / ປ້ອນເອງ), ຂັ້ນ 3 ໄຟລ໌.
 * ບັນທຶກແລ້ວເງິນເຂົ້າບັນຊີທັນທີ ຈຶ່ງຢືນຢັນກ່ອນ; ຕອນແກ້ໄຂ ບັນຊີ/ຈຳນວນ/ອາກອນ ລັອກ (ຕ້ອງຍົກເລີກແລ້ວບັນທຶກໃໝ່)
 */
const IncomeForm = ({ data, accounts, onClose, onSaved }: Props) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const isEdit = !!data;
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [taxMode, setTaxMode] = useState<TaxMode>('none');
  const [manualMethod, setManualMethod] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [customer, setCustomer] = useState<CustomerValue>({
    partner: data?.partner_id ? data.partner ?? null : null,
    name: data?.payer_name ?? data?.partner?.name ?? '',
  });
  const [classes, setClasses] = useState<AccountClass[]>([]);
  /** ໝວດທີ່ຮັບເງິນເຂົ້າ — ຕອນແກ້ໄຂ ເອົາຕາມບັນຊີທີ່ບັນທຶກແລ້ວ; ບັນທຶກໃໝ່ ຕັ້ງເປັນໝວດເງິນສົດເມື່ອໂຫຼດໝວດແລ້ວ */
  const [receiveClass, setReceiveClass] = useState<number | null>(classIdOf(data?.acount ?? undefined) ?? null);
  const [inputs, setInputs] = useState<any>({
    income_date: data ? incomeDateOf(data).toDate() : new Date(),
    incom_title: data?.incom_title ?? '',
    type_incom_fk: data?.type_incom_fk ?? null,
    description: data?.description ?? '',
    acount_id_fk: data?.acount_id_fk ?? null,
    balances: data ? Number(data.balances) : null,
    tax_id: null,
    tax: null,
    payer_bank_id: data?.payer_bank_id ?? null,
    payer_account_name: data?.payer_account_name ?? '',
    payer_account_number: data?.payer_account_number ?? '',
  });

  useEffect(() => {
    getApi('/finance-category/option/1')
      .then((res) => setCategories(res.data?.data ?? []))
      .catch((error) => console.error(error));
    getApi('/tax/option')
      .then((res) => setTaxes(res.data?.data ?? []))
      .catch((error) => console.error(error));
    getApi('/type-account/option')
      .then((res) => {
        const list: AccountClass[] = [...(res.data?.data ?? [])]
          .sort((a, b) => String(a.type_code).localeCompare(String(b.type_code), undefined, { numeric: true }));
        setClasses(list);
        setReceiveClass((current) => current ?? (list.find((c) => c.type_code === CASH_CLASS_CODE) ?? list[0])?._uuid ?? null);
      })
      .catch((error) => console.error(error));
  }, []);

  /** ປ່ຽນໝວດ → ລ້າງບັນຊີທີ່ເລືອກໄວ້ ຖ້າມັນບໍ່ຢູ່ໃນໝວດໃໝ່ */
  const selectReceive = (value: number) => {
    setReceiveClass(value);
    if (classIdOf(accounts.find((a) => a._uuid === inputs.acount_id_fk)) !== value) {
      setInputs({ ...inputs, acount_id_fk: null });
    }
  };

  // ລ້າງ URL ຂອງຮູບຕົວຢ່າງເມື່ອປ່ຽນໄຟລ໌ ຫຼື ປິດຟອມ
  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  const usable = accounts.filter((a) => Number(a.status) === 1);
  /** ບັນຊີຮັບເງິນ = ສະເພາະບັນຊີໃນໝວດທີ່ເລືອກ */
  const active = usable.filter((a) => classIdOf(a) === receiveClass);
  const selectedClass = classes.find((c) => c._uuid === receiveClass);
  // ຕອນແກ້ໄຂ ໃຊ້ຄ່າທີ່ບັນທຶກໄວ້; ບັນທຶກໃໝ່ ໝວດເງິນສົດ = ເງິນສົດ, ໝວດອື່ນ = ເງິນໂອນ
  const receiveType = isEdit
    ? (Number(data.receive_type) === TRANSFER ? TRANSFER : CASH)
    : (selectedClass?.type_code === CASH_CLASS_CODE ? CASH : TRANSFER);
  const account = accounts.find((a) => a._uuid === inputs.acount_id_fk) ?? data?.acount ?? undefined;
  const symbol = currencySymbol(account?.treasury?.currency);
  const money = (value: number) => `${symbol} ${formatNumber(value)}`.trim();
  const amount = Number(inputs.balances) || 0;
  const selectedTax = taxes.find((x) => x._uuid === inputs.tax_id);
  const calc = isEdit
    ? { tax: Number(data.tax) || 0, total: Number(data.balance_income) || 0 }
    : computeTax(amount, taxMode, selectedTax, Number(inputs.tax) || 0, manualMethod);

  const categoryOptions = categories.map((c) => ({
    label: `${c.type_code} ${c.type_name}`,
    value: c._uuid,
    code: c.type_code,
    name: c.type_name,
    tone: 'is-emerald',
  }));
  const taxOptions = taxes.map((x) => ({
    label: `${x.name} (${Number(x.rate)}%)`,
    value: x._uuid,
    code: `${Number(x.rate)}%`,
    name: x.name,
    cur: t(Number(x.calc_method) === 1 ? 'taxInclusive' : 'taxExclusive'),
    tone: 'is-gold',
  }));

  const model = Schema.Model<any>({
    income_date: DateType().isRequired(t('selectRequired')),
    incom_title: StringType().isRequired(t('inputRequired')),
    type_incom_fk: NumberType().isRequired(t('selectRequired')),
    ...(isEdit
      ? {}
      : {
        acount_id_fk: NumberType()
          .isRequired(t('selectRequired'))
          .addRule((value) => classIdOf(accounts.find((a) => a._uuid === value)) === receiveClass, t('incomeClassOnly')),
        balances: NumberType().isRequired(t('inputRequired')).min(1, t('xferPositive')),
        ...(taxMode === 'select' ? { tax_id: NumberType().isRequired(t('selectRequired')) } : {}),
        ...(taxMode === 'manual'
          ? {
            tax: NumberType()
              .isRequired(t('inputRequired'))
              .min(0, t('xferPositive'))
              .addRule((value) => manualMethod !== 1 || Number(value) < amount, t('incomeTaxTooHigh')),
          }
          : {}),
      }),
  });

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0];
    e.target.value = '';
    if (!next) return;
    if (!isAllowedFile(next)) return Notific.warning('incomeFileType');
    if (next.size > MAX_FILE) return Notific.warning('incomeFileSize');
    setFile(next);
    setRemoveFile(false);
    setFilePreview(/^image\//.test(next.type) ? URL.createObjectURL(next) : null);
  };

  const clearFile = () => {
    setFile(null);
    setFilePreview(null);
    if (data?.file_doct) setRemoveFile(true);
  };

  const save = async () => {
    const body = new FormData();
    // ສົ່ງເປັນ "YYYY-MM-DD" (FormData ບໍ່ຜ່ານ interceptor ທີ່ແປງ Date)
    body.append('income_date', moment(inputs.income_date).format('YYYY-MM-DD'));
    body.append('incom_title', String(inputs.incom_title).trim());
    body.append('type_incom_fk', String(inputs.type_incom_fk));
    body.append('description', String(inputs.description ?? '').trim());
    body.append('receive_type', String(receiveType));
    body.append('partner_id', customer.partner ? String(customer.partner._uuid) : '');
    body.append('payer_name', customer.name.trim());
    if (receiveType === TRANSFER) {
      if (inputs.payer_bank_id) body.append('payer_bank_id', String(inputs.payer_bank_id));
      body.append('payer_account_name', String(inputs.payer_account_name ?? '').trim());
      body.append('payer_account_number', String(inputs.payer_account_number ?? '').trim());
    }
    if (file) body.append('file_doct', file);
    if (isEdit) {
      if (removeFile && !file) body.append('remove_file', '1');
    } else {
      body.append('acount_id_fk', String(inputs.acount_id_fk));
      body.append('balances', String(amount));
      if (taxMode === 'select' && inputs.tax_id) body.append('tax_id', String(inputs.tax_id));
      if (taxMode === 'manual') {
        body.append('tax', String(Number(inputs.tax) || 0));
        body.append('calc_method', String(manualMethod));
      }
    }
    try {
      setSaving(true);
      if (isEdit) await putApi(`/income/${btoa(String(data._uuid))}`, body);
      else await postApi('/income/create', body);
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

  const submit = () => {
    if (!formRef.current?.check()) return;
    // ບັນທຶກໃໝ່ = ເງິນເຂົ້າບັນຊີທັນທີ ແລະ ແກ້ຈຳນວນບໍ່ໄດ້ອີກ → ຢືນຢັນກ່ອນ
    if (isEdit) save();
    else Notific.confirm(`${t('incomeConfirm')} ${money(calc.total)} → ${account?.acountName ?? ''}`, save);
  };

  const existingFile = data?.file_url && !removeFile && !file;
  // ບໍ່ສະແດງຍອດເງິນຂອງບັນຊີໃນຟອມລາຍຮັບ
  const renderAccount = renderAccountOption(t('treasuryNoBank'), false);

  return (
    <Modal open onClose={onClose} size="lg" className="acc-book-modal is-steps is-xfer">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-arrow-trend-up'}`} /></span>
          <span>
            <Modal.Title>{t(isEdit ? 'incomeEdit' : 'incomeAdd')}</Modal.Title>
            <small>{isEdit ? `${data.number} · ${t('incomeLockedNote')}` : t('incomeHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs} className="acc-book-main">
          <FormStep no={1} done={!!inputs.income_date && !!String(inputs.incom_title).trim() && !!inputs.type_incom_fk}
            title={t('incomeStepInfo')} hint={t('incomeStepInfoHint')}
          >
            {/* ລາຍການ (ເຕັມແຖວ) → ປະເພດ | ວັນທີຮັບເງິນ → ລາຍລະອຽດ — ຮູບແບບດຽວກັບຟອມລາຍຈ່າຍ */}
            <div className="is-wide">
              <InputField name="incom_title" label={t('incomeTitle')} placeholder={t('incomeTitlePlaceholder')}
                icon={<i className="fa-solid fa-pen" />}
              />
            </div>
            <PickerField name="type_incom_fk" label={t('incomeCategory')} data={categoryOptions} placeholder={t('select')}
              cleanable={false} renderOption={codeLabel} renderValue={codeLabel}
            />
            {/* ຄ່າຕັ້ງຕົ້ນມື້ນີ້, ລົງຍ້ອນຫຼັງໄດ້ */}
            <InputField name="income_date" label={t('incomeDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy"
              block cleanable={false} shouldDisableDate={isFutureDay} placeholder="dd/mm/yyyy"
            />
            <div className="is-wide">
              <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
            </div>
          </FormStep>

          <FormStep no={2} done={isEdit || (!!inputs.acount_id_fk && amount > 0)}
            title={t('incomeStepMoney')} hint={isEdit ? t('incomeLockedNote') : t('incomeStepMoneyHint')}
            note={isEdit && <><i className="fa-solid fa-lock" /> {t('incomeLocked')}</>}
          >
            {isEdit ? (
              // ບັນທຶກແລ້ວ — ວິທີຮັບເງິນ ແລະ ບັນຊີ ສະແດງຢ່າງດຽວ
              <div className="is-wide acc-xfer-preview">
                <span className={`acc-jr-method${receiveType === TRANSFER ? ' is-transfer' : ''}`}>
                  <i className={`fa-solid ${receiveType === TRANSFER ? 'fa-building-columns' : 'fa-money-bill-wave'}`} />
                  {t(receiveType === TRANSFER ? 'incomeReceiveTransfer' : 'incomeReceiveCash')}
                </span>
                <div className="acc-xfer-preview-row is-in">
                  {account && renderAccount(null, accountOption(account))}
                </div>
              </div>
            ) : (
              <>
                {/* ໝວດບັນຊີທີ່ຮັບເງິນເຂົ້າ — ວົນຕາມໝວດທີ່ມີໃນ ຕັ້ງຄ່າ → ໝວດບັນຊີ (ມີຈັກໝວດກໍ່ສະແດງຄົບ) */}
                <ChoiceTiles<number>
                  className="is-wide"
                  label={t('incomeReceiveLabel')}
                  value={receiveClass ?? -1}
                  onChange={selectReceive}
                  options={classes.map((c) => {
                    const count = usable.filter((a) => classIdOf(a) === c._uuid).length;
                    return {
                      value: c._uuid,
                      label: `${c.type_code} ${c.type_name}`,
                      icon: c.type_code === CASH_CLASS_CODE ? 'fa-money-bill-wave' : 'fa-building-columns',
                      hint: count ? `${count} ${t('bankAccounts')}` : t('bankNoAccounts'),
                    };
                  })}
                />
                <div className="is-wide">
                  <PickerField name="acount_id_fk" label={t('incomeAccount')} data={active.map((a) => accountOption(a))}
                    placeholder={t('select')} cleanable={false} renderOption={renderAccount} renderValue={renderAccount}
                    popupStyle={ACCOUNT_POPUP_STYLE} disabled={!receiveClass}
                    locale={{ noResultsText: t('incomeNoClassAccount') }}
                  />
                </div>
                <div className="acc-book-money is-usable">
                  <InputField name="balances" label={t('incomeAmount')} accepter={NumberInput}
                    formatter={toThousands} prefix={symbol || undefined} controls={false}
                  />
                </div>
                {/* ອາກອນ 3 ທາງເລືອກ — ແຖວດຽວແບບນ້ອຍ, ແຄບກໍ່ເລື່ອນຂ້າງ (ບໍ່ຕົກແຖວ) */}
                <ChoiceTiles<TaxMode>
                  className="acc-jr-tax-tiles"
                  label={t('incomeTaxField')}
                  value={taxMode}
                  onChange={setTaxMode}
                  options={[
                    { value: 'none', label: t('incomeTaxNone'), icon: 'fa-ban' },
                    { value: 'select', label: t('incomeTaxSelect'), icon: 'fa-list' },
                    { value: 'manual', label: t('incomeTaxManual'), icon: 'fa-keyboard' },
                  ]}
                />
                {taxMode === 'select' && (
                  <div className="is-wide">
                    <PickerField name="tax_id" label={t('incomeTaxPick')} data={taxOptions} placeholder={t('select')}
                      cleanable={false} renderOption={codeLabel} renderValue={codeLabel}
                      locale={{ noResultsText: t('incomeTaxNoSetup') }}
                    />
                  </div>
                )}
                {taxMode === 'manual' && (
                  <>
                    <InputField name="tax" label={t('taxAmount')} accepter={NumberInput}
                      formatter={toThousands} prefix={symbol || undefined} controls={false}
                    />
                    <ChoiceTiles<number>
                      label={t('taxCalc')}
                      value={manualMethod}
                      onChange={setManualMethod}
                      options={[
                        { value: 1, label: t('taxInclusive'), icon: 'fa-equals' },
                        { value: 2, label: t('taxExclusive'), icon: 'fa-plus' },
                      ]}
                    />
                  </>
                )}
              </>
            )}

            {/* ສະຫຼຸບ: ຈຳນວນ / ອາກອນ / ຍອດເຂົ້າບັນຊີ (ບໍ່ສະແດງຍອດຂອງບັນຊີ) */}
            <div className="is-wide acc-jr-summary">
              <div>
                <small>{t('incomeAmount')}</small>
                <b>{money(isEdit ? Number(data.balances) || 0 : amount)}</b>
              </div>
              <div>
                <small>{t('incomeTaxField')}</small>
                <b>{money(calc.tax)}</b>
              </div>
              <div className="is-total">
                <small>{t('incomeTotal')}</small>
                <b>+{money(calc.total)}</b>
              </div>
            </div>
          </FormStep>

          {/* ຮັບເງິນຈາກໃຜ — ລູກຄ້າ (ເລືອກຈາກລາຍຊື່ ຫຼື ພິມເອງ) ທຸກວິທີຮັບເງິນ; ເງິນໂອນມີຊື່/ເລກບັນຊີຜູ້ໂອນນຳ. ບໍ່ບັງຄັບ ແລະ ແກ້ໄດ້ຫຼັງບັນທຶກ */}
          <FormStep no={3} done={!!customer.name.trim() || !!(inputs.payer_account_name || inputs.payer_account_number)}
            title={t('incomeStepPayer')} hint={t('incomeStepPayerHint')}
          >
            <CustomerField side="income" value={customer} current={data?.partner} onChange={setCustomer} />
            {receiveType === TRANSFER && (
              <>
                <InputField name="payer_account_name" label={t('incomePayerName')} required={false}
                  icon={<i className="fa-solid fa-user" />}
                />
                <InputField name="payer_account_number" label={t('incomePayerNumber')} required={false}
                  placeholder="XXX-XXXX-XXXXX" icon={<i className="fa-solid fa-hashtag" />}
                />
              </>
            )}
          </FormStep>

          <FormStep no={4} done={!!file || !!existingFile} title={t('incomeStepFile')} hint={t('incomeStepFileHint')}>
            <div className="is-wide acc-jr-file">
              {file || existingFile ? (
                <div className="acc-jr-file-card">
                  <span className="acc-jr-file-thumb">
                    {filePreview
                      ? <img src={filePreview} alt="" />
                      : existingFile && !/\.pdf$/i.test(data?.file_doct ?? '')
                        ? <img src={data?.file_url ?? ''} alt="" />
                        : <i className="fa-solid fa-file-pdf" />}
                  </span>
                  <span className="acc-jr-file-name">
                    <b>{file?.name ?? data?.file_doct}</b>
                    {file
                      ? <small>{formatNumber(Math.round(file.size / 1024))} KB</small>
                      : <a href={data?.file_url ?? '#'} target="_blank" rel="noreferrer">{t('incomeFileView')}</a>}
                  </span>
                  <button type="button" className="acc-jr-file-remove" onClick={clearFile}
                    aria-label={t('incomeFileRemove')} title={t('incomeFileRemove')}
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              ) : (
                <label className="acs-logo-pick">
                  <span className="acs-logo-preview"><i className="fa-solid fa-paperclip" /></span>
                  <span className="acs-logo-text">
                    <b><i className="fa-solid fa-upload" /> {t('incomeFilePick')}</b>
                    <small>JPG, PNG, PDF · ≤ 5MB</small>
                  </span>
                  <input type="file" accept="image/*,application/pdf" hidden onChange={pickFile} />
                </label>
              )}
            </div>
          </FormStep>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={submit}>
          <i className="fa-solid fa-check" /> {t('save')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default IncomeForm;
