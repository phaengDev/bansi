import { useEffect, useState } from 'react';
import { Loader, Modal } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { useT } from '../../../context/LanguageContext';
import { kip, monthLabel, planToDate, statusOf, type BudgetData, type BudgetRow, type Unbudgeted } from './budgetApi';
import { BudgetProgress, BudgetStatusPill } from './BudgetKit';

type BudgetExpense = {
  _uuid: number;
  number: string;
  expense_date: string;
  expense_title: string;
  payee_name: string | null;
  account_name: string | null;
  currency: { _id: number; name: string; genus: string | null } | null;
  balance_expense: number;
  /** null = ສະກຸນນີ້ຍັງບໍ່ມີອັດຕາແລກປ່ຽນ (ບໍ່ໄດ້ນັບໃນງົບ) */
  amount_lak: number | null;
};

/**
 * ລາຍລະອຽດງົບຂອງປະເພດໜຶ່ງ — ສະຫຼຸບ, ແຖບລາຍເດືອນ (ໃຊ້ຈິງ ທຽບ ງົບເດືອນ) ແລະ ລາຍຈ່າຍທັງໝົດໃນປີ (POST /budget/expenses).
 * row ທີ່ບໍ່ມີ _uuid = ປະເພດທີ່ຍັງບໍ່ມີງົບ
 */
const BudgetDetail = ({ row, budget, onClose }: { row: BudgetRow | Unbudgeted; budget: BudgetData; onClose: () => void }) => {
  const t = useT();
  const [list, setList] = useState<BudgetExpense[] | null>(null);
  const [error, setError] = useState('');
  const planned = '_uuid' in row ? row : null;
  const amount = planned?.amount ?? 0;
  const status = planned ? statusOf(amount, row.actual) : null;
  const peak = Math.max(1, ...budget.months.map((m) => Math.max(row.actual_months[m] ?? 0, planned?.months[m] ?? 0)));
  const currentMonth = moment().format('YYYY-MM');

  useEffect(() => {
    postApi('/budget/expenses', { fiscal_id: budget.fiscal._uuid, category_id: row.category_id })
      .then((res) => setList(res.data?.data ?? []))
      .catch((err) => setError(getErrorMessage(err)));
  }, [budget.fiscal._uuid, row.category_id]);

  return (
    <Modal open onClose={onClose} size="md" className="acc-gl-ledger-modal acc-bg-detail">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <span className="acc-gl-group-icon acc-tone is-gold"><i className="fa-solid fa-bullseye" /></span>
          <span>
            <Modal.Title>
              {row.category ? `${row.category.type_code} ${row.category.type_name}` : `#${row.category_id}`}{' '}
              {status && <BudgetStatusPill status={status} />}
            </Modal.Title>
            <small>{budget.fiscal.fiscal_name || budget.fiscal.fiscal_code} · {row.count} {t('journalExpense')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="acc-bg-detail-sum">
          <span><small>{t('budgetAmount')}</small><b>{planned ? kip(amount) : '—'}</b></span>
          <span><small>{t('budgetUsed')}</small><b>{kip(row.actual)}</b></span>
          <span className={planned && row.actual > amount ? 'is-bad' : ''}>
            <small>{t(planned && row.actual > amount ? 'budgetOverBy' : 'budgetRemaining')}</small>
            <b>{planned ? kip(Math.abs(amount - row.actual)) : '—'}</b>
          </span>
        </div>
        {planned && <BudgetProgress budget={amount} used={row.actual} plan={planToDate(planned, budget.fiscal)} />}
        {planned?.description && <p className="acc-arap-desc mt-2">{planned.description}</p>}

        <div className="acc-bg-mini" style={{ gridTemplateColumns: `repeat(${budget.months.length}, minmax(0, 1fr))` }}>
          {budget.months.map((m) => {
            const used = row.actual_months[m] ?? 0;
            const plan = planned?.is_monthly ? planned.months[m] ?? 0 : null;
            return (
              <span key={m} className={`acc-bg-mini-col${m === currentMonth ? ' is-now' : ''}`}
                title={`${monthLabel(m)} · ${t('budgetUsed')} ${kip(used)}${plan !== null ? ` / ${kip(plan)}` : ''}`}
              >
                <span className="acc-bg-mini-track">
                  {plan !== null && plan > 0 && <em style={{ bottom: `${(plan / peak) * 100}%` }} />}
                  <i className={plan !== null && used > plan ? 'is-over' : ''} style={{ height: `${(used / peak) * 100}%` }} />
                </span>
                <small>{monthLabel(m).slice(0, 2)}</small>
              </span>
            );
          })}
        </div>

        <h6 className="acc-bg-detail-title">{t('budgetExpenses')}</h6>
        {error ? (
          <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
        ) : !list ? (
          <div className="text-center py-4"><Loader size="sm" content={t('loadingDots')} /></div>
        ) : !list.length ? (
          <p className="acc-arap-empty">{t('budgetNoExpenses')}</p>
        ) : (
          <div className="acc-rp-scroll">
            <table className="acc-gl-table is-compact">
              <thead>
                <tr>
                  <th>{t('expenseDate')}</th>
                  <th>{t('expenseTitle')}</th>
                  <th className="is-num">{t('fsAmount')}</th>
                  <th className="is-num">LAK</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const base = !e.currency || e.currency.name === 'LAK';
                  return (
                    <tr key={e._uuid}>
                      <td>
                        {moment(e.expense_date).format('DD/MM/YYYY')}
                        <small className="acc-gl-ref">{e.number}</small>
                      </td>
                      <td>
                        {e.expense_title}
                        <small className="acc-gl-ref">{[e.payee_name, e.account_name].filter(Boolean).join(' · ')}</small>
                      </td>
                      <td className="is-num">{`${e.currency?.genus ?? ''} ${formatNumber(e.balance_expense)}`.trim()}</td>
                      <td className="is-num is-strong">
                        {e.amount_lak === null
                          ? <span className="acc-gl-ref is-bad">{t('budgetNoRate')}</span>
                          : base ? formatNumber(e.amount_lak) : formatNumber(Math.round(e.amount_lak))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default BudgetDetail;
