import { useCallback, useEffect, useState } from 'react';
import { Loader, Modal } from 'rsuite';
import { deleteApi, formatNumber, getApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import LoanForm from './LoanForm';
import LoanPayForm from './LoanPayForm';
import { BORROWED, LOAN_METHODS, STATE_CHIPS, money, showDate, termText, type LoanDetail as Detail } from './loanApi';

type Tab = 'schedule' | 'payments';

/**
 * ລາຍລະອຽດເງິນກູ້ — ສະຫຼຸບ (ຍອດຄົງເຫຼືອ, ງວດຕໍ່ໄປ, ກາຍກຳນົດ, ດອກເບ້ຍ), ຕາຕະລາງຜ່ອນພ້ອມສະຖານະແຕ່ລະງວດ,
 * ປະຫວັດການຈ່າຍ (ຍົກເລີກໄດ້); ຈ່າຍ/ຮັບຄືນ, ແກ້ໄຂ, ລຶບ (ກ່ອນມີການຈ່າຍ), Excel
 */
const LoanDetail = ({ id, nextCode, onClose, onChanged }: { id: number; nextCode: string; onClose: () => void; onChanged: () => void }) => {
  const t = useT();
  const [loan, setLoan] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>('schedule');
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getApi(`/loan/${id}`);
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

  const borrowed = loan.direction === BORROWED;
  const cur = loan.currency;
  const paidPct = loan.principal > 0 ? Math.min(100, Math.round((loan.paid_principal / loan.principal) * 100)) : 0;
  const method = LOAN_METHODS.find((m) => m.value === Number(loan.method));
  const activePayments = loan.payments.filter((p) => Number(p.status) === 1);

  const remove = () => Notific.confirm(`${t('lnDeleteConfirm')} ${loan.loan_code} ${loan.counterparty}`, async () => {
    try {
      await deleteApi(`/loan/${loan._uuid}`);
      Notific.success('acsDeleted');
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

  const exportSchedule = () => exportExcel(loan.schedule.map((r, i) => ({
    '#': r.no,
    [t('lnDue')]: showDate(r.due_date),
    [t('lnPrincipalShort')]: r.principal,
    [t('lnInterestShort')]: r.interest,
    [t('total')]: r.payment,
    [t('lnBalanceAfter')]: Math.max(0, loan.principal - loan.schedule.slice(0, i + 1).reduce((n, x) => n + x.principal, 0)),
    [t('lnPaidShort')]: r.paid_principal + r.paid_interest,
    [t('status')]: t(STATE_CHIPS[r.state].label),
  })), `loan_${loan.loan_code}`, `${loan.loan_code} ${loan.counterparty}`);

  let running = loan.principal;

  return (
    <Modal open onClose={onClose} size="lg" className="acc-ln-detail">
      <Modal.Header>
        <div className="acc-ln-head">
          <span className={`acc-ln-head-icon is-${borrowed ? 'borrowed' : 'lent'}`}><i className={`fa-solid ${borrowed ? 'fa-building-columns' : 'fa-hand-holding-dollar'}`} /></span>
          <span className="acc-ln-head-text">
            <Modal.Title>{loan.counterparty}</Modal.Title>
            <small>
              <span className="acc-fs-code">{loan.loan_code}</span>
              {[loan.contract_no, t(borrowed ? 'lnBorrowed' : 'lnLent'), `${loan.annual_rate}% ${t('lnPerYear')}`, method && t(method.label),
                termText(loan.term, loan.frequency_months, t), cur?.name].filter(Boolean).join(' · ')}
            </small>
          </span>
          <span className="acc-ln-head-actions">
            <button type="button" className="acc-rp-btn" onClick={exportSchedule}><i className="fa-solid fa-file-excel" /> Excel</button>
            {canEdit && <button type="button" className="acc-rp-btn" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" /> {t('edit')}</button>}
            {canDelete && !loan.locked && (
              <button type="button" className="acc-rp-btn is-danger" onClick={remove}><i className="fa-solid fa-trash" /> {t('delete')}</button>
            )}
            {canCreate && !loan.closed && (
              <button type="button" className="acc-rp-btn is-primary" onClick={() => setPaying(true)}>
                <i className={`fa-solid ${borrowed ? 'fa-money-bill-transfer' : 'fa-hand-holding-dollar'}`} /> {t(borrowed ? 'lnPay' : 'lnReceive')}
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
          <div className="acc-ln-kpi">
            <small>{t(borrowed ? 'lnInterestPaid' : 'lnInterestReceived')}</small>
            <b>{money(loan.paid_interest, cur)}</b>
            <em>{t('lnOfTotal')} {money(loan.total_interest, cur)}</em>
          </div>
        </div>

        <p className="acc-ln-meta">
          <span><i className="fa-solid fa-calendar-day" /> {t(borrowed ? 'lnStartDateBorrowed' : 'lnStartDateLent')} {showDate(loan.start_date)}</span>
          {Number(loan.start_mode) === 2
            ? <span><i className="fa-solid fa-flag-checkered" /> {t('lnModeOpening')} {showDate(loan.opening_date)}</span>
            : loan.treasury && <span><i className="fa-solid fa-building-columns" /> {loan.treasury.acountName}</span>}
          <span><i className="fa-solid fa-list-ol" /> {loan.paid_installments} / {loan.installments} {t('lnInstallments')}</span>
          {loan.purpose && <span><i className="fa-solid fa-bullseye" /> {loan.purpose}</span>}
        </p>

        <div className="acc-type-segment" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'schedule'} className={tab === 'schedule' ? 'is-active' : ''} onClick={() => setTab('schedule')}>
            <i className="fa-solid fa-table-list" /> {t('lnSchedule')} <em>{loan.schedule.length}</em>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'is-active' : ''} onClick={() => setTab('payments')}>
            <i className="fa-solid fa-receipt" /> {t(borrowed ? 'lnPayments' : 'lnReceipts')} <em>{activePayments.length}</em>
          </button>
        </div>

        {tab === 'schedule' ? (
          <div className="acc-rp-scroll acc-ln-table-wrap">
            <table className="acc-fs-table acc-ln-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('lnDue')}</th>
                  <th>{t('lnPrincipalShort')}</th>
                  <th>{t('lnInterestShort')}</th>
                  <th>{t('total')}</th>
                  <th>{t('lnBalanceAfter')}</th>
                  <th>{t('lnPaidShort')}</th>
                  <th>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {loan.schedule.map((r) => {
                  running = Math.max(0, Math.round((running - r.principal) * 100) / 100);
                  const chip = STATE_CHIPS[r.state];
                  const paid = r.paid_principal + r.paid_interest;
                  return (
                    <tr key={r.no} className={`is-line is-${r.state}${loan.next?.no === r.no ? ' is-next' : ''}`}>
                      <td>{r.no}</td>
                      <td>{showDate(r.due_date)}</td>
                      <td>{formatNumber(r.principal)}</td>
                      <td>{formatNumber(r.interest)}</td>
                      <td><b>{formatNumber(r.payment)}</b></td>
                      <td>{formatNumber(running)}</td>
                      <td>{paid ? formatNumber(paid) : '—'}</td>
                      <td><span className={`acc-ln-state is-${r.state}`}><i className={`fa-solid ${chip.icon}`} /> {t(chip.label)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !loan.payments.length ? (
          <div className="acc-class-empty"><i className="fa-solid fa-receipt" /><p>{t('lnNoPayments')}</p></div>
        ) : (
          <div className="acc-rp-scroll acc-ln-table-wrap">
            <table className="acc-fs-table acc-ln-table">
              <thead>
                <tr>
                  <th>{t('lnPayDate')}</th>
                  <th>{t('lnPaymentNo')}</th>
                  <th>{t('lnAccount')}</th>
                  <th>{t('lnPrincipalShort')}</th>
                  <th>{t('lnInterestShort')}</th>
                  <th>{t('lnFee')}</th>
                  <th>{t('total')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loan.payments.map((p) => {
                  const cancelled = Number(p.status) !== 1;
                  return (
                    <tr key={p._uuid} className={`is-line${cancelled ? ' is-cancelled' : ''}`}>
                      <td>{showDate(p.pay_date)}</td>
                      <td>
                        <b>{p.number}</b>
                        <small className="acc-gl-ref">{[p.entry_number, p.reference].filter(Boolean).join(' · ')}</small>
                      </td>
                      <td>{p.treasury?.acountName ?? '—'}</td>
                      <td>{formatNumber(p.principal)}</td>
                      <td>{formatNumber(p.interest)}</td>
                      <td>{p.fee ? formatNumber(p.fee) : '—'}</td>
                      <td><b>{money(p.total, cur)}</b></td>
                      <td className="acc-fa-actions">
                        {cancelled ? <span className="acc-ln-state is-closed">{t('lnCancelled')}</span> : canDelete && (
                          <button type="button" className="is-danger" onClick={() => cancelPayment(p._uuid, p.number)} title={t('lnCancelPayment')} aria-label={t('lnCancelPayment')}>
                            <i className="fa-solid fa-rotate-left" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>

      {paying && <LoanPayForm loan={loan} onClose={() => setPaying(false)} onSaved={changed} />}
      {editing && <LoanForm direction={loan.direction} row={loan} nextCode={nextCode} onClose={() => setEditing(false)} onSaved={changed} />}
    </Modal>
  );
};

export default LoanDetail;
