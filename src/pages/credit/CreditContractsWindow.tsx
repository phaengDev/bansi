import { useMemo, useState, type ReactNode } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import AppPage from '../../components/Elements/AppPage';
import { formatNumber } from '../../utils/configApi';
import { canCreate } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { CREDIT_CONTRACTS_MENU, toRailNav } from '../account/config/SidebarPopup';
import { useRailKey } from '../account/windowMemory';
import { SettingToolbar } from '../account/setting/settingKit';
import { money, showDate } from '../account/loans/loanApi';
import ApplicationForm from './ApplicationForm';
import ApplicationDetail from './ApplicationDetail';
import ContractDetail from './ContractDetail';
import { useCreditList, type Application, type Contract } from './creditApi';
import { AppStatusChip, creditTermText } from './creditKit';

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

  return (
    <div className="acs-page acc-fa acc-ln cr-page">
      <SettingToolbar
        stats={[
          { label: t('crStPending'), value: count([2]), tone: 'violet' },
          { label: t('crFilterToDisburse'), value: count([3]), tone: 'gold' },
          { label: t('crPipeline'), value: `₭ ${formatNumber(Math.round(pendingAmount))}`, tone: 'green' },
        ]}
        keyword={keyword} onKeyword={setKeyword} placeholder={t('crAppSearch')}
        addLabel={t('crAppAdd')} onAdd={() => setAdding(true)} canAdd={canCreate}
      />
      {rows.length > 0 && (
        <div className="acc-type-segment acc-fa-filter-tabs" role="tablist">
          {APP_FILTERS.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'is-active' : ''} onClick={() => setFilter(f.key)}>
              {t(f.label)} <small>{count(f.statuses)}</small>
            </button>
          ))}
        </div>
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
        <div className="acc-rp-scroll">
          <table className="acc-fs-table acc-ln-list">
            <thead>
              <tr>
                <th>{t('crCustomer')}</th>
                <th>{t('crProduct')}</th>
                <th>{t('crRequestedAmount')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r._uuid} className="is-line is-click" onClick={() => setViewing(r._uuid)}>
                  <td>
                    <div className="acc-fa-name">
                      <span className="acc-fs-code">{r.application_no}</span>
                      <b>{r.customer?.name ?? '—'}</b>
                    </div>
                    <small>{[r.customer?.code, r.customer?.phone, showDate(r.apply_date)].filter(Boolean).join(' · ')}</small>
                  </td>
                  <td>
                    <b>{r.product?.name ?? '—'}</b>
                    <small className="acc-gl-ref">{r.purpose ?? ''}</small>
                  </td>
                  <td>
                    <b>₭ {formatNumber(r.approved_amount ?? r.requested_amount)}</b>
                    <small className="acc-gl-ref">{creditTermText(r.approved_term ?? r.requested_term, r.frequency_days, r.frequency_months, t)} · {r.approved_rate ?? r.annual_rate}%</small>
                  </td>
                  <td>
                    <AppStatusChip status={Number(r.status)} level={r.approval_level} levels={r.product?.approval_levels} />
                    {r.loan_code && <small className="acc-gl-ref">{r.loan_code}</small>}
                  </td>
                </tr>
              ))}
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

  return (
    <div className="acs-page acc-fa acc-ln cr-page">
      <SettingToolbar
        stats={[
          { label: t('crContractsActive'), value: active.length },
          { label: t('crDisbursedTotal'), value: totalsText(rows, (r) => r.principal) },
          { label: t('lnOutstanding'), value: totalsText(active, (r) => r.outstanding), tone: 'green' },
          { label: t('crIncomeEarned'), value: totalsText(rows, (r) => r.paid_interest + r.paid_fee + (r.upfront_fee || 0)), tone: 'gold' },
          ...(dueToday.length ? [{ label: t('crDueToday'), value: dueToday.length, tone: 'violet' as const }] : []),
          ...(rows.some(test.overdue) ? [{ label: t('lnOverdue'), value: rows.filter(test.overdue).length, tone: 'red' as const }] : []),
        ]}
        keyword={keyword} onKeyword={setKeyword} placeholder={t('crContractSearch')}
      />
      {rows.length > 0 && (
        <div className="acc-type-segment acc-fa-filter-tabs" role="tablist">
          {(['active', 'overdue', 'closed', 'all'] as ContractFilter[]).map((key) => (
            <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>
              {t(key === 'active' ? 'lnFilterActive' : key === 'overdue' ? 'lnOverdue' : key === 'closed' ? 'lnFilterClosed' : 'faFilterAll')} <small>{rows.filter(test[key]).length}</small>
            </button>
          ))}
        </div>
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
        <div className="acc-rp-scroll">
          <table className="acc-fs-table acc-ln-list">
            <thead>
              <tr>
                <th>{t('crCustomer')}</th>
                <th>{t('lnTermsShort')}</th>
                <th>{t('lnPrincipal')}</th>
                <th>{t('lnOutstanding')}</th>
                <th>{t('lnNextDue')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const pct = r.principal > 0 ? Math.min(100, (r.paid_principal / r.principal) * 100) : 0;
                return (
                  <tr key={r._uuid} className={`is-line is-click${r.closed ? ' is-disposed' : ''}`} onClick={() => setViewing(r._uuid)}>
                    <td>
                      <div className="acc-fa-name">
                        <span className="acc-fs-code">{r.loan_code}</span>
                        <b>{r.customer?.name ?? r.counterparty}</b>
                        {r.closed && <em className="acc-fa-chip is-full"><i className="fa-solid fa-circle-check" /> {t('lnClosed')}</em>}
                      </div>
                      <small>{[r.product?.name, r.customer?.phone, r.contract_no].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td>
                      <b>{r.annual_rate}%</b>
                      <small className="acc-gl-ref">{creditTermText(r.term, r.frequency_days, r.frequency_months, t)} · {showDate(r.start_date)}</small>
                    </td>
                    <td>{money(r.principal, r.currency)}</td>
                    <td>
                      <b>{money(r.outstanding, r.currency)}</b>
                      <span className="acc-fa-bar" title={`${pct.toFixed(0)}%`}><i style={{ width: `${pct}%` }} /></span>
                    </td>
                    <td>
                      {r.closed ? '—' : r.next ? (
                        <>
                          <b>{money(r.next.amount, r.currency)}</b>
                          <small className="acc-gl-ref">{t('lnInstallmentNo')} {r.next.no} · {showDate(r.next.due_date)}</small>
                        </>
                      ) : '—'}
                      {r.overdue_count > 0 && (
                        <span className="hr-expiry-chip is-over"><i className="fa-solid fa-triangle-exclamation" /> {t('lnOverdueN').replace('{n}', String(r.overdue_count))}</span>
                      )}
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

/** ໜ້າຕ່າງ ຄຳຮ້ອງ ແລະ ສັນຍາ */
const CreditContractsWindow = () => {
  const t = useT();
  const railNav = useMemo(() => toRailNav(CREDIT_CONTRACTS_MENU, t), [t]);
  const [activeKey, setActiveKey] = useRailKey('creditContracts', CREDIT_CONTRACTS_MENU);
  const active = railNav.find((item) => item.key === activeKey);
  const pages: Record<string, ReactNode> = { applications: <ApplicationsPage />, contracts: <ContractsPage /> };
  return (
    <AppPage title={active?.label ?? t('accountAppCreditContracts')} subtitle={t('accountAppCreditContracts')}
      railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}
    >
      {pages[activeKey] ?? null}
    </AppPage>
  );
};

export default CreditContractsWindow;
