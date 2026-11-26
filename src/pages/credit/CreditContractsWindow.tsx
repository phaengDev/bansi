import { useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import AppPage from '../../components/Elements/AppPage';
import { formatNumber } from '../../utils/configApi';
import { canCreate } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { money, showDate } from '../account/loans/loanApi';
import ApplicationForm from './ApplicationForm';
import ApplicationDetail from './ApplicationDetail';
import ContractDetail from './ContractDetail';
import { DaysLateChip } from './collectKit';
import { APP_STATUS, CLOSE_REASONS, useCreditList, type Application, type Contract } from './creditApi';
import { AppStatusChip, CreditListBar, CreditTiles, IdentityCell, creditTermText } from './creditKit';

/** ຍອດລວມແຍກຕາມສະກຸນ — "₭ 145,000,000 · $ 10,000" */
const totalsText = (rows: Contract[], value: (r: Contract) => number) => {
  const by = new Map<string, { symbol: string; total: number }>();
  rows.forEach((r) => {
    const key = r.currency?.name ?? 'LAK';
    const cur = by.get(key) ?? { symbol: r.currency?.genus || key, total: 0 };
    cur.total += value(r);
    by.set(key, cur);
  });
  return [...by.values()].map((c) => `${c.symbol} ${formatNumber(Math.round(c.total * 100) / 100)}`).join(' · ') || '0';
};

type AppFilter = 'open' | 'draft' | 'pending' | 'approved' | 'disbursed' | 'closed' | 'all';
const APP_FILTERS: { key: AppFilter; label: string; statuses: number[] }[] = [
  { key: 'open', label: 'crFilterOpen', statuses: [1, 2, 3] },
  { key: 'draft', label: 'crStDraft', statuses: [1] },
  { key: 'pending', label: 'crStPending', statuses: [2] },
  { key: 'approved', label: 'crFilterToDisburse', statuses: [3] },
  { key: 'disbursed', label: 'crStDisbursed', statuses: [5] },
  { key: 'closed', label: 'crFilterRejected', statuses: [4, 6] },
  { key: 'all', label: 'faFilterAll', statuses: [1, 2, 3, 4, 5, 6] },
];

/** ຄຳຮ້ອງຂໍສິນເຊື່ອ — ຕາມສະຖານະ (ຮ່າງ → ລໍຖ້າພິຈາລະນາ → ອະນຸມັດ → ປ່ອຍກູ້) */
const ApplicationsPage = () => {
  const t = useT();
  const { rows, loading, error, reload } = useCreditList<Application>('/credit/application');
  const [filter, setFilter] = useState<AppFilter>('open');
  const [keyword, setKeyword] = useState('');
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;

  const count = (statuses: number[]) => rows.filter((r) => statuses.includes(Number(r.status))).length;
  const q = keyword.trim().toLowerCase();
  const shown = rows
    .filter((r) => APP_FILTERS.find((f) => f.key === filter)!.statuses.includes(Number(r.status)))
    .filter((r) => !q || `${r.application_no} ${r.customer?.code ?? ''} ${r.customer?.name ?? ''} ${r.customer?.phone ?? ''} ${r.product?.name ?? ''}`.toLowerCase().includes(q));
  const pendingAmount = rows.filter((r) => [2, 3].includes(Number(r.status))).reduce((n, r) => n + (r.approved_amount ?? r.requested_amount), 0);

  const sumOf = (statuses: number[]) => rows.filter((r) => statuses.includes(Number(r.status))).reduce((n, r) => n + (r.approved_amount ?? r.requested_amount), 0);

  return (
    <div className="acs-page acc-fa acc-ln cr-page">
      <CreditTiles
        tiles={[
          { icon: 'fa-file-pen', label: t('crPipeline'), value: `₭ ${formatNumber(Math.round(pendingAmount))}`, sub: `${count([2, 3])} ${t('crApplicationsN')}`, tone: 'navy' },
          { icon: 'fa-hourglass-half', label: t('crStPending'), value: formatNumber(count([2])), sub: `₭ ${formatNumber(Math.round(sumOf([2])))}`, tone: 'violet' },
          { icon: 'fa-money-bill-transfer', label: t('crFilterToDisburse'), value: formatNumber(count([3])), sub: `₭ ${formatNumber(Math.round(sumOf([3])))}`, tone: 'gold' },
          { icon: 'fa-circle-check', label: t('crStDisbursed'), value: formatNumber(count([5])), sub: `₭ ${formatNumber(Math.round(sumOf([5])))}`, tone: 'green' },
          { icon: 'fa-pen-ruler', label: t('crStDraft'), value: formatNumber(count([1])), tone: 'slate' },
        ]}
      />
      {rows.length > 0 && (
        <CreditListBar
          tabs={APP_FILTERS.map((f) => ({ key: f.key, label: t(f.label), count: count(f.statuses) }))} value={filter} onChange={setFilter}
          keyword={keyword} onKeyword={setKeyword} placeholder={t('crAppSearch')}
          addLabel={t('crAppAdd')} onAdd={() => setAdding(true)} canAdd={canCreate}
        />
      )}
      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !rows.length ? (
        <div className="acc-class-empty acc-fa-empty">
          <i className="fa-solid fa-file-pen" />
          <p><b>{t('crNoApplications')}</b><br />{t('crNoApplicationsHint')}</p>
          {canCreate && <button type="button" className="acc-rp-btn" onClick={() => setAdding(true)}><i className="fa-solid fa-plus" /> {t('crAppAdd')}</button>}
        </div>
      ) : !shown.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-magnifying-glass" /><p>{t('rpEmpty')}</p></div>
      ) : (
        <div className="cr-card cr-list-card acc-rp-scroll">
          <table className="acc-fs-table cr-list">
            <thead>
              <tr>
                <th>{t('crApplication')}</th>
                <th className="is-text">{t('crProduct')}</th>
                <th>{t('crRequestedAmount')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const st = APP_STATUS[Number(r.status)] ?? APP_STATUS[1];
                return (
                  <tr key={r._uuid} className="is-click" onClick={() => setViewing(r._uuid)}>
                    <td>
                      <IdentityCell icon={st.icon} tone={st.tone} title={r.customer?.name ?? '—'} code={r.application_no}
                        meta={[r.customer?.code, r.customer?.phone, showDate(r.apply_date)]}
                      />
                    </td>
                    <td className="is-text">
                      <b>{r.product?.name ?? '—'}</b>
                      {r.purpose && <small>{r.purpose}</small>}
                    </td>
                    <td>
                      <b>₭ {formatNumber(r.approved_amount ?? r.requested_amount)}</b>
                      <small>{creditTermText(r.approved_term ?? r.requested_term, r.frequency_days, r.frequency_months, t)} · {r.approved_rate ?? r.annual_rate}%</small>
                    </td>
                    <td>
                      <AppStatusChip status={Number(r.status)} level={r.approval_level} levels={r.product?.approval_levels} />
                      {r.loan_code && <small>{r.loan_code}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {adding && <ApplicationForm row={null} onClose={() => setAdding(false)} onSaved={(id) => { reload(); if (id) setViewing(id); }} />}
      {viewing && <ApplicationDetail id={viewing} onClose={() => setViewing(null)} onChanged={reload} />}
    </div>
  );
};

type ContractFilter = 'active' | 'overdue' | 'closed' | 'all';

/** ສັນຍາສິນເຊື່ອ — ຍອດປ່ອຍ, ຍອດຄ້າງ, ດອກເບ້ຍ + ຄ່າທຳນຽມທີ່ໄດ້ຮັບ, ກາຍກຳນົດ; ກົດແຖວ = ສັນຍາ (ຮັບຊຳລະ) */
const ContractsPage = () => {
  const t = useT();
  const { rows, loading, error, reload } = useCreditList<Contract>('/credit/contract');
  const [filter, setFilter] = useState<ContractFilter>('active');
  const [keyword, setKeyword] = useState('');
  const [viewing, setViewing] = useState<number | null>(null);
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;

  const active = rows.filter((r) => !r.closed);
  const test: Record<ContractFilter, (r: Contract) => boolean> = {
    active: (r) => !r.closed,
    overdue: (r) => !r.closed && r.overdue_count > 0,
    closed: (r) => r.closed,
    all: () => true,
  };
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter(test[filter])
    .filter((r) => !q || `${r.loan_code} ${r.contract_no ?? ''} ${r.customer?.code ?? ''} ${r.customer?.name ?? ''} ${r.customer?.phone ?? ''}`.toLowerCase().includes(q));
  const today = moment().format('YYYY-MM-DD');
  const dueToday = active.filter((r) => r.next && r.next.due_date === today);

  const overdueRows = rows.filter(test.overdue);

  return (
    <div className="acs-page acc-fa acc-ln cr-page">
      <CreditTiles
        tiles={[
          { icon: 'fa-sack-dollar', label: t('lnOutstanding'), value: totalsText(active, (r) => r.outstanding), sub: `${active.length} ${t('crContractsActive')}`, tone: 'navy' },
          { icon: 'fa-money-bill-transfer', label: t('crDisbursedTotal'), value: totalsText(rows, (r) => r.principal), sub: `${rows.length} ${t('crContracts')}`, tone: 'blue' },
          { icon: 'fa-coins', label: t('crIncomeEarned'), value: totalsText(rows, (r) => r.paid_interest + r.paid_fee + (r.upfront_fee || 0) + (r.paid_penalty || 0)), sub: t('crIncomeHint'), tone: 'green' },
          { icon: 'fa-calendar-day', label: t('crDueToday'), value: formatNumber(dueToday.length), sub: dueToday.length ? totalsText(dueToday, (r) => r.next?.amount ?? 0) : '', tone: 'violet' },
          { icon: 'fa-triangle-exclamation', label: t('lnOverdue'), value: formatNumber(overdueRows.length), sub: overdueRows.length ? totalsText(overdueRows, (r) => r.overdue_amount ?? 0) : '', tone: overdueRows.length ? 'red' : 'slate' },
        ]}
      />
      {rows.length > 0 && (
        <CreditListBar
          tabs={(['active', 'overdue', 'closed', 'all'] as ContractFilter[]).map((key) => ({
            key, count: rows.filter(test[key]).length,
            label: t(key === 'active' ? 'lnFilterActive' : key === 'overdue' ? 'lnOverdue' : key === 'closed' ? 'lnFilterClosed' : 'faFilterAll'),
          }))}
          value={filter} onChange={setFilter} keyword={keyword} onKeyword={setKeyword} placeholder={t('crContractSearch')}
        />
      )}
      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !rows.length ? (
        <div className="acc-class-empty acc-fa-empty">
          <i className="fa-solid fa-file-signature" />
          <p><b>{t('crNoContracts')}</b><br />{t('crNoContractsHint')}</p>
        </div>
      ) : !shown.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-magnifying-glass" /><p>{t('rpEmpty')}</p></div>
      ) : (
        <div className="cr-card cr-list-card acc-rp-scroll">
          <table className="acc-fs-table cr-list">
            <thead>
              <tr>
                <th>{t('crContract')}</th>
                <th className="is-text">{t('lnTermsShort')}</th>
                <th>{t('lnPrincipal')}</th>
                <th>{t('lnOutstanding')}</th>
                <th>{t('lnNextDue')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const pct = r.principal > 0 ? Math.min(100, (r.paid_principal / r.principal) * 100) : 0;
                const why = r.closed ? CLOSE_REASONS[Number(r.close_reason)] ?? CLOSE_REASONS[1] : null;
                return (
                  <tr key={r._uuid} className={`is-click${r.closed ? ' is-off' : ''}`} onClick={() => setViewing(r._uuid)}>
                    <td>
                      <IdentityCell icon="fa-file-signature" tone={r.closed ? 'is-slate' : r.days_overdue > 0 ? 'is-red' : 'is-blue'}
                        title={r.customer?.name ?? r.counterparty} code={r.loan_code} meta={[r.product?.name, r.customer?.phone, r.contract_no]}
                        chips={why && <em className={`acc-fa-chip ${why.tone}`}><i className={`fa-solid ${why.icon}`} /> {t(why.label)}</em>}
                      />
                    </td>
                    <td className="is-text">
                      <b>{r.annual_rate}% / {t('lnYear')}</b>
                      <small>{creditTermText(r.term, r.frequency_days, r.frequency_months, t)} · {showDate(r.start_date)}</small>
                    </td>
                    <td>{money(r.principal, r.currency)}</td>
                    <td>
                      <b>{money(r.outstanding, r.currency)}</b>
                      {!r.closed && (
                        <span className="cr-progress-row" title={t('crPaidPct').replace('{p}', pct.toFixed(0))}>
                          <span className="cr-progress"><i style={{ width: `${pct}%` }} /></span>
                          <small>{pct.toFixed(0)}%</small>
                        </span>
                      )}
                    </td>
                    <td>
                      {r.closed ? <span className="cr-muted">—</span> : r.next ? (
                        <>
                          <b>{money(r.next.amount, r.currency)}</b>
                          <small>{t('lnInstallmentNo')} {r.next.no} · {showDate(r.next.due_date)}</small>
                        </>
                      ) : <span className="cr-muted">—</span>}
                      <DaysLateChip days={r.days_overdue} aging={r.aging} />
                      {r.penalty_due > 0 && <small className="cr-text-bad">{t('crPenalty')} {formatNumber(r.penalty_due)}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {viewing && <ContractDetail id={viewing} onClose={() => setViewing(null)} onChanged={reload} />}
    </div>
  );
};

/** ໜ້າຕ່າງ ສັນຍາສິນເຊື່ອ */
const CreditContractsWindow = () => <AppPage showHeader={false}><ContractsPage /></AppPage>;

/** ໜ້າຕ່າງ ຄຳຮ້ອງຂໍກູ້ */
export const CreditApplicationsWindow = () => <AppPage showHeader={false}><ApplicationsPage /></AppPage>;

export default CreditContractsWindow;
