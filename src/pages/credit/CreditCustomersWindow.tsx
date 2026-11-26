import { useState } from 'react';
import { Loader } from 'rsuite';
import AppPage from '../../components/Elements/AppPage';
import { formatNumber } from '../../utils/configApi';
import { canCreate } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import CustomerForm from './CustomerForm';
import CustomerDetail from './CustomerDetail';
import { customerAddress } from './creditApi';
import { CreditListBar, CreditTiles, IdentityCell, RiskChip, customerAvatar, useCreditCustomers } from './creditKit';

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

  const withDebt = rows.filter(test.debt);
  const overdue = rows.filter(test.overdue);
  const pending = rows.reduce((n, c) => n + (c.pending ?? 0), 0);

  return (
    <div className="acs-page acc-fa acc-ln cr-page">
      <CreditTiles
        tiles={[
          { icon: 'fa-users', label: t('crCustomers'), value: formatNumber(active.length), sub: t('crOfTotal').replace('{n}', formatNumber(rows.length)), tone: 'navy' },
          { icon: 'fa-file-invoice-dollar', label: t('crWithDebt'), value: formatNumber(withDebt.length), sub: `${withDebt.reduce((n, c) => n + (c.active_loans ?? 0), 0)} ${t('crActiveContracts')}`, tone: 'violet' },
          { icon: 'fa-sack-dollar', label: t('lnOutstanding'), value: `₭ ${formatNumber(Math.round(outstanding))}`, tone: 'green' },
          { icon: 'fa-triangle-exclamation', label: t('lnOverdue'), value: formatNumber(overdue.length), sub: t('crCustomers'), tone: overdue.length ? 'red' : 'slate' },
          { icon: 'fa-hourglass-half', label: t('crPendingApps'), value: formatNumber(pending), tone: 'gold' },
        ]}
      />

      {rows.length > 0 && (
        <CreditListBar
          tabs={filters.map((f) => ({ ...f, count: rows.filter(test[f.key]).length }))} value={filter} onChange={setFilter}
          keyword={keyword} onKeyword={setKeyword} placeholder={t('crCustomerSearch')}
          addLabel={t('crCustomerAdd')} onAdd={() => setAdding(true)} canAdd={canCreate}
        />
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
        <div className="cr-card cr-list-card acc-rp-scroll">
          <table className="acc-fs-table cr-list">
            <thead>
              <tr>
                <th>{t('crCustomer')}</th>
                <th className="is-text">{t('crContact')}</th>
                <th>{t('crMonthlyIncome')}</th>
                <th>{t('lnOutstanding')}</th>
                <th className="is-center">{t('crRisk')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const address = customerAddress(c);
                return (
                  <tr key={c._uuid} className={`is-click${Number(c.status) !== 1 ? ' is-off' : ''}`} onClick={() => setViewing(c._uuid)}>
                    <td>
                      <IdentityCell {...customerAvatar(c)} title={c.full_name} code={c.customer_code} meta={[c.id_no, c.occupation]}
                        chips={(
                          <>
                            {Number(c.customer_type) === 2 && <em className="acc-fa-chip is-active"><i className="fa-solid fa-building" /> {t('crBorrowerCompany')}</em>}
                            {Number(c.blacklisted) === 1 && <em className="acc-fa-chip is-black"><i className="fa-solid fa-ban" /> {t('crBlacklist')}</em>}
                            {(c.pending ?? 0) > 0 && <em className="acc-fa-chip is-pending"><i className="fa-solid fa-hourglass-half" /> {t('crPendingN').replace('{n}', String(c.pending))}</em>}
                          </>
                        )}
                      />
                    </td>
                    <td className="is-text">
                      {c.phone ? <b className="cr-phone"><i className="fa-solid fa-phone" /> {c.phone}</b> : <span className="cr-muted">—</span>}
                      {address && <small>{address}</small>}
                    </td>
                    <td>{c.monthly_income ? <b>{formatNumber(c.monthly_income)}</b> : <span className="cr-muted">—</span>}</td>
                    <td>
                      {(c.active_loans ?? 0) > 0 ? (
                        <>
                          <b>₭ {formatNumber(c.outstanding ?? 0)}</b>
                          <small>{c.active_loans} {t('crActiveContracts')}</small>
                        </>
                      ) : <span className="cr-muted">—</span>}
                      {(c.overdue ?? 0) > 0 && <span className="hr-expiry-chip is-over"><i className="fa-solid fa-triangle-exclamation" /> {t('lnOverdue')}</span>}
                    </td>
                    <td className="is-center"><RiskChip level={c.risk_level} /></td>
                  </tr>
                );
              })}
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
