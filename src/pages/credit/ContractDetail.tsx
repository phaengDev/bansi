import { useCallback, useEffect, useState } from 'react';
import { Loader, Modal } from 'rsuite';
import { getApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import LoanPayForm from '../account/loans/LoanPayForm';
import { PaymentsTable, ScheduleTable } from '../account/loans/loanKit';
import { LOAN_METHODS, money, showDate } from '../account/loans/loanApi';
import { customerAddress, type ContractDetail as Detail } from './creditApi';
import { CollateralList, DetailTabs, GuarantorList, InfoRows, RiskChip, creditTermText } from './creditKit';

type Tab = 'schedule' | 'payments' | 'security' | 'customer';

/**
 * ສັນຍາສິນເຊື່ອ — ຍອດຄ້າງ / ງວດຕໍ່ໄປ / ກາຍກຳນົດ / ດອກເບ້ຍ ແລະ ຄ່າທຳນຽມທີ່ໄດ້ຮັບ, ຕາຕະລາງຜ່ອນ, ການຊຳລະ (ຍົກເລີກໄດ້),
 * ຫຼັກຊັບ + ຜູ້ຄ້ຳ, ຂໍ້ມູນລູກຄ້າ; ຮັບຊຳລະ (ຟອມດຽວກັບເງິນກູ້), ຍົກເລີກການປ່ອຍກູ້ (ກ່ອນມີການຊຳລະ / ດອກເບ້ຍຄ້າງ)
 */
const ContractDetail = ({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) => {
  const t = useT();
  const [loan, setLoan] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>('schedule');
  const [paying, setPaying] = useState(false);

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
            {canCreate && !loan.closed && (
              <button type="button" className="acc-rp-btn is-primary" onClick={() => setPaying(true)}>
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
          <div className={`acc-ln-kpi${loan.overdue_count ? ' is-bad' : ''}`}>
            <small>{t('lnOverdue')}</small>
            <b>{loan.overdue_count ? money(loan.overdue_amount, cur) : '—'}</b>
            <em>{loan.overdue_count} {t('lnInstallments')}</em>
          </div>
          <div className="acc-ln-kpi is-income">
            <small>{t('crIncomeEarned')}</small>
            <b>{money(loan.paid_interest + loan.upfront_fee + penalties + loan.paid_fee, cur)}</b>
            <em>{t('crIncomeSplit').replace('{i}', money(loan.paid_interest, cur)).replace('{f}', money(loan.upfront_fee + loan.paid_fee, cur))}</em>
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
          { key: 'security', icon: 'fa-house-lock', label: t('crSecurity'), count: loan.collaterals.length + loan.guarantors.length },
          { key: 'customer', icon: 'fa-address-card', label: t('crCustomer') },
        ]}
        />

        {tab === 'schedule' && <ScheduleTable rows={loan.schedule} principal={loan.principal} nextNo={loan.next?.no} />}
        {tab === 'payments' && <PaymentsTable payments={loan.payments} currency={cur} onCancel={(p) => cancelPayment(p._uuid, p.number)} />}
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

      {paying && <LoanPayForm loan={loan} onClose={() => setPaying(false)} onSaved={changed} />}
    </Modal>
  );
};

export default ContractDetail;
