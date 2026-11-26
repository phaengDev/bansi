import { useMemo, useRef, useState } from 'react';
import { DatePicker, Form, NumberInput, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../utils/configApi';
import { InputField } from '../../utils/inputFields';
import { canDelete } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { ChoiceTiles, FormStep, SettingModal } from '../account/setting/settingKit';
import { runSave } from '../account/setting/settingApi';
import { money, showDate, type LoanCurrency } from '../account/loans/loanApi';
import { FOLLOW_METHODS, FOLLOW_RESULTS, agingOfDays, agingTone, type FollowUp, type PenaltyState, type Waiver } from './creditApi';

const { StringType, NumberType, DateType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;

/** ປ້າຍມື້ກາຍກຳນົດ — ສີຕາມກຸ່ມອາຍຸໜີ້ */
export const DaysLateChip = ({ days, aging }: { days: number; aging?: string }) => {
  const t = useT();
  if (!(days > 0)) return null;
  return <span className={`cr-late ${agingTone(aging ?? agingOfDays(days))}`}><i className="fa-solid fa-triangle-exclamation" /> {t('crDaysLateN').replace('{n}', String(days))}</span>;
};

/**
 * ບັນທຶກການຕິດຕາມທວງໜີ້ — ວິທີ (ໂທ / SMS / ລົງຢ້ຽມ / ໜັງສື / ຄະດີ), ຜົນ (ນັດຈ່າຍ = ຕ້ອງມີວັນນັດ), ໝາຍເຫດ
 */
export const FollowUpForm = ({ loanId, title, onClose, onSaved }: { loanId: number; title: string; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [method, setMethod] = useState(1);
  const [result, setResult] = useState(1);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>({ promise_date: moment().add(1, 'day').toDate(), promise_amount: null, note: '' });
  const promise = result === 1;
  const model = useMemo(() => Schema.Model<any>(promise ? { promise_date: DateType().isRequired(t('selectRequired')) } : {}), [promise, t]);
  const submit = async () => {
    if (!formRef.current?.check()) return;
    const body = {
      loan_id: loanId, method, result, note: inputs.note,
      promise_date: promise ? moment(inputs.promise_date).format('YYYY-MM-DD') : null, promise_amount: promise ? num(inputs.promise_amount) : 0,
    };
    if (await runSave(() => postApi('/credit/collection', body), setSaving)) {
      onSaved();
      onClose();
    }
  };
  return (
    <SettingModal title={t('crFollowUpAdd')} hint={title} icon="fa-phone-volume" saving={saving} onClose={onClose} onSubmit={submit} className="is-steps" wide>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done title={t('crStepFollowUp')} hint={t('crStepFollowUpHint')}>
          <ChoiceTiles<number> className="is-wide" label={t('crFollowMethod')} value={method} onChange={setMethod}
            options={FOLLOW_METHODS.map((m) => ({ value: m.value, label: t(m.label), icon: m.icon }))}
          />
          <ChoiceTiles<number> className="is-wide" label={t('crFollowResult')} value={result} onChange={setResult}
            options={FOLLOW_RESULTS.map((r) => ({ value: r.value, label: t(r.label), icon: r.icon }))}
          />
          {promise && (
            <>
              <InputField name="promise_date" label={t('crPromiseDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
                shouldDisableDate={(d: Date) => moment(d).isBefore(moment(), 'day')}
              />
              <div className="acc-fa-money">
                <InputField name="promise_amount" label={t('crPromiseAmount')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} prefix="₭" />
              </div>
            </>
          )}
          <div className="is-wide">
            <InputField name="note" label={t('note')} required={false} placeholder={t('crFollowNotePlaceholder')} icon={<i className="fa-solid fa-comment" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/** ຍົກເວັ້ນຄ່າປັບ — ບໍ່ເກີນຍອດຄ້າງ, ຕ້ອງມີເຫດຜົນ; ລະບົບບັນທຶກຊື່ຜູ້ອະນຸມັດ */
export const WaiveForm = ({ loanId, title, due, currency, onClose, onSaved }: {
  loanId: number; title: string; due: number; currency: LoanCurrency; onClose: () => void; onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>({ amount: due, reason: '' });
  const model = useMemo(() => Schema.Model<any>({
    amount: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnPrincipalPositive')).max(due, t('crWaiveOver')),
    reason: StringType().isRequired(t('crReasonRequired')),
  }), [due, t]);
  const submit = async () => {
    if (!formRef.current?.check()) return;
    if (await runSave(() => postApi(`/credit/contract/${loanId}/waive`, { amount: num(inputs.amount), reason: inputs.reason }), setSaving)) {
      onSaved();
      onClose();
    }
  };
  return (
    <SettingModal title={t('crWaive')} hint={title} icon="fa-hand-holding-heart" saving={saving} onClose={onClose} onSubmit={submit}
      className="is-steps" submit={{ label: t('crWaive'), icon: 'fa-check' }}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done title={t('crStepWaive')} hint={t('crStepWaiveHint').replace('{a}', money(due, currency))}>
          <div className="is-wide acc-fa-money">
            <InputField name="amount" label={t('crWaiveAmount')} accepter={NumberInput} formatter={amountFormatter} controls={false} prefix={currency?.genus || '₭'} />
          </div>
          <div className="is-wide">
            <InputField name="reason" label={t('crReason')} placeholder={t('crWaiveReasonPlaceholder')} icon={<i className="fa-solid fa-comment" />} />
          </div>
          <p className="is-wide acc-gl-hint"><i className="fa-solid fa-user-check" /> {t('crWaiveApprover').replace('{n}', localStorage.getItem('user_name') ?? '')}</p>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/** ຄ່າປັບແຕ່ລະງວດ + ການຍົກເວັ້ນ (ຍົກເລີກໄດ້) */
export const PenaltyPanel = ({ state, waivers, currency, rate, grace, onUndoWaiver }: {
  state: PenaltyState; waivers: Waiver[]; currency: LoanCurrency; rate: number; grace: number; onUndoWaiver: (w: Waiver) => void;
}) => {
  const t = useT();
  return (
    <div className="cr-penalty">
      <p className="acc-gl-hint"><i className="fa-solid fa-gavel" /> {rate > 0 ? t('crPenaltyRule').replace('{r}', String(rate)).replace('{g}', String(grace)) : t('crNoPenaltyRule')}</p>
      {!state.rows.length ? (
        <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-circle-check" /><p>{t('crNoPenalty')}</p></div>
      ) : (
        <div className="acc-rp-scroll acc-ln-table-wrap">
          <table className="acc-fs-table acc-ln-table">
            <thead>
              <tr>
                <th>#</th><th>{t('lnDue')}</th><th>{t('crDaysLate')}</th><th>{t('crPenaltyBaseNow')}</th>
                <th>{t('crPenaltyAccrued')}</th><th>{t('lnPaidShort')}</th><th>{t('crWaived')}</th><th>{t('crPenaltyDue')}</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((r) => (
                <tr key={r.no} className="is-line">
                  <td>{r.no}</td>
                  <td>{showDate(r.due_date)}</td>
                  <td><DaysLateChip days={r.days_late} /></td>
                  <td>{r.base ? formatNumber(r.base) : '—'}</td>
                  <td>{formatNumber(r.accrued)}</td>
                  <td>{r.paid ? formatNumber(r.paid) : '—'}</td>
                  <td>{r.waived ? formatNumber(r.waived) : '—'}</td>
                  <td><b className={r.due ? 'cr-text-bad' : ''}>{r.due ? formatNumber(r.due) : '—'}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="is-total">
                <td colSpan={4}>{t('total')}</td>
                <td>{formatNumber(state.accrued)}</td><td>{formatNumber(state.paid)}</td><td>{formatNumber(state.waived)}</td>
                <td><b>{money(state.due, currency)}</b></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {waivers.length > 0 && (
        <section className="cr-waivers">
          <h5>{t('crWaivers')}</h5>
          {waivers.map((w) => (
            <div key={w._uuid} className="cr-waiver">
              <i className="fa-solid fa-hand-holding-heart" />
              <span><b>{money(w.amount, currency)}</b> · {t('lnInstallmentNo')} {w.installment_no}<small>{[showDate(w.date), w.by, w.reason].filter(Boolean).join(' · ')}</small></span>
              {canDelete && (
                <button type="button" className="acc-class-edit is-danger" title={t('crUndoWaiver')} aria-label={t('crUndoWaiver')} onClick={() => onUndoWaiver(w)}>
                  <i className="fa-solid fa-rotate-left" />
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

/** ປະຫວັດການຕິດຕາມ (ໃໝ່ສຸດກ່ອນ) */
export const FollowUpList = ({ rows }: { rows: FollowUp[] }) => {
  const t = useT();
  if (!rows.length) return <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-phone-volume" /><p>{t('crNoFollowUps')}</p></div>;
  return (
    <ol className="cr-timeline cr-follow">
      {rows.map((f) => {
        const m = FOLLOW_METHODS.find((x) => x.value === Number(f.method)) ?? FOLLOW_METHODS[0];
        const r = FOLLOW_RESULTS.find((x) => x.value === Number(f.result)) ?? FOLLOW_RESULTS[0];
        return (
          <li key={f._uuid} className={r.tone}>
            <span className="cr-timeline-dot"><i className={`fa-solid ${m.icon}`} /></span>
            <div>
              <b>{t(m.label)} · <span className={`cr-result ${r.tone}`}>{t(r.label)}</span></b>
              <small>{[moment(f.contact_date).format('DD/MM/YYYY HH:mm'), f.by].filter(Boolean).join(' · ')}</small>
              {f.promise_date && <p><i className="fa-solid fa-calendar-check" /> {t('crPromiseOn').replace('{d}', showDate(f.promise_date))}{f.promise_amount ? ` · ₭ ${formatNumber(f.promise_amount)}` : ''}</p>}
              {f.note && <p className="cr-timeline-comment"><i className="fa-solid fa-comment" /> {f.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
