import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DatePicker, DateRangePicker, Loader } from 'rsuite';
import moment from 'moment';
import AppPage from '../../components/Elements/AppPage';
import { formatNumber, getApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { exportExcel } from '../../utils/exportHelpers';
import { printElementByFrame } from '../../utils/Print';
import { useT } from '../../context/LanguageContext';
import { useCompany } from '../hr/payroll/payrollApi';
import { CREDIT_REPORTS_MENU, toRailNav } from '../account/config/SidebarPopup';
import { useRailKey } from '../account/windowMemory';
import { showDate } from '../account/loans/loanApi';
import ContractDetail from './ContractDetail';
import { AGING_BUCKETS, APP_STATUS, FOLLOW_METHODS, FOLLOW_RESULTS, PAYMENT_TYPES, agingOfDays, collateralTypeOf } from './creditApi';

type Row = Record<string, any>;
type Filter = 'asOf' | 'range' | 'future' | 'months' | 'none';
type Column = { key: string; label: string; money?: boolean; num?: boolean; total?: boolean; render?: (r: Row) => ReactNode; excel?: (r: Row) => string | number };
type Group = { key: (r: Row) => string; label: (key: string) => string; order?: (a: string, b: string) => number };
type ReportDef = { endpoint: string; filter: Filter; columns: Column[]; group?: Group; map?: (rows: Row[]) => Row[] };

const PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  html, body { background: #fff !important; margin: 0; }
  .cr-report-doc { border: 0 !important; padding: 0 !important; }
  .acc-rp-scroll { overflow: visible !important; }
  .acc-fs-table { font-size: 10.5px !important; min-width: 0 !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;
const CLASS_CODES = ['A', 'B', 'C', 'D', 'E'];
const day = (d: Date) => moment(d).format('YYYY-MM-DD');

/** ຄໍລຳທີ່ໃຊ້ຊ້ຳ */
const useColumns = () => {
  const t = useT();
  return useMemo(() => {
    const contract = (r: Row) => (
      <><span className="acc-fs-code">{r.loan_code}</span> {r.customer}<small className="acc-gl-ref">{[r.customer_code, r.phone].filter(Boolean).join(' · ')}</small></>
    );
    const date = (key: string, label: string): Column => ({ key, label, render: (r) => showDate(r[key]), excel: (r) => showDate(r[key]) });
    const time = (key: string, label: string): Column => ({ key, label, render: (r) => moment(r[key]).format('DD/MM/YYYY HH:mm'), excel: (r) => moment(r[key]).format('DD/MM/YYYY HH:mm') });
    const money = (key: string, label: string, total = true): Column => ({ key, label, money: true, total });
    const text = (key: string, label: string): Column => ({ key, label });
    const contractCol: Column = { key: 'loan_code', label: t('crContract'), render: contract, excel: (r) => `${r.loan_code ?? ''} ${r.customer ?? ''}` };
    return { contract: contractCol, date, time, money, text };
  }, [t]);
};

/**
 * ລາຍງານສິນເຊື່ອ — ໜ້າຕ່າງຂອງຕົນເອງ, ເມນູຂ້າງແບ່ງກຸ່ມ: ພອດໂຟລິໂອ (ລາຍສັນຍາ / ອາຍຸໜີ້ / ຜະລິດຕະພັນ / ພະນັກງານ / ຊັ້ນໜີ້ / ປະຫວັດຈັດຊັ້ນ),
 * ການເຄື່ອນໄຫວ (ປ່ອຍກູ້, ຮັບຊຳລະ, ກຳນົດເກັບເງິນ, ຄຳຮ້ອງ), ລາຍຮັບ ແລະ ກຳໄລ, ຄວບຄຸມ (ຍົກເລີກ, ຍົກເວັ້ນ, ປັບໂຄງສ້າງ, ໜີ້ສູນ, ການຕິດຕາມ).
 * ທຸກລາຍງານ: ກັ່ນຕາມວັນທີ, ລວມທ້າຍ (ແລະ ລວມຍ່ອຍຕາມກຸ່ມ), Excel, ພິມ, ກົດແຖວ = ເປີດສັນຍາ
 */
const CreditReportsWindow = () => {
  const t = useT();
  const company = useCompany();
  const col = useColumns();
  const railNav = useMemo(() => toRailNav(CREDIT_REPORTS_MENU, t), [t]);
  const [report, setReport] = useRailKey('creditReports', CREDIT_REPORTS_MENU);
  const ref = useRef<HTMLDivElement>(null);
  const [asOf, setAsOf] = useState(new Date());
  const [range, setRange] = useState<[Date, Date]>([moment().startOf('month').toDate(), new Date()]);
  const [future, setFuture] = useState<[Date, Date]>([new Date(), moment().add(30, 'days').toDate()]);
  const [months, setMonths] = useState<[Date, Date]>([moment().subtract(12, 'months').startOf('month').toDate(), moment().subtract(1, 'month').startOf('month').toDate()]);
  // ແຖວຜູກກັບ endpoint + query ທີ່ໂຫຼດມາ — ປ່ຽນລາຍງານແລ້ວບໍ່ເອົາແຖວເກົ່າມາສະແດງດ້ວຍຄໍລຳໃໝ່
  const [loaded, setLoaded] = useState<{ key: string; rows: Row[] }>({ key: '', rows: [] });
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);

  const portfolioCols: Column[] = [
    col.contract, col.text('product', t('crProduct')), col.date('start_date', t('crDisbursedOn')), col.date('maturity', t('crMaturity')),
    col.money('outstanding', t('lnOutstanding')), col.money('overdue', t('lnOverdue')),
    { key: 'days_overdue', label: t('crDaysLate'), num: true },
    { key: 'class_code', label: t('crClass'), render: (r) => <span className={`cr-class is-${r.class_code} is-sm`}>{r.class_code}</span> },
    col.money('provision_amount', t('crProvision')), col.text('officer', t('crOfficer')),
  ];
  const portfolio = (group?: Group): ReportDef => ({
    endpoint: 'portfolio', filter: 'asOf', columns: portfolioCols, group,
    map: (list) => list.map((r) => ({ ...r, overdue: r.overdue_principal + r.overdue_interest })),
  });
  const agingOrder = AGING_BUCKETS.map((b) => b.key) as string[];
  const KIND: Record<string, string> = {
    payment: 'crCxPayment', rejected: 'crStRejected', app_cancelled: 'crCxApplication', writeoff_undone: 'crCxWriteoff', restructure_undone: 'crCxRestructure',
  };
  const REPORTS: Record<string, ReportDef> = {
    portfolio: portfolio(),
    aging: portfolio({ key: (r) => agingOfDays(r.days_overdue), label: (k) => t(AGING_BUCKETS.find((b) => b.key === k)?.label ?? k), order: (a, b) => agingOrder.indexOf(a) - agingOrder.indexOf(b) }),
    byProduct: portfolio({ key: (r) => r.product ?? '—', label: (k) => k }),
    byOfficer: portfolio({ key: (r) => r.officer ?? t('crNoOfficer'), label: (k) => k }),
    byClass: portfolio({ key: (r) => r.class_code, label: (k) => `${t('crClass')} ${k}` }),
    classes: {
      endpoint: 'classes', filter: 'months',
      columns: [
        { key: 'period', label: t('crMonth'), render: (r) => moment(r.period, 'YYYY-MM').format('MM/YYYY'), excel: (r) => r.period },
        { key: 'contracts', label: t('crContracts'), num: true },
        ...CLASS_CODES.map((c) => col.money(c, c, false)),
        col.money('total', t('total'), false),
        { key: 'npl_ratio', label: 'NPL %', num: true, render: (r) => `${r.npl_ratio}%`, excel: (r) => r.npl_ratio },
        col.money('provision', t('crProvision'), false),
      ],
    },
    disbursements: {
      endpoint: 'disbursements', filter: 'range',
      columns: [
        col.date('date', t('crDisburseDate')),
        { ...col.contract, render: (r) => <>{col.contract.render!(r)}{r.restructured && <em className="acc-fa-chip is-pending">{t('crCloseRestructured')}</em>}</> },
        col.text('product', t('crProduct')), col.money('principal', t('lnPrincipal')), col.money('upfront_fee', t('crFee')), col.money('net', t('crNetToCustomer')),
        { key: 'terms', label: t('lnTermsShort'), num: true, render: (r) => `${r.annual_rate}% · ${r.term}`, excel: (r) => `${r.annual_rate}% · ${r.term}` }, col.text('officer', t('crOfficer')),
      ],
    },
    collections: {
      endpoint: 'collections', filter: 'range',
      columns: [
        col.date('date', t('lnPayDate')), col.text('number', t('crReceiptNo')),
        { ...col.contract, render: (r) => <>{col.contract.render!(r)}{r.recovery && <em className="acc-fa-chip is-black">{t('crRecovery')}</em>}</> },
        col.money('principal', t('lnPrincipalShort')), col.money('interest', t('lnInterestShort')), col.money('penalty', t('crPenalty')), col.money('fee', t('crFees')),
        col.money('total', t('total')),
        { key: 'type', label: t('crPayType'), render: (r) => t(PAYMENT_TYPES[Number(r.payment_type)]?.label ?? ''), excel: (r) => t(PAYMENT_TYPES[Number(r.payment_type)]?.label ?? '') },
        col.text('account', t('lnReceiveInto')), col.text('by', t('crCollector')),
      ],
    },
    due: {
      endpoint: 'due', filter: 'future',
      group: { key: (r) => r.date, label: (k) => `${showDate(k)}${k < day(new Date()) ? ` · ${t('lnOverdue')}` : ''}` },
      columns: [
        { ...col.contract, render: (r) => <>{col.contract.render!(r)}{r.late && <em className="acc-fa-chip is-black">{t('lnOverdue')}</em>}</> },
        { key: 'no', label: t('lnInstallmentNo'), num: true }, col.text('product', t('crProduct')),
        col.money('principal', t('lnPrincipalShort')), col.money('interest', t('lnInterestShort')), col.money('total', t('total')), col.text('officer', t('crOfficer')),
      ],
    },
    applications: {
      endpoint: 'applications', filter: 'range',
      columns: [
        col.date('date', t('crApplyDate')), col.text('application_no', t('crAppNo')), col.text('customer', t('crCustomer')), col.text('product', t('crProduct')),
        col.money('requested', t('crRequestedAmount')), col.money('approved', t('crApprovedAmount')),
        {
          key: 'status', label: t('status'),
          render: (r) => {
            const st = Object.values(APP_STATUS)[['draft', 'pending', 'approved', 'rejected', 'disbursed', 'cancelled'].indexOf(r.status)];
            return st ? <span className={`cr-status ${st.tone}`}>{t(st.label)}</span> : r.status;
          },
          excel: (r) => r.status,
        },
        col.text('approvers', t('crApprovedBy')), { key: 'days', label: t('crDaysToDecide'), num: true }, col.text('by', t('crCreatedBy')), col.text('reason', t('crReason')),
      ],
    },
    income: {
      endpoint: 'income', filter: 'range',
      columns: [
        { key: 'month', label: t('crMonth'), render: (r) => moment(r.month, 'YYYY-MM').format('MM/YYYY'), excel: (r) => r.month },
        col.money('interest', t('lnInterestShort')), col.money('fees', t('crFees')), col.money('penalty', t('crPenalty')), col.money('recovery', t('crRecovery')),
        col.money('income', t('crIncomePeriod')), col.money('provision', t('crProvisionExpense')), col.money('profit', t('crCreditProfit')),
      ],
    },
    cancelled: {
      endpoint: 'cancelled', filter: 'range',
      columns: [
        col.time('date', t('crCancelledOn')),
        { key: 'kind', label: t('crCxKind'), render: (r) => <span className="cr-status is-rejected">{t(KIND[r.kind] ?? String(r.kind ?? ''))}</span>, excel: (r) => t(KIND[r.kind] ?? String(r.kind ?? '')) },
        col.text('doc', t('crDoc')), col.contract, col.money('amount', t('crAmount')), col.text('reason', t('crReason')), col.text('ref', t('crReversal')), col.text('by', t('crDoneBy')),
      ],
    },
    waivers: {
      endpoint: 'waivers', filter: 'range',
      columns: [col.date('date', t('date')), col.contract, { key: 'installment_no', label: t('lnInstallmentNo'), num: true }, { key: 'days_late', label: t('crDaysLate'), num: true },
        col.money('amount', t('crWaiveAmount')), col.text('reason', t('crReason')), col.text('by', t('crApprovedBy'))],
    },
    restructures: {
      endpoint: 'restructures', filter: 'range',
      columns: [
        col.date('date', t('crRestructureDate')),
        { ...col.contract, render: (r) => <><span className="acc-fs-code">{r.loan_code}</span> → <span className="acc-fs-code">{r.new_code}</span> {r.customer}</>, excel: (r) => `${r.loan_code} → ${r.new_code} ${r.customer}` },
        col.money('old_outstanding', t('crOldOutstanding')), col.money('capitalized', t('crCapitalized')), col.money('principal', t('crNewPrincipal')),
        col.text('rates', t('lnAnnualRate')), col.text('terms', t('lnTerm')), col.text('reason', t('crReason')), col.text('by', t('crApprovedBy')),
      ],
    },
    writeoffs: {
      endpoint: 'writeoffs', filter: 'none',
      columns: [col.date('date', t('crWriteOffDate')), col.contract, col.money('principal', t('lnPrincipalShort')), col.money('interest', t('lnInterestShort')),
        col.money('penalty', t('crPenalty')), col.money('recovered', t('crRecovered')), col.money('remaining', t('crRecoverLeft')), col.text('reason', t('crReason')), col.text('by', t('crApprovedBy'))],
    },
    officers: {
      endpoint: 'officers', filter: 'range',
      columns: [
        { key: 'officer', label: t('crOfficer'), render: (r) => r.officer ?? <span className="cr-muted">{t('crNoOfficer')}</span>, excel: (r) => r.officer ?? t('crNoOfficer') },
        { key: 'customers', label: t('crCustomers'), num: true, total: true }, { key: 'contracts', label: t('crContracts'), num: true, total: true },
        col.money('outstanding', t('lnOutstanding')),
        { key: 'overdue_contracts', label: t('crOverdueContracts'), num: true, total: true },
        { key: 'par30', label: 'PAR30', money: true, total: true, render: (r) => <>{formatNumber(r.par30)}<small className="acc-gl-ref">{r.par30_ratio}%</small></> },
        { key: 'npl_ratio', label: 'NPL %', num: true, render: (r) => <span className={r.npl_ratio > 5 ? 'cr-text-bad' : ''}>{r.npl_ratio}%</span>, excel: (r) => r.npl_ratio },
        col.money('provision', t('crProvision')),
        { key: 'disbursed', label: t('crRepDisbursements'), money: true, total: true, render: (r) => <>{formatNumber(r.disbursed)}<small className="acc-gl-ref">{r.disbursed_count} {t('crContracts')}</small></> },
        col.money('collected', t('crRepCollections')), col.money('collected_interest', t('crIncomePeriod')),
        { key: 'new_customers', label: t('crNewCustomers'), num: true, total: true },
      ],
    },
    collaterals: {
      endpoint: 'collaterals', filter: 'none',
      group: {
        key: (r) => (r.to_return ? '0' : String(r.status)),
        label: (k) => t(({ 0: 'crColToReturn', 1: 'crColHeld', 2: 'crColReturned', 3: 'crColSeized' } as Record<string, string>)[k] ?? 'crColHeld'),
      },
      columns: [
        {
          key: 'description', label: t('crCollateral'),
          render: (r) => <><span className="acc-fs-code">{r.code ?? '—'}</span> {r.description}<small className="acc-gl-ref">{[t(collateralTypeOf(r.type).label), r.document_no, r.owner].filter(Boolean).join(' · ')}</small></>,
          excel: (r) => `${r.code ?? ''} ${r.description}`,
        },
        { key: 'customer', label: t('crCustomer'), render: (r) => <>{r.customer ?? '—'}<small className="acc-gl-ref">{r.customer_code ?? ''}</small></>, excel: (r) => r.customer ?? '' },
        col.money('appraised_value', t('crAppraisedValue')), col.money('market_value', t('crMarketShort'), false),
        {
          key: 'loan_code', label: t('crContract'),
          render: (r) => (r.loan_code ? <>{r.loan_code}<small className="acc-gl-ref">{t(r.loan_state === 'active' ? 'lnFilterActive' : r.loan_state.startsWith('closed') ? 'lnFilterClosed' : 'crNoContract')}</small></> : '—'),
          excel: (r) => r.loan_code ?? '',
        },
        { key: 'storage', label: t('crColStorage'), render: (r) => [r.storage, r.location].filter(Boolean).join(' · ') || '—', excel: (r) => [r.storage, r.location].filter(Boolean).join(' · ') },
        col.date('received_date', t('crColReceived')), col.date('returned_date', t('crColReturnedOn')),
      ],
    },
    followups: {
      endpoint: 'followups', filter: 'range',
      columns: [
        col.time('date', t('date')), col.contract,
        {
          key: 'method', label: t('crFollowMethod'),
          render: (r) => (r.kind === 'notice' ? <><i className="fa-solid fa-bell" /> {t('crReminder')}</> : t(FOLLOW_METHODS.find((m) => m.value === Number(r.method))?.label ?? '')),
          excel: (r) => (r.kind === 'notice' ? t('crReminder') : t(FOLLOW_METHODS.find((m) => m.value === Number(r.method))?.label ?? '')),
        },
        { key: 'result', label: t('crFollowResult'), render: (r) => (r.result ? t(FOLLOW_RESULTS.find((x) => x.value === Number(r.result))?.label ?? '') : '—'), excel: (r) => (r.result ? t(FOLLOW_RESULTS.find((x) => x.value === Number(r.result))?.label ?? '') : '') },
        col.date('promise_date', t('crPromiseDate')), col.money('promise_amount', t('crPromiseAmount'), false), col.text('note', t('note')), col.text('by', t('crDoneBy')),
      ],
    },
  };
  const def = REPORTS[report] ?? REPORTS.portfolio;
  const query = def.filter === 'asOf' ? `as_of=${day(asOf)}`
    : def.filter === 'range' ? `from=${day(range[0])}&to=${day(range[1])}`
      : def.filter === 'future' ? `from=${day(future[0])}&to=${day(future[1])}`
        : def.filter === 'months' ? `from=${moment(months[0]).format('YYYY-MM')}&to=${moment(months[1]).format('YYYY-MM')}` : '';

  const loadKey = `${def.endpoint}?${query}`;
  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      setLoading(true);
      const res = await getApi(`/credit/report/${loadKey}`);
      if (mine !== seq.current) return; // ຄຳຕອບຊ້າຂອງລາຍງານກ່ອນ
      setLoaded({ key: loadKey, rows: res.data?.data ?? [] });
      setError('');
    } catch (err) {
      if (mine === seq.current) setError(getErrorMessage(err));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [loadKey]);
  useEffect(() => {
    load();
  }, [load]);

  const rows = loaded.key === loadKey ? loaded.rows : [];
  const data = def.map ? def.map(rows) : rows;
  const columns = def.columns;
  const sum = (list: Row[]) => Object.fromEntries(columns.filter((c) => c.total).map((c) => [c.key, list.reduce((n, r) => n + (Number(r[c.key]) || 0), 0)]));
  const totals = sum(data);
  const groupOf = (r: Row) => String(def.group?.key(r) ?? '—');
  const groups = def.group ? [...new Set(data.map(groupOf))].sort(def.group.order ?? ((a, b) => a.localeCompare(b))) : null;
  const title = railNav.find((r) => r.key === report)?.label ?? '';
  const subtitle = def.filter === 'asOf' ? `${t('crAsOf')} ${moment(asOf).format('DD/MM/YYYY')}`
    : def.filter === 'range' ? `${moment(range[0]).format('DD/MM/YYYY')} – ${moment(range[1]).format('DD/MM/YYYY')}`
      : def.filter === 'future' ? `${moment(future[0]).format('DD/MM/YYYY')} – ${moment(future[1]).format('DD/MM/YYYY')}`
        : def.filter === 'months' ? `${moment(months[0]).format('MM/YYYY')} – ${moment(months[1]).format('MM/YYYY')}` : t('crAllTime');
  const cell = (c: Column, r: Row) => (c.render ? c.render(r) : c.money ? (r[c.key] ? formatNumber(r[c.key]) : '—') : r[c.key] ?? '—');
  const totalRow = (label: string, values: Record<string, number>, className: string) => (
    <tr className={className}>
      {columns.map((c, i) => <td key={c.key} className={c.money || c.num ? 'is-num' : ''}>{i === 0 ? label : c.total ? formatNumber(Math.round(values[c.key] * 100) / 100) : ''}</td>)}
    </tr>
  );
  const toExcel = () => exportExcel([
    ...data.map((r) => ({
      ...(def.group ? { [t('crGroup')]: def.group.label(groupOf(r)) } : {}),
      ...Object.fromEntries(columns.map((c) => [c.label, c.excel ? c.excel(r) : r[c.key] ?? ''])),
    })),
    Object.fromEntries(columns.map((c, i) => [c.label, i === 0 ? t('total') : c.total ? totals[c.key] : ''])),
  ], `credit_${report}_${day(new Date())}`, `${title} · ${subtitle}`);
  const open = (r: Row) => r.loan_id && setViewing(r.loan_id);

  return (
    <AppPage title={title} subtitle={t('crReportsMenu')} railNav={railNav} railActiveKey={report} onRailSelect={setReport}>
      <div className="acs-page cr-page cr-reports">
        <div className="cr-filters">
          {def.filter === 'asOf' && <DatePicker format="dd/MM/yyyy" value={asOf} onChange={(v) => v && setAsOf(v)} cleanable={false} oneTap />}
          {def.filter === 'range' && <DateRangePicker format="dd/MM/yyyy" value={range} onChange={(v) => v && setRange(v as [Date, Date])} cleanable={false} character=" – " />}
          {def.filter === 'future' && <DateRangePicker format="dd/MM/yyyy" value={future} onChange={(v) => v && setFuture(v as [Date, Date])} cleanable={false} character=" – " />}
          {def.filter === 'months' && (
            <>
              <DatePicker format="MM/yyyy" value={months[0]} onChange={(v) => v && setMonths([v, months[1]])} cleanable={false} oneTap />
              <span>–</span>
              <DatePicker format="MM/yyyy" value={months[1]} onChange={(v) => v && setMonths([months[0], v])} cleanable={false} oneTap />
            </>
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
                  <thead><tr>{columns.map((c) => <th key={c.key} className={c.money || c.num ? 'is-num' : ''}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {groups ? groups.map((g) => {
                      const list = data.filter((r) => groupOf(r) === g);
                      return (
                        <Fragment key={g}>
                          <tr className="cr-report-group"><td colSpan={columns.length}><b>{def.group!.label(g)}</b> <small>{list.length} {t('crItems')}</small></td></tr>
                          {list.map((r, i) => (
                            <tr key={`${g}-${i}`} className={`is-line${r.loan_id ? ' is-click' : ''}`} onClick={() => open(r)}>
                              {columns.map((c) => <td key={c.key} className={c.money || c.num ? 'is-num' : ''}>{cell(c, r)}</td>)}
                            </tr>
                          ))}
                          {columns.some((c) => c.total) && totalRow(t('crSubtotal'), sum(list), 'cr-report-subtotal')}
                        </Fragment>
                      );
                    }) : data.map((r, i) => (
                      <tr key={i} className={`is-line${r.loan_id ? ' is-click' : ''}`} onClick={() => open(r)}>
                        {columns.map((c) => <td key={c.key} className={c.money || c.num ? 'is-num' : ''}>{cell(c, r)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                  {columns.some((c) => c.total) && <tfoot>{totalRow(t('total'), totals, 'is-total')}</tfoot>}
                </table>
              </div>
            )}
          </div>
        )}
        {viewing && <ContractDetail id={viewing} onClose={() => setViewing(null)} onChanged={load} />}
      </div>
    </AppPage>
  );
};

export default CreditReportsWindow;
