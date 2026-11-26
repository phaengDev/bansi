import { useRef } from 'react';
import { Button, Modal } from 'rsuite';
import moment from 'moment';
import { formatNumber } from '../../utils/configApi';
import { printElementByFrame } from '../../utils/Print';
import { amountInLaoWords } from '../../utils/laoWords';
import { useT } from '../../context/LanguageContext';
import { useCompany } from '../hr/payroll/payrollApi';
import { money, showDate } from '../account/loans/loanApi';
import { PAYMENT_TYPES, type ContractDetail, type ContractPayment } from './creditApi';

/** ພິມສະເພາະໃບຮັບເງິນ — A5 ຕັ້ງ */
const PRINT_CSS = `
  @page { size: A5 portrait; margin: 8mm; }
  html, body { background: #fff !important; margin: 0; }
  .cr-receipt { box-shadow: none !important; border: 0 !important; margin: 0 !important; width: auto !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * ໃບຮັບເງິນ ຂອງການຊຳລະສັນຍາສິນເຊື່ອ — ບໍລິສັດ, ລູກຄ້າ, ສັນຍາ, ແບ່ງ ຕົ້ນ / ດອກ / ຄ່າປັບ / ຄ່າທຳນຽມ, ຕົວໜັງສື,
 * ຍອດຄົງເຫຼືອຫຼັງຊຳລະ, ງວດຕໍ່ໄປ (ສະເພາະໃບຫຼ້າສຸດ), ບ່ອນເຊັນ ຜູ້ຈ່າຍ / ຜູ້ຮັບ
 */
const ReceiptPrint = ({ contract, payment, onClose }: { contract: ContractDetail; payment: ContractPayment; onClose: () => void }) => {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const company = useCompany();
  const cur = contract.currency;
  const code = cur?.name ?? 'LAK';
  const latest = contract.payments.filter((p) => Number(p.status) === 1)
    .sort((a, b) => b.pay_date.localeCompare(a.pay_date) || b._uuid - a._uuid)[0]?._uuid === payment._uuid;
  const address = [company?.village, company?.district?.district_name, company?.district?.province?.province_name].filter(Boolean).join(', ');
  const c = contract.customer;
  const lines = [
    { label: t('lnPrincipalShort'), amount: payment.principal },
    { label: t('lnInterestShort'), amount: payment.interest },
    { label: t('crPenalty'), amount: payment.penalty },
    { label: t('lnFee'), amount: payment.fee },
  ].filter((l) => l.amount > 0);
  const type = PAYMENT_TYPES[Number(payment.payment_type)] ?? PAYMENT_TYPES[1];
  const cancelled = Number(payment.status) !== 1;

  return (
    <Modal open onClose={onClose} size="sm" className="cr-receipt-modal">
      <Modal.Header><Modal.Title>{t('crReceipt')} {payment.number}</Modal.Title></Modal.Header>
      <Modal.Body>
        <div ref={ref} className={`cr-receipt${cancelled ? ' is-cancelled' : ''}`}>
          <header className="cr-receipt-head">
            {company?.logo_url && <img src={company.logo_url} alt="" />}
            <div>
              <b>{company?.name_la ?? ''}</b>
              {company?.name_en && <em>{company.name_en}</em>}
              <small>{[address, company?.phone1, company?.phone2].filter(Boolean).join(' · ')}</small>
            </div>
          </header>
          <div className="cr-receipt-title">
            <h2>{t('crReceipt')}</h2>
            <span>RECEIPT</span>
            {cancelled && <strong>{t('lnCancelled')}</strong>}
          </div>
          <dl className="cr-receipt-meta">
            <div><dt>{t('crReceiptNo')}</dt><dd><b>{payment.number}</b></dd></div>
            <div><dt>{t('lnPayDate')}</dt><dd>{showDate(payment.pay_date)}</dd></div>
            <div><dt>{t('crReceivedFrom')}</dt><dd><b>{c?.full_name ?? contract.counterparty}</b> {c && <small>{c.customer_code}{c.phone ? ` · ${c.phone}` : ''}</small>}</dd></div>
            <div><dt>{t('crContract')}</dt><dd>{contract.loan_code}{contract.contract_no ? ` (${contract.contract_no})` : ''} · {contract.product?.name_la ?? ''}</dd></div>
          </dl>
          <table className="cr-receipt-lines">
            <tbody>
              {lines.map((l) => <tr key={l.label}><td>{l.label}</td><td>{formatNumber(l.amount)}</td></tr>)}
            </tbody>
            <tfoot>
              <tr><td>{t('total')} ({code})</td><td>{formatNumber(payment.total)}</td></tr>
            </tfoot>
          </table>
          <p className="cr-receipt-words">{amountInLaoWords(payment.total, code)}</p>
          <dl className="cr-receipt-meta is-after">
            <div><dt>{t('crPayType')}</dt><dd>{t(type.label)}</dd></div>
            <div><dt>{t('lnReceiveInto')}</dt><dd>{payment.treasury?.acountName ?? '—'}{payment.reference ? ` · ${payment.reference}` : ''}</dd></div>
            <div><dt>{t('crBalanceAfter')}</dt><dd><b>{payment.balance_after !== null ? money(payment.balance_after, cur) : '—'}</b></dd></div>
            {latest && contract.next && !contract.closed && (
              <div><dt>{t('lnNextDue')}</dt><dd>{showDate(contract.next.due_date)} · {money(contract.next.amount, cur)}</dd></div>
            )}
          </dl>
          <div className="cr-receipt-signs">
            <span>{t('crPayer')}</span>
            <span>{t('crCollector')}</span>
          </div>
          <small className="cr-receipt-foot">{t('crPrintedAt')} {moment().format('DD/MM/YYYY HH:mm')} · {localStorage.getItem('user_name') ?? ''}</small>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" onClick={() => ref.current && printElementByFrame(ref.current, PRINT_CSS)}>
          <i className="fa-solid fa-print" /> {t('print')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ReceiptPrint;
