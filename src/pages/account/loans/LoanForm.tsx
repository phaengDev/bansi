import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, DatePicker, Form, Modal, NumberInput, Schema, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi, putApi } from '../../../utils/configApi';
import { InputField } from '../../../utils/inputFields';
import { useCurrency } from '../../../utils/selectOption';
import { useT } from '../../../context/LanguageContext';
import { CurrencyField } from '../../../components/Elements/CurrencyPicker';
import { accountOptionLabel, amountFormatter, useAccountOptions, useChartAccounts } from '../gl/glKit';
import { ChoiceTiles, FormStep, PickerField } from '../setting/settingKit';
import { postfixProp, runSave } from '../setting/settingApi';
import { ACCOUNT_POPUP_STYLE, accountOption, renderAccountOption } from '../ledger/accountOption';
import {
  BORROWED, LOAN_FREQUENCIES, LOAN_METHODS, money, showDate, termText, useTreasuryAccounts,
  type Direction, type LoanDetail, type ScheduleRow,
} from './loanApi';

const { StringType, NumberType, DateType } = Schema.Types;

const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const toKey = (d: Date | null | undefined) => (d ? moment(d).format('YYYY-MM-DD') : null);
const toDate = (s: string | null | undefined) => (s ? moment(s, 'YYYY-MM-DD').toDate() : null);
/** ໄລຍະກູ້ທີ່ໃຊ້ເລື້ອຍ (ເດືອນ) */
const TERM_PRESETS = [12, 24, 36, 60];
const SHORT_TERM_CODE = '2180';
const PREVIEW_ROWS = 6;

type Inputs = {
  loan_code: string;
  counterparty: string;
  contract_no: string;
  purpose: string;
  currency_id: number | null;
  principal: number | string | null;
  annual_rate: number | string | null;
  term: number | string | null;
  start_date: Date | null;
  first_due_date: Date | null;
  treasury_account_id: number | null;
  opening_date: Date | null;
  loan_account_id: number | null;
  interest_account_id: number | null;
  note: string;
};

/**
 * ຟອມເງິນກູ້ (ເງິນກູ້ຢືມ / ເງິນໃຫ້ກູ້) — ຊ້າຍ: ບັດ + ຕົວຢ່າງຕາຕະລາງຜ່ອນ (POST /loan/preview ຕາມທີ່ປ້ອນ),
 * ຂວາ: 1 ຄູ່ສັນຍາ, 2 ເງື່ອນໄຂ, 3 ການຮັບ/ຈ່າຍເງິນກູ້ (ບັນຊີເງິນຄັງ ຫຼື ຍອດຍົກມາ), 4 ບັນຊີ (ພັບໄວ້).
 * ມີການຈ່າຍ / ຄິດດອກເບ້ຍຄ້າງແລ້ວ (locked) = ແກ້ໄດ້ສະເພາະຊື່, ເລກສັນຍາ, ຈຸດປະສົງ, ໝາຍເຫດ ແລະ ບັນຊີດອກເບ້ຍ
 */
const LoanForm = ({ direction, row, nextCode, onClose, onSaved }: {
  direction: Direction;
  row: LoanDetail | null;
  nextCode: string;
  onClose: () => void;
  onSaved: (id: number) => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const borrowed = direction === BORROWED;
  const locked = !!row?.locked;
  const currencies = useCurrency();
  const lak = currencies.find((c) => c.label === 'LAK');
  const { rows: accounts } = useChartAccounts();
  const loanOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === (borrowed ? 2 : 1));
  const interestOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === (borrowed ? 5 : 4));
  const [method, setMethod] = useState(row?.method ?? 1);
  const [frequency, setFrequency] = useState(row?.frequency_months ?? 1);
  const [actualDays, setActualDays] = useState(Number(row?.day_basis) === 2);
  const [startMode, setStartMode] = useState(row?.start_mode ?? 1);
  const [accountsOpen, setAccountsOpen] = useState(!!(row?.interest_account_id || row?.note));
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Inputs>(() => ({
    loan_code: row?.loan_code ?? nextCode,
    counterparty: row?.counterparty ?? '',
    contract_no: row?.contract_no ?? '',
    purpose: row?.purpose ?? '',
    currency_id: row?.currency_id ?? null,
    principal: row?.principal ?? null,
    annual_rate: row?.annual_rate ?? null,
    term: row?.term ?? 12,
    start_date: toDate(row?.start_date) ?? new Date(),
    first_due_date: toDate(row?.first_due_date) ?? moment().add(1, 'month').toDate(),
    treasury_account_id: row?.treasury_account_id ?? null,
    opening_date: toDate(row?.opening_date) ?? moment().startOf('year').toDate(),
    loan_account_id: row?.loan_account_id ?? null,
    interest_account_id: row?.interest_account_id ?? null,
    note: row?.note ?? '',
  }));
  const currencyId = inputs.currency_id ?? lak?.value ?? null;
  const currency = currencies.find((c) => c.value === currencyId);
  const symbol = { genus: currency?.genus, name: currency?.label ?? 'LAK' };
  const treasuries = useTreasuryAccounts(currencyId);
  const term = Math.round(num(inputs.term));
  const months = term * frequency;
  const shortTerm = accounts.find((a) => a.account_code === SHORT_TERM_CODE);

  // ---- ຕົວຢ່າງຕາຕະລາງຜ່ອນ (ລໍຖ້າພິມແລ້ວ 300ms) ----
  const terms = {
    principal: num(inputs.principal), annual_rate: num(inputs.annual_rate), method, day_basis: actualDays ? 2 : 1,
    frequency_months: frequency, term, start_date: toKey(inputs.start_date), first_due_date: toKey(inputs.first_due_date), currency_id: currencyId,
  };
  const termsKey = JSON.stringify(terms);
  const [preview, setPreview] = useState<{ rows: ScheduleRow[]; interest: number; total: number } | null>(null);
  useEffect(() => {
    const ready = terms.principal > 0 && term > 0 && terms.start_date && terms.first_due_date && terms.first_due_date > terms.start_date;
    if (!ready) {
      setPreview(null);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      postApi('/loan/preview', terms)
        .then((res) => alive && setPreview({ rows: res.data?.data ?? [], interest: res.data?.total_interest ?? 0, total: res.data?.total_payment ?? 0 }))
        .catch(() => alive && setPreview(null));
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termsKey]);

  /** ປ່ຽນວັນທີກູ້ / ໄລຍະຈ່າຍ → ງວດທຳອິດເລື່ອນຕາມ (ຖ້າຍັງເປັນຄ່າທີ່ລະບົບຕັ້ງໃຫ້) */
  const setStart = (next: Inputs) => {
    const autoDue = moment(inputs.start_date).add(frequency, 'months').isSame(inputs.first_due_date, 'day');
    if (!locked && next.start_date && autoDue && !moment(next.start_date).isSame(inputs.start_date, 'day')) {
      next = { ...next, first_due_date: moment(next.start_date).add(frequency, 'months').toDate() };
    }
    setInputs(next);
  };
  const pickFrequency = (next: number) => {
    const autoDue = moment(inputs.start_date).add(frequency, 'months').isSame(inputs.first_due_date, 'day');
    setFrequency(next);
    setInputs({
      ...inputs,
      term: Math.max(1, Math.round(months / next)) || 1,
      first_due_date: autoDue && inputs.start_date ? moment(inputs.start_date).add(next, 'months').toDate() : inputs.first_due_date,
    });
  };

  const model = useMemo(() => Schema.Model<any>({
    counterparty: StringType().isRequired(t('inputRequired')),
    principal: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0.01, t('lnPrincipalPositive')),
    annual_rate: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0, t('lnRateRange')).max(100, t('lnRateRange')),
    term: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnTermRange')).max(600, t('lnTermRange')),
    start_date: DateType().isRequired(t('selectRequired')),
    first_due_date: DateType().isRequired(t('selectRequired'))
      .addRule((value, data) => !data.start_date || moment(value).isAfter(data.start_date, 'day'), t('lnFirstDueAfter')),
    ...(startMode === 1 ? { treasury_account_id: NumberType().isRequired(t('selectRequired')) } : { opening_date: DateType().isRequired(t('selectRequired')) }),
  }), [startMode, t]);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const loanAccount = inputs.loan_account_id ?? (!row && borrowed && months <= 12 && shortTerm ? shortTerm._uuid : null);
    const payload = {
      direction,
      loan_code: String(inputs.loan_code ?? '').trim(),
      counterparty: inputs.counterparty.trim(),
      contract_no: inputs.contract_no,
      purpose: inputs.purpose,
      note: inputs.note,
      interest_account_id: inputs.interest_account_id,
      ...(locked ? {} : {
        ...terms,
        start_date: toKey(inputs.start_date),
        first_due_date: toKey(inputs.first_due_date),
        start_mode: startMode,
        treasury_account_id: startMode === 1 ? inputs.treasury_account_id : null,
        opening_date: startMode === 2 ? toKey(inputs.opening_date) : null,
        loan_account_id: loanAccount,
      }),
    };
    let savedId = row?._uuid ?? 0;
    const ok = await runSave(async () => {
      const res = row ? await putApi(`/loan/${row._uuid}`, payload) : await postApi('/loan/create', payload);
      savedId = res.data?.data?._uuid ?? savedId;
    }, setSaving);
    if (ok) {
      onSaved(savedId);
      onClose();
    }
  };

  const first = preview?.rows[0];
  const last = preview?.rows[preview.rows.length - 1];
  const level = method === 1 && preview && preview.rows.length > 1;
  const renderTreasury = renderAccountOption(t('treasuryNoBank'));
  const titleKey = row ? (borrowed ? 'lnEditBorrowed' : 'lnEditLent') : borrowed ? 'lnAddBorrowed' : 'lnAddLent';

  return (
    <Modal open onClose={onClose} size="lg" keyboard={false} className="acc-book-modal is-steps acc-ln-modal">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className={`fa-solid ${borrowed ? 'fa-building-columns' : 'fa-hand-holding-dollar'}`} /></span>
          <span>
            <Modal.Title>{t(titleKey)}</Modal.Title>
            <small>{t(borrowed ? 'lnFormHintBorrowed' : 'lnFormHintLent')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-book-layout">
          {/* ---- ຊ້າຍ: ບັດ + ຕົວຢ່າງຕາຕະລາງຜ່ອນ ---- */}
          <aside className="acc-book-aside">
            <span className="acc-book-aside-label">{t('treasuryPreview')}</span>
            <div className={`acc-ln-card is-${borrowed ? 'borrowed' : 'lent'}${inputs.counterparty.trim() ? '' : ' is-empty'}`}>
              <div className="acc-ln-card-top">
                <span><b>{inputs.loan_code || 'LN-····'}</b><small>{t(borrowed ? 'lnBorrowed' : 'lnLent')}</small></span>
                <i className={`fa-solid ${borrowed ? 'fa-building-columns' : 'fa-hand-holding-dollar'}`} />
              </div>
              <div className="acc-ln-card-name">{inputs.counterparty.trim() || t(borrowed ? 'lnLender' : 'lnBorrower')}</div>
              <div className="acc-ln-card-amount">{money(num(inputs.principal), symbol)}</div>
              <div className="acc-ln-card-bottom">
                <span>{num(inputs.annual_rate)}% {t('lnPerYear')} · {t(LOAN_METHODS.find((m) => m.value === method)!.label)}</span>
                <em>{term ? termText(term, frequency, t) : '—'}</em>
              </div>
            </div>

            <dl className="acc-book-summary">
              <div><dt>{t(level ? 'lnPaymentLevel' : 'lnPaymentFirst')}</dt><dd>{first ? money(first.payment, symbol) : '—'}</dd></div>
              {!level && last && last !== first && <div><dt>{t('lnPaymentLast')}</dt><dd>{money(last.payment, symbol)}</dd></div>}
              <div><dt>{t('lnTotalInterest')}</dt><dd>{preview ? money(preview.interest, symbol) : '—'}</dd></div>
              <div><dt>{t('lnPeriod')}</dt><dd>{first ? `${showDate(first.due_date)} – ${showDate(last?.due_date)}` : '—'}</dd></div>
              <div className="is-total"><dt>{t('lnTotalPayment')}</dt><dd>{preview ? money(preview.total, symbol) : '—'}</dd></div>
            </dl>

            {preview && preview.rows.length > 0 && (
              <div className="acc-ln-mini">
                <table>
                  <thead><tr><th>#</th><th>{t('lnDue')}</th><th>{t('lnPrincipalShort')}</th><th>{t('lnInterestShort')}</th></tr></thead>
                  <tbody>
                    {preview.rows.slice(0, PREVIEW_ROWS).map((r) => (
                      <tr key={r.no}><td>{r.no}</td><td>{showDate(r.due_date)}</td><td>{formatNumber(r.principal)}</td><td>{formatNumber(r.interest)}</td></tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > PREVIEW_ROWS && <small>+ {preview.rows.length - PREVIEW_ROWS} {t('lnMoreRows')}</small>}
              </div>
            )}
          </aside>

          {/* ---- ຂວາ: ຊ່ອງປ້ອນ ---- */}
          <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(next) => setStart(next as Inputs)} className="acc-book-main">
            <FormStep no={1} done={!!inputs.counterparty.trim()} title={t(borrowed ? 'lnStepLender' : 'lnStepBorrower')} hint={t('lnStepPartyHint')}>
              <div className="is-wide acs-code-name">
                <InputField name="loan_code" label={t('faCode')} required={false} icon={<i className="fa-solid fa-hashtag" />} />
                <InputField name="counterparty" label={t(borrowed ? 'lnLender' : 'lnBorrower')} placeholder={t(borrowed ? 'lnLenderPlaceholder' : 'lnBorrowerPlaceholder')}
                  icon={<i className={`fa-solid ${borrowed ? 'fa-building-columns' : 'fa-user'}`} />}
                />
              </div>
              <InputField name="contract_no" label={t('lnContractNo')} required={false} icon={<i className="fa-solid fa-file-signature" />} />
              <InputField name="purpose" label={t('lnPurpose')} required={false} icon={<i className="fa-solid fa-bullseye" />} />
            </FormStep>

            <FormStep no={2} done={num(inputs.principal) > 0 && term > 0} title={t('lnStepTerms')} hint={t('lnStepTermsHint')}
              note={locked && <><i className="fa-solid fa-lock" /> {t('lnLockedNote')}</>}
            >
              <CurrencyField name="currency_id" label={t('accountTypeCurrency')} required={false} disabled={locked} cleanable={false} placeholder="LAK" />
              <div className="acc-fa-money">
                <InputField name="principal" label={t('lnPrincipal')} accepter={NumberInput} formatter={amountFormatter} prefix={symbol.genus || symbol.name}
                  controls={false} disabled={locked}
                />
              </div>
              <InputField name="annual_rate" label={t('lnAnnualRate')} accepter={NumberInput} {...postfixProp(`% / ${t('lnYear')}`)} controls={false} disabled={locked} />
              <div className="rs-form-group">
                <label className="form-label">{t('lnDayBasis')}</label>
                <div className={`acs-toggle-field${actualDays ? ' is-on' : ''}`}>
                  <Toggle checked={actualDays} onChange={setActualDays} disabled={locked} />
                  <span>{t(actualDays ? 'lnDayBasisActual' : 'lnDayBasisMonthly')}</span>
                </div>
              </div>
              <ChoiceTiles<number> className="is-wide" label={t('lnMethod')} value={method} onChange={setMethod} disabled={locked}
                options={LOAN_METHODS.map((m) => ({ value: m.value, label: t(m.label), hint: t(m.hint), icon: m.icon }))}
              />
              <ChoiceTiles<number> className="is-wide" label={t('lnFrequency')} value={frequency} onChange={pickFrequency} disabled={locked}
                options={LOAN_FREQUENCIES.map((f) => ({ value: f.value, label: t(f.label) }))}
              />
              <div className="is-wide acc-fa-life-row">
                <InputField name="term" label={t('lnTerm')} accepter={NumberInput} {...postfixProp(t('lnInstallments'))} disabled={locked} />
                <div className="acc-fa-presets" role="group" aria-label={t('lnTerm')}>
                  {TERM_PRESETS.filter((m) => m % frequency === 0).map((m) => (
                    <button key={m} type="button" disabled={locked} className={months === m ? 'is-active' : ''}
                      onClick={() => setInputs({ ...inputs, term: m / frequency })}
                    >
                      {termText(m / frequency, frequency, t)}
                    </button>
                  ))}
                </div>
              </div>
              <InputField name="start_date" label={t(borrowed ? 'lnStartDateBorrowed' : 'lnStartDateLent')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block
                cleanable={false} disabled={locked}
              />
              <InputField name="first_due_date" label={t('lnFirstDue')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} disabled={locked} />
            </FormStep>

            <FormStep no={3} done={startMode === 1 ? !!inputs.treasury_account_id : !!inputs.opening_date}
              title={t(borrowed ? 'lnStepReceive' : 'lnStepDisburse')} hint={t('lnStepStartHint')}
            >
              <ChoiceTiles<number> className="is-wide" label={t('lnStartMode')} value={startMode} onChange={setStartMode} disabled={locked}
                options={[
                  { value: 1, label: t(borrowed ? 'lnModeReceive' : 'lnModeDisburse'), hint: t(borrowed ? 'lnModeReceiveHint' : 'lnModeDisburseHint'), icon: 'fa-building-columns' },
                  { value: 2, label: t('lnModeOpening'), hint: t('lnModeOpeningHint'), icon: 'fa-flag-checkered' },
                ]}
              />
              {startMode === 1 ? (
                <PickerField name="treasury_account_id" label={t(borrowed ? 'lnReceiveInto' : 'lnPayFrom')} className="is-wide" disabled={locked}
                  data={treasuries.map((a) => accountOption(a))} placeholder={treasuries.length ? t('select') : t('lnNoTreasury')}
                  renderOption={renderTreasury} renderValue={renderTreasury} popupStyle={ACCOUNT_POPUP_STYLE}
                />
              ) : (
                <>
                  <InputField name="opening_date" label={t('lnOpeningDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} disabled={locked} />
                  <p className="acc-gl-hint"><i className="fa-solid fa-book" /> {t('lnOpeningRule')}</p>
                </>
              )}
            </FormStep>

            <FormStep no={4} done title={t('faAccounts')} hint={t('lnAccountsHint')}
              summary={[inputs.loan_account_id, inputs.interest_account_id].some(Boolean)
                ? [inputs.loan_account_id, inputs.interest_account_id].map((id) => accounts.find((a) => a._uuid === id)?.account_code ?? t('faDefaultShort')).join(' · ')
                : t('faUseDefault')}
              collapsed={!accountsOpen} onToggle={() => setAccountsOpen((open) => !open)}
            >
              <PickerField name="loan_account_id" label={t(borrowed ? 'lnLoanAccountBorrowed' : 'lnLoanAccountLent')} data={loanOptions} required={false} disabled={locked}
                placeholder={!row && borrowed && months <= 12 && shortTerm ? `${shortTerm.account_code} · ${t('lnShortTermAuto')}` : t('faUseDefault')}
                renderOption={accountOptionLabel} renderValue={(_: unknown, item: any) => accountOptionLabel(_, item)}
              />
              <PickerField name="interest_account_id" label={t(borrowed ? 'lnInterestExpenseAccount' : 'lnInterestIncomeAccount')} data={interestOptions} required={false}
                placeholder={t('faUseDefault')} renderOption={accountOptionLabel} renderValue={(_: unknown, item: any) => accountOptionLabel(_, item)}
              />
              <div className="is-wide">
                <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
              </div>
            </FormStep>
          </Form>
        </div>
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

export default LoanForm;
