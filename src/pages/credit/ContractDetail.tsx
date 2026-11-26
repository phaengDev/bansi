import { useCallback, useEffect, useState } from 'react';
import { Loader, Modal } from 'rsuite';
import { deleteApi, getApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { PaymentsTable, ScheduleTable } from '../account/loans/loanKit';
import { LOAN_METHODS, money, showDate } from '../account/loans/loanApi';
import { PAYMENT_TYPES, customerAddress, type ContractDetail as Detail, type ContractPayment, type Waiver } from './creditApi';
import CollectForm from './CollectForm';
import ReceiptPrint from './ReceiptPrint';
import { FollowUpForm, FollowUpList, PenaltyPanel, WaiveForm } from './collectKit';
import { CollateralList, DetailTabs, GuarantorList, InfoRows, RiskChip, creditTermText } from './creditKit';

type Tab = 'schedule' | 'payments' | 'penalty' | 'followups' | 'security' | 'customer';

/**
 * ສັນຍາສິນເຊື່ອ — ຍອດຄ້າງ / ງວດຕໍ່ໄປ / ກາຍກຳນົດ / ດອກເບ້ຍ ແລະ ຄ່າທຳນຽມທີ່ໄດ້ຮັບ, ຕາຕະລາງຜ່ອນ, ການຊຳລະ (ຍົກເລີກໄດ້),
 * ຫຼັກຊັບ + ຜູ້ຄ້ຳ, ຂໍ້ມູນລູກຄ້າ; ຮັບຊຳລະ (ຟອມດຽວກັບເງິນກູ້), ຍົກເລີກການປ່ອຍກູ້ (ກ່ອນມີການຊຳລະ / ດອກເບ້ຍຄ້າງ)
 */
/** openReceipt = ເປີດໃບຮັບເງິນຂອງການຊຳລະນີ້ທັນທີ (ຫຼັງຮັບຊຳລະຈາກໜ້າຕິດຕາມໜີ້) */
const ContractDetail = ({ id, onClose, onChanged, openReceipt }: { id: number; onClose: () => void; onChanged: () => void; openReceipt?: number }) => {
  const t = useT();
  const [loan, setLoan] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>(openReceipt ? 'payments' : 'schedule');
  const [form, setForm] = useState<'collect' | 'waive' | 'followup' | null>(null);
  /** ໃບຮັບເງິນທີ່ກຳລັງເບິ່ງ / ພິມ (ເລກການຊຳລະ) */
  const [receiptId, setReceiptId] = useState<number | null>(openReceipt ?? null);

  const load = useCallback(async () => {
    try {
      const res = await getApi(`/credit/contract/${id}`);
      setLoan(res.data?.data ?? null);
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

  if (!loan) {
    return (
      <Modal open onClose={onClose} size="lg" className="acc-ln-detail">
        <Modal.Body><div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div></Modal.Body>
      </Modal>
    );
  }

  const cur = loan.currency;
  const paidPct = loan.principal > 0 ? Math.min(100, Math.round((loan.paid_principal / loan.principal) * 100)) : 0;
  const method = LOAN_METHODS.find((m) => m.value === Number(loan.method));
  const active = loan.payments.filter((p) => Number(p.status) === 1);
  const penalties = active.reduce((n, p) => n + (Number(p.penalty) || 0), 0);
  const c = loan.customer;

  const undo = () => Notific.confirm(`${t('crUndoDisburseConfirm')} ${loan.loan_code}`, async () => {
    try {
      await postApi(`/credit/contract/${loan._uuid}/undo-disburse`, {});
      Notific.success('acsSaved');
      onChanged();
      onClose();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });

  const undoWaiver = (w: Waiver) => Notific.confirm(`${t('crUndoWaiverConfirm')} ${money(w.amount, cur)}`, async () => {
    try {
      await deleteApi(`/credit/penalty/${w._uuid}`);
      Notific.success('acsSaved');
      changed();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });

  const cancelPayment = (paymentId: number, number: string | null) => Notific.confirm(`${t('lnCancelPaymentConfirm')} ${number ?? ''}`, async () => {
    try {
      await putApi(`/loan/payment/cancel/${paymentId}`, {});
      Notific.success('acsSaved');
      changed();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });

  return (
    <Modal open onClose={onClose} size="lg" className="acc-ln-detail cr-detail">
      <Modal.Header>
        <div className="acc-ln-head">
          <span className="acc-ln-head-icon is-lent"><i className="fa-solid fa-file-signature" /></span>
          <span className="acc-ln-head-text">
            <Modal.Title>{c?.full_name ?? loan.counterparty}</Modal.Title>
            <small>
              <span className="acc-fs-code">{loan.loan_code}</span>
              {[loan.contract_no, loan.product?.name_la, `${loan.annual_rate}% ${t('lnPerYear')}`, method && t(method.label),
                creditTermText(loan.term, loan.frequency_days, loan.frequency_months, t), cur?.name].filter(Boolean).join(' · ')}
            </small>
          </span>
          <span className="acc-ln-head-actions">
            {canDelete && !loan.locked && (
              <button type="button" className="acc-rp-btn is-danger" onClick={undo}><i className="fa-solid fa-rotate-left" /> {t('crUndoDisburse')}</button>
            )}
            {canCreate && (!loan.closed || loan.penalty.due > 0) && (
              <button type="button" className="acc-rp-btn" onClick={() => setForm('followup')}><i className="fa-solid fa-phone-volume" /> {t('crFollowUpAdd')}</button>
            )}
            {canCreate && (!loan.closed || loan.penalty.due > 0) && (
              <button type="button" className="acc-rp-btn is-primary" onClick={() => setForm('collect')}>
                <i className="fa-solid fa-hand-holding-dollar" /> {t('crCollect')}
              </button>
            )}
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-ln-kpis">
          <div className="acc-ln-kpi is-main">
            <small>{t('lnOutstanding')}</small>
            <b>{money(loan.outstanding, cur)}</b>
            <span className="acc-ln-bar"><i style={{ width: `${paidPct}%` }} /></span>
            <em>{t('lnPaidOf').replace('{p}', String(paidPct))} · {money(loan.principal, cur)}</em>
          </div>
          <div className={`acc-ln-kpi${loan.closed ? ' is-done' : ''}`}>
            <small>{t('lnNextDue')}</small>
            {loan.closed ? <b><i className="fa-solid fa-circle-check" /> {t('lnClosed')}</b> : (
              <>
                <b>{loan.next ? money(loan.next.amount, cur) : '—'}</b>
                <em>{loan.next ? `${t('lnInstallmentNo')} ${loan.next.no} · ${showDate(loan.next.due_date)}` : ''}</em>
              </>
            )}
          </div>
          <div className={`acc-ln-kpi${loan.overdue_count || loan.penalty.due ? ' is-bad' : ''}`}>
            <small>{t('lnOverdue')}</small>
            <b>{loan.overdue_count ? money(loan.overdue_amount, cur) : '—'}</b>
            <em>
              {loan.overdue_count ? `${loan.overdue_count} ${t('lnInstallments')} · ${t('crDaysLateN').replace('{n}', String(loan.penalty.days_overdue))}` : t('crOnTime')}
              {loan.penalty.due > 0 && <><br />{t('crPenalty')} {money(loan.penalty.due, cur)}</>}
            </em>
          </div>
          <div className="acc-ln-kpi is-income">
            <small>{t('crIncomeEarned')}</small>
            <b>{money(loan.paid_interest + loan.upfront_fee + penalties + loan.paid_fee, cur)}</b>
            <em>{t('crIncomeSplit').replace('{i}', money(loan.paid_interest, cur)).replace('{f}', money(loan.upfront_fee + loan.paid_fee, cur))}{penalties > 0 ? ` · ${t('crPenalty')} ${money(penalties, cur)}` : ''}</em>
          </div>
        </div>

        <p className="acc-ln-meta">
          <span><i className="fa-solid fa-calendar-day" /> {t('crDisbursedOn')} {showDate(loan.start_date)}</span>
          {loan.treasury && <span><i className="fa-solid fa-building-columns" /> {loan.treasury.acountName}</span>}
          <span><i className="fa-solid fa-list-ol" /> {loan.paid_installments} / {loan.installments} {t('lnInstallments')}</span>
          {loan.application && <span><i className="fa-solid fa-file-pen" /> {loan.application.application_no}</span>}
          {loan.officer && <span><i className="fa-solid fa-user-tie" /> {loan.officer}</span>}
          {loan.penalty_rate > 0 && <span><i className="fa-solid fa-gavel" /> {t('crPenalty')} {loan.penalty_rate}% / {t('crDay')}{loan.grace_days ? ` · ${t('crGraceN').replace('{n}', String(loan.grace_days))}` : ''}</span>}
        </p>

        <DetailTabs<Tab> value={tab} onChange={setTab} tabs={[
          { key: 'schedule', icon: 'fa-table-list', label: t('lnSchedule'), count: loan.schedule.length },
          { key: 'payments', icon: 'fa-receipt', label: t('lnReceipts'), count: active.length },
          { key: 'penalty', icon: 'fa-gavel', label: t('crPenalty'), count: loan.penalty.rows.length },
          { key: 'followups', icon: 'fa-phone-volume', label: t('crFollowUps'), count: loan.collections.length },
          { key: 'security', icon: 'fa-house-lock', label: t('crSecurity'), count: loan.collaterals.length + loan.guarantors.length },
          { key: 'customer', icon: 'fa-address-card', label: t('crCustomer') },
        ]}
        />

        {tab === 'schedule' && <ScheduleTable rows={loan.schedule} principal={loan.principal} nextNo={loan.next?.no} />}
        {tab === 'payments' && (
          <PaymentsTable<ContractPayment> payments={loan.payments} currency={cur} onCancel={(p) => cancelPayment(p._uuid, p.number)} onPrint={(p) => setReceiptId(p._uuid)}
            badge={(p) => Number(p.payment_type) > 1 && (
              <span className={`cr-pay-type is-${p.payment_type}`}><i className={`fa-solid ${PAYMENT_TYPES[p.payment_type].icon}`} /> {t(PAYMENT_TYPES[p.payment_type].label)}</span>
            )}
          />
        )}
        {tab === 'penalty' && (
          <>
            {canEdit && loan.penalty.due > 0 && (
              <div className="cr-tab-actions">
                <button type="button" className="acc-rp-btn" onClick={() => setForm('waive')}><i className="fa-solid fa-hand-holding-heart" /> {t('crWaive')}</button>
              </div>
            )}
            <PenaltyPanel state={loan.penalty} waivers={loan.waivers} currency={cur} rate={loan.penalty_rate} grace={loan.grace_days} onUndoWaiver={undoWaiver} />
          </>
        )}
        {tab === 'followups' && <FollowUpList rows={loan.collections} />}
        {tab === 'security' && (
          <div className="cr-split">
            <section><h5>{t('crCollaterals')}</h5><CollateralList rows={loan.collaterals} /></section>
            <section><h5>{t('crGuarantors')}</h5><GuarantorList rows={loan.guarantors} /></section>
          </div>
        )}
        {tab === 'customer' && c && (
          <div className="cr-split">
            <InfoRows rows={[
              [t('faCode'), c.customer_code],
              [t('phone'), [c.phone, c.phone2].filter(Boolean).join(' · ')],
              [t('crIdNo'), c.id_no],
              [t('crAddress'), customerAddress(c)],
            ]}
            />
            <InfoRows rows={[
              [t('crOccupation'), [c.occupation, c.workplace].filter(Boolean).join(' · ')],
              [t('crMonthlyIncome'), c.monthly_income ? money(c.monthly_income, null) : ''],
              [t('crRisk'), <RiskChip level={c.risk_level} />],
            ]}
            />
          </div>
        )}
      </Modal.Body>

      {form === 'collect' && (
        <CollectForm contract={{ ...loan, name: c?.full_name ?? loan.counterparty }} onClose={() => setForm(null)}
          onSaved={(paymentId) => {
            changed();
            setTab('payments');
            if (paymentId) setReceiptId(paymentId);
          }}
        />
      )}
      {form === 'waive' && (
        <WaiveForm loanId={loan._uuid} title={`${loan.loan_code} · ${c?.full_name ?? ''}`} due={loan.penalty.due} currency={cur} onClose={() => setForm(null)} onSaved={changed} />
      )}
      {form === 'followup' && <FollowUpForm loanId={loan._uuid} title={`${loan.loan_code} · ${c?.full_name ?? ''}`} onClose={() => setForm(null)} onSaved={() => { changed(); setTab('followups'); }} />}
      {receiptId && loan.payments.some((p) => p._uuid === receiptId) && (
        <ReceiptPrint contract={loan} payment={loan.payments.find((p) => p._uuid === receiptId)!} onClose={() => setReceiptId(null)} />
      )}
    </Modal>
  );
};

export default ContractDetail;
