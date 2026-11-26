import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker, Form, Loader, Modal, NumberInput, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { deleteApi, getApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { InputField } from '../../utils/inputFields';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { ChoiceTiles, FormStep, PickerField, SettingModal } from '../account/setting/settingKit';
import { postfixProp, runSave } from '../account/setting/settingApi';
import { ACCOUNT_POPUP_STYLE, accountOption, renderAccountOption } from '../account/ledger/accountOption';
import { ScheduleTable } from '../account/loans/loanKit';
import { LOAN_METHODS, money, showDate, useTreasuryAccounts } from '../account/loans/loanApi';
import ApplicationForm from './ApplicationForm';
import ContractDetail from './ContractDetail';
import { APP_STATUS, customerAddress, type ApplicationDetail as Detail } from './creditApi';
import { AppStatusChip, CollateralList, DetailTabs, GuarantorList, InfoRows, RiskChip, creditTermText, monthlyRate } from './creditKit';

const { NumberType, StringType, DateType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const DECISIONS = [
  { value: 1, label: 'crDecApprove', icon: 'fa-circle-check' },
  { value: 3, label: 'crDecReturn', icon: 'fa-rotate-left' },
  { value: 2, label: 'crDecReject', icon: 'fa-circle-xmark' },
];
const myId = () => Number(localStorage.getItem('userid')) || 0;

type FlowStep = { key: string; icon: string; title: string; state: 'done' | 'current' | 'todo' | 'bad'; who?: string | null; when?: string | null };

/**
 * ຂັ້ນຕອນອະນຸມັດ — ຍື່ນຄຳຮ້ອງ → ຂັ້ນ 1…N (ຕາມຜະລິດຕະພັນ) → ປ່ອຍກູ້: ໃຜເຮັດ ແລະ ເມື່ອໃດ, ຂັ້ນທີ່ກຳລັງລໍ.
 * ລໍຖ້າພິຈາລະນາ: ບອກວ່າໃຜພິຈາລະນາຂັ້ນນີ້ໄດ້ (ຈາກ API) ແລະ ຖ້າຜູ້ເບິ່ງພິຈາລະນາບໍ່ໄດ້ ບອກເຫດຜົນ (ຜູ້ສ້າງ / ອະນຸມັດຂັ້ນກ່ອນແລ້ວ)
 */
const ApprovalFlow = ({ app, blocked, canDecide, onDecide }: { app: Detail; blocked: string; canDecide: boolean; onDecide: () => void }) => {
  const t = useT();
  const status = Number(app.status);
  const levels = app.product?.approval_levels ?? 1;
  const reached = Number(app.approval_level) || 0;
  const date = (d?: string | null) => (d ? moment(d).format('DD/MM/YYYY HH:mm') : null);
  // ອະນຸມັດຫຼ້າສຸດຂອງແຕ່ລະຂັ້ນ (ຮອບທີ່ສົ່ງກັບແກ້ໄຂ ອັນໃໝ່ກວ່າທັບອັນເກົ່າ)
  const approvedAt = (level: number) => [...app.approvals].reverse().find((a) => Number(a.level) === level && Number(a.decision) === 1);
  const rejected = status === 4 ? [...app.approvals].reverse().find((a) => Number(a.decision) === 2) : undefined;
  const steps: FlowStep[] = [
    {
      key: 'submit', icon: 'fa-paper-plane', title: t(status === 1 ? 'crStDraft' : 'crFlowSubmitted'),
      state: status === 1 ? 'current' : 'done', who: app.created_by_name, when: status === 1 ? null : moment(app.apply_date).format('DD/MM/YYYY'),
    },
    ...Array.from({ length: levels }, (_, i): FlowStep => {
      const level = i + 1;
      const done = status === 3 || status === 5 || level <= reached;
      const record = done ? approvedAt(level) : undefined;
      if (rejected && Number(rejected.level) === level) {
        return { key: `l${level}`, icon: 'fa-circle-xmark', title: t('crFlowRejectedAt').replace('{n}', String(level)), state: 'bad', who: rejected.approver_name, when: date(rejected.decided_at) };
      }
      return {
        key: `l${level}`, icon: done ? 'fa-circle-check' : 'fa-gavel', title: t('crLevelN').replace('{n}', String(level)),
        state: done ? 'done' : status === 2 && level === reached + 1 ? 'current' : 'todo',
        who: record?.approver_name ?? null, when: date(record?.decided_at),
      };
    }),
    {
      key: 'disburse', icon: 'fa-money-bill-transfer', title: t(status === 5 ? 'crStDisbursed' : 'crDisburse'),
      state: status === 5 ? 'done' : status === 3 ? 'current' : 'todo', who: status === 5 ? app.loan?.loan_code : null,
    },
  ];
  const stateText = (s: FlowStep) => (s.state === 'current' ? t(s.key === 'disburse' ? 'crFilterToDisburse' : s.key === 'submit' ? 'crFlowNotSent' : 'crFlowWaiting') : s.state === 'todo' ? '—' : '');
  const next = reached + 1;
  const approvers = app.approvers ?? [];

  return (
    <section className="cr-card cr-flow">
      <header>
        <b><i className="fa-solid fa-route" /> {t('crFlowTitle')}</b>
        <small>{t('crFlowRule').replace('{n}', String(levels))}</small>
      </header>
      <ol className="cr-flow-steps">
        {steps.map((s) => (
          <li key={s.key} className={`is-${s.state}`}>
            <span className="cr-flow-dot"><i className={`fa-solid ${s.state === 'current' && s.key !== 'disburse' && s.key !== 'submit' ? 'fa-hourglass-half' : s.icon}`} /></span>
            <b>{s.title}</b>
            <small>{s.who ?? stateText(s)}</small>
            {s.when && <small>{s.when}</small>}
          </li>
        ))}
      </ol>
      {status === 2 && (
        <div className={`cr-flow-who${blocked ? ' is-blocked' : ''}`}>
          {blocked ? (
            <p><i className="fa-solid fa-user-lock" /> <span><b>{blocked}</b></span></p>
          ) : canDecide ? (
            <p>
              <i className="fa-solid fa-user-check" /> <span><b>{t('crFlowYouCan').replace('{n}', String(next))}</b></span>
              <button type="button" className="acc-rp-btn is-primary" onClick={onDecide}><i className="fa-solid fa-gavel" /> {t('crDecide')}</button>
            </p>
          ) : null}
          {approvers.length ? (
            <p className="cr-flow-names">
              <i className="fa-solid fa-users" />
              <span>{t('crFlowWho').replace('{n}', String(next))} {approvers.map((u) => <em key={u._uuid}>{u.name}</em>)}</span>
            </p>
          ) : (
            <p className="cr-flow-none"><i className="fa-solid fa-triangle-exclamation" /> <span>{t('crFlowNobody')}</span></p>
          )}
        </div>
      )}
    </section>
  );
};

/** ພິຈາລະນາ (ຂັ້ນຕໍ່ໄປ) — ອະນຸມັດ (ປັບຍອດ / ງວດ / ດອກເບ້ຍ ລົງໄດ້), ສົ່ງກັບແກ້ໄຂ ຫຼື ປະຕິເສດ (ຕ້ອງບອກເຫດຜົນ) */
const DecisionForm = ({ app, onClose, onSaved }: { app: Detail; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [decision, setDecision] = useState(1);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>({
    approved_amount: app.approved_amount ?? app.requested_amount,
    approved_term: app.approved_term ?? app.requested_term,
    approved_rate: app.approved_rate ?? app.annual_rate,
    comment: '',
  });
  const levels = app.product?.approval_levels ?? 1;
  const level = Number(app.approval_level) + 1;
  const approve = decision === 1;
  const model = useMemo(() => Schema.Model<any>({
    ...(approve ? {
      approved_amount: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnPrincipalPositive')).max(app.requested_amount, t('crOverRequested')),
      approved_term: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnTermRange')),
      approved_rate: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0, t('crRateRange')).max(240, t('crRateRange')),
    } : { comment: StringType().isRequired(t('crReasonRequired')) }),
  }), [approve, app.requested_amount, t]);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const body = approve
      ? { decision, approved_amount: num(inputs.approved_amount), approved_term: num(inputs.approved_term), approved_rate: num(inputs.approved_rate), comment: inputs.comment }
      : { decision, comment: inputs.comment };
    if (await runSave(() => postApi(`/credit/application/${app._uuid}/decide`, body), setSaving)) {
      onSaved();
      onClose();
    }
  };
  const d = DECISIONS.find((x) => x.value === decision)!;
  return (
    <SettingModal title={t('crDecide')} hint={`${app.application_no} · ${app.customer?.full_name ?? ''} · ${t('crLevelOf').replace('{n}', String(level)).replace('{m}', String(levels))}`}
      icon="fa-gavel" saving={saving} onClose={onClose} onSubmit={submit} className="is-steps" wide
      submit={{ label: t(d.label), icon: d.icon, danger: decision === 2 }}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done title={t('crStepDecision')} hint={t(level < levels && approve ? 'crDecisionNextLevel' : 'crDecisionHint')}>
          <ChoiceTiles<number> className="is-wide" label={t('crDecision')} value={decision} onChange={setDecision}
            options={DECISIONS.map((x) => ({ value: x.value, label: t(x.label), icon: x.icon, hint: t(`${x.label}Hint`) }))}
          />
          {approve && (
            <>
              <div className="acc-fa-money">
                <InputField name="approved_amount" label={t('crApprovedAmount')} accepter={NumberInput} formatter={amountFormatter} controls={false}
                  prefix={app.currency?.genus || app.currency?.name || '₭'}
                />
              </div>
              <InputField name="approved_term" label={t('lnTerm')} accepter={NumberInput} {...postfixProp(t('lnInstallments'))} />
              <InputField name="approved_rate" label={t('lnAnnualRate')} accepter={NumberInput} {...postfixProp(`% / ${t('lnYear')}`)} controls={false} />
              <p className="acc-gl-hint"><i className="fa-solid fa-circle-info" /> {t('crRequestedWas')} {money(app.requested_amount, app.currency)} · {app.requested_term} {t('lnInstallments')} · {app.annual_rate}%</p>
            </>
          )}
          <div className="is-wide">
            <InputField name="comment" label={t(approve ? 'crComment' : 'crReason')} required={!approve} icon={<i className="fa-solid fa-comment" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/** ປ່ອຍກູ້ — ສ້າງສັນຍາຈາກເງື່ອນໄຂທີ່ອະນຸມັດ, ຈ່າຍເງິນ (ຍອດກູ້ − ຄ່າທຳນຽມ) ຈາກບັນຊີເງິນຄັງ ແລະ ລົງບັນຊີ */
const DisburseForm = ({ app, onClose, onSaved }: { app: Detail; onClose: () => void; onSaved: (loanId: number) => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const treasuries = useTreasuryAccounts(app.product?.currency_id);
  const [saving, setSaving] = useState(false);
  const days = Number(app.frequency_days) || 0;
  const firstDue = (d: Date) => (days ? moment(d).add(days, 'days') : moment(d).add(Number(app.frequency_months) || 1, 'months')).toDate();
  const [inputs, setInputs] = useState<Record<string, any>>(() => ({ date: new Date(), treasury_account_id: null, first_due_date: firstDue(new Date()), contract_no: '' }));
  const amount = app.approved_amount ?? app.requested_amount;
  const net = amount - app.fee;
  const account = treasuries.find((a) => a._uuid === inputs.treasury_account_id);
  const short = !!account && Number(account.balance_treasury) < net;
  const model = useMemo(() => Schema.Model<any>({
    date: DateType().isRequired(t('selectRequired')),
    treasury_account_id: NumberType().isRequired(t('selectRequired')),
    first_due_date: DateType().isRequired(t('selectRequired')).addRule((v, d) => !d.date || moment(v).isAfter(d.date, 'day'), t('lnFirstDueAfter')),
  }), [t]);
  const onChange = (next: Record<string, any>) => {
    // ວັນທີປ່ອຍກູ້ປ່ຽນ → ງວດທຳອິດເລື່ອນຕາມ (ຖ້າຍັງເປັນຄ່າທີ່ລະບົບຕັ້ງໃຫ້)
    if (next.date && !moment(next.date).isSame(inputs.date, 'day') && moment(firstDue(inputs.date)).isSame(inputs.first_due_date, 'day')) next = { ...next, first_due_date: firstDue(next.date) };
    setInputs(next);
  };
  const submit = async () => {
    if (!formRef.current?.check()) return;
    let loanId = 0;
    const ok = await runSave(async () => {
      const res = await postApi(`/credit/application/${app._uuid}/disburse`, {
        date: moment(inputs.date).format('YYYY-MM-DD'), treasury_account_id: inputs.treasury_account_id,
        first_due_date: moment(inputs.first_due_date).format('YYYY-MM-DD'), contract_no: inputs.contract_no,
      });
      loanId = res.data?.data?.loan_id ?? 0;
    }, setSaving);
    if (ok) {
      onSaved(loanId);
      onClose();
    }
  };
  const renderTreasury = renderAccountOption(t('treasuryNoBank'));
  return (
    <SettingModal title={t('crDisburse')} hint={`${app.application_no} · ${app.customer?.full_name ?? ''}`} icon="fa-money-bill-transfer" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide submit={{ label: t('crDisburse'), icon: 'fa-money-bill-transfer' }}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={onChange}>
        <FormStep no={1} done title={t('crStepAmount')} hint={t('crStepAmountHint')}>
          <dl className="acc-book-summary is-wide">
            <div><dt>{t('crApprovedAmount')}</dt><dd>{money(amount, app.currency)}</dd></div>
            <div><dt>{t('crFee')}</dt><dd>− {money(app.fee, app.currency)}</dd></div>
            <div className="is-total"><dt>{t('crNetToCustomer')}</dt><dd>{money(net, app.currency)}</dd></div>
          </dl>
          <p className="is-wide acc-gl-hint"><i className="fa-solid fa-book" /> {t('crDisburseRule')}</p>
        </FormStep>
        <FormStep no={2} done={!!inputs.treasury_account_id} title={t('crStepPayout')} hint={t('crStepPayoutHint')}>
          <InputField name="date" label={t('crDisburseDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
            shouldDisableDate={(d: Date) => moment(d).isAfter(moment(), 'day')}
          />
          <InputField name="first_due_date" label={t('lnFirstDue')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} />
          <PickerField name="treasury_account_id" label={t('lnPayFrom')} className="is-wide"
            data={treasuries.map((a) => accountOption(a))} placeholder={treasuries.length ? t('select') : t('lnNoTreasury')}
            renderOption={renderTreasury} renderValue={renderTreasury} popupStyle={ACCOUNT_POPUP_STYLE}
          />
          {short && <p className="is-wide acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('expenseInsufficient')}</p>}
          <div className="is-wide">
            <InputField name="contract_no" label={t('lnContractNo')} required={false} placeholder={t('crContractNoAuto')} icon={<i className="fa-solid fa-file-signature" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

type Tab = 'summary' | 'security' | 'history' | 'schedule';

/**
 * ຄຳຮ້ອງຂໍສິນເຊື່ອ — ຜົນກວດ (LTV, ອັດຕາສ່ວນໜີ້, ວົງເງິນ…), ຂໍ້ມູນລູກຄ້າ, ຫຼັກຊັບ/ຜູ້ຄ້ຳ, ປະຫວັດການພິຈາລະນາ, ຕາຕະລາງຕົວຢ່າງ;
 * ຄຳສັ່ງຕາມສະຖານະ: ຮ່າງ → ແກ້ໄຂ / ສົ່ງພິຈາລະນາ, ລໍຖ້າ → ພິຈາລະນາ, ອະນຸມັດ → ປ່ອຍກູ້, ປ່ອຍແລ້ວ → ເປີດສັນຍາ
 */
const ApplicationDetail = ({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) => {
  const t = useT();
  const [app, setApp] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const [form, setForm] = useState<'edit' | 'decide' | 'disburse' | null>(null);
  const [contractId, setContractId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getApi(`/credit/application/${id}`);
      setApp(res.data?.data ?? null);
    } catch (err) {
      Notific.error(getErrorMessage(err));
      onClose();
    }
  }, [id, onClose]);
  useEffect(() => {
    load();
  }, [load]);
  const changed = () => {
    load();
    onChanged();
  };

  if (!app) {
    return (
      <Modal open onClose={onClose} size="lg" className="acc-ln-detail">
        <Modal.Body><div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div></Modal.Body>
      </Modal>
    );
  }

  const status = Number(app.status);
  const levels = app.product?.approval_levels ?? 1;
  const mine = myId() > 0 && myId() === Number(app.created_by);
  const approvedBefore = app.approvals.some((a) => Number(a.decision) === 1 && Number(a.approver_id) === myId() && a.level <= Number(app.approval_level));
  const amount = app.approved_amount ?? app.requested_amount;
  const term = app.approved_term ?? app.requested_term;
  const rate = app.approved_rate ?? app.annual_rate;
  const first = app.schedule[0];
  const c = app.customer;
  const method = LOAN_METHODS.find((m) => m.value === Number(app.method));
  const issues = app.check.issues;

  const act = async (task: () => Promise<unknown>, message = 'acsSaved') => {
    try {
      setBusy(true);
      await task();
      Notific.success(message);
      changed();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const submit = () => act(() => putApi(`/credit/application/${app._uuid}`, { submit: true }), 'crSubmitted');
  const cancel = () => Notific.confirm(`${t('crCancelAppConfirm')} ${app.application_no}`, () => act(() => postApi(`/credit/application/${app._uuid}/cancel`, {})));
  const remove = () => Notific.confirm(`${t('crDeleteAppConfirm')} ${app.application_no}`, async () => {
    try {
      await deleteApi(`/credit/application/${app._uuid}`);
      Notific.success('acsDeleted');
      onChanged();
      onClose();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });
  const decideBlocked = mine ? t('crMakerChecker') : approvedBefore ? t('crApprovedBefore') : '';

  return (
    <Modal open onClose={onClose} size="lg" className="acc-ln-detail cr-detail">
      <Modal.Header>
        <div className="acc-ln-head">
          <span className={`acc-ln-head-icon cr-app-icon ${APP_STATUS[status]?.tone ?? ''}`}><i className={`fa-solid ${APP_STATUS[status]?.icon ?? 'fa-file-pen'}`} /></span>
          <span className="acc-ln-head-text">
            <Modal.Title>{c?.full_name ?? '—'}</Modal.Title>
            <small>
              <span className="acc-fs-code">{app.application_no}</span>
              {[app.product?.name_la, showDate(app.apply_date), app.created_by_name && `${t('crCreatedBy')} ${app.created_by_name}`].filter(Boolean).join(' · ')}
            </small>
          </span>
          <span className="acc-ln-head-actions">
            <AppStatusChip status={status} level={app.approval_level} levels={levels} />
            {status === 1 && canEdit && <button type="button" className="acc-rp-btn" disabled={busy} onClick={() => setForm('edit')}><i className="fa-solid fa-pen" /> {t('edit')}</button>}
            {[1, 4, 6].includes(status) && canDelete && !app.approvals.length && (
              <button type="button" className="acc-rp-btn is-danger" disabled={busy} onClick={remove}><i className="fa-solid fa-trash" /> {t('delete')}</button>
            )}
            {[1, 2, 3].includes(status) && canEdit && (
              <button type="button" className="acc-rp-btn is-danger" disabled={busy} onClick={cancel}><i className="fa-solid fa-ban" /> {t('crCancelApp')}</button>
            )}
            {status === 1 && canEdit && (
              <button type="button" className="acc-rp-btn is-primary" disabled={busy || issues.length > 0} title={issues.length ? t('crSubmitBlocked') : undefined} onClick={submit}>
                <i className="fa-solid fa-paper-plane" /> {t('crSubmit')}
              </button>
            )}
            {status === 2 && canEdit && (
              <button type="button" className="acc-rp-btn is-primary" disabled={busy || !!decideBlocked} title={decideBlocked || undefined} onClick={() => setForm('decide')}>
                <i className="fa-solid fa-gavel" /> {t('crDecide')}
              </button>
            )}
            {status === 3 && canCreate && (
              <button type="button" className="acc-rp-btn is-primary" disabled={busy} onClick={() => setForm('disburse')}>
                <i className="fa-solid fa-money-bill-transfer" /> {t('crDisburse')}
              </button>
            )}
            {status === 5 && app.loan && (
              <button type="button" className="acc-rp-btn is-primary" onClick={() => setContractId(app.loan!._uuid)}>
                <i className="fa-solid fa-file-signature" /> {app.loan.loan_code}
              </button>
            )}
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-ln-kpis">
          <div className="acc-ln-kpi is-main">
            <small>{t(app.approved_amount !== null ? 'crApprovedAmount' : 'crRequestedAmount')}</small>
            <b>{money(amount, app.currency)}</b>
            <em>{creditTermText(term, app.frequency_days, app.frequency_months, t)} · {rate}% ({monthlyRate(rate)}% {t('crPerMonth')})</em>
          </div>
          <div className="acc-ln-kpi">
            <small>{t('crInstallment')}</small>
            <b>{first ? money(first.payment, app.currency) : '—'}</b>
            <em>{method && t(method.label)}{app.fee ? ` · ${t('crFee')} ${money(app.fee, app.currency)}` : ''}</em>
          </div>
          <div className={`acc-ln-kpi${app.product?.max_debt_ratio && (app.check.debt_ratio ?? 999) > app.product.max_debt_ratio ? ' is-bad' : ''}`}>
            <small>{t('crDti')}</small>
            <b>{app.check.debt_ratio === null ? '—' : `${app.check.debt_ratio}%`}</b>
            <em>{c?.monthly_income ? `${t('crMonthlyIncome')} ${money(c.monthly_income, null)}` : t('crNoIncome')}</em>
          </div>
          <div className={`acc-ln-kpi${app.product?.max_ltv && (app.check.ltv ?? 0) > app.product.max_ltv ? ' is-bad' : ''}`}>
            <small>LTV</small>
            <b>{app.check.ltv === null ? '—' : `${app.check.ltv}%`}</b>
            <em>{t('crCollateralTotal')} {money(app.check.collateral_value, null)}</em>
          </div>
        </div>

        {[1, 2, 3].includes(status) && (
          issues.length ? (
            <div className="cr-issues">
              <b><i className="fa-solid fa-triangle-exclamation" /> {t('crIssues')}</b>
              <ul>{issues.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ) : (
            <div className="cr-issues is-ok"><b><i className="fa-solid fa-shield-halved" /> {t('crChecksPassed')}</b></div>
          )
        )}
        {status === 4 && app.reject_reason && <div className="cr-issues"><b><i className="fa-solid fa-circle-xmark" /> {t('crRejectedReason')}</b> {app.reject_reason}</div>}
        {status <= 5 && (
          <ApprovalFlow app={app} blocked={status === 2 ? decideBlocked : ''} canDecide={status === 2 && canEdit && !decideBlocked} onDecide={() => setForm('decide')} />
        )}

        <DetailTabs<Tab> value={tab} onChange={setTab} tabs={[
          { key: 'summary', icon: 'fa-address-card', label: t('crSummary') },
          { key: 'security', icon: 'fa-house-lock', label: t('crSecurity'), count: app.collaterals.length + app.guarantors.length },
          { key: 'history', icon: 'fa-clock-rotate-left', label: t('crHistory'), count: app.approvals.length },
          { key: 'schedule', icon: 'fa-table-list', label: t('lnSchedule'), count: app.schedule.length },
        ]}
        />

        {tab === 'summary' && (
          <div className="cr-split">
            <section>
              <h5><i className="fa-solid fa-user" /> {t('crBorrower')}</h5>
              <InfoRows rows={[
                [t('crCustomer'), c && <>{c.customer_code} · {c.full_name} {Number(c.blacklisted) === 1 && <span className="cr-status is-rejected">{t('crBlacklist')}</span>}</>],
                [t('phone'), c?.phone],
                [t('crIdNo'), c?.id_no],
                [t('crAddress'), c && customerAddress(c)],
                [t('crOccupation'), c && [c.occupation, c.workplace].filter(Boolean).join(' · ')],
                [t('crRisk'), c && <RiskChip level={c.risk_level} />],
              ]}
              />
            </section>
            <section>
              <h5><i className="fa-solid fa-file-pen" /> {t('crApplication')}</h5>
              <InfoRows rows={[
                [t('crProduct'), app.product && `${app.product.product_code} · ${app.product.name_la}`],
                [t('crApplyDate'), showDate(app.apply_date)],
                [t('crRequestedAmount'), `${money(app.requested_amount, app.currency)} · ${creditTermText(app.requested_term, app.frequency_days, app.frequency_months, t)} · ${app.annual_rate}%`],
                [t('crApprovedAmount'), app.approved_amount !== null && `${money(app.approved_amount, app.currency)} · ${app.approved_term ?? app.requested_term} ${t('lnInstallments')} · ${app.approved_rate ?? app.annual_rate}%`],
                [t('lnMethod'), (() => { const m = LOAN_METHODS.find((x) => x.value === Number(app.method)); return m ? t(m.label) : ''; })()],
                [t('lnPurpose'), app.purpose],
                [t('crRepaymentSource'), app.repayment_source],
                [t('crItem'), app.item_description && `${app.item_description} · ${money(app.item_price, app.currency)} (${t('crDownPayment')} ${money(app.down_payment, app.currency)})`],
                [t('crCreatedBy'), app.created_by_name],
                [t('note'), app.note],
              ]}
              />
            </section>
          </div>
        )}
        {tab === 'security' && (
          <div className="cr-split">
            <section><h5>{t('crCollaterals')}</h5><CollateralList rows={app.collaterals} /></section>
            <section><h5>{t('crGuarantors')}</h5><GuarantorList rows={app.guarantors} /></section>
          </div>
        )}
        {tab === 'history' && (
          app.approvals.length ? (
            <ol className="cr-timeline">
              {app.approvals.map((a) => {
                const d = DECISIONS.find((x) => x.value === Number(a.decision)) ?? DECISIONS[0];
                return (
                  <li key={a._uuid} className={`is-${d.value === 1 ? 'approve' : d.value === 2 ? 'reject' : 'return'}`}>
                    <span className="cr-timeline-dot"><i className={`fa-solid ${d.icon}`} /></span>
                    <div>
                      <b>{t(d.label)} · {t('crLevelN').replace('{n}', String(a.level))}</b>
                      <small>{[a.approver_name, moment(a.decided_at).format('DD/MM/YYYY HH:mm')].filter(Boolean).join(' · ')}</small>
                      {d.value === 1 && a.approved_amount !== null && (
                        <p>{money(a.approved_amount, app.currency)} · {a.approved_term} {t('lnInstallments')} · {a.approved_rate}%</p>
                      )}
                      {a.comment && <p className="cr-timeline-comment"><i className="fa-solid fa-comment" /> {a.comment}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-clock-rotate-left" /><p>{t('crNoHistory')}</p></div>
        )}
        {tab === 'schedule' && <ScheduleTable rows={app.schedule} principal={amount} preview />}
      </Modal.Body>

      {form === 'edit' && <ApplicationForm row={app} onClose={() => setForm(null)} onSaved={changed} />}
      {form === 'decide' && <DecisionForm app={app} onClose={() => setForm(null)} onSaved={changed} />}
      {form === 'disburse' && (
        <DisburseForm app={app} onClose={() => setForm(null)} onSaved={(loanId) => {
          changed();
          if (loanId) setContractId(loanId);
        }}
        />
      )}
      {contractId && <ContractDetail id={contractId} onClose={() => setContractId(null)} onChanged={changed} />}
    </Modal>
  );
};

export default ApplicationDetail;
