import { useMemo, useRef, useState } from 'react';
import { DatePicker, Form, NumberInput, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { postApi } from '../../../utils/configApi';
import { InputField } from '../../../utils/inputFields';
import { useT } from '../../../context/LanguageContext';
import { amountFormatter } from '../gl/glKit';
import { FormStep, PickerField, SettingModal } from '../setting/settingKit';
import { runSave } from '../setting/settingApi';
import { ACCOUNT_POPUP_STYLE, accountOption, renderAccountOption } from '../ledger/accountOption';
import { BORROWED, money, useTreasuryAccounts, type LoanDetail } from './loanApi';

const { NumberType, DateType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const r2 = (n: number) => Math.round(n * 100) / 100;

type Preset = 'next' | 'due' | 'payoff';

/**
 * ຈ່າຍຄືນ (ເງິນກູ້ຢືມ) / ຮັບຄືນ (ເງິນໃຫ້ກູ້) — ເລືອກໄວ: ງວດຕໍ່ໄປ, ທຸກງວດທີ່ຄົບກຳນົດແລ້ວ ຫຼື ປິດເງິນກູ້ (ຕົ້ນທຶນທັງໝົດ);
 * ແກ້ຕົວເລກເອງໄດ້ (ຈ່າຍບາງສ່ວນ / ຈ່າຍກ່ອນກຳນົດ). ຍອດທີ່ຈ່າຍຕັດໃສ່ງວດເກົ່າສຸດກ່ອນ
 */
const LoanPayForm = ({ loan, onClose, onSaved }: { loan: LoanDetail; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const borrowed = loan.direction === BORROWED;
  const treasuries = useTreasuryAccounts(loan.currency_id);
  const open = loan.schedule.filter((r) => ['overdue', 'partial', 'upcoming'].includes(r.state));
  const today = moment().format('YYYY-MM-DD');
  const dueRows = open.filter((r) => r.due_date <= today);
  const amounts = (key: Preset) => {
    if (key === 'next') return { principal: loan.next?.principal ?? 0, interest: loan.next?.interest ?? 0 };
    const rows = dueRows.length ? dueRows : open.slice(0, 1);
    const interest = r2(rows.reduce((n, r) => n + r.due_interest, 0));
    return key === 'payoff' ? { principal: loan.outstanding, interest } : { principal: r2(rows.reduce((n, r) => n + r.due_principal, 0)), interest };
  };
  const [preset, setPreset] = useState<Preset | null>(dueRows.length > 1 ? 'due' : 'next');
  const [inputs, setInputs] = useState<any>(() => ({
    pay_date: new Date(),
    treasury_account_id: loan.start_mode === 1 ? loan.treasury_account_id : null,
    ...amounts(dueRows.length > 1 ? 'due' : 'next'),
    fee: '',
    reference: '',
    note: '',
  }));
  const [saving, setSaving] = useState(false);
  const principal = num(inputs.principal);
  const interest = num(inputs.interest);
  const fee = num(inputs.fee);
  const total = r2(principal + interest + fee);
  const account = treasuries.find((a) => a._uuid === inputs.treasury_account_id);
  const short = borrowed && !!account && Number(account.balance_treasury) < total;

  const model = useMemo(() => Schema.Model<any>({
    pay_date: DateType().isRequired(t('selectRequired')),
    treasury_account_id: NumberType().isRequired(t('selectRequired')),
    principal: NumberType(t('faNumberOnly')).min(0, t('faNumberOnly')).max(loan.outstanding, t('lnOverOutstanding')),
    interest: NumberType(t('faNumberOnly')).min(0, t('faNumberOnly')),
  }), [loan.outstanding, t]);

  const pick = (key: Preset) => {
    setPreset(key);
    setInputs({ ...inputs, ...amounts(key) });
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const body = {
      pay_date: moment(inputs.pay_date).format('YYYY-MM-DD'),
      treasury_account_id: inputs.treasury_account_id, principal, interest, fee,
      reference: inputs.reference, note: inputs.note,
    };
    if (await runSave(() => postApi(`/loan/pay/${loan._uuid}`, body), setSaving)) {
      onSaved();
      onClose();
    }
  };

  const renderTreasury = renderAccountOption(t('treasuryNoBank'));
  const presets: { key: Preset; label: string; hint: string; disabled?: boolean }[] = [
    { key: 'next', label: loan.next ? `${t('lnInstallmentNo')} ${loan.next.no}` : t('lnNext'), hint: loan.next ? money(loan.next.amount, loan.currency) : '—', disabled: !loan.next },
    { key: 'due', label: t('lnPresetDue'), hint: `${dueRows.length} ${t('lnInstallments')}`, disabled: !dueRows.length },
    { key: 'payoff', label: t('lnPresetPayoff'), hint: money(loan.outstanding, loan.currency) },
  ];

  return (
    <SettingModal title={t(borrowed ? 'lnPay' : 'lnReceive')} hint={`${loan.loan_code} · ${loan.counterparty}`}
      icon={borrowed ? 'fa-money-bill-transfer' : 'fa-hand-holding-dollar'} saving={saving} onClose={onClose} onSubmit={submit}
      className="is-steps" keyboard={false} wide
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(next) => { setInputs(next); setPreset(null); }}>
        <FormStep no={1} done={principal + interest + fee > 0} title={t('lnStepAmount')} hint={t('lnStepAmountHint')}>
          <div className="is-wide acc-ln-presets" role="group">
            {presets.map((p) => (
              <button key={p.key} type="button" disabled={p.disabled} className={preset === p.key ? 'is-active' : ''} onClick={() => pick(p.key)}>
                <b>{p.label}</b><small>{p.hint}</small>
              </button>
            ))}
          </div>
          <div className="acc-fa-money">
            <InputField name="principal" label={t('lnPrincipalPart')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false}
              prefix={loan.currency?.genus || loan.currency?.name || '₭'}
            />
          </div>
          <div className="acc-fa-money">
            <InputField name="interest" label={t('lnInterestPart')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false}
              prefix={loan.currency?.genus || loan.currency?.name || '₭'}
            />
          </div>
          <div className="acc-fa-money">
            <InputField name="fee" label={t('lnFee')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} placeholder="0"
              prefix={loan.currency?.genus || loan.currency?.name || '₭'}
            />
          </div>
          <dl className="acc-book-summary">
            <div><dt>{t('lnOutstanding')}</dt><dd>{money(loan.outstanding, loan.currency)}</dd></div>
            <div><dt>{t('lnAfterPayment')}</dt><dd>{money(Math.max(0, r2(loan.outstanding - principal)), loan.currency)}</dd></div>
            <div className="is-total"><dt>{t(borrowed ? 'lnTotalPay' : 'lnTotalReceive')}</dt><dd>{money(total, loan.currency)}</dd></div>
          </dl>
        </FormStep>

        <FormStep no={2} done={!!inputs.treasury_account_id && !!inputs.pay_date} title={t(borrowed ? 'lnStepPayFrom' : 'lnStepReceiveInto')} hint={t('lnStepCashHint')}>
          <InputField name="pay_date" label={t('lnPayDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
            shouldDisableDate={(d: Date) => moment(d).isAfter(moment(), 'day')}
          />
          <InputField name="reference" label={t('lnReference')} required={false} icon={<i className="fa-solid fa-hashtag" />} />
          <PickerField name="treasury_account_id" label={t(borrowed ? 'lnPayFrom' : 'lnReceiveInto')} className="is-wide"
            data={treasuries.map((a) => accountOption(a))} placeholder={treasuries.length ? t('select') : t('lnNoTreasury')}
            renderOption={renderTreasury} renderValue={renderTreasury} popupStyle={ACCOUNT_POPUP_STYLE}
          />
          {short && <p className="is-wide acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('expenseInsufficient')}</p>}
          <div className="is-wide">
            <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

export default LoanPayForm;
