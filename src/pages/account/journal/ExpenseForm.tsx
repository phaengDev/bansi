import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AutoComplete, Button, DatePicker, Form, Input, Modal, NumberInput, Schema, Textarea } from 'rsuite';
import moment from 'moment';
import type { FormInstance } from 'rsuite';
import { formatNumber, postApi, putApi } from '../../../utils/configApi';
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
  CASH, CASH_CLASS_CODE, MAX_FILE, TRANSFER, classIdOf, computeTax, defaultClassId, formatQty, isAllowedFile, isFutureDay,
  type TaxMode,
} from './journalKit';
import { useAccountClasses, useFinanceCategories, useTaxes } from '../../../utils/selectOption';
import CustomerField, { type CustomerValue, type PartnerRef } from './CustomerField';
import { kip, type BudgetCheck } from '../budget/budgetApi';
import { BudgetHint } from '../budget/BudgetKit';

const { StringType, NumberType, DateType } = Schema.Types;

/** ລາຍການຍ່ອຍທີ່ບັນທຶກແລ້ວ (tbl_expense_items) */
export type ExpenseItem = {
  _uuid: number;
  line_no: number;
  item_name: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  discount: number;
  amount: number;
};

/** ແຖວຈາກ POST /expense/fetch — ຫົວ + ປະເພດ (typeout), ບັນຊີ (acount + banks.url + treasury.currency), ລາຍການຍ່ອຍ */
export type Expense = {
  _uuid: number;
  number: string;
  /** ວັນທີຈ່າຍເງິນ YYYY-MM-DD */
  expense_date: string;
  expense_title: string;
  type_expense_fk: number;
  payee_name?: string | null;
  bill_no?: string | null;
  type_acountid: number;
  acount_id_fk: number;
  /** 1 = ເງິນສົດ, 2 = ເງິນໂອນ */
  pay_type: number;
  payee_bank_id?: number | null;
  payee_account_number?: string | null;
  payeeBank?: { _uuid: number; abbr?: string; name_la?: string; url?: string | null } | null;
  /** ລູກຄ້າ/ຜູ້ສະໜອງທີ່ຈ່າຍໃຫ້ (tbl_partner) — ບໍ່ບັງຄັບ, ບໍ່ຕັດໜີ້ */
  partner_id?: number | null;
  partner?: PartnerRef | null;
  /** ລວມທຸກລາຍການ / ອາກອນ / ຍອດຈ່າຍອອກແທ້ */
  subtotal: number;
  tax: number;
  balance_expense: number;
  description?: string | null;
  file_doct?: string | null;
  file_url?: string | null;
  status: number;
  createdAt: string;
  updatedAt?: string;
  typeout?: { _uuid: number; type_code: string; type_name: string } | null;
  acount?: (TreasuryAccount & { treasury?: AccountType }) | null;
  user?: { user_uuid: number; user_name: string } | null;
  items: ExpenseItem[];
};

export const expenseDateOf = (row: Pick<Expense, 'expense_date'>) => moment(row.expense_date, 'YYYY-MM-DD');

/** ລາຍການຍ່ອຍ 1 ແຖວ (ຈະເປັນ table ລາຍລະອຽດ ແຍກຈາກຫົວ) — key ໃຊ້ພາຍໃນຟອມເທົ່ານັ້ນ */
type Line = {
  key: number;
  name: string;
  qty: number | null;
  unit: string;
  price: number | null;
  discount: number | null;
};

/** ຫົວໜ່ວຍທີ່ໃຊ້ເລື້ອຍ — ພິມເອງໄດ້ຖ້າບໍ່ມີໃນລາຍການ */
const UNITS = ['ອັນ', 'ແພັກ', 'ກ່ອງ', 'ແກັດ', 'ຕຸກ', 'ກິໂລ', 'ລິດ', 'ຊຸດ', 'ໂຕ', 'ໃບ', 'ຫໍ່', 'ມັດ', 'ຄັ້ງ', 'ເດືອນ'];

let lineSeq = 0;
const newLine = (): Line => ({ key: ++lineSeq, name: '', qty: 1, unit: '', price: null, discount: null });

const num = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
/** ເປັນເງິນຂອງແຖວ = ຈຳນວນ × ລາຄາ − ສ່ວນຫຼຸດ */
const grossOf = (line: Line) => num(line.qty) * num(line.price);
const lineTotalOf = (line: Line) => Math.max(0, Math.round(grossOf(line) - num(line.discount)));
/** ແຖວຫວ່າງທັງແຖວ (ບໍ່ໄດ້ປ້ອນຫຍັງ) — ຂ້າມຕອນກວດ ແລະ ຕອນສົ່ງ */
const isBlank = (line: Line) => !line.name.trim() && !line.price && !line.discount;
const lineErrors = (line: Line) => ({
  name: !line.name.trim(),
  qty: !(num(line.qty) > 0),
  price: line.price === null || num(line.price) < 0,
  discount: num(line.discount) < 0 || num(line.discount) > grossOf(line),
});

type Props = {
  /** null = ບັນທຶກໃໝ່ */
  data: Expense | null;
  /** ບັນຊີເງິນຄັງທັງໝົດ (ມີ banks + treasury.currency + ຍອດ) — ເລືອກໄດ້ສະເພາະອັນທີ່ໃຊ້ງານ */
  accounts: TreasuryAccount[];
  onClose: () => void;
  onSaved: () => void;
};

/**
 * ຟອມບັນທຶກລາຍຈ່າຍ — POST /expense/create, PUT /expense/:id (multipart, ໄຟລ໌ "file_doct", ລາຍການ = JSON "items").
 * ຫົວ (ຂັ້ນ 1, 3, 4) — ຫົວຂໍ້, ປະເພດ, ວັນທີຈ່າຍ, ບັນຊີທີ່ຈ່າຍ, ລູກຄ້າ/ຜູ້ສະໜອງ (ເລືອກ ຫຼື ພິມເອງ), ອາກອນ, ເລກທີ/ໄຟລ໌ໃບບິນ, ໝາຍເຫດ;
 * ລາຍລະອຽດ (ຂັ້ນ 2) — ຫຼາຍແຖວ: ລາຍການ, ຈຳນວນ, ຫົວໜ່ວຍ, ລາຄາ/ຫົວໜ່ວຍ, ສ່ວນຫຼຸດ, ເປັນເງິນ.
 * ລວມເປັນເງິນ = ຜົນລວມທຸກແຖວ → ຄິດອາກອນ → ຍອດຈ່າຍທັງໝົດ. ບັນຊີທີ່ຈ່າຍບໍ່ສະແດງຍອດ ແຕ່ເຕືອນເມື່ອຍອດບໍ່ພໍ.
 * ບັນທຶກແລ້ວເງິນອອກທັນທີ ຈຶ່ງຢືນຢັນກ່ອນ; ຕອນແກ້ໄຂ ລາຍການ / ບັນຊີ / ອາກອນ ລັອກ (ຕ້ອງຍົກເລີກແລ້ວບັນທຶກໃໝ່)
 */
const ExpenseForm = ({ data, accounts, onClose, onSaved }: Props) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const isEdit = !!data;
  const [saving, setSaving] = useState(false);
  const [removeFile, setRemoveFile] = useState(false);
  const categories = useFinanceCategories(2);
  const taxes = useTaxes();
  /** ຈ່າຍໃຫ້ໃຜ — ເລືອກລູກຄ້າ/ຜູ້ສະໜອງ ຫຼື ພິມຊື່ເອງ (ຊື່ເກັບໃນ payee_name) */
  const [customer, setCustomer] = useState<CustomerValue>({
    partner: data?.partner_id ? data.partner ?? null : null,
    name: data?.payee_name ?? data?.partner?.name ?? '',
  });
  const classes = useAccountClasses();
  const [payClassPicked, setPayClass] = useState<number | null>(classIdOf(data?.acount ?? undefined) ?? null);
  /** ຍັງບໍ່ເລືອກ = ໝວດເງິນສົດ (ຫຼື ໝວດທຳອິດ) */
  const payClass = payClassPicked ?? defaultClassId(classes);
  const [taxMode, setTaxMode] = useState<TaxMode>('none');
  const [manualMethod, setManualMethod] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  /** ກົດບັນທຶກແລ້ວ — ເລີ່ມໝາຍແຖວທີ່ປ້ອນບໍ່ຄົບເປັນສີແດງ */
  const [checked, setChecked] = useState(false);
  /** ແຖວທີ່ຫາກໍ່ເພີ່ມ — ໂຟກັສຊ່ອງຊື່ລາຍການໃຫ້ພິມຕໍ່ໄດ້ເລີຍ */
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const [inputs, setInputs] = useState<any>({
    expense_date: data ? expenseDateOf(data).toDate() : new Date(),
    expense_title: data?.expense_title ?? '',
    type_expense_fk: data?.type_expense_fk ?? null,
    bill_no: data?.bill_no ?? '',
    acount_id_fk: data?.acount_id_fk ?? null,
    tax_id: null,
    tax: null,
    payee_bank_id: data?.payee_bank_id ?? null,
    payee_account_number: data?.payee_account_number ?? '',
    description: data?.description ?? '',
  });

  useEffect(() => () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
  }, [filePreview]);

  // ---- ລາຍການຍ່ອຍ ----
  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => {
    const line = newLine();
    setLines((list) => [...list, line]);
    setFocusKey(line.key);
  };
  const removeLine = (key: number) => setLines((list) => (list.length > 1 ? list.filter((l) => l.key !== key) : list));
  /** Enter ໃນແຖວສຸດທ້າຍ = ເພີ່ມແຖວໃໝ່ (ບໍ່ຕ້ອງເອື້ອມໄປກົດປຸ່ມ) */
  const onLineKey = (e: KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && index === lines.length - 1) {
      e.preventDefault();
      addLine();
    }
  };

  const filled = lines.filter((l) => !isBlank(l));
  const linesValid = isEdit || (filled.length > 0 && filled.every((l) => !Object.values(lineErrors(l)).some(Boolean)));
  const subtotal = isEdit ? Number(data.subtotal) || 0 : filled.reduce((n, l) => n + lineTotalOf(l), 0);
  const itemCount = isEdit ? data.items.length : filled.length;

  // ---- ບັນຊີທີ່ຈ່າຍ ----
  const usable = accounts.filter((a) => Number(a.status) === 1);
  const inClass = usable.filter((a) => classIdOf(a) === payClass);
  const selectedClass = classes.find((c) => c._uuid === payClass);
  // ຕອນແກ້ໄຂ ໃຊ້ຄ່າທີ່ບັນທຶກໄວ້; ບັນທຶກໃໝ່ ໝວດເງິນສົດ = ເງິນສົດ, ໝວດອື່ນ = ເງິນໂອນ
  const payType = isEdit
    ? (Number(data.pay_type) === TRANSFER ? TRANSFER : CASH)
    : (selectedClass?.type_code === CASH_CLASS_CODE ? CASH : TRANSFER);
  const account = accounts.find((a) => a._uuid === inputs.acount_id_fk) ?? data?.acount ?? undefined;
  const symbol = currencySymbol(account?.treasury?.currency);
  const money = (value: number) => `${symbol} ${formatNumber(value)}`.trim();
  const selectedTax = taxes.find((x) => x._uuid === inputs.tax_id);
  const calc = isEdit
    ? { tax: Number(data.tax) || 0, total: Number(data.balance_expense) || 0 }
    : computeTax(subtotal, taxMode, selectedTax, Number(inputs.tax) || 0, manualMethod);
  /** ບໍ່ສະແດງຍອດຂອງບັນຊີ — ບອກພຽງວ່າພໍຈ່າຍບໍ່ (backend ກວດຊ້ຳຕອນບັນທຶກ) */
  const insufficient = !isEdit && !!account && calc.total > Number(account.balance_treasury ?? 0);

  // ---- ງົບປະມານຂອງປະເພດທີ່ເລືອກ (ເຕືອນເທົ່ານັ້ນ ບໍ່ກັ້ນການບັນທຶກ) ----
  const [budgetCheck, setBudgetCheck] = useState<BudgetCheck | null>(null);
  const budget = inputs.type_expense_fk ? budgetCheck : null;
  const budgetDate = inputs.expense_date ? moment(inputs.expense_date).format('YYYY-MM-DD') : '';
  useEffect(() => {
    if (!inputs.type_expense_fk) return;
    let cancelled = false;
    // ລໍຖ້າພິມຈຳນວນແລ້ວຄ່ອຍຖາມ (ບໍ່ຖາມທຸກຕົວອັກສອນ)
    const timer = setTimeout(() => {
      postApi('/budget/check', {
        category_id: inputs.type_expense_fk,
        expense_date: budgetDate,
        acount_id_fk: inputs.acount_id_fk ?? undefined,
        amount: calc.total,
        exclude_id: data?._uuid,
      })
        .then((res) => !cancelled && setBudgetCheck(res.data?.data ?? null))
        .catch(() => !cancelled && setBudgetCheck(null));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inputs.type_expense_fk, budgetDate, inputs.acount_id_fk, calc.total, data?._uuid]);
  /** ຍອດທີ່ຈະເກີນງົບ (ປີ ຫຼື ເດືອນ ອັນໃດຫຼາຍກວ່າ) — 0 = ບໍ່ເກີນ */
  const budgetOver = budget?.has_budget
    ? Math.max(0, -budget.after, budget.month ? -budget.month.after : 0)
    : 0;

  const selectPayClass = (value: number) => {
    setPayClass(value);
    if (classIdOf(accounts.find((a) => a._uuid === inputs.acount_id_fk)) !== value) {
      setInputs({ ...inputs, acount_id_fk: null });
    }
  };

  const categoryOptions = categories.map((c) => ({
    label: `${c.type_code} ${c.type_name}`,
    value: c._uuid,
    code: c.type_code,
    name: c.type_name,
    tone: 'is-coral',
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
    expense_date: DateType().isRequired(t('selectRequired')),
    expense_title: StringType().isRequired(t('inputRequired')),
    type_expense_fk: NumberType().isRequired(t('selectRequired')),
    ...(isEdit
      ? {}
      : {
        acount_id_fk: NumberType()
          .isRequired(t('selectRequired'))
          .addRule((value) => classIdOf(accounts.find((a) => a._uuid === value)) === payClass, t('incomeClassOnly')),
        ...(taxMode === 'select' ? { tax_id: NumberType().isRequired(t('selectRequired')) } : {}),
        ...(taxMode === 'manual'
          ? {
            tax: NumberType()
              .isRequired(t('inputRequired'))
              .min(0, t('xferPositive'))
              .addRule((value) => manualMethod !== 1 || Number(value) < subtotal, t('incomeTaxTooHigh')),
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
    setFilePreview(/^image\//.test(next.type) ? URL.createObjectURL(next) : null);
  };

  const clearFile = () => {
    setFile(null);
    setFilePreview(null);
    if (data?.file_doct) setRemoveFile(true);
  };

  const save = async () => {
    const body = new FormData();
    const text = (value: unknown) => String(value ?? '').trim();
    // ສົ່ງເປັນ "YYYY-MM-DD" (FormData ບໍ່ຜ່ານ interceptor ທີ່ແປງ Date)
    body.append('expense_date', moment(inputs.expense_date).format('YYYY-MM-DD'));
    body.append('expense_title', text(inputs.expense_title));
    body.append('type_expense_fk', String(inputs.type_expense_fk));
    body.append('payee_name', customer.name.trim());
    body.append('bill_no', text(inputs.bill_no));
    body.append('description', text(inputs.description));
    body.append('partner_id', customer.partner ? String(customer.partner._uuid) : '');
    if (payType === TRANSFER) {
      // ທະນາຄານຜູ້ຮັບບໍ່ມີໃຫ້ເລືອກແລ້ວ (ໃຊ້ລູກຄ້າແທນ) — ສົ່ງຄ່າເດີມຄືນ ບໍ່ໃຫ້ຂໍ້ມູນເກົ່າຫາຍ
      body.append('payee_bank_id', inputs.payee_bank_id ? String(inputs.payee_bank_id) : '');
      body.append('payee_account_number', text(inputs.payee_account_number));
    }
    if (file) body.append('file_doct', file);
    if (isEdit) {
      if (removeFile && !file) body.append('remove_file', '1');
    } else {
      body.append('acount_id_fk', String(inputs.acount_id_fk));
      body.append('items', JSON.stringify(filled.map((l) => ({
        item_name: l.name.trim(),
        quantity: num(l.qty),
        unit: l.unit.trim(),
        unit_price: num(l.price),
        discount: num(l.discount),
      }))));
      if (taxMode === 'select' && inputs.tax_id) body.append('tax_id', String(inputs.tax_id));
      if (taxMode === 'manual') {
        body.append('tax', String(Number(inputs.tax) || 0));
        body.append('calc_method', String(manualMethod));
      }
    }
    try {
      setSaving(true);
      if (isEdit) await putApi(`/expense/${btoa(String(data._uuid))}`, body);
      else await postApi('/expense/create', body);
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
    setChecked(true);
    const formOk = formRef.current?.check();
    if (!linesValid) Notific.warning('expenseLinesInvalid');
    if (!formOk || !linesValid) return;
    if (isEdit) return save();
    if (insufficient) return Notific.warning('expenseInsufficient');
    // ບັນທຶກໃໝ່ = ເງິນອອກຈາກບັນຊີທັນທີ ແລະ ແກ້ຈຳນວນບໍ່ໄດ້ອີກ → ຢືນຢັນກ່ອນ (ເກີນງົບ = ບອກໃນຂໍ້ຄວາມຢືນຢັນນຳ)
    const overText = budgetOver > 0 ? ` — ${t('expenseBudgetConfirm')} ${kip(budgetOver)}` : '';
    Notific.confirm(`${t('expenseConfirm')} ${money(calc.total)} ← ${account?.acountName ?? ''}${overText}`, save);
  };

  const existingFile = data?.file_url && !removeFile && !file;
  const renderAccount = renderAccountOption(t('treasuryNoBank'), false);
  const infoDone = !!inputs.expense_date && !!String(inputs.expense_title).trim() && !!inputs.type_expense_fk;

  return (
    <Modal open onClose={onClose} size="lg" className="acc-book-modal is-steps is-xfer is-expense">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-arrow-trend-down'}`} /></span>
          <span>
            <Modal.Title>{t(isEdit ? 'expenseEdit' : 'expenseAdd')}</Modal.Title>
            <small>{isEdit ? `${data.number} · ${t('expenseLockedNote')}` : t('expenseHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs} className="acc-book-main">
          {/* ---- ຂັ້ນ 1: ຫົວ ---- */}
          <FormStep no={1} done={infoDone} title={t('expenseStepInfo')} hint={t('expenseStepInfoHint')}>
            <div className="is-wide">
              <InputField name="expense_title" label={t('expenseTitle')} placeholder={t('expenseTitlePlaceholder')}
                icon={<i className="fa-solid fa-pen" />}
              />
            </div>
            <PickerField name="type_expense_fk" label={t('expenseCategory')} data={categoryOptions} placeholder={t('select')}
              cleanable={false} renderOption={codeLabel} renderValue={codeLabel}
            />
            <InputField name="expense_date" label={t('expenseDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy"
              block cleanable={false} shouldDisableDate={isFutureDay} placeholder="dd/mm/yyyy"
            />
          </FormStep>

          {/* ---- ຂັ້ນ 2: ລາຍລະອຽດ (ຫຼາຍແຖວ) ---- */}
          <FormStep no={2} done={linesValid} title={t('expenseStepItems')} hint={t('expenseStepItemsHint')}
            note={isEdit
              ? <><i className="fa-solid fa-lock" /> {t('incomeLocked')}</>
              : <><i className="fa-solid fa-list-ol" /> {itemCount} {t('incomeItems')}</>}
          >
            <div className="is-wide acc-ex-lines">
              <div className="acc-ex-row is-head" aria-hidden="true">
                <span>#</span>
                <span>{t('expenseItemName')}</span>
                <span>{t('expenseQty')}</span>
                <span>{t('expenseUnit')}</span>
                <span>{t('expenseUnitPrice')}</span>
                <span>{t('expenseDiscount')}</span>
                <span>{t('expenseLineTotal')}</span>
                <span />
              </div>

              {/* ບັນທຶກແລ້ວ — ລາຍການສະແດງຢ່າງດຽວ (ຍອດບັນຊີຜູກກັບມັນແລ້ວ) */}
              {isEdit && data.items.map((item, index) => (
                <div key={item._uuid} className="acc-ex-row is-view">
                  <span className="acc-ex-no">{index + 1}</span>
                  <span className="acc-ex-cell is-name"><small>{t('expenseItemName')}</small><b>{item.item_name}</b></span>
                  <span className="acc-ex-cell is-qty"><small>{t('expenseQty')}</small>{formatQty(item.quantity)}</span>
                  <span className="acc-ex-cell is-unit"><small>{t('expenseUnit')}</small>{item.unit || '—'}</span>
                  <span className="acc-ex-cell is-money"><small>{t('expenseUnitPrice')}</small>{formatNumber(item.unit_price)}</span>
                  <span className="acc-ex-cell is-money"><small>{t('expenseDiscount')}</small>{item.discount ? formatNumber(item.discount) : '—'}</span>
                  <span className="acc-ex-cell is-total"><small>{t('expenseLineTotal')}</small><b>{formatNumber(item.amount)}</b></span>
                  <span />
                </div>
              ))}

              {!isEdit && lines.map((line, index) => {
                const err = checked && !isBlank(line) ? lineErrors(line) : null;
                const blankError = checked && isBlank(line) && !filled.length && index === 0;
                return (
                  <div key={line.key} className="acc-ex-row" onKeyDown={(e) => onLineKey(e, index)}>
                    <span className="acc-ex-no">{index + 1}</span>
                    <label className={`acc-ex-cell is-name${err?.name || blankError ? ' has-error' : ''}`}>
                      <small>{t('expenseItemName')}</small>
                      <Input value={line.name} placeholder={t('expenseItemPlaceholder')} autoFocus={focusKey === line.key}
                        aria-label={`${t('expenseItemName')} ${index + 1}`}
                        onChange={(value) => updateLine(line.key, { name: value })}
                      />
                    </label>
                    <label className={`acc-ex-cell is-qty${err?.qty ? ' has-error' : ''}`}>
                      <small>{t('expenseQty')}</small>
                      <NumberInput value={line.qty} min={0} controls={false} aria-label={`${t('expenseQty')} ${index + 1}`}
                        onChange={(value) => updateLine(line.key, { qty: value === '' || value === null ? null : num(value) })}
                      />
                    </label>
                    <div className="acc-ex-cell is-unit">
                      <small>{t('expenseUnit')}</small>
                      <AutoComplete data={UNITS} value={line.unit} placeholder="—" filterBy={(value, item) => String(item.label).includes(value)}
                        aria-label={`${t('expenseUnit')} ${index + 1}`}
                        onChange={(value) => updateLine(line.key, { unit: String(value ?? '') })}
                      />
                    </div>
                    <label className={`acc-ex-cell is-money${err?.price ? ' has-error' : ''}`}>
                      <small>{t('expenseUnitPrice')}</small>
                      <NumberInput value={line.price} min={0} controls={false} formatter={toThousands}
                        aria-label={`${t('expenseUnitPrice')} ${index + 1}`}
                        onChange={(value) => updateLine(line.key, { price: value === '' || value === null ? null : num(value) })}
                      />
                    </label>
                    <label className={`acc-ex-cell is-money${err?.discount ? ' has-error' : ''}`}
                      title={err?.discount ? t('expenseDiscountTooHigh') : undefined}
                    >
                      <small>{t('expenseDiscount')}</small>
                      <NumberInput value={line.discount} min={0} controls={false} formatter={toThousands} placeholder="0"
                        aria-label={`${t('expenseDiscount')} ${index + 1}`}
                        onChange={(value) => updateLine(line.key, { discount: value === '' || value === null ? null : num(value) })}
                      />
                    </label>
                    <span className="acc-ex-cell is-total">
                      <small>{t('expenseLineTotal')}</small>
                      <b>{formatNumber(lineTotalOf(line))}</b>
                    </span>
                    <button type="button" className="acc-ex-remove" disabled={lines.length === 1}
                      aria-label={t('expenseRemoveLine')} title={t('expenseRemoveLine')} onClick={() => removeLine(line.key)}
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                );
              })}

              <div className="acc-ex-foot">
                {isEdit ? <span /> : (
                  <button type="button" className="acc-ex-add" onClick={addLine}>
                    <i className="fa-solid fa-plus" /> {t('expenseAddLine')}
                    <kbd>Enter</kbd>
                  </button>
                )}
                <span className="acc-ex-subtotal">
                  <small>{t('expenseSubtotal')}</small>
                  <b>{money(subtotal)}</b>
                </span>
              </div>
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 3: ຈ່າຍຈາກບັນຊີໃດ + ອາກອນ + ສະຫຼຸບ ---- */}
          <FormStep no={3} done={isEdit || (!!inputs.acount_id_fk && subtotal > 0 && !insufficient)}
            title={t('expenseStepPay')} hint={isEdit ? t('expenseLockedNote') : t('expenseStepPayHint')}
            note={isEdit && <><i className="fa-solid fa-lock" /> {t('incomeLocked')}</>}
          >
            {isEdit ? (
              // ບັນທຶກແລ້ວ — ວິທີຈ່າຍ ແລະ ບັນຊີ ສະແດງຢ່າງດຽວ
              <div className="is-wide acc-xfer-preview">
                <span className={`acc-jr-method${payType === TRANSFER ? ' is-transfer' : ''}`}>
                  <i className={`fa-solid ${payType === TRANSFER ? 'fa-building-columns' : 'fa-money-bill-wave'}`} />
                  {t(payType === TRANSFER ? 'incomeReceiveTransfer' : 'incomeReceiveCash')}
                </span>
                <div className="acc-xfer-preview-row is-out">
                  {account && renderAccount(null, accountOption(account))}
                </div>
              </div>
            ) : (
              <>
            <ChoiceTiles<number>
              className="is-wide"
              label={t('expensePayFrom')}
              value={payClass ?? -1}
              onChange={selectPayClass}
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
              <PickerField name="acount_id_fk" label={t('expenseAccount')} data={inClass.map((a) => accountOption(a))}
                placeholder={t('select')} cleanable={false} renderOption={renderAccount} renderValue={renderAccount}
                popupStyle={ACCOUNT_POPUP_STYLE} disabled={!payClass}
                locale={{ noResultsText: t('incomeNoClassAccount') }}
              />
            </div>
              </>
            )}
            <CustomerField side="expense" value={customer} current={data?.partner} onChange={setCustomer} />
            {payType === TRANSFER && (
              <InputField name="payee_account_number" label={t('expensePayeeNumber')} required={false}
                placeholder="XXX-XXXX-XXXXX" icon={<i className="fa-solid fa-hashtag" />}
              />
            )}
            {/* ອາກອນ 3 ທາງເລືອກ ຄິດຈາກ "ລວມເປັນເງິນ" ຂອງທຸກລາຍການ */}
            {!isEdit && (
            <ChoiceTiles<TaxMode>
              className="is-wide acc-jr-tax-tiles"
              label={t('incomeTaxField')}
              value={taxMode}
              onChange={setTaxMode}
              options={[
                { value: 'none', label: t('incomeTaxNone'), icon: 'fa-ban' },
                { value: 'select', label: t('incomeTaxSelect'), icon: 'fa-list' },
                { value: 'manual', label: t('incomeTaxManual'), icon: 'fa-keyboard' },
              ]}
            />
            )}
            {!isEdit && taxMode === 'select' && (
              <div className="is-wide">
                <PickerField name="tax_id" label={t('incomeTaxPick')} data={taxOptions} placeholder={t('select')}
                  cleanable={false} renderOption={codeLabel} renderValue={codeLabel}
                  locale={{ noResultsText: t('incomeTaxNoSetup') }}
                />
              </div>
            )}
            {!isEdit && taxMode === 'manual' && (
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

            <div className="is-wide acc-jr-summary is-expense">
              <div>
                <small>{t('expenseSubtotal')} · {itemCount} {t('incomeItems')}</small>
                <b>{money(subtotal)}</b>
              </div>
              <div>
                <small>{t('incomeTaxField')}</small>
                <b>{money(calc.tax)}</b>
              </div>
              <div className="is-total">
                <small>{t('expenseTotal')}</small>
                <b>−{money(calc.total)}</b>
              </div>
              {insufficient && (
                <p className="acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('expenseInsufficient')}</p>
              )}
            </div>
            {budget && <div className="is-wide"><BudgetHint check={budget} /></div>}
          </FormStep>

          {/* ---- ຂັ້ນ 4: ໃບບິນ + ໝາຍເຫດ ---- */}
          <FormStep no={4} done={!!file || !!existingFile} title={t('expenseStepFile')} hint={t('expenseStepFileHint')}>
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
                  <span className="acs-logo-preview"><i className="fa-solid fa-receipt" /></span>
                  <span className="acs-logo-text">
                    <b><i className="fa-solid fa-upload" /> {t('incomeFilePick')}</b>
                    <small>JPG, PNG, PDF · ≤ 5MB</small>
                  </span>
                  <input type="file" accept="image/*,application/pdf" hidden onChange={pickFile} />
                </label>
              )}
            </div>
            {/* ເລກທີໃບບິນ ຢູ່ກັບຮູບໃບບິນ */}
            <div className="is-wide">
              <InputField name="bill_no" label={t('expenseBillNo')} required={false} placeholder={t('expenseBillNoPlaceholder')}
                icon={<i className="fa-solid fa-hashtag" />}
              />
            </div>
            <div className="is-wide">
              <InputField name="description" label={t('expenseNote')} accepter={Textarea} rows={2} required={false} />
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

export default ExpenseForm;
