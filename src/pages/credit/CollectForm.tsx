import { useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker, Form, NumberInput, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../utils/configApi';
import { InputField } from '../../utils/inputFields';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { ChoiceTiles, FormStep, PickerField, SettingModal } from '../account/setting/settingKit';
import { runSave } from '../account/setting/settingApi';
import { ACCOUNT_POPUP_STYLE, accountOption, renderAccountOption } from '../account/ledger/accountOption';
import { money, showDate, useTreasuryAccounts, type LoanCurrency } from '../account/loans/loanApi';
import { PAYMENT_TYPES, type PrepayMode, type Quote } from './creditApi';

const { NumberType, DateType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
type Preset = 'next' | 'due' | 'payoff';

/** ສັນຍາທີ່ຈະຮັບຊຳລະ — ພໍສຳລັບຟອມ (ໃຊ້ໄດ້ທັງຈາກລາຍລະອຽດສັນຍາ ແລະ ໜ້າຕິດຕາມໜີ້) */
export type CollectTarget = { _uuid: number; loan_code: string; name: string; currency: LoanCurrency; currency_id: number | null; treasury_account_id?: number | null };

/**
 * ຮັບຊຳລະສັນຍາສິນເຊື່ອ — ປ້ອນຍອດທີ່ລູກຄ້າຈ່າຍ (ຫຼື ເລືອກ ງວດຕໍ່ໄປ / ຄົບກຳນົດທັງໝົດ / ປິດບັນຊີ), ລະບົບແບ່ງໃຫ້:
 * ຄ່າປັບກ່ອນ → ດອກເບ້ຍ → ຕົ້ນທຶນ (POST /credit/contract/:id/quote ສະແດງກ່ອນບັນທຶກ); ບັນທຶກແລ້ວ onSaved(ເລກການຊຳລະ) → ພິມໃບຮັບເງິນ
 */
const CollectForm = ({ contract, onClose, onSaved }: { contract: CollectTarget; onClose: () => void; onSaved: (paymentId: number) => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const treasuries = useTreasuryAccounts(contract.currency_id);
  const [inputs, setInputs] = useState<Record<string, any>>({
    pay_date: new Date(), amount: null, treasury_account_id: contract.treasury_account_id ?? null, reference: '', note: '',
  });
  const [preset, setPreset] = useState<Preset | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [saving, setSaving] = useState(false);
  /** ຈ່າຍຕົ້ນທຶນລ່ວງໜ້າ: ຫຼຸດຈຳນວນງວດ (ເງິນຜ່ອນເທົ່າເດີມ) ຫຼື ຫຼຸດເງິນຜ່ອນຕໍ່ງວດ (ງວດເທົ່າເດີມ) */
  const [prepayMode, setPrepayMode] = useState<PrepayMode>('term');
  const date = moment(inputs.pay_date).format('YYYY-MM-DD');
  const amount = num(inputs.amount);
  const payoff = preset === 'payoff';
  const cur = contract.currency;

  // ຍອດ + ການແບ່ງ ຕາມວັນທີ / ຈຳນວນ (ລໍພິມແລ້ວ 250ms)
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      postApi(`/credit/contract/${contract._uuid}/quote`, { pay_date: date, amount, payoff })
        .then((res) => {
          if (!alive) return;
          const q: Quote = res.data?.data;
          setQuote(q);
          if (!q) return;
          // ເປີດຟອມເທື່ອທຳອິດ: ຄົບກຳນົດຫຼາຍງວດ = ຮັບທັງໝົດ, ບໍ່ດັ່ງນັ້ນ = ງວດຕໍ່ໄປ
          if (inputs.amount === null) pick(q.due_count > 1 ? 'due' : 'next', q);
          // ປ່ຽນວັນທີ → ຍອດຂອງປຸ່ມທີ່ເລືອກໄວ້ປ່ຽນຕາມ (ຄ່າປັບ / ດອກເບ້ຍຮອດມື້ນັ້ນ)
          else if (preset && q.presets[preset] !== amount) setInputs((prev) => ({ ...prev, amount: q.presets[preset] }));
        })
        .catch(() => alive && setQuote(null));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, amount, payoff, preset, contract._uuid]);

  const pick = (key: Preset, q = quote) => {
    if (!q) return;
    setPreset(key);
    setInputs((prev) => ({ ...prev, amount: q.presets[key] }));
  };

  const model = useMemo(() => Schema.Model<any>({
    pay_date: DateType().isRequired(t('selectRequired')),
    treasury_account_id: NumberType().isRequired(t('selectRequired')),
    amount: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnPrincipalPositive')),
  }), [t]);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    let paymentId = 0;
    const ok = await runSave(async () => {
      const res = await postApi(`/credit/contract/${contract._uuid}/collect`, {
        pay_date: date, treasury_account_id: inputs.treasury_account_id, amount, payoff, reference: inputs.reference, note: inputs.note,
        ...(quote?.split?.prepay ? { prepay_mode: prepayMode } : {}),
      });
      paymentId = res.data?.data?._uuid ?? 0;
    }, setSaving);
    if (ok) {
      onSaved(paymentId);
      onClose();
    }
  };

  const split = quote?.split;
  const account = treasuries.find((a) => a._uuid === inputs.treasury_account_id);
  const renderTreasury = renderAccountOption(t('treasuryNoBank'));
  const presets: { key: Preset; label: string; hint: string; disabled?: boolean }[] = quote ? [
    { key: 'next', label: quote.next ? `${t('lnInstallmentNo')} ${quote.next.no}` : t('lnNext'), hint: money(quote.presets.next, cur), disabled: !quote.next },
    { key: 'due', label: t('lnPresetDue'), hint: `${quote.due_count} ${t('lnInstallments')} · ${money(quote.presets.due, cur)}`, disabled: !quote.due_count },
    { key: 'payoff', label: t('crPayOff'), hint: money(quote.presets.payoff, cur), disabled: !(quote.presets.payoff > 0) },
  ] : [];
  const type = split ? PAYMENT_TYPES[split.payment_type] : null;

  return (
    <SettingModal title={t('crCollect')} hint={`${contract.loan_code} · ${contract.name}`} icon="fa-hand-holding-dollar" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide submit={{ label: t('crCollect'), icon: 'fa-check' }}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(next) => { if (num(next.amount) !== amount) setPreset(null); setInputs(next); }}>
        <FormStep no={1} done={!!split && !quote?.error} title={t('crStepCollectAmount')} hint={t('crStepCollectAmountHint')}
          note={quote && quote.penalty_due > 0 && (
            <span className="cr-penalty-note"><i className="fa-solid fa-gavel" /> {t('crPenaltyDueNote').replace('{a}', money(quote.penalty_due, cur)).replace('{d}', String(quote.days_overdue))}</span>
          )}
        >
          <div className="is-wide acc-ln-presets" role="group">
            {presets.map((p) => (
              <button key={p.key} type="button" disabled={p.disabled} className={preset === p.key ? 'is-active' : ''} onClick={() => pick(p.key)}>
                <b>{p.label}</b><small>{p.hint}</small>
              </button>
            ))}
          </div>
          <div className="is-wide acc-fa-money">
            <InputField name="amount" label={t('crAmountReceived')} accepter={NumberInput} formatter={amountFormatter} controls={false}
              prefix={cur?.genus || cur?.name || '₭'}
            />
          </div>
          <div className="is-wide cr-split-box">
            {quote?.error ? (
              <p className="acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {quote.error}</p>
            ) : split ? (
              <>
                <dl className="acc-book-summary">
                  <div className={split.penalty ? 'is-penalty' : ''}><dt>1 · {t('crPenalty')}</dt><dd>{split.penalty ? formatNumber(split.penalty) : '—'}</dd></div>
                  <div><dt>2 · {t('lnInterestShort')}</dt><dd>{formatNumber(split.interest)}</dd></div>
                  <div><dt>3 · {t('lnPrincipalShort')}</dt><dd>{formatNumber(split.principal)}</dd></div>
                  {split.fee > 0 && <div><dt>{t('crPrepayFee')}</dt><dd>{formatNumber(split.fee)}</dd></div>}
                  <div className="is-total"><dt>{t('total')}</dt><dd>{money(split.total, cur)}</dd></div>
                </dl>
                <p className="cr-split-after">
                  {type && <span className={`cr-pay-type is-${split.payment_type}`}><i className={`fa-solid ${type.icon}`} /> {t(type.label)}</span>}
                  <span>{t('lnAfterPayment')} <b>{money(split.outstanding_after, cur)}</b></span>
                </p>
                {split.prepay && (() => {
                  const p = split.prepay;
                  const saved = (o: typeof p.term) => Math.max(0, p.before.interest - o.interest);
                  return (
                    <div className="cr-prepay">
                      <p className="cr-prepay-head">
                        <i className="fa-solid fa-forward" />
                        <span>
                          <b>{t('crPrepayHead').replace('{p}', money(p.principal, cur))}</b>
                          <small>{t('crPrepayExplain').replace('{r}', money(p.regular_total, cur))}{p.fee > 0 ? ` · ${t('crPrepayFee')} ${money(p.fee, cur)}` : ''}</small>
                        </span>
                      </p>
                      <ChoiceTiles<PrepayMode> label={t('crPrepayHow')} value={prepayMode} onChange={setPrepayMode} options={[
                        {
                          value: 'term', icon: 'fa-calendar-minus', label: t('crPrepayTerm'),
                          hint: t('crPrepayOption').replace('{n}', String(p.term.count)).replace('{a}', money(p.term.payment, cur)).replace('{s}', money(saved(p.term), cur)),
                        },
                        {
                          value: 'installment', icon: 'fa-arrow-down-short-wide', label: t('crPrepayInstallment'),
                          hint: t('crPrepayOption').replace('{n}', String(p.installment.count)).replace('{a}', money(p.installment.payment, cur)).replace('{s}', money(saved(p.installment), cur)),
                        },
                      ]}
                      />
                      <p className="acc-gl-hint">
                        <i className="fa-solid fa-circle-info" /> {t('crPrepayBefore').replace('{n}', String(p.before.count)).replace('{a}', money(p.before.payment, cur))}
                        {' → '}{t('crPrepayEnds').replace('{d}', showDate(p[prepayMode].last_due))}
                      </p>
                    </div>
                  );
                })()}
              </>
            ) : <p className="acc-gl-hint"><i className="fa-solid fa-calculator" /> {t('crSplitHint')}</p>}
          </div>
        </FormStep>

        <FormStep no={2} done={!!inputs.treasury_account_id} title={t('crStepCollectInto')} hint={t('crStepCollectIntoHint')}>
          <InputField name="pay_date" label={t('lnPayDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
            shouldDisableDate={(d: Date) => moment(d).isAfter(moment(), 'day')}
          />
          <InputField name="reference" label={t('lnReference')} required={false} placeholder={t('crReferencePlaceholder')} icon={<i className="fa-solid fa-hashtag" />} />
          <PickerField name="treasury_account_id" label={t('lnReceiveInto')} className="is-wide"
            data={treasuries.map((a) => accountOption(a))} placeholder={treasuries.length ? t('select') : t('lnNoTreasury')}
            renderOption={renderTreasury} renderValue={renderTreasury} popupStyle={ACCOUNT_POPUP_STYLE}
          />
          {account && <p className="is-wide acc-gl-hint"><i className="fa-solid fa-building-columns" /> {t('crChannelHint')}</p>}
          <div className="is-wide">
            <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

export default CollectForm;
