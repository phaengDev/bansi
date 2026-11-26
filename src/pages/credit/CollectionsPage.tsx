import { useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { formatNumber } from '../../utils/configApi';
import { canCreate } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { money, showDate } from '../account/loans/loanApi';
import CollectForm from './CollectForm';
import ContractDetail from './ContractDetail';
import { AGING_BUCKETS, FOLLOW_METHODS, FOLLOW_RESULTS, useCreditList, type AgingKey, type CollectionRow } from './creditApi';
import { DaysLateChip, FollowUpForm } from './collectKit';
import { CreditListBar, CreditTiles, IdentityCell } from './creditKit';
import ReminderModal from './ReminderModal';
import { AgingBars } from './creditCharts';

type Filter = 'overdue' | 'today' | 'promise' | 'week' | 'all';

/**
 * ຕິດຕາມໜີ້ — ສັນຍາທີ່ກາຍກຳນົດ (ຕາມອາຍຸໜີ້), ຄົບກຳນົດມື້ນີ້, ນັດຈ່າຍຮອດແລ້ວ, ຄົບກຳນົດພາຍໃນ 7 ມື້;
 * ແຕ່ລະແຖວ: ໂທ, ບັນທຶກການຕິດຕາມ, ຮັບຊຳລະ; ກົດແຖວ = ສັນຍາ
 */
const CollectionsPage = () => {
  const t = useT();
  const { rows, extra, loading, error, reload } = useCreditList<CollectionRow>('/credit/collections');
  const today = String(extra.today ?? moment().format('YYYY-MM-DD'));
  const [filter, setFilter] = useState<Filter>('overdue');
  const [aging, setAging] = useState<AgingKey | null>(null);
  const [keyword, setKeyword] = useState('');
  const [viewing, setViewing] = useState<{ id: number; receipt?: number } | null>(null);
  const [collecting, setCollecting] = useState<CollectionRow | null>(null);
  const [logging, setLogging] = useState<CollectionRow | null>(null);
  const [reminding, setReminding] = useState<CollectionRow | null>(null);
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;

  const weekEnd = moment(today).add(7, 'days').format('YYYY-MM-DD');
  const test: Record<Filter, (r: CollectionRow) => boolean> = {
    overdue: (r) => r.days_overdue > 0 || (r.closed && r.penalty_due > 0),
    today: (r) => !r.closed && r.days_overdue === 0 && r.next?.due_date === today,
    promise: (r) => r.last_contact?.result === 1 && !!r.last_contact.promise_date && r.last_contact.promise_date <= today && r.days_overdue > 0,
    week: (r) => !r.closed && !!r.next && r.next.due_date > today && r.next.due_date <= weekEnd,
    all: () => true,
  };
  const q = keyword.trim().toLowerCase();
  const shown = rows
    .filter(test[filter])
    .filter((r) => !aging || r.aging === aging)
    .filter((r) => !q || `${r.loan_code} ${r.customer?.code ?? ''} ${r.customer?.name ?? ''} ${r.customer?.phone ?? ''}`.toLowerCase().includes(q))
    .sort((a, b) => b.days_overdue - a.days_overdue || (a.next?.due_date ?? '').localeCompare(b.next?.due_date ?? ''));
  const open = rows.filter((r) => !r.closed);
  const overdue = rows.filter(test.overdue);
  const outstanding = open.reduce((n, r) => n + r.outstanding, 0);
  const overdueAmount = overdue.reduce((n, r) => n + r.overdue_amount, 0);
  const dueToday = rows.filter(test.today);
  const par30 = open.filter((r) => r.days_overdue >= 30).reduce((n, r) => n + r.outstanding, 0);
  const agingRows = AGING_BUCKETS.map((b) => {
    const list = open.filter((r) => r.aging === b.key);
    return { key: b.key, label: t(b.label), contracts: list.length, amount: list.reduce((n, r) => n + r.outstanding, 0) };
  });
  const filters: { key: Filter; label: string; icon: string }[] = [
    { key: 'overdue', label: t('lnOverdue'), icon: 'fa-triangle-exclamation' },
    { key: 'today', label: t('crDueToday'), icon: 'fa-calendar-day' },
    { key: 'promise', label: t('crPromiseDue'), icon: 'fa-handshake' },
    { key: 'week', label: t('crDueWeek'), icon: 'fa-calendar-week' },
    { key: 'all', label: t('faFilterAll'), icon: 'fa-list' },
  ];

  return (
    <div className="acs-page acc-fa acc-ln cr-page cr-collections">
      <div className="cr-collect-top">
        <CreditTiles
          className="is-2x2"
          tiles={[
            { icon: 'fa-triangle-exclamation', label: t('crOverdueContracts'), value: formatNumber(overdue.length), sub: `${t('crOverdueAmount')} ₭ ${formatNumber(Math.round(overdueAmount))}`, tone: overdue.length ? 'red' : 'slate' },
            { icon: 'fa-calendar-day', label: t('crDueToday'), value: formatNumber(dueToday.length), sub: `₭ ${formatNumber(Math.round(dueToday.reduce((n, r) => n + (r.next?.amount ?? 0), 0)))}`, tone: 'violet' },
            { icon: 'fa-gavel', label: t('crPenaltyDue'), value: `₭ ${formatNumber(Math.round(rows.reduce((n, r) => n + r.penalty_due, 0)))}`, tone: 'gold' },
            { icon: 'fa-chart-pie', label: 'PAR30', value: `${outstanding > 0 ? Math.round((par30 / outstanding) * 1000) / 10 : 0}%`, sub: `₭ ${formatNumber(Math.round(par30))} / ${formatNumber(Math.round(outstanding))}`, tone: par30 > 0 ? 'red' : 'green' },
          ]}
        />
        {open.length > 0 && (
          <div className="cr-card cr-aging-card">
            <span className="cr-aging-title"><b>{t('crAgingTitle')}</b><small>{t('crAgingHint')}</small></span>
            <AgingBars rows={agingRows} active={aging} onPick={(key) => {
              const next = aging === key ? null : (key as AgingKey);
              setAging(next);
              if (next) setFilter(next === 'current' ? 'all' : 'overdue');
            }}
            />
          </div>
        )}
      </div>

      <CreditListBar
        tabs={filters.map((f) => ({ ...f, count: rows.filter(test[f.key]).length }))} value={filter} onChange={(key) => { setFilter(key); setAging(null); }}
        keyword={keyword} onKeyword={setKeyword} placeholder={t('crContractSearch')}
        extra={aging && (
          <button type="button" className="cr-filter-chip" onClick={() => setAging(null)}>
            {t(AGING_BUCKETS.find((b) => b.key === aging)!.label)} <i className="fa-solid fa-xmark" />
          </button>
        )}
      />

      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !shown.length ? (
        <div className="acc-class-empty acc-fa-empty">
          <i className="fa-solid fa-circle-check" />
          <p><b>{t(filter === 'overdue' ? 'crNoOverdue' : 'rpEmpty')}</b></p>
        </div>
      ) : (
        <div className="cr-card cr-list-card acc-rp-scroll">
          <table className="acc-fs-table cr-list cr-collect-list">
            <thead>
              <tr>
                <th>{t('crContract')}</th>
                <th>{t('lnOverdue')}</th>
                <th>{t('lnNextDue')}</th>
                <th className="is-text">{t('crLastContact')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const last = r.last_contact;
                const method = last && FOLLOW_METHODS.find((m) => m.value === Number(last.method));
                const result = last && FOLLOW_RESULTS.find((x) => x.value === Number(last.result));
                const phone = r.customer?.phone;
                return (
                  <tr key={r._uuid} className="is-click" onClick={() => setViewing({ id: r._uuid })}>
                    <td>
                      <IdentityCell icon="fa-file-signature" tone={r.days_overdue > 0 ? 'is-red' : 'is-blue'} title={r.customer?.name ?? r.counterparty}
                        code={r.loan_code} meta={[r.customer?.code, phone, r.product?.name]}
                      />
                    </td>
                    <td>
                      {r.days_overdue > 0 ? (
                        <>
                          <b>{money(r.overdue_amount, r.currency)}</b>
                          <DaysLateChip days={r.days_overdue} aging={r.aging} />
                          {r.penalty_due > 0 && <small className="cr-text-bad">{t('crPenalty')} {formatNumber(r.penalty_due)}</small>}
                        </>
                      ) : r.penalty_due > 0 ? <small className="cr-text-bad">{t('crPenalty')} {formatNumber(r.penalty_due)}</small> : <span className="cr-muted">—</span>}
                    </td>
                    <td>
                      {r.next ? (
                        <>
                          <b>{money(r.next.amount, r.currency)}</b>
                          <small>{t('lnInstallmentNo')} {r.next.no} · {showDate(r.next.due_date)}</small>
                        </>
                      ) : <span className="cr-muted">—</span>}
                    </td>
                    <td className="is-text">
                      {last ? (
                        <span className="cr-last">
                          <i className={`fa-solid ${method?.icon ?? 'fa-phone'}`} />
                          <span>
                            <b className={`cr-result ${result?.tone ?? ''}`}>{result ? t(result.label) : ''}</b>
                            <small>
                              {last.promise_date ? t('crPromiseOn').replace('{d}', showDate(last.promise_date)) : moment(last.contact_date).format('DD/MM/YYYY')}
                              {last.by ? ` · ${last.by}` : ''}
                            </small>
                          </span>
                        </span>
                      ) : <span className="cr-muted">{t('crNotContacted')}</span>}
                      {r.last_notice && <small><i className="fa-solid fa-bell" /> {t('crReminderSentOn').replace('{d}', moment(r.last_notice).format('DD/MM'))}</small>}
                    </td>
                    <td className="acc-fa-actions" onClick={(e) => e.stopPropagation()}>
                      {phone && <a href={`tel:${phone}`} title={t('crCall')} aria-label={t('crCall')}><i className="fa-solid fa-phone" /></a>}
                      {canCreate && (
                        <button type="button" onClick={() => setReminding(r)} title={t('crReminder')} aria-label={t('crReminder')}
                          className={r.last_notice ? 'is-sent' : ''}
                        >
                          <i className="fa-solid fa-bell" />
                        </button>
                      )}
                      {canCreate && (
                        <button type="button" onClick={() => setLogging(r)} title={t('crFollowUpAdd')} aria-label={t('crFollowUpAdd')}><i className="fa-solid fa-comment-dots" /></button>
                      )}
                      {canCreate && (
                        <button type="button" className="is-primary" onClick={() => setCollecting(r)} title={t('crCollect')} aria-label={t('crCollect')}><i className="fa-solid fa-hand-holding-dollar" /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewing && <ContractDetail id={viewing.id} openReceipt={viewing.receipt} onClose={() => setViewing(null)} onChanged={reload} />}
      {collecting && (
        <CollectForm contract={{ ...collecting, name: collecting.customer?.name ?? collecting.counterparty }} onClose={() => setCollecting(null)}
          onSaved={(paymentId) => { reload(); setViewing({ id: collecting._uuid, receipt: paymentId || undefined }); }}
        />
      )}
      {reminding && <ReminderModal row={reminding} onClose={() => setReminding(null)} onSent={reload} />}
      {logging && <FollowUpForm loanId={logging._uuid} title={`${logging.loan_code} · ${logging.customer?.name ?? ''}`} onClose={() => setLogging(null)} onSaved={reload} />}
    </div>
  );
};

export default CollectionsPage;
