import { useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker, Form, NumberInput, Schema, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../utils/configApi';
import { InputField } from '../../utils/inputFields';
import { canDelete } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { ChoiceTiles, FormStep, PickerField, SettingModal } from '../account/setting/settingKit';
import { postfixProp, runSave } from '../account/setting/settingApi';
import { ACCOUNT_POPUP_STYLE, accountOption, renderAccountOption } from '../account/ledger/accountOption';
import { LOAN_METHODS, money, showDate, useTreasuryAccounts, type ScheduleRow } from '../account/loans/loanApi';
import type { ContractDetail } from './creditApi';

const { StringType, NumberType, DateType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const key = (d: Date) => moment(d).format('YYYY-MM-DD');
const PREVIEW_ROWS = 4;

/** ດອກເບ້ຍຂອງງວດທີ່ຄົບກຳນົດແລ້ວ ແຕ່ຍັງບໍ່ໄດ້ຈ່າຍ */
export const overdueInterestOf = (c: ContractDetail, date = moment().format('YYYY-MM-DD')) =>
  c.schedule.filter((r) => ['overdue', 'partial'].includes(r.state) && r.due_date <= date).reduce((n, r) => n + r.due_interest, 0);

/**
 * ຕັດໜີ້ສູນ — ຕົ້ນທຶນຄ້າງອອກຈາກປຶ້ມ (ໃຊ້ເງິນແຮກ່ອນ ສ່ວນເກີນເປັນຄ່າໃຊ້ຈ່າຍ), ດອກເບ້ຍ / ຄ່າປັບ ບັນທຶກໄວ້ຕິດຕາມ.
 * ຫຼັກຊັບຍັງຖືຢູ່ (ຍຶດໄດ້ຢູ່ລາຍລະອຽດລູກຄ້າ); ເກັບຄືນໄດ້ພາຍຫຼັງ
 */
export const WriteOffForm = ({ contract, onClose, onSaved }: { contract: ContractDetail; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>({ date: new Date(), reason: '' });
  const cur = contract.currency;
  const interest = overdueInterestOf(contract);
  const model = useMemo(() => Schema.Model<any>({
    date: DateType().isRequired(t('selectRequired')),
    reason: StringType().isRequired(t('crReasonRequired')),
  }), [t]);
  const submit = async () => {
    if (!formRef.current?.check()) return;
    if (await runSave(() => postApi(`/credit/contract/${contract._uuid}/writeoff`, { date: key(inputs.date), reason: inputs.reason }), setSaving)) {
      onSaved();
      onClose();
    }
  };
  return (
    <SettingModal title={t('crWriteOff')} hint={`${contract.loan_code} · ${contract.customer?.full_name ?? ''}`} icon="fa-skull-crossbones" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" wide submit={{ label: t('crWriteOff'), icon: 'fa-skull-crossbones', danger: true }}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done title={t('crStepWriteOff')} hint={t('crStepWriteOffHint')}>
          <dl className="acc-book-summary is-wide">
            <div><dt>{t('lnPrincipalShort')} ({t('crOffBooks')})</dt><dd>{money(contract.outstanding, cur)}</dd></div>
            <div><dt>{t('crOverdueInterest')} ({t('crMemoOnly')})</dt><dd>{money(interest, cur)}</dd></div>
            <div><dt>{t('crPenaltyDue')} ({t('crMemoOnly')})</dt><dd>{money(contract.penalty.due, cur)}</dd></div>
            <div className="is-total"><dt>{t('crWriteOffTotal')}</dt><dd>{money(contract.outstanding + interest + contract.penalty.due, cur)}</dd></div>
          </dl>
          <p className="is-wide acc-gl-hint"><i className="fa-solid fa-book" /> {t('crWriteOffRule')}</p>
          <InputField name="date" label={t('crWriteOffDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
            shouldDisableDate={(d: Date) => moment(d).isAfter(moment(), 'day')}
          />
          <div />
          <div className="is-wide">
            <InputField name="reason" label={t('crReason')} placeholder={t('crWriteOffReasonPlaceholder')} icon={<i className="fa-solid fa-comment" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/** ເກັບຄືນໜີ້ສູນ — ເງິນເຂົ້າບັນຊີເງິນຄັງ, ລາຍຮັບໜີ້ສູນເກັບຄືນ (4250) */
export const RecoverForm = ({ contract, onClose, onSaved }: { contract: ContractDetail; onClose: () => void; onSaved: (paymentId: number) => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const treasuries = useTreasuryAccounts(contract.currency_id);
  const wo = contract.closure.writeoff!;
  const left = Math.max(0, wo.principal + wo.interest + wo.penalty - wo.recovered);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>({ pay_date: new Date(), amount: null, treasury_account_id: null, reference: '' });
  const cur = contract.currency;
  const model = useMemo(() => Schema.Model<any>({
    pay_date: DateType().isRequired(t('selectRequired')),
    treasury_account_id: NumberType().isRequired(t('selectRequired')),
    amount: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnPrincipalPositive')).max(left, t('crRecoverOver')),
  }), [left, t]);
  const submit = async () => {
    if (!formRef.current?.check()) return;
    let paymentId = 0;
    const ok = await runSave(async () => {
      const res = await postApi(`/credit/contract/${contract._uuid}/recover`, {
        pay_date: key(inputs.pay_date), treasury_account_id: inputs.treasury_account_id, amount: num(inputs.amount), reference: inputs.reference,
      });
      paymentId = res.data?.data?._uuid ?? 0;
    }, setSaving);
    if (ok) {
      onSaved(paymentId);
      onClose();
    }
  };
  const renderTreasury = renderAccountOption(t('treasuryNoBank'));
  return (
    <SettingModal title={t('crRecover')} hint={`${contract.loan_code} · ${contract.customer?.full_name ?? ''}`} icon="fa-hand-holding-dollar" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide submit={{ label: t('crRecover'), icon: 'fa-check' }}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done={num(inputs.amount) > 0} title={t('crStepRecover')} hint={t('crStepRecoverHint')}>
          <dl className="acc-book-summary is-wide">
            <div><dt>{t('crWrittenOff')}</dt><dd>{money(wo.principal + wo.interest + wo.penalty, cur)}</dd></div>
            <div><dt>{t('crRecovered')}</dt><dd>{money(wo.recovered, cur)}</dd></div>
            <div className="is-total"><dt>{t('crRecoverLeft')}</dt><dd>{money(left, cur)}</dd></div>
          </dl>
          <div className="is-wide acc-fa-money">
            <InputField name="amount" label={t('crAmountReceived')} accepter={NumberInput} formatter={amountFormatter} controls={false} prefix={cur?.genus || '₭'} />
          </div>
        </FormStep>
        <FormStep no={2} done={!!inputs.treasury_account_id} title={t('crStepCollectInto')} hint={t('crStepCollectIntoHint')}>
          <InputField name="pay_date" label={t('lnPayDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
            shouldDisableDate={(d: Date) => moment(d).isAfter(moment(), 'day') || moment(d).isBefore(moment(wo.date), 'day')}
          />
          <InputField name="reference" label={t('lnReference')} required={false} placeholder={t('crReferencePlaceholder')} icon={<i className="fa-solid fa-hashtag" />} />
          <PickerField name="treasury_account_id" label={t('lnReceiveInto')} className="is-wide"
            data={treasuries.map((a) => accountOption(a))} placeholder={treasuries.length ? t('select') : t('lnNoTreasury')}
            renderOption={renderTreasury} renderValue={renderTreasury} popupStyle={ACCOUNT_POPUP_STYLE}
          />
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/**
 * ປັບໂຄງສ້າງໜີ້ — ອອກສັນຍາໃໝ່ສຳລັບຕົ້ນທຶນທີ່ຄ້າງ (+ ດອກເບ້ຍທີ່ກາຍກຳນົດ ຖ້າເລືອກລວມ) ດ້ວຍອັດຕາ / ງວດໃໝ່;
 * ຕົວຢ່າງຕາຕະລາງຈາກ POST /loan/preview. ຄ່າປັບຕ້ອງຮັບ ຫຼື ຍົກເວັ້ນກ່ອນ
 */
export const RestructureForm = ({ contract, onClose, onSaved }: { contract: ContractDetail; onClose: () => void; onSaved: (loanId: number) => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const cur = contract.currency;
  const interest = overdueInterestOf(contract);
  const remaining = contract.schedule.filter((r) => ['overdue', 'partial', 'upcoming'].includes(r.state)).length || contract.term;
  const step = (d: Date) => (contract.frequency_days ? moment(d).add(contract.frequency_days, 'days') : moment(d).add(contract.frequency_months || 1, 'months')).toDate();
  const [method, setMethod] = useState(Number(contract.method));
  const [capitalize, setCapitalize] = useState(interest > 0);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>(() => ({
    date: new Date(), annual_rate: contract.annual_rate, term: remaining, first_due_date: step(new Date()), reason: '', note: '',
  }));
  const principal = contract.outstanding + (capitalize ? interest : 0);
  const [preview, setPreview] = useState<ScheduleRow[]>([]);
  const termsKey = JSON.stringify([principal, inputs.annual_rate, inputs.term, method, key(inputs.date), inputs.first_due_date && key(inputs.first_due_date)]);
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      if (!(num(inputs.term) > 0) || !inputs.first_due_date) return setPreview([]);
      postApi('/loan/preview', {
        principal, annual_rate: num(inputs.annual_rate), method, day_basis: contract.day_basis, frequency_months: contract.frequency_months,
        frequency_days: contract.frequency_days, term: num(inputs.term), start_date: key(inputs.date), first_due_date: key(inputs.first_due_date), currency_id: contract.currency_id,
      }).then((res) => alive && setPreview(res.data?.data ?? [])).catch(() => alive && setPreview([]));
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termsKey]);
  const model = useMemo(() => Schema.Model<any>({
    annual_rate: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0, t('crRateRange')).max(240, t('crRateRange')),
    term: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnTermRange')).max(600, t('lnTermRange')),
    first_due_date: DateType().isRequired(t('selectRequired')).addRule((v, d) => !d.date || moment(v).isAfter(d.date, 'day'), t('lnFirstDueAfter')),
    reason: StringType().isRequired(t('crReasonRequired')),
  }), [t]);
  const submit = async () => {
    if (!formRef.current?.check()) return;
    let loanId = 0;
    const ok = await runSave(async () => {
      const res = await postApi(`/credit/contract/${contract._uuid}/restructure`, {
        date: key(inputs.date), annual_rate: num(inputs.annual_rate), term: num(inputs.term), first_due_date: key(inputs.first_due_date),
        method, capitalize_interest: capitalize, reason: inputs.reason, note: inputs.note,
      });
      loanId = res.data?.data?.loan_id ?? 0;
    }, setSaving);
    if (ok) {
      onSaved(loanId);
      onClose();
    }
  };
  const first = preview[0];
  return (
    <SettingModal title={t('crRestructure')} hint={`${contract.loan_code} · ${contract.customer?.full_name ?? ''}`} icon="fa-shuffle" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide submit={{ label: t('crRestructure'), icon: 'fa-shuffle' }}
    >
      {contract.penalty.due > 0 && <p className="acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('crRestructurePenalty').replace('{a}', money(contract.penalty.due, cur))}</p>}
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done title={t('crStepNewTerms')} hint={t('crStepNewTermsHint')}>
          <div className="rs-form-group">
            <label className="form-label">{t('crCapitalize')}</label>
            <div className={`acs-toggle-field${capitalize ? ' is-on' : ''}`}>
              <Toggle checked={capitalize} onChange={setCapitalize} disabled={!(interest > 0)} />
              <span>{interest > 0 ? `${t('crOverdueInterest')} ${money(interest, cur)}` : t('crNoOverdueInterest')}</span>
            </div>
          </div>
          <dl className="acc-book-summary">
            <div><dt>{t('crOldOutstanding')}</dt><dd>{money(contract.outstanding, cur)}</dd></div>
            <div className="is-total"><dt>{t('crNewPrincipal')}</dt><dd>{money(principal, cur)}</dd></div>
          </dl>
          <InputField name="annual_rate" label={t('lnAnnualRate')} accepter={NumberInput} {...postfixProp(`% / ${t('lnYear')}`)} controls={false} />
          <InputField name="term" label={t('lnTerm')} accepter={NumberInput} {...postfixProp(t('lnInstallments'))} />
          <ChoiceTiles<number> className="is-wide" label={t('lnMethod')} value={method} onChange={setMethod}
            options={LOAN_METHODS.map((m) => ({ value: m.value, label: t(m.label), icon: m.icon }))}
          />
          <InputField name="date" label={t('crRestructureDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
            shouldDisableDate={(d: Date) => moment(d).isAfter(moment(), 'day')}
          />
          <InputField name="first_due_date" label={t('lnFirstDue')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} />
          {preview.length > 0 && (
            <div className="is-wide acc-ln-mini cr-mini-preview">
              <p><b>{t('crInstallment')} {money(first.payment, cur)}</b> · {preview.length} {t('lnInstallments')} · {showDate(first.due_date)} – {showDate(preview[preview.length - 1].due_date)}</p>
              <table>
                <thead><tr><th>#</th><th>{t('lnDue')}</th><th>{t('lnPrincipalShort')}</th><th>{t('lnInterestShort')}</th></tr></thead>
                <tbody>{preview.slice(0, PREVIEW_ROWS).map((r) => <tr key={r.no}><td>{r.no}</td><td>{showDate(r.due_date)}</td><td>{formatNumber(r.principal)}</td><td>{formatNumber(r.interest)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </FormStep>
        <FormStep no={2} done={!!String(inputs.reason).trim()} title={t('crStepRestructureWhy')} hint={t('crStepRestructureWhyHint')}>
          <div className="is-wide">
            <InputField name="reason" label={t('crReason')} placeholder={t('crRestructureReasonPlaceholder')} icon={<i className="fa-solid fa-comment" />} />
          </div>
          <div className="is-wide">
            <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/** ແຖບສະຖານະການປິດພິເສດ: ຕັດໜີ້ສູນ (ເກັບຄືນ / ຍົກເລີກ), ປັບໂຄງສ້າງເປັນ / ຈາກ ສັນຍາອື່ນ (ເປີດ / ຍົກເລີກ) */
export const ClosureBanner = ({ contract, onOpen, onRecover, onUndoWriteOff, onUndoRestructure }: {
  contract: ContractDetail;
  onOpen: (loanId: number) => void;
  onRecover: () => void;
  onUndoWriteOff: () => void;
  onUndoRestructure: () => void;
}) => {
  const t = useT();
  const { writeoff, restructured_from: from, restructured_into: into } = contract.closure;
  const cur = contract.currency;
  return (
    <>
      {writeoff && Number(contract.close_reason) === 4 && (
        <div className="cr-closure is-writeoff">
          <i className="fa-solid fa-skull-crossbones" />
          <div>
            <b>{t('crWrittenOffOn').replace('{d}', showDate(writeoff.date))}</b>
            <small>
              {t('lnPrincipalShort')} {money(writeoff.principal, cur)} · {t('lnInterestShort')} {formatNumber(writeoff.interest)} · {t('crPenalty')} {formatNumber(writeoff.penalty)}
              {' · '}{t('crRecovered')} <b>{money(writeoff.recovered, cur)}</b>
            </small>
            <small>{[writeoff.reason, writeoff.by].filter(Boolean).join(' · ')}</small>
          </div>
          <span>
            {canDelete && writeoff.recovered === 0 && <button type="button" className="acc-rp-btn" onClick={onUndoWriteOff}><i className="fa-solid fa-rotate-left" /> {t('crUndoWriteOff')}</button>}
            <button type="button" className="acc-rp-btn is-primary" onClick={onRecover}><i className="fa-solid fa-hand-holding-dollar" /> {t('crRecover')}</button>
          </span>
        </div>
      )}
      {into && (
        <div className="cr-closure is-restructure">
          <i className="fa-solid fa-shuffle" />
          <div>
            <b>{t('crRestructuredInto').replace('{c}', into.other_code ?? '').replace('{d}', showDate(into.date))}</b>
            <small>{t('crRestructureTerms').replace('{a}', money(into.old_outstanding, cur)).replace('{r1}', String(into.old_rate)).replace('{r2}', String(into.new_rate)).replace('{n1}', String(into.old_term)).replace('{n2}', String(into.new_term))}</small>
            <small>{[into.reason, into.by].filter(Boolean).join(' · ')}</small>
          </div>
          <span>
            {canDelete && <button type="button" className="acc-rp-btn" onClick={onUndoRestructure}><i className="fa-solid fa-rotate-left" /> {t('crUndoRestructure')}</button>}
            <button type="button" className="acc-rp-btn is-primary" onClick={() => onOpen(into.other_id)}><i className="fa-solid fa-file-signature" /> {into.other_code}</button>
          </span>
        </div>
      )}
      {from && (
        <div className="cr-closure is-from">
          <i className="fa-solid fa-shuffle" />
          <div>
            <b>{t('crRestructuredFrom').replace('{c}', from.other_code ?? '')}</b>
            <small>{t('crRestructureTerms').replace('{a}', money(from.old_outstanding, cur)).replace('{r1}', String(from.old_rate)).replace('{r2}', String(from.new_rate)).replace('{n1}', String(from.old_term)).replace('{n2}', String(from.new_term))}
              {from.capitalized_interest > 0 ? ` · ${t('crCapitalized')} ${formatNumber(from.capitalized_interest)}` : ''}</small>
          </div>
          <span><button type="button" className="acc-rp-btn" onClick={() => onOpen(from.other_id)}><i className="fa-solid fa-file-signature" /> {from.other_code}</button></span>
        </div>
      )}
    </>
  );
};
