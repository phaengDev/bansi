import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { DatePicker, DateRangePicker, Loader } from 'rsuite';
import moment from 'moment';
import { formatNumber, getApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { exportExcel } from '../../utils/exportHelpers';
import { printElementByFrame } from '../../utils/Print';
import { useT } from '../../context/LanguageContext';
import { useCompany } from '../hr/payroll/payrollApi';
import { showDate } from '../account/loans/loanApi';
import ContractDetail from './ContractDetail';
import { PAYMENT_TYPES } from './creditApi';

type ReportKey = 'portfolio' | 'disbursements' | 'collections' | 'writeoffs';
type Row = Record<string, any>;
type Column = { key: string; label: string; money?: boolean; total?: boolean; render?: (r: Row) => ReactNode; excel?: (r: Row) => string | number };

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  html, body { background: #fff !important; margin: 0; }
  .no-print { display: none !important; }
  .cr-report-doc { border: 0 !important; padding: 0 !important; }
  .acc-rp-scroll { overflow: visible !important; }
  .acc-fs-table { font-size: 10.5px !important; min-width: 0 !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * ລາຍງານສິນເຊື່ອ — ພອດໂຟລິໂອ (ຊັ້ນໜີ້ + ເງິນແຮ ณ ວັນທີ), ການປ່ອຍກູ້, ການຮັບຊຳລະ, ໜີ້ສູນ; ລວມທ້າຍ, Excel, ພິມ (A4 ນອນ)
 */
const CreditReportsPage = () => {
  const t = useT();
  const company = useCompany();
  const ref = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<ReportKey>('portfolio');
  const [asOf, setAsOf] = useState(new Date());
  const [range, setRange] = useState<[Date, Date]>([moment().startOf('month').toDate(), new Date()]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  const day = (d: Date) => moment(d).format('YYYY-MM-DD');
  const query = report === 'portfolio' ? `as_of=${day(asOf)}` : report === 'writeoffs' ? '' : `from=${day(range[0])}&to=${day(range[1])}`;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi(`/credit/report/${report}${query ? `?${query}` : ''}`);
      setRows(res.data?.data ?? []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [report, query]);
  useEffect(() => {
    load();
  }, [load]);

  const contract = (r: Row) => <><span className="acc-fs-code">{r.loan_code}</span> {r.customer}<small className="acc-gl-ref">{[r.customer_code, r.phone].filter(Boolean).join(' · ')}</small></>;
  const COLUMNS: Record<ReportKey, Column[]> = {
    portfolio: [
      { key: 'loan_code', label: t('crContract'), render: contract, excel: (r) => `${r.loan_code} ${r.customer}` },
      { key: 'product', label: t('crProduct') },
      { key: 'start_date', label: t('crDisbursedOn'), render: (r) => showDate(r.start_date), excel: (r) => showDate(r.start_date) },
      { key: 'maturity', label: t('crMaturity'), render: (r) => showDate(r.maturity), excel: (r) => showDate(r.maturity) },
      { key: 'principal', label: t('lnPrincipal'), money: true, total: true },
      { key: 'outstanding', label: t('lnOutstanding'), money: true, total: true },
      { key: 'overdue', label: t('lnOverdue'), money: true, total: true },
      { key: 'days_overdue', label: t('crDaysLate') },
      { key: 'class_code', label: t('crClass'), render: (r) => <span className={`cr-class is-${r.class_code} is-sm`}>{r.class_code}</span> },
      { key: 'provision_amount', label: t('crProvision'), money: true, total: true },
      { key: 'officer', label: t('crOfficer') },
    ],
    disbursements: [
      { key: 'date', label: t('crDisburseDate'), render: (r) => showDate(r.date), excel: (r) => showDate(r.date) },
      { key: 'loan_code', label: t('crContract'), render: (r) => <>{contract(r)}{r.restructured && <em className="acc-fa-chip is-pending">{t('crCloseRestructured')}</em>}</>, excel: (r) => `${r.loan_code} ${r.customer}` },
      { key: 'product', label: t('crProduct') },
      { key: 'principal', label: t('lnPrincipal'), money: true, total: true },
      { key: 'upfront_fee', label: t('crFee'), money: true, total: true },
      { key: 'net', label: t('crNetToCustomer'), money: true, total: true },
      { key: 'terms', label: t('lnTermsShort'), render: (r) => `${r.annual_rate}% · ${r.term} ${t('lnInstallments')}`, excel: (r) => `${r.annual_rate}% · ${r.term}` },
      { key: 'officer', label: t('crOfficer') },
    ],
    collections: [
      { key: 'date', label: t('lnPayDate'), render: (r) => showDate(r.date), excel: (r) => showDate(r.date) },
      { key: 'number', label: t('crReceiptNo') },
      { key: 'loan_code', label: t('crContract'), render: (r) => <>{contract(r)}{r.recovery && <em className="acc-fa-chip is-black">{t('crRecovery')}</em>}</>, excel: (r) => `${r.loan_code} ${r.customer}${r.recovery ? ` (${t('crRecovery')})` : ''}` },
      { key: 'principal', label: t('lnPrincipalShort'), money: true, total: true },
      { key: 'interest', label: t('lnInterestShort'), money: true, total: true },
      { key: 'penalty', label: t('crPenalty'), money: true, total: true },
      { key: 'fee', label: t('crFees'), money: true, total: true },
      { key: 'total', label: t('total'), money: true, total: true },
      { key: 'type', label: t('crPayType'), render: (r) => t(PAYMENT_TYPES[Number(r.payment_type)]?.label ?? ''), excel: (r) => t(PAYMENT_TYPES[Number(r.payment_type)]?.label ?? '') },
      { key: 'account', label: t('lnReceiveInto') },
      { key: 'by', label: t('crCollector') },
    ],
    writeoffs: [
      { key: 'date', label: t('crWriteOffDate'), render: (r) => showDate(r.date), excel: (r) => showDate(r.date) },
      { key: 'loan_code', label: t('crContract'), render: contract, excel: (r) => `${r.loan_code} ${r.customer}` },
      { key: 'principal', label: t('lnPrincipalShort'), money: true, total: true },
      { key: 'interest', label: t('lnInterestShort'), money: true, total: true },
      { key: 'penalty', label: t('crPenalty'), money: true, total: true },
      { key: 'recovered', label: t('crRecovered'), money: true, total: true },
      { key: 'remaining', label: t('crRecoverLeft'), money: true, total: true },
      { key: 'reason', label: t('crReason') },
      { key: 'by', label: t('crApprovedBy') },
    ],
  };
  const columns = COLUMNS[report];
  const data = rows.map((r) => (report === 'portfolio' ? { ...r, overdue: r.overdue_principal + r.overdue_interest } : r));
  const totals = Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, data.reduce((n, r) => n + (Number(r[c.key]) || 0), 0)]));
  const reports: { key: ReportKey; label: string; icon: string }[] = [
    { key: 'portfolio', label: t('crRepPortfolio'), icon: 'fa-briefcase' },
    { key: 'disbursements', label: t('crRepDisbursements'), icon: 'fa-money-bill-transfer' },
    { key: 'collections', label: t('crRepCollections'), icon: 'fa-hand-holding-dollar' },
    { key: 'writeoffs', label: t('crRepWriteoffs'), icon: 'fa-skull-crossbones' },
  ];
  const title = reports.find((r) => r.key === report)!.label;
  const subtitle = report === 'portfolio' ? `${t('crAsOf')} ${moment(asOf).format('DD/MM/YYYY')}`
    : report === 'writeoffs' ? t('crAllTime') : `${moment(range[0]).format('DD/MM/YYYY')} – ${moment(range[1]).format('DD/MM/YYYY')}`;
  const toExcel = () => exportExcel([
    ...data.map((r) => Object.fromEntries(columns.map((c) => [c.label, c.excel ? c.excel(r) : r[c.key] ?? '']))),
    Object.fromEntries(columns.map((c, i) => [c.label, i === 0 ? t('total') : c.total ? totals[c.key] : ''])),
  ], `credit_${report}_${day(new Date())}`, `${title} · ${subtitle}`);

  return (
    <div className="acs-page cr-page cr-reports">
      <div className="cr-filters no-print">
        <div className="acc-type-segment" role="tablist">
          {reports.map((r) => (
            <button key={r.key} type="button" role="tab" aria-selected={report === r.key} className={report === r.key ? 'is-active' : ''} onClick={() => setReport(r.key)}>
              <i className={`fa-solid ${r.icon}`} /> {r.label}
            </button>
          ))}
        </div>
        {report === 'portfolio' && <DatePicker format="dd/MM/yyyy" value={asOf} onChange={(v) => v && setAsOf(v)} cleanable={false} oneTap />}
        {(report === 'disbursements' || report === 'collections') && (
          <DateRangePicker format="dd/MM/yyyy" value={range} onChange={(v) => v && setRange(v as [Date, Date])} cleanable={false} character=" – " />
        )}
        <span className="cr-filter-spacer" />
        <button type="button" className="acc-rp-btn" disabled={!data.length} onClick={toExcel}><i className="fa-solid fa-file-excel" /> Excel</button>
        <button type="button" className="acc-rp-btn" disabled={!data.length} onClick={() => ref.current && printElementByFrame(ref.current, PRINT_CSS)}><i className="fa-solid fa-print" /> {t('print')}</button>
      </div>

      {error ? <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div> : (
        <div ref={ref} className={`cr-card cr-report-doc${loading ? ' is-loading' : ''}`}>
          <header className="cr-report-head">
            <span><b>{title}</b><small>{[company?.name_la, subtitle].filter(Boolean).join(' · ')}</small></span>
            <small>{data.length} {t('crItems')}</small>
          </header>
          {loading && !data.length ? <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div> : !data.length ? (
            <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-magnifying-glass" /><p>{t('rpEmpty')}</p></div>
          ) : (
            <div className="acc-rp-scroll">
              <table className="acc-fs-table cr-report-table">
                <thead><tr>{columns.map((c) => <th key={c.key} className={c.money ? 'is-num' : ''}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={`${r.loan_id}-${r.payment_id ?? r._uuid ?? i}`} className="is-line is-click" onClick={() => setViewing(r.loan_id)}>
                      {columns.map((c) => (
                        <td key={c.key} className={c.money ? 'is-num' : ''}>{c.render ? c.render(r) : c.money ? (r[c.key] ? formatNumber(r[c.key]) : '—') : r[c.key] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="is-total">
                    {columns.map((c, i) => <td key={c.key} className={c.money ? 'is-num' : ''}>{i === 0 ? t('total') : c.total ? formatNumber(Math.round(totals[c.key] * 100) / 100) : ''}</td>)}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
      {viewing && <ContractDetail id={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </div>
  );
};

export default CreditReportsPage;
