import { useRef } from 'react';
import { Button, Modal } from 'rsuite';
import moment from 'moment';
import { formatNumber } from '../../utils/configApi';
import { printElementByFrame } from '../../utils/Print';
import { exportExcel } from '../../utils/exportHelpers';
import { useT } from '../../context/LanguageContext';
import { useCompany } from '../hr/payroll/payrollApi';
import { money, showDate } from '../account/loans/loanApi';
import { CLOSE_REASONS, PAYMENT_TYPES, customerAddress, type ContractDetail } from './creditApi';
import { creditTermText } from './creditKit';

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 12mm 14mm; }
  html, body { background: #fff !important; margin: 0; }
  .cr-agreement { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; }
  .cr-statement-table { break-inside: auto; }
  .cr-statement-table tr { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

type Line = { date: string; doc: string; label: string; principal: number; interest: number; penalty: number; fee: number; total: number; balance: number; out?: boolean };

/**
 * ໃບແຈ້ງຍອດໜີ້ (Statement of account) ຂອງສັນຍາໜຶ່ງ — ໃຫ້ລູກຄ້າ: ຂໍ້ມູນສັນຍາ, ສະຫຼຸບ (ປ່ອຍ / ຈ່າຍແລ້ວ / ຄົງເຫຼືອ / ກາຍກຳນົດ),
 * ທຸກລາຍການເຄື່ອນໄຫວ (ປ່ອຍກູ້, ການຊຳລະ, ຍົກເວັ້ນຄ່າປັບ) ພ້ອມຍອດຄົງເຫຼືອຫຼັງແຕ່ລະລາຍການ ແລະ ງວດທີ່ເຫຼືອ. ພິມ A4 / Excel
 */
const StatementPrint = ({ contract, onClose }: { contract: ContractDetail; onClose: () => void }) => {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const company = useCompany();
  const c = contract.customer;
  const cur = contract.currency;
  const companyAddress = [company?.village, company?.district?.district_name, company?.district?.province?.province_name].filter(Boolean).join(', ');
  const today = moment().format('YYYY-MM-DD');
  const active = contract.payments.filter((p) => Number(p.status) === 1).sort((a, b) => a.pay_date.localeCompare(b.pay_date) || a._uuid - b._uuid);

  // ລາຍການເຄື່ອນໄຫວຕາມວັນທີ: ປ່ອຍກູ້ (ຍອດເພີ່ມ) → ການຊຳລະ (ຍອດຫຼຸດ) · ຍົກເວັ້ນຄ່າປັບ (ບໍ່ປ່ຽນຕົ້ນທຶນ)
  let balance = contract.principal;
  const lines: Line[] = ([
    {
      date: contract.start_date, doc: contract.loan_code, label: t('crStmtDisbursed'), principal: contract.principal, interest: 0, penalty: 0,
      fee: contract.upfront_fee, total: contract.principal, balance, out: true,
    },
    ...active.map((p) => {
      balance = Math.max(0, Math.round((balance - p.principal) * 100) / 100);
      const type = PAYMENT_TYPES[Number(p.payment_type)];
      return {
        date: p.pay_date, doc: p.number ?? '—', label: type ? t(type.label) : t('crCollect'),
        principal: p.principal, interest: p.interest, penalty: p.penalty, fee: p.fee, total: p.principal + p.interest + p.penalty + p.fee, balance,
      };
    }),
    ...contract.waivers.map((x) => ({
      date: x.date, doc: '—', label: `${t('crWaived')}${x.reason ? ` · ${x.reason}` : ''}`, principal: 0, interest: 0, penalty: -x.amount, fee: 0, total: 0,
      balance: Number.NaN,
    })),
  ] as Line[]).sort((a, b) => a.date.localeCompare(b.date) || (a.out ? -1 : b.out ? 1 : 0));
  // ຍອດຄົງເຫຼືອຂອງແຖວຍົກເວັ້ນ = ຍອດຂອງແຖວກ່ອນໜ້າ
  lines.forEach((l, i) => {
    if (Number.isNaN(l.balance)) l.balance = i ? lines[i - 1].balance : contract.principal;
  });
  const paid = active.reduce((n, p) => ({ principal: n.principal + p.principal, interest: n.interest + p.interest, penalty: n.penalty + p.penalty, fee: n.fee + p.fee }),
    { principal: 0, interest: 0, penalty: 0, fee: 0 });
  const remaining = contract.schedule.filter((r) => ['overdue', 'partial', 'upcoming'].includes(r.state));
  const why = contract.close_reason ? CLOSE_REASONS[Number(contract.close_reason)] : null;

  const toExcel = () => exportExcel([
    ...lines.map((l) => ({
      [t('date')]: showDate(l.date), [t('crDoc')]: l.doc, [t('crStmtItem')]: l.label, [t('lnPrincipalShort')]: l.out ? l.principal : -l.principal,
      [t('lnInterestShort')]: l.interest, [t('crPenalty')]: l.penalty, [t('crFees')]: l.fee, [t('crStmtPaidTotal')]: l.out ? 0 : l.total, [t('lnOutstanding')]: l.balance,
    })),
  ], `statement_${contract.loan_code}_${today}`, `${t('crStatement')} ${contract.loan_code} · ${c?.full_name ?? contract.counterparty}`);

  const box = (label: string, value: string, tone = '') => <div className={tone}><small>{label}</small><b>{value}</b></div>;

  return (
    <Modal open onClose={onClose} size="lg" className="cr-agreement-modal">
      <Modal.Header>
        <Modal.Title>{t('crStatement')} {contract.loan_code}</Modal.Title>
        <small className="cr-agreement-warn">{c?.full_name ?? contract.counterparty} · {t('crAsOf')} {showDate(today)}</small>
      </Modal.Header>
      <Modal.Body>
        <div ref={ref} className="cr-agreement cr-statement">
          <header className="cr-agreement-head">
            <div className="cr-receipt-head">
              {company?.logo_url && <img src={company.logo_url} alt="" />}
              <div><b>{company?.name_la ?? ''}</b><small>{[companyAddress, company?.phone1].filter(Boolean).join(' · ')}</small></div>
            </div>
            <span>{t('crAsOf')} <b>{showDate(today)}</b><br />{t('crStmtPrinted')} {moment().format('DD/MM/YYYY HH:mm')}</span>
          </header>
          <h2>{t('crStatementTitle')}</h2>

          <dl className="cr-statement-info">
            <div><dt>{t('crCustomer')}</dt><dd><b>{c?.full_name ?? contract.counterparty}</b>{c?.customer_code ? ` · ${c.customer_code}` : ''}{c?.phone ? ` · ${c.phone}` : ''}</dd></div>
            <div><dt>{t('crAddress')}</dt><dd>{(c && customerAddress(c)) || '—'}</dd></div>
            <div><dt>{t('crContract')}</dt><dd><b>{contract.loan_code}</b>{contract.contract_no ? ` · ${contract.contract_no}` : ''} · {contract.product?.name_la ?? ''}</dd></div>
            <div>
              <dt>{t('lnTermsShort')}</dt>
              <dd>{money(contract.principal, cur)} · {contract.annual_rate}% / {t('lnYear')} · {creditTermText(contract.term, contract.frequency_days, contract.frequency_months, t)}</dd>
            </div>
            <div><dt>{t('crDisbursedOn')}</dt><dd>{showDate(contract.start_date)} → {showDate(contract.schedule[contract.schedule.length - 1]?.due_date)}</dd></div>
            {why && <div><dt>{t('status')}</dt><dd>{t(why.label)} {contract.closed_date ? showDate(contract.closed_date) : ''}</dd></div>}
          </dl>

          <div className="cr-statement-boxes">
            {box(t('crStmtPrincipalPaid'), money(paid.principal, cur))}
            {box(t('crStmtInterestPaid'), money(paid.interest, cur))}
            {box(t('crStmtPenaltyPaid'), money(paid.penalty, cur))}
            {box(t('lnOutstanding'), money(contract.outstanding, cur), 'is-main')}
            {box(t('lnOverdue'), contract.overdue_amount > 0 ? `${money(contract.overdue_amount, cur)} · ${contract.penalty.days_overdue} ${t('crDays')}` : '—', contract.overdue_amount > 0 ? 'is-bad' : '')}
            {box(t('crPenaltyDue'), contract.penalty.due > 0 ? money(contract.penalty.due, cur) : '—', contract.penalty.due > 0 ? 'is-bad' : '')}
          </div>

          <h3>{t('crStmtMovements')}</h3>
          <table className="cr-receipt-lines cr-agreement-table cr-statement-table">
            <thead>
              <tr>
                <th>{t('date')}</th><th>{t('crDoc')}</th><th>{t('crStmtItem')}</th><th>{t('lnPrincipalShort')}</th><th>{t('lnInterestShort')}</th>
                <th>{t('crPenalty')}</th><th>{t('crFees')}</th><th>{t('crStmtPaidTotal')}</th><th>{t('lnOutstanding')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className={l.out ? 'is-out' : ''}>
                  <td>{showDate(l.date)}</td><td>{l.doc}</td><td>{l.label}</td>
                  <td>{l.principal ? `${l.out ? '+' : '−'}${formatNumber(l.principal)}` : '—'}</td>
                  <td>{l.interest ? formatNumber(l.interest) : '—'}</td>
                  <td>{l.penalty ? formatNumber(l.penalty) : '—'}</td>
                  <td>{l.fee ? formatNumber(l.fee) : '—'}</td>
                  <td>{!l.out && l.total ? formatNumber(l.total) : '—'}</td>
                  <td><b>{formatNumber(l.balance)}</b></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>{t('total')}</td><td>{formatNumber(paid.principal)}</td><td>{formatNumber(paid.interest)}</td>
                <td>{formatNumber(paid.penalty)}</td><td>{formatNumber(paid.fee)}</td>
                <td>{formatNumber(paid.principal + paid.interest + paid.penalty + paid.fee)}</td><td><b>{formatNumber(contract.outstanding)}</b></td>
              </tr>
            </tfoot>
          </table>

          {remaining.length > 0 && (
            <>
              <h3>{t('crStmtRemaining')} <small>({remaining.length} {t('lnInstallments')})</small></h3>
              <table className="cr-receipt-lines cr-agreement-table">
                <thead><tr><th>#</th><th>{t('lnDue')}</th><th>{t('lnPrincipalShort')}</th><th>{t('lnInterestShort')}</th><th>{t('crStmtToPay')}</th><th>{t('status')}</th></tr></thead>
                <tbody>
                  {remaining.map((r) => (
                    <tr key={r.no} className={r.state === 'overdue' ? 'is-bad' : ''}>
                      <td>{r.no}</td><td>{showDate(r.due_date)}</td><td>{formatNumber(r.due_principal)}</td><td>{formatNumber(r.due_interest)}</td>
                      <td><b>{formatNumber(r.due_principal + r.due_interest)}</b></td>
                      <td>{t(r.state === 'overdue' ? 'lnOverdue' : r.state === 'partial' ? 'lnStatePartial' : 'lnStateUpcoming')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <p className="cr-statement-foot">{t('crStmtFoot')}</p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
        <Button appearance="default" className="acc-book-btn" onClick={toExcel}><i className="fa-solid fa-file-excel" /> Excel</Button>
        <Button appearance="primary" className="acc-book-btn is-save" onClick={() => ref.current && printElementByFrame(ref.current, PRINT_CSS)}>
          <i className="fa-solid fa-print" /> {t('print')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default StatementPrint;
