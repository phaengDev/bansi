import { useState } from 'react';
import moment from 'moment';
import { useT } from '../../../context/LanguageContext';
import {
  BUDGET_STATUS, STATUS_ORDER, elapsedOf, kip, percentText, planToDate, statusOf,
  type BudgetData, type BudgetRow, type BudgetStatus, type Unbudgeted,
} from './budgetApi';
import { BudgetProgress, BudgetStatusPill } from './BudgetKit';

type Props = {
  budget: BudgetData;
  /** ປີເປີດຢູ່ ແລະ ມີສິດ — ຕັ້ງ / ແກ້ / ລຶບງົບໄດ້ */
  canAdd: boolean;
  canChange: boolean;
  canRemove: boolean;
  onAdd: (categoryId?: number) => void;
  onEdit: (row: BudgetRow) => void;
  onDelete: (row: BudgetRow) => void;
  onView: (row: BudgetRow | Unbudgeted) => void;
};

/**
 * ຕິດຕາມງົບປະມານຂອງປີ — ຕົວເລກລວມ, ຕາຕະລາງແຕ່ລະປະເພດ (ງົບ / ໃຊ້ແລ້ວ / ຄົງເຫຼືອ / ແຖບຄວາມຄືບໜ້າ + ຂີດຕາມແຜນ / ສະຖານະ)
 * ແລະ ປະເພດທີ່ມີລາຍຈ່າຍແຕ່ຍັງບໍ່ມີງົບ. ກົດແຖວ = ລາຍລະອຽດ + ລາຍຈ່າຍຂອງປະເພດນັ້ນ
 */
const BudgetOverview = ({ budget, canAdd, canChange, canRemove, onAdd, onEdit, onDelete, onView }: Props) => {
  const t = useT();
  const [filter, setFilter] = useState<BudgetStatus | 'all'>('all');
  const { fiscal, data: rows, unbudgeted } = budget;
  const currentMonth = moment().format('YYYY-MM');

  const withStatus = rows.map((r) => ({ row: r, status: statusOf(r.amount, r.actual) }));
  const count = (status: BudgetStatus) => withStatus.filter((r) => r.status === status).length;
  const shown = filter === 'all' ? withStatus : withStatus.filter((r) => r.status === filter);
  const total = rows.reduce((n, r) => n + r.amount, 0);
  const used = rows.reduce((n, r) => n + r.actual, 0);
  const remaining = total - used;
  const elapsed = Math.round(elapsedOf(fiscal) * 100);
  const unbudgetedTotal = unbudgeted.reduce((n, r) => n + r.actual, 0);

  if (!rows.length && !unbudgeted.length) {
    return (
      <div className="acc-class-empty acc-bg-empty">
        <i className="fa-solid fa-bullseye" />
        <p><b>{t('budgetEmpty')}</b></p>
        <p>{t('budgetEmptyHint')}</p>
        {canAdd && (
          <button type="button" className="acc-class-add" onClick={() => onAdd()}>
            <i className="fa-solid fa-plus" /> {t('budgetAdd')}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="acc-rp-kpis">
        <div className="acc-rp-kpi is-main">
          <small>{t('budgetTotal')}</small>
          <b>{kip(total)}</b>
          <em>{rows.length} {t('budgetCategories')}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('budgetUsed')}</small>
          <b>{kip(used)}</b>
          <em className="is-flat">{percentText(total, used)} · {t('budgetYearElapsed')} {elapsed}%</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t(remaining < 0 ? 'budgetOverBy' : 'budgetRemaining')}</small>
          <b className={remaining < 0 ? 'is-out' : 'is-in'}>{kip(Math.abs(remaining))}</b>
          <em className="is-flat">{unbudgetedTotal > 0 ? `+ ${kip(unbudgetedTotal)} ${t('budgetUnbudgetedShort')}` : t('budgetAllCounted')}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('budgetWatch')}</small>
          <b className={count('over') ? 'is-out' : ''}>{count('over') + count('near')}</b>
          <em className={count('over') ? 'is-bad' : 'is-flat'}>
            {count('over')} {t('budgetStatusOver')} · {count('near')} {t('budgetStatusNear')}
          </em>
        </div>
      </div>

      {budget.missing_rate > 0 && (
        <p className="acc-bg-note is-warn">
          <i className="fa-solid fa-triangle-exclamation" /> {budget.missing_rate} {t('budgetMissingRate')}
        </p>
      )}

      {rows.length > 0 && (
        <section className="acc-rp-card acc-bg-card">
          <header>
            <h4><i className="fa-solid fa-list-check" /> {t('budgetByCategory')}</h4>
            <div className="acc-type-segment" role="tablist">
              <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
                {t('all')} <em>{rows.length}</em>
              </button>
              {STATUS_ORDER.filter((s) => count(s)).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={filter === s} className={filter === s ? 'is-active' : ''} onClick={() => setFilter(s)}>
                  {t(BUDGET_STATUS[s].label)} <em>{count(s)}</em>
                </button>
              ))}
            </div>
          </header>
          <div className="acc-rp-scroll">
            <table className="acc-gl-table acc-bg-table">
              <thead>
                <tr>
                  <th>{t('expenseCategory')}</th>
                  <th className="is-num">{t('budgetAmount')}</th>
                  <th className="is-num">{t('budgetUsed')}</th>
                  <th className="is-num">{t('budgetRemaining')}</th>
                  <th className="acc-bg-col-progress">{t('budgetProgress')}</th>
                  <th>{t('status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map(({ row: r, status }) => {
                  const left = r.amount - r.actual;
                  const monthBudget = r.months[currentMonth];
                  return (
                    <tr key={r._uuid} className="is-click" onClick={() => onView(r)}>
                      <td>
                        <span className="acc-bg-cat">
                          <b className="acc-gl-code acc-tone is-coral">{r.category?.type_code ?? '—'}</b>
                          <span>
                            {r.category?.type_name ?? `#${r.category_id}`}
                            <small className="acc-gl-ref">
                              {r.count} {t('journalExpense')}
                              {r.is_monthly === 1 && <> · <i className="fa-solid fa-calendar-days" /> {t('budgetSplitMonthly')}</>}
                              {r.is_monthly === 1 && monthBudget !== undefined && (
                                <> · {t('thisMonth')} {kip(r.actual_months[currentMonth] ?? 0)} / {kip(monthBudget)}</>
                              )}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td className="is-num">{kip(r.amount)}</td>
                      <td className="is-num">{kip(r.actual)}</td>
                      <td className={`is-num is-strong${left < 0 ? ' acc-bg-neg' : ''}`}>{left < 0 ? `−${kip(-left)}` : kip(left)}</td>
                      <td className="acc-bg-col-progress"><BudgetProgress budget={r.amount} used={r.actual} plan={planToDate(r, fiscal)} /></td>
                      <td><BudgetStatusPill status={status} /></td>
                      <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="acc-gl-act" disabled={!canChange} title={t('edit')} onClick={() => onEdit(r)}>
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button type="button" className="acc-gl-act is-danger" disabled={!canRemove} title={t('delete')} onClick={() => onDelete(r)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && <tr className="is-empty"><td colSpan={7}>{t('noData')}</td></tr>}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t('total')}</td>
                  <td className="is-num">{kip(total)}</td>
                  <td className="is-num">{kip(used)}</td>
                  <td className={`is-num${remaining < 0 ? ' acc-bg-neg' : ''}`}>{remaining < 0 ? `−${kip(-remaining)}` : kip(remaining)}</td>
                  <td className="acc-bg-col-progress"><BudgetProgress budget={total} used={used} /></td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="acc-bg-note">
            <i className="fa-solid fa-circle-info" /> {t('budgetNote')} <span className="acc-bg-plan-key" /> {t('budgetPlanMarker')}
          </p>
        </section>
      )}

      {unbudgeted.length > 0 && (
        <section className="acc-rp-card">
          <header>
            <h4><i className="fa-solid fa-circle-question" /> {t('budgetUnbudgeted')}</h4>
            <small>{t('budgetUnbudgetedHint')}</small>
          </header>
          {unbudgeted.map((r) => (
            <div key={r.category_id} className="acc-arap-watch is-click" onClick={() => onView(r)}>
              <b className="acc-gl-code acc-tone is-coral">{r.category?.type_code ?? '—'}</b>
              <span className="acc-arap-watch-text">
                <b>{r.category?.type_name ?? `#${r.category_id}`}</b>
                <small>{r.count} {t('journalExpense')}</small>
              </span>
              <span className="acc-arap-watch-amount">{kip(r.actual)}</span>
              {canAdd && (
                <button type="button" className="acc-rp-btn" onClick={(e) => {
                  e.stopPropagation();
                  onAdd(r.category_id);
                }}
                >
                  <i className="fa-solid fa-bullseye" /> {t('budgetSetFor')}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
};

export default BudgetOverview;
