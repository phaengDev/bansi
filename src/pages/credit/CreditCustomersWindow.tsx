import { useState } from 'react';
import { Loader } from 'rsuite';
import AppPage from '../../components/Elements/AppPage';
import { formatNumber } from '../../utils/configApi';
import { canCreate } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { SettingToolbar } from '../account/setting/settingKit';
import CustomerForm from './CustomerForm';
import CustomerDetail from './CustomerDetail';
import { customerAddress } from './creditApi';
import { RiskChip, useCreditCustomers } from './creditKit';

type Filter = 'active' | 'debt' | 'overdue' | 'blacklist' | 'all';

/**
 * ລູກຄ້າສິນເຊື່ອ — ລາຍຊື່ + ຍອດຄ້າງ, ສັນຍາທີ່ຍັງຜ່ອນ, ກາຍກຳນົດ, ຄຳຮ້ອງທີ່ຄ້າງ; ກົດແຖວ = ລາຍລະອຽດ (KYC, ຫຼັກຊັບ, ຄຳຮ້ອງ, ສັນຍາ)
 */
const CustomerList = () => {
  const t = useT();
  const { rows, nextCode, loading, error, reload } = useCreditCustomers();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;

  const active = rows.filter((c) => Number(c.status) === 1);
  const test: Record<Filter, (c: (typeof rows)[number]) => boolean> = {
    active: (c) => Number(c.status) === 1,
    debt: (c) => (c.active_loans ?? 0) > 0,
    overdue: (c) => (c.overdue ?? 0) > 0,
    blacklist: (c) => Number(c.blacklisted) === 1,
    all: () => true,
  };
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter(test[filter])
    .filter((c) => !q || `${c.customer_code} ${c.full_name} ${c.name_en ?? ''} ${c.phone ?? ''} ${c.id_no ?? ''}`.toLowerCase().includes(q));
  const outstanding = rows.reduce((n, c) => n + (c.outstanding ?? 0), 0);
  const filters: { key: Filter; label: string }[] = [
    { key: 'active', label: t('crFilterActive') },
    { key: 'debt', label: t('crFilterDebt') },
    { key: 'overdue', label: t('lnOverdue') },
    { key: 'blacklist', label: t('crBlacklist') },
    { key: 'all', label: t('faFilterAll') },
  ];

  return (
    <div className="acs-page acc-fa acc-ln cr-page">
      <SettingToolbar
        stats={[
          { label: t('crCustomers'), value: active.length },
          { label: t('crWithDebt'), value: rows.filter(test.debt).length, tone: 'violet' },
          { label: t('lnOutstanding'), value: `₭ ${formatNumber(Math.round(outstanding))}`, tone: 'green' },
          ...(rows.some(test.overdue) ? [{ label: t('lnOverdue'), value: rows.filter(test.overdue).length, tone: 'red' as const }] : []),
        ]}
        keyword={keyword} onKeyword={setKeyword} placeholder={t('crCustomerSearch')}
        addLabel={t('crCustomerAdd')} onAdd={() => setAdding(true)} canAdd={canCreate}
      />

      {rows.length > 0 && (
        <div className="acc-type-segment acc-fa-filter-tabs" role="tablist">
          {filters.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'is-active' : ''} onClick={() => setFilter(f.key)}>
              {f.label} <small>{rows.filter(test[f.key]).length}</small>
            </button>
          ))}
        </div>
      )}

      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !rows.length ? (
        <div className="acc-class-empty acc-fa-empty">
          <i className="fa-solid fa-address-card" />
          <p><b>{t('crNoCustomers')}</b><br />{t('crNoCustomersHint')}</p>
          {canCreate && <button type="button" className="acc-rp-btn" onClick={() => setAdding(true)}><i className="fa-solid fa-plus" /> {t('crCustomerAdd')}</button>}
        </div>
      ) : !shown.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-magnifying-glass" /><p>{t('rpEmpty')}</p></div>
      ) : (
        <div className="acc-rp-scroll">
          <table className="acc-fs-table acc-ln-list">
            <thead>
              <tr>
                <th>{t('crCustomer')}</th>
                <th>{t('crContact')}</th>
                <th>{t('crMonthlyIncome')}</th>
                <th>{t('lnOutstanding')}</th>
                <th>{t('crRisk')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c._uuid} className={`is-line is-click${Number(c.status) !== 1 ? ' is-disposed' : ''}`} onClick={() => setViewing(c._uuid)}>
                  <td>
                    <div className="acc-fa-name">
                      <span className="acc-fs-code">{c.customer_code}</span>
                      <b>{c.full_name}</b>
                      {Number(c.customer_type) === 2 && <em className="acc-fa-chip is-active"><i className="fa-solid fa-building" /> {t('crBorrowerCompany')}</em>}
                      {Number(c.blacklisted) === 1 && <em className="acc-fa-chip is-black"><i className="fa-solid fa-ban" /> {t('crBlacklist')}</em>}
                      {(c.pending ?? 0) > 0 && <em className="acc-fa-chip is-pending"><i className="fa-solid fa-hourglass-half" /> {t('crPendingN').replace('{n}', String(c.pending))}</em>}
                    </div>
                    <small>{[c.id_no, c.occupation].filter(Boolean).join(' · ') || '—'}</small>
                  </td>
                  <td>
                    <b>{c.phone ?? '—'}</b>
                    <small className="acc-gl-ref">{customerAddress(c) || '—'}</small>
                  </td>
                  <td>{c.monthly_income ? formatNumber(c.monthly_income) : '—'}</td>
                  <td>
                    {(c.active_loans ?? 0) > 0 ? (
                      <>
                        <b>₭ {formatNumber(c.outstanding ?? 0)}</b>
                        <small className="acc-gl-ref">{c.active_loans} {t('crActiveContracts')}</small>
                      </>
                    ) : '—'}
                    {(c.overdue ?? 0) > 0 && <span className="hr-expiry-chip is-over"><i className="fa-solid fa-triangle-exclamation" /> {t('lnOverdue')}</span>}
                  </td>
                  <td><RiskChip level={c.risk_level} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <CustomerForm row={null} nextCode={nextCode} onClose={() => setAdding(false)} onSaved={(id) => { reload(); if (id) setViewing(id); }} />}
      {viewing && <CustomerDetail id={viewing} onClose={() => setViewing(null)} onChanged={reload} />}
    </div>
  );
};

/** ໜ້າຕ່າງ ລູກຄ້າສິນເຊື່ອ */
const CreditCustomersWindow = () => (
  <AppPage showHeader={false}>
    <CustomerList />
  </AppPage>
);

export default CreditCustomersWindow;
