import { formatNumber } from '../../../utils/configApi';
import { canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { STATE_CHIPS, money, showDate, type Installment, type LoanCurrency, type LoanPayment } from './loanApi';

/**
 * ຕາຕະລາງຜ່ອນ — ສະຖານະແຕ່ລະງວດ (ຈ່າຍແລ້ວ / ກາຍກຳນົດ / ງວດຕໍ່ໄປ …) ແລະ ຍອດຄົງເຫຼືອຫຼັງງວດ.
 * ໃຊ້ຮ່ວມ: ລາຍລະອຽດເງິນກູ້ (LoanDetail), ສັນຍາສິນເຊື່ອ, ຕົວຢ່າງໃນຄຳຮ້ອງ (preview = ບໍ່ມີຖັນຈ່າຍແລ້ວ / ສະຖານະ)
 */
export const ScheduleTable = ({ rows, principal, nextNo, preview }: {
  rows: (Pick<Installment, 'no' | 'due_date' | 'principal' | 'interest' | 'payment'> & Partial<Installment>)[];
  principal: number;
  nextNo?: number | null;
  preview?: boolean;
}) => {
  const t = useT();
  let running = principal;
  return (
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
            {!preview && <th>{t('lnPaidShort')}</th>}
            {!preview && <th>{t('status')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            running = Math.max(0, Math.round((running - r.principal) * 100) / 100);
            const chip = r.state ? STATE_CHIPS[r.state] : null;
            const paid = (r.paid_principal ?? 0) + (r.paid_interest ?? 0);
            return (
              <tr key={r.no} className={`is-line${r.state ? ` is-${r.state}` : ''}${nextNo === r.no ? ' is-next' : ''}`}>
                <td>{r.no}</td>
                <td>{showDate(r.due_date)}</td>
                <td>{formatNumber(r.principal)}</td>
                <td>{formatNumber(r.interest)}</td>
                <td><b>{formatNumber(r.payment)}</b></td>
                <td>{formatNumber(running)}</td>
                {!preview && <td>{paid ? formatNumber(paid) : '—'}</td>}
                {!preview && (
                  <td>{chip && <span className={`acc-ln-state is-${r.state}`}><i className={`fa-solid ${chip.icon}`} /> {t(chip.label)}</span>}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/** ປະຫວັດການຈ່າຍ / ຮັບ — ຍົກເລີກໄດ້ (ກັບລາຍການບັນຊີ). ໃຊ້ຮ່ວມ: ລາຍລະອຽດເງິນກູ້ ແລະ ສັນຍາສິນເຊື່ອ */
export const PaymentsTable = ({ payments, currency, onCancel }: {
  payments: (LoanPayment & { penalty?: number })[];
  currency: LoanCurrency;
  onCancel: (payment: LoanPayment) => void;
}) => {
  const t = useT();
  if (!payments.length) return <div className="acc-class-empty"><i className="fa-solid fa-receipt" /><p>{t('lnNoPayments')}</p></div>;
  const hasPenalty = payments.some((p) => Number(p.penalty) > 0);
  return (
    <div className="acc-rp-scroll acc-ln-table-wrap">
      <table className="acc-fs-table acc-ln-table">
        <thead>
          <tr>
            <th>{t('lnPayDate')}</th>
            <th>{t('lnPaymentNo')}</th>
            <th>{t('lnAccount')}</th>
            <th>{t('lnPrincipalShort')}</th>
            <th>{t('lnInterestShort')}</th>
            {hasPenalty && <th>{t('crPenalty')}</th>}
            <th>{t('lnFee')}</th>
            <th>{t('total')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
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
                {hasPenalty && <td>{p.penalty ? formatNumber(p.penalty) : '—'}</td>}
                <td>{p.fee ? formatNumber(p.fee) : '—'}</td>
                <td><b>{money(p.total, currency)}</b></td>
                <td className="acc-fa-actions">
                  {cancelled ? <span className="acc-ln-state is-closed">{t('lnCancelled')}</span> : canDelete && (
                    <button type="button" className="is-danger" onClick={() => onCancel(p)} title={t('lnCancelPayment')} aria-label={t('lnCancelPayment')}>
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
  );
};
