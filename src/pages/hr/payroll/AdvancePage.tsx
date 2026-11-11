import { useEffect, useState, type ReactNode } from 'react';
import { Button, DatePicker, Form, Input, Loader, Modal, NumberInput, SelectPicker } from 'rsuite';
import moment from 'moment';
import { getApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useEmployees } from '../../../utils/selectOption';
import { refreshHrPending } from '../hrPending';
import { useT } from '../../../context/LanguageContext';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import { periodLabel, usePostData } from '../attendance/attendanceApi';
import { FormSection, SearchBox, SettingModal, YearStepper } from '../../account/setting/settingKit';
import { runSave } from '../../account/setting/settingApi';
import { kip, kipFormatter } from './payrollApi';
import { LakAccountSelect, useLakAccounts } from './LakAccountSelect';
import {
  ADVANCE_STATUSES, ADV_ACTIVE, ADV_APPROVED, ADV_PENDING, ADV_REJECTED, ADV_SETTLED, advanceApi,
  type AdvanceData, type AdvanceRepayment, type SalaryAdvance,
} from './advanceApi';

const MAX_INSTALLMENTS = 36;
const BY_CASH = 2;

const toPeriod = (date: Date) => moment(date).format('YYYY-MM');
const toMonthDate = (period: string) => moment(`${period}-01`).toDate();

const StatusPill = ({ status }: { status: number }) => {
  const t = useT();
  const state = ADVANCE_STATUSES[status] ?? ADVANCE_STATUSES[ADV_PENDING];
  return <span className={`att-state ${state.tone}`}><i className={`fa-solid ${state.icon}`} /> {t(state.label)}</span>;
};

const Field = ({ label, required, hint, wide, children }: { label: string; required?: boolean; hint?: ReactNode; wide?: boolean; children: ReactNode }) => (
  <div className={`rs-form-group${wide ? ' is-wide' : ''}`}>
    <label className="form-label">{label}{required && <span className="text-danger">*</span>}</label>
    {children}
    {hint && <small className="pay-field-hint">{hint}</small>}
  </div>
);

const MoneyField = ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
  <NumberInput value={value} onChange={(v) => onChange(Math.max(0, Number(v) || 0))} formatter={kipFormatter} controls={false} prefix="₭" min={0} />
);

/** ຈຳນວນງວດ + ເດືອນເລີ່ມຫັກ + ຜົນຫັກຕໍ່ເດືອນ — ໃຊ້ໃນຟອມບັນທຶກແທນ, ອະນຸມັດ ແລະ ປ່ຽນແຜນ */
const ScheduleFields = ({ amount, installments, period, onInstallments, onPeriod }: {
  amount: number;
  installments: number;
  period: string;
  onInstallments: (value: number) => void;
  onPeriod: (value: string) => void;
}) => {
  const t = useT();
  const monthly = Math.ceil(amount / Math.max(1, installments));
  return (
    <>
      <Field label={t('advInstallments')} required hint={amount > 0 ? `${t('advMonthly')} ₭ ${kip(monthly)}` : undefined}>
        <NumberInput value={installments} onChange={(v) => onInstallments(Math.min(MAX_INSTALLMENTS, Math.max(1, Math.round(Number(v) || 1))))}
          postfix={t('advMonths')} min={1} max={MAX_INSTALLMENTS}
        />
      </Field>
      <Field label={t('advStartPeriod')} required hint={t('advStartPeriodHint')}>
        <DatePicker value={toMonthDate(period)} onChange={(d) => d && onPeriod(toPeriod(d))} format="MM/yyyy" oneTap block cleanable={false}
          shouldDisableDate={(d) => moment(d).isBefore(moment(), 'month')}
        />
      </Field>
    </>
  );
};

/** ຫົວກ່ອງ: ພະນັກງານ + ສະຖານະ */
const Person = ({ row }: { row: SalaryAdvance }) => {
  const employee = row.employee;
  return (
    <div className="lv-review-person">
      <HrAvatar url={employee?.profile_url} name={employee?.first_name} />
      <span>
        <b>{fullName(employee) || '—'}</b>
        <small>{[employee?.emp_code, employee?.department?.depart_name, employee?.position?.position_name].filter(Boolean).join(' · ')}</small>
      </span>
      <StatusPill status={row.status} />
    </div>
  );
};

/** HR ບັນທຶກເງິນເບີກແທນພະນັກງານ — ຖືວ່າອະນຸມັດແລ້ວ, ລໍຖ້າຈ່າຍເງິນ */
const CreateModal = ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const employees = useEmployees();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [installments, setInstallments] = useState(1);
  const [period, setPeriod] = useState(moment().format('YYYY-MM'));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!employeeId) return Notific.warning('advPickEmployee');
    if (amount <= 0) return Notific.warning('advAmountRequired');
    if (!reason.trim()) return Notific.warning('advReasonRequired');
    const ok = await runSave(() => advanceApi.create({ employee_id: employeeId, amount, installments, start_period: period, reason: reason.trim() }), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('advCreate')} hint={t('advCreateHint')} icon="fa-hand-holding-dollar" saving={saving} onClose={onClose} onSubmit={submit}>
      <Form fluid>
        <FormSection title={t('advDetails')}>
          <Field label={t('hrEmployee')} required wide>
            <SelectPicker block data={employees} value={employeeId} onChange={setEmployeeId} placeholder={t('select')} popupClassName="acc-book-menu" />
          </Field>
          <Field label={t('advAmount')} required wide><MoneyField value={amount} onChange={setAmount} /></Field>
          <ScheduleFields amount={amount} installments={installments} period={period} onInstallments={setInstallments} onPeriod={setPeriod} />
          <Field label={t('advReason')} required wide><Input as="textarea" rows={2} value={reason} onChange={setReason} maxLength={255} /></Field>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/** ອະນຸມັດ (ປ່ຽນຍອດ / ງວດໄດ້) ຫຼື ປະຕິເສດ */
const ReviewModal = ({ row, mode, onClose, onSaved }: { row: SalaryAdvance; mode: 'approve' | 'reject'; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const approve = mode === 'approve';
  const [amount, setAmount] = useState(row.amount);
  const [installments, setInstallments] = useState(row.installments);
  const [period, setPeriod] = useState(row.start_period);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const salary = Number(row.employee?.basic_salary) || 0;

  const submit = async () => {
    if (approve && amount <= 0) return Notific.warning('advAmountRequired');
    const ok = await runSave(() => (approve
      ? advanceApi.approve(row, { amount, installments, start_period: period, note: note.trim() })
      : advanceApi.reject(row, note.trim())), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(approve ? 'advApprove' : 'advReject')} hint={t(approve ? 'advApproveHint' : 'advRejectHint')}
      icon={approve ? 'fa-circle-check' : 'fa-circle-xmark'} saving={saving} onClose={onClose} onSubmit={submit}
      className={`lv-review-modal${approve ? '' : ' is-reject'}`}
      submit={{ label: t(approve ? 'advApprove' : 'advReject'), icon: approve ? 'fa-check' : 'fa-xmark', danger: !approve }}
    >
      <div className="lv-review">
        <Person row={row} />
        <div className="lv-review-facts is-two">
          <span><i className="fa-solid fa-sack-dollar" /><small>{t('advRequested')}</small><b>₭ {kip(row.requested_amount)}</b></span>
          <span><i className="fa-regular fa-paper-plane" /><small>{t('leaveRequestedAt')}</small><b>{moment(row.createdAt).format('DD/MM/YYYY HH:mm')}</b></span>
        </div>
        <div className="lv-review-reason">
          <small><i className="fa-solid fa-quote-left" /> {t('advReason')}</small>
          <p>{row.reason || '—'}</p>
        </div>
        {approve && (
          <Form fluid>
            <FormSection title={t('advSchedule')}>
              <Field label={t('advAmount')} required wide hint={salary > 0 ? `${Math.round((amount / salary) * 100)}% ${t('advOfSalary')} ₭ ${kip(salary)}` : undefined}>
                <MoneyField value={amount} onChange={setAmount} />
              </Field>
              <ScheduleFields amount={amount} installments={installments} period={period} onInstallments={setInstallments} onPeriod={setPeriod} />
            </FormSection>
          </Form>
        )}
        <div className="lv-review-field">
          <label>{t('leaveReviewNote')}</label>
          <Input as="textarea" rows={2} value={note} onChange={setNote} maxLength={255} />
        </div>
      </div>
    </SettingModal>
  );
};

/** ຈ່າຍເງິນເບີກ: ເລືອກບັນຊີສະກຸນກີບ + ວັນທີ — ເງິນອອກຈາກບັນຊີ + ລົງບັນຊີອັດຕະໂນມັດ */
const PayModal = ({ row, onClose, onSaved }: { row: SalaryAdvance; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const accounts = useLakAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date());
  const [saving, setSaving] = useState(false);
  const account = accounts.find((a) => a._uuid === accountId);

  const submit = async () => {
    if (!accountId) return Notific.warning('payPickAccount');
    if (account && account.balance_treasury < row.amount) return Notific.warning('payNotEnough');
    const ok = await runSave(() => advanceApi.pay(row, { account_id: accountId, pay_date: moment(date).format('YYYY-MM-DD') }), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('advPay')} hint={t('advPayHint')} icon="fa-money-bill-transfer" saving={saving} onClose={onClose} onSubmit={submit}>
      <Form fluid>
        <div className="pay-pay-total">
          <span><small>{t('advAmount')}</small><b>₭ {kip(row.amount)}</b></span>
          <em><i className="fa-solid fa-user" /> {fullName(row.employee) || '—'}</em>
        </div>
        <FormSection title={t('payFromAccount')}>
          <Field label={t('payAccount')} required wide>
            <LakAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} amount={row.amount} />
          </Field>
          <Field label={t('payDate')} required>
            <DatePicker value={date} onChange={(d) => d && setDate(d)} oneTap format="dd/MM/yyyy" block cleanable={false}
              shouldDisableDate={(d) => moment(d).isAfter(moment(), 'day')}
            />
          </Field>
        </FormSection>
        <FormSection title={t('payPosting')}>
          <div className="is-wide pay-posting">
            <span><em className="is-dr">Dr</em> {t('advPostAccount')} <b>{kip(row.amount)}</b></span>
            <span><em className="is-cr">Cr</em> {account?.acountName ?? t('payAccount')} <b>{kip(row.amount)}</b></span>
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/** ຮັບຄືນເງິນສົດ / ໂອນ (ບໍ່ຜ່ານເງິນເດືອນ) — ເຊັ່ນ ກ່ອນລາອອກ */
const RepayModal = ({ row, onClose, onSaved }: { row: SalaryAdvance; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const accounts = useLakAccounts();
  const [amount, setAmount] = useState(row.balance);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const account = accounts.find((a) => a._uuid === accountId);

  const submit = async () => {
    if (amount <= 0) return Notific.warning('advAmountRequired');
    if (!accountId) return Notific.warning('payPickAccount');
    const ok = await runSave(() => advanceApi.repay(row, {
      amount, account_id: accountId, repay_date: moment(date).format('YYYY-MM-DD'), note: note.trim(),
    }), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('advRepay')} hint={t('advRepayHint')} icon="fa-hand-holding-dollar" saving={saving} onClose={onClose} onSubmit={submit}>
      <Form fluid>
        <div className="pay-pay-total">
          <span><small>{t('advBalance')}</small><b>₭ {kip(row.balance)}</b></span>
          <em><i className="fa-solid fa-user" /> {fullName(row.employee) || '—'}</em>
        </div>
        <FormSection title={t('advDetails')}>
          <Field label={t('advRepayAmount')} required wide><MoneyField value={amount} onChange={setAmount} /></Field>
          <Field label={t('advToAccount')} required wide>
            <LakAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} amount={amount} direction="in" />
          </Field>
          <Field label={t('advRepayDate')} required>
            <DatePicker value={date} onChange={(d) => d && setDate(d)} oneTap format="dd/MM/yyyy" block cleanable={false}
              shouldDisableDate={(d) => moment(d).isAfter(moment(), 'day')}
            />
          </Field>
          <Field label={t('attNote')}><Input value={note} onChange={setNote} maxLength={255} /></Field>
        </FormSection>
        <FormSection title={t('payPosting')}>
          <div className="is-wide pay-posting">
            <span><em className="is-dr">Dr</em> {account?.acountName ?? t('advToAccount')} <b>{kip(amount)}</b></span>
            <span><em className="is-cr">Cr</em> {t('advPostAccount')} <b>{kip(amount)}</b></span>
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/** ປ່ຽນແຜນຫັກຄືນຂອງລາຍການທີ່ກຳລັງຫັກ (ແບ່ງຍອດຄ້າງເທົ່າກັນ) */
const ScheduleModal = ({ row, onClose, onSaved }: { row: SalaryAdvance; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [installments, setInstallments] = useState(Math.max(1, Math.ceil(row.balance / Math.max(1, row.monthly_deduction))));
  const [period, setPeriod] = useState(row.start_period);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const ok = await runSave(() => advanceApi.schedule(row, { installments, start_period: period }), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('advReschedule')} hint={t('advRescheduleHint')} icon="fa-calendar-days" saving={saving} onClose={onClose} onSubmit={submit}>
      <Form fluid>
        <div className="pay-pay-total">
          <span><small>{t('advBalance')}</small><b>₭ {kip(row.balance)}</b></span>
          <em><i className="fa-solid fa-user" /> {fullName(row.employee) || '—'}</em>
        </div>
        <FormSection title={t('advSchedule')}>
          <ScheduleFields amount={row.balance} installments={installments} period={period} onInstallments={setInstallments} onPeriod={setPeriod} />
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/** ລາຍລະອຽດ + ປະຫວັດການຄືນ — ຍົກເລີກການຮັບຄືນເງິນສົດໄດ້ (ສ່ວນທີ່ຫັກຈາກເງິນເດືອນ ຍົກເລີກຜ່ານໃບເງິນເດືອນ) */
const DetailModal = ({ row: initial, onClose, onChanged }: { row: SalaryAdvance; onClose: () => void; onChanged: () => void }) => {
  const t = useT();
  const [row, setRow] = useState(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getApi(`/advance/${btoa(String(initial._uuid))}`)
      .then((res) => res.data?.data && setRow(res.data.data))
      .catch((error) => Notific.error(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [initial._uuid]);

  const removeRepayment = (repayment: AdvanceRepayment) => Notific.confirm(`${t('advRepaymentCancelConfirm')} ₭ ${kip(repayment.amount)}`, async () => {
    try {
      setRow(await advanceApi.deleteRepayment(repayment));
      Notific.success('saveSuccessDone');
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  const repayments = row.repayments ?? [];
  const percent = row.amount > 0 ? Math.min(100, Math.round((row.repaid / row.amount) * 100)) : 0;

  return (
    <Modal open onClose={onClose} size="sm" className="acc-gl-ledger-modal adv-detail">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <HrAvatar url={row.employee?.profile_url} name={row.employee?.first_name} />
          <span>
            <Modal.Title>{fullName(row.employee) || '—'} <StatusPill status={row.status} /></Modal.Title>
            <small>{[row.number, row.employee?.emp_code].filter(Boolean).join(' · ')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="adv-sum">
          <span><small>{t('advAmount')}</small><b>₭ {kip(row.amount)}</b></span>
          <span><small>{t('advRepaid')}</small><b>₭ {kip(row.repaid)}</b></span>
          <span className={row.balance > 0 ? 'is-due' : ''}><small>{t('advBalance')}</small><b>₭ {kip(row.balance)}</b></span>
        </div>
        <div className="adv-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent}%` }} /></div>
        <dl className="adv-facts">
          <div><dt>{t('advMonthly')}</dt><dd>₭ {kip(row.monthly_deduction)} · {row.installments} {t('advMonths')}</dd></div>
          <div><dt>{t('advStartPeriod')}</dt><dd>{periodLabel(row.start_period)}</dd></div>
          {row.pay_date && <div><dt>{t('payDate')}</dt><dd>{moment(row.pay_date).format('DD/MM/YYYY')}</dd></div>}
          <div className="is-wide"><dt>{t('advReason')}</dt><dd>{row.reason}</dd></div>
          {row.review_note && <div className="is-wide"><dt>{t('leaveReviewNote')}</dt><dd>{row.review_note}</dd></div>}
        </dl>
        <h6 className="adv-heading"><i className="fa-solid fa-clock-rotate-left" /> {t('advHistory')}</h6>
        {loading ? <Loader size="sm" content={t('loadingDots')} /> : !repayments.length ? (
          <p className="acc-arap-empty">{t('advNoRepayments')}</p>
        ) : (
          <ul className="adv-repayments">
            {repayments.map((r) => {
              const cash = r.kind === BY_CASH;
              return (
                <li key={r._uuid}>
                  <i className={`fa-solid ${cash ? 'fa-money-bill-wave' : 'fa-money-check-dollar'}`} />
                  <span>
                    <b>{cash ? t('advByCash') : `${t('advByPayroll')} ${r.period ? periodLabel(r.period) : ''}`}</b>
                    <small>{moment(r.repay_date).format('DD/MM/YYYY')}{r.note ? ` · ${r.note}` : ''}</small>
                  </span>
                  <em>₭ {kip(r.amount)}</em>
                  {cash && canDelete && (
                    <button type="button" className="acc-gl-act is-danger" title={t('delete')} aria-label={t('delete')} onClick={() => removeRepayment(r)}>
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
      </Modal.Footer>
    </Modal>
  );
};

type Dialog =
  | { kind: 'create' }
  | { kind: 'approve' | 'reject' | 'pay' | 'repay' | 'schedule' | 'detail'; row: SalaryAdvance };

/**
 * ເງິນເບີກລ່ວງໜ້າ — ພະນັກງານຂໍຜ່ານ app ຫຼື HR ບັນທຶກແທນ; ອະນຸມັດ → ຈ່າຍເງິນ (ອອກຈາກບັນຊີເງິນຄັງ + ລົງບັນຊີ) →
 * ຫັກຄືນອັດຕະໂນມັດຈາກໃບເງິນເດືອນທຸກເດືອນ ຫຼື ຮັບຄືນເປັນເງິນສົດ. ກຳລັງຫັກຄືນ ສະແດງທຸກປີ
 */
const AdvancePage = () => {
  const t = useT();
  const [year, setYear] = useState(moment().year());
  /** 0 = ທັງໝົດ */
  const [status, setStatus] = useState(ADV_PENDING);
  const [keyword, setKeyword] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { data, loading, reload: reloadList } = usePostData<AdvanceData>('/advance/fetch', { year, status });
  // ລາຍການປ່ຽນ (ອະນຸມັດ / ປະຕິເສດ / ຈ່າຍ) = ຕົວເລກລໍຖ້າຢູ່ເມນູຊ້າຍ ແລະ ໄອຄອນ desktop ອັບເດດນຳ
  const reload = () => {
    reloadList();
    refreshHrPending();
  };

  const rows = data?.data ?? [];
  const summary = data?.summary;
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) => !q || `${r.number ?? ''} ${r.employee?.emp_code ?? ''} ${fullName(r.employee)} ${r.reason}`.toLowerCase().includes(q));
  const tabs = [
    { key: ADV_PENDING, label: 'advStatusPending', value: summary?.pending },
    { key: ADV_APPROVED, label: 'advStatusApproved', value: summary?.approved },
    { key: ADV_ACTIVE, label: 'advStatusActive', value: summary?.active },
    { key: ADV_SETTLED, label: 'advStatusSettled', value: summary?.settled },
    { key: ADV_REJECTED, label: 'advStatusRejected', value: summary?.rejected },
    { key: 0, label: 'all', value: summary ? summary.pending + summary.approved + summary.active + summary.settled + summary.rejected + summary.cancelled : undefined },
  ];

  const open = (kind: Exclude<Dialog['kind'], 'create'>, row: SalaryAdvance) => setDialog({ kind, row });
  const act = (task: () => Promise<unknown>) => async () => {
    try {
      await task();
      Notific.success('saveSuccessDone');
      reload();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  };
  const cancel = (row: SalaryAdvance) => Notific.confirm(`${t('advCancelConfirm')} ₭ ${kip(row.amount)}`, act(() => advanceApi.cancel(row)));
  const unpay = (row: SalaryAdvance) => Notific.confirm(`${t('advUnpayConfirm')} ${row.number ?? ''}`, act(() => advanceApi.unpay(row)));

  return (
    <div className="acc-rp att-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="att-nav">
            <YearStepper year={year} onChange={setYear} max={moment().year()} />
          </div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            {canCreate && (
              <button type="button" className="acc-rp-btn is-primary" onClick={() => setDialog({ kind: 'create' })}>
                <i className="fa-solid fa-plus" /> {t('advCreate')}
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('advNote')}</p>

      {!data ? (
        <div className="text-center py-5">
          {loading ? <Loader size="md" content={t('loadingDots')} vertical /> : <p className="acc-gl-ref">{t('noData')}</p>}
        </div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <div className="acc-rp-kpis">
            <div className="acc-rp-kpi is-main">
              <small>{t('advOutstanding')}</small>
              <b>₭ {kip(summary?.outstanding ?? 0)}</b>
              <em>{summary?.active ?? 0} {t('advStatusActive')}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('advStatusPending')}</small>
              <b>{summary?.pending ?? 0}</b>
              <em className="is-flat">{t('advToReview')}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('advStatusApproved')}</small>
              <b>{summary?.approved ?? 0}</b>
              <em className="is-flat">{t('advToPay')}</em>
            </div>
          </div>

          <div className="att-toolbar">
            <div className="acc-type-segment" role="tablist">
              {tabs.map((tab) => (
                <button key={tab.key} type="button" role="tab" aria-selected={status === tab.key} className={status === tab.key ? 'is-active' : ''} onClick={() => setStatus(tab.key)}>
                  {t(tab.label)} <em>{tab.value ?? 0}</em>
                </button>
              ))}
            </div>
            <div className="att-toolbar-tools">
              <SearchBox value={keyword} onChange={setKeyword} placeholder={t('search')} />
            </div>
          </div>

          {!shown.length ? (
            <div className="acc-class-empty"><i className="fa-solid fa-hand-holding-dollar" /><p>{t('noData')}</p></div>
          ) : (
            <div className="acc-gl-group">
              <div className="acc-rp-scroll">
                <table className="acc-gl-table hr-table att-table">
                  <thead>
                    <tr>
                      <th>{t('hrEmployee')}</th>
                      <th className="is-num">{t('advAmount')}</th>
                      <th>{t('advSchedule')}</th>
                      <th className="is-num">{t('advBalance')}</th>
                      <th>{t('advReason')}</th>
                      <th>{t('status')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r._uuid} className="is-click" onClick={() => open('detail', r)}>
                        <td>
                          <span className="hr-person">
                            <HrAvatar url={r.employee?.profile_url} name={r.employee?.first_name} />
                            <span>
                              <b>{fullName(r.employee) || '—'}</b>
                              <small className="acc-gl-ref">
                                {r.employee?.emp_code}{r.employee?.department ? ` · ${r.employee.department.depart_name}` : ''}
                                {Number(r.employee?.work_status) === 2 && <> · <span className="adv-resigned">{t('hrResigned')}</span></>}
                              </small>
                            </span>
                          </span>
                        </td>
                        <td className="is-num">
                          <b>{kip(r.amount)}</b>
                          {r.requested_amount !== r.amount && <small className="acc-gl-ref d-block">{t('advRequested')} {kip(r.requested_amount)}</small>}
                        </td>
                        <td>
                          <b>{kip(r.monthly_deduction)}</b> × {r.installments}
                          <small className="acc-gl-ref d-block">{t('advStartPeriod')} {periodLabel(r.start_period)}</small>
                        </td>
                        <td className={`is-num${r.status === ADV_ACTIVE ? ' pay-minus' : ''}`}>{r.status === ADV_ACTIVE ? kip(r.balance) : '—'}</td>
                        <td className="att-note">{r.reason}</td>
                        <td>
                          <StatusPill status={r.status} />
                          {r.number && <small className="acc-gl-ref d-block">{r.number}</small>}
                        </td>
                        <td className="lv-actions" onClick={(e) => e.stopPropagation()}>
                          {canEdit && r.status === ADV_PENDING && (
                            <>
                              <button type="button" className="lv-act is-approve" onClick={() => open('approve', r)}><i className="fa-solid fa-check" /> {t('advApprove')}</button>
                              <button type="button" className="lv-act is-reject" title={t('advReject')} aria-label={t('advReject')} onClick={() => open('reject', r)}><i className="fa-solid fa-xmark" /></button>
                            </>
                          )}
                          {canEdit && r.status === ADV_APPROVED && (
                            <>
                              <button type="button" className="lv-act is-approve" onClick={() => open('pay', r)}><i className="fa-solid fa-money-bill-transfer" /> {t('advPay')}</button>
                              <button type="button" className="lv-act is-reject" title={t('cancel')} aria-label={t('cancel')} onClick={() => cancel(r)}><i className="fa-solid fa-xmark" /></button>
                            </>
                          )}
                          {canEdit && r.status === ADV_ACTIVE && (
                            <>
                              <button type="button" className="lv-act is-approve" onClick={() => open('repay', r)}><i className="fa-solid fa-hand-holding-dollar" /> {t('advRepay')}</button>
                              <button type="button" className="lv-act" title={t('advReschedule')} aria-label={t('advReschedule')} onClick={() => open('schedule', r)}><i className="fa-solid fa-calendar-days" /></button>
                              {r.repaid === 0 && (
                                <button type="button" className="lv-act is-reject" title={t('advUnpay')} aria-label={t('advUnpay')} onClick={() => unpay(r)}><i className="fa-solid fa-rotate-left" /></button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {dialog?.kind === 'create' && <CreateModal onClose={() => setDialog(null)} onSaved={reload} />}
      {(dialog?.kind === 'approve' || dialog?.kind === 'reject') && <ReviewModal row={dialog.row} mode={dialog.kind} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === 'pay' && <PayModal row={dialog.row} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === 'repay' && <RepayModal row={dialog.row} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === 'schedule' && <ScheduleModal row={dialog.row} onClose={() => setDialog(null)} onSaved={reload} />}
      {dialog?.kind === 'detail' && <DetailModal row={dialog.row} onClose={() => setDialog(null)} onChanged={reload} />}
    </div>
  );
};

export default AdvancePage;
