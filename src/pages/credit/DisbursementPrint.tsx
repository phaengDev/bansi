import { useRef } from 'react';
import { Button, Modal } from 'rsuite';
import moment from 'moment';
import { formatNumber } from '../../utils/configApi';
import { printElementByFrame } from '../../utils/Print';
import { amountInLaoWords } from '../../utils/laoWords';
import { useT } from '../../context/LanguageContext';
import { useCompany } from '../hr/payroll/payrollApi';
import { money, showDate } from '../account/loans/loanApi';
import type { ContractDetail } from './creditApi';
import { creditTermText } from './creditKit';

/** ພິມສະເພາະໃບ — A5 ຕັ້ງ (ຄືໃບຮັບເງິນ) */
const PRINT_CSS = `
  @page { size: A5 portrait; margin: 8mm; }
  html, body { background: #fff !important; margin: 0; }
  .cr-receipt { box-shadow: none !important; border: 0 !important; margin: 0 !important; width: auto !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * ໃບຮັບເງິນກູ້ (ໃບຈ່າຍເງິນກູ້ໃຫ້ລູກຄ້າ) — ລູກຄ້າເຊັນຮັບເງິນຕອນປ່ອຍກູ້: ຍອດກູ້, ຫັກຄ່າທຳນຽມ, ເງິນທີ່ຮັບຕົວຈິງ (ຕົວເລກ + ຕົວໜັງສື),
 * ຈ່າຍຈາກບັນຊີ, ເງື່ອນໄຂ ແລະ ງວດທຳອິດ, ບ່ອນເຊັນ ຜູ້ຮັບເງິນ / ຜູ້ຈ່າຍເງິນ / ຜູ້ອະນຸມັດ. ເປີດເອງຫຼັງປ່ອຍກູ້ ແລະ ພິມຄືນໄດ້ຈາກສັນຍາ
 */
const DisbursementPrint = ({ contract, onClose }: { contract: ContractDetail; onClose: () => void }) => {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const company = useCompany();
  const cur = contract.currency;
  const code = cur?.name ?? 'LAK';
  const address = [company?.village, company?.district?.district_name, company?.district?.province?.province_name].filter(Boolean).join(', ');
  const c = contract.customer;
  const net = Math.round((contract.principal - contract.upfront_fee) * 100) / 100;
  const first = contract.schedule[0];

  return (
    <Modal open onClose={onClose} size="sm" className="cr-receipt-modal">
      <Modal.Header><Modal.Title>{t('crPayoutVoucher')} {contract.loan_code}</Modal.Title></Modal.Header>
      <Modal.Body>
        <div ref={ref} className="cr-receipt">
          <header className="cr-receipt-head">
            {company?.logo_url && <img src={company.logo_url} alt="" />}
            <div>
              <b>{company?.name_la ?? ''}</b>
              {company?.name_en && <em>{company.name_en}</em>}
              <small>{[address, company?.phone1, company?.phone2].filter(Boolean).join(' · ')}</small>
            </div>
          </header>
          <div className="cr-receipt-title">
            <h2>{t('crPayoutVoucher')}</h2>
            <span>LOAN DISBURSEMENT</span>
          </div>
          <dl className="cr-receipt-meta">
            <div><dt>{t('crContract')}</dt><dd><b>{contract.loan_code}</b>{contract.contract_no ? ` (${contract.contract_no})` : ''}</dd></div>
            <div><dt>{t('date')}</dt><dd>{showDate(contract.start_date)}</dd></div>
            <div><dt>{t('crPaidTo')}</dt><dd><b>{c?.full_name ?? contract.counterparty}</b> {c && <small>{c.customer_code}{c.phone ? ` · ${c.phone}` : ''}{c.id_no ? ` · ${c.id_no}` : ''}</small>}</dd></div>
            <div><dt>{t('crProduct')}</dt><dd>{contract.product?.name_la ?? ''} · {contract.annual_rate}% / {t('lnYear')} · {creditTermText(contract.term, contract.frequency_days, contract.frequency_months, t)}</dd></div>
          </dl>
          <table className="cr-receipt-lines">
            <tbody>
              <tr><td>{t('crLoanAmount')}</td><td>{formatNumber(contract.principal)}</td></tr>
              {contract.upfront_fee > 0 && <tr><td>{t('crLessFee')}</td><td>−{formatNumber(contract.upfront_fee)}</td></tr>}
            </tbody>
            <tfoot>
              <tr><td>{t('crNetReceived')} ({code})</td><td>{formatNumber(net)}</td></tr>
            </tfoot>
          </table>
          <p className="cr-receipt-words">{amountInLaoWords(net, code)}</p>
          <dl className="cr-receipt-meta is-after">
            <div><dt>{t('crPaidFrom')}</dt><dd>{contract.treasury?.acountName ?? '—'}</dd></div>
            {first && <div><dt>{t('crFirstInstallment')}</dt><dd>{showDate(first.due_date)} · {money(first.payment, cur)}</dd></div>}
            <div><dt>{t('crRepayTotal')}</dt><dd>{money(contract.schedule.reduce((n, r) => n + r.payment, 0), cur)} · {contract.schedule.length} {t('lnInstallments')}</dd></div>
          </dl>
          <div className="cr-receipt-signs is-three">
            <span>{t('crSignReceiver')}</span>
            <span>{t('crSignPayer')}</span>
            <span>{t('crSignApprover')}</span>
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

export default DisbursementPrint;
