import { useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { formatNumber } from '../../../utils/configApi';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { GlNotReady } from '../gl/glKit';
import { SettingToolbar } from '../setting/settingKit';
import LoanForm from './LoanForm';
import LoanDetail from './LoanDetail';
import { BORROWED, LOAN_METHODS, money, showDate, termText, useLoans, type Direction, type Loan } from './loanApi';

type Filter = 'active' | 'closed' | 'all';
/** ງວດທີ່ຈະຄົບກຳນົດພາຍໃນຈັກມື້ (ສະຖິຕິເທິງລາຍການ) */
const SOON_DAYS = 30;

/** ຍອດລວມແຍກຕາມສະກຸນ — "₭ 145,000,000 · $ 10,000" */
const totalsText = (rows: Loan[], value: (r: Loan) => number) => {
  const by = new Map<string, { symbol: string; total: number }>();
  rows.forEach((r) => {
    const key = r.currency?.name ?? 'LAK';
    const cur = by.get(key) ?? { symbol: r.currency?.genus || key, total: 0 };
    cur.total += value(r);
    by.set(key, cur);
  });
  return [...by.values()].map((c) => `${c.symbol} ${formatNumber(Math.round(c.total * 100) / 100)}`).join(' · ') || '0';
};

/**
 * ລາຍການເງິນກູ້ຢືມ (direction 1) ຫຼື ເງິນໃຫ້ກູ້ (direction 2) — ຍອດຄົງເຫຼືອ + ແຖບຈ່າຍແລ້ວ, ງວດຕໍ່ໄປ, ກາຍກຳນົດ;
 * ກົດແຖວ = ລາຍລະອຽດ (ຕາຕະລາງຜ່ອນ, ຈ່າຍ/ຮັບຄືນ)
 */
const LoanList = ({ direction }: { direction: Direction }) => {
  const t = useT();
  const borrowed = direction === BORROWED;
  const { rows: all, nextCode, loading, error, notReady, reload } = useLoans();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

  if (notReady) return <GlNotReady />;
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;

  const rows = all.filter((r) => r.direction === direction);
  const active = rows.filter((r) => !r.closed);
  const q = keyword.trim().toLowerCase();
  const shown = rows
    .filter((r) => filter === 'all' || (filter === 'closed' ? r.closed : !r.closed))
    .filter((r) => !q || `${r.loan_code} ${r.counterparty} ${r.contract_no ?? ''} ${r.purpose ?? ''}`.toLowerCase().includes(q));
  const soon = active.filter((r) => r.next && moment(r.next.due_date).diff(moment().startOf('day'), 'days') <= SOON_DAYS && moment(r.next.due_date).isSameOrAfter(moment(), 'day'));
  const overdue = active.filter((r) => r.overdue_count > 0);

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'active', label: t('lnFilterActive'), count: active.length },
    { key: 'closed', label: t('lnFilterClosed'), count: rows.length - active.length },
    { key: 'all', label: t('faFilterAll'), count: rows.length },
  ];

  return (
    <div className="acs-page acc-fa acc-ln">
      <SettingToolbar
        stats={[
          { label: t(borrowed ? 'lnCountBorrowed' : 'lnCountLent'), value: active.length },
          { label: t('lnOutstanding'), value: totalsText(active, (r) => r.outstanding), tone: borrowed ? 'gold' : 'green' },
          { label: t('lnDueSoon'), value: soon.length, tone: 'violet' },
          ...(overdue.length ? [{ label: t('lnOverdue'), value: overdue.length, tone: 'red' as const }] : []),
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t(borrowed ? 'lnAddBorrowed' : 'lnAddLent')}
        onAdd={() => setAdding(true)}
        canAdd={canCreate}
      />

      {rows.length > 0 && (
        <div className="acc-type-segment acc-fa-filter-tabs" role="tablist">
          {filters.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'is-active' : ''} onClick={() => setFilter(f.key)}>
              {f.label} <small>{f.count}</small>
            </button>
          ))}
        </div>
      )}

      {loading && !all.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !rows.length ? (
        <div className="acc-class-empty acc-fa-empty">
          <i className={`fa-solid ${borrowed ? 'fa-building-columns' : 'fa-hand-holding-dollar'}`} />
          <p><b>{t(borrowed ? 'lnEmptyBorrowed' : 'lnEmptyLent')}</b><br />{t(borrowed ? 'lnEmptyBorrowedHint' : 'lnEmptyLentHint')}</p>
          {canCreate && (
            <button type="button" className="acc-rp-btn" onClick={() => setAdding(true)}>
              <i className="fa-solid fa-plus" /> {t(borrowed ? 'lnAddBorrowed' : 'lnAddLent')}
            </button>
          )}
        </div>
      ) : !shown.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-magnifying-glass" /><p>{t('rpEmpty')}</p></div>
      ) : (
        <div className="acc-rp-scroll">
          <table className="acc-fs-table acc-ln-list">
            <thead>
              <tr>
                <th>{t(borrowed ? 'lnLender' : 'lnBorrower')}</th>
                <th>{t('lnTermsShort')}</th>
                <th>{t('lnPrincipal')}</th>
                <th>{t('lnOutstanding')}</th>
                <th>{t('lnNextDue')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const pct = r.principal > 0 ? Math.min(100, (r.paid_principal / r.principal) * 100) : 0;
                const method = LOAN_METHODS.find((m) => m.value === Number(r.method));
                return (
                  <tr key={r._uuid} className={`is-line is-click${r.closed ? ' is-disposed' : ''}`} onClick={() => setViewing(r._uuid)}>
                    <td>
                      <div className="acc-fa-name">
                        <span className="acc-fs-code">{r.loan_code}</span>
                        <b>{r.counterparty}</b>
                        {r.closed && <em className="acc-fa-chip is-full"><i className="fa-solid fa-circle-check" /> {t('lnClosed')}</em>}
                        {Number(r.start_mode) === 2 && <em className="acc-fa-chip is-active"><i className="fa-solid fa-flag-checkered" /> {t('lnModeOpening')}</em>}
                      </div>
                      <small>{[r.contract_no, r.purpose].filter(Boolean).join(' · ') || showDate(r.start_date)}</small>
                    </td>
                    <td>
                      <b>{r.annual_rate}%</b> <small className="acc-gl-ref">{method && t(method.label)}</small>
                      <small className="acc-gl-ref">{termText(r.term, r.frequency_months, t)} · {showDate(r.start_date)}</small>
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

      {adding && (
        <LoanForm direction={direction} row={null} nextCode={nextCode} onClose={() => setAdding(false)}
          onSaved={(id) => {
            reload();
            if (id) setViewing(id);
          }}
        />
      )}
      {viewing && <LoanDetail id={viewing} nextCode={nextCode} onClose={() => setViewing(null)} onChanged={reload} />}
    </div>
  );
};

export default LoanList;
