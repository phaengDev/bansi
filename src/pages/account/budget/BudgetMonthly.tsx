import moment from 'moment';
import { formatNumber } from '../../../utils/configApi';
import { useT } from '../../../context/LanguageContext';
import { kip, monthLabel, statusOf, type BudgetData, type BudgetRow, type Unbudgeted } from './budgetApi';

const num = (value: number | undefined) => (value ? formatNumber(Math.round(value)) : '–');

/**
 * ງົບ ທຽບ ໃຊ້ຈິງ ລາຍເດືອນ — ແຖວ = ປະເພດລາຍຈ່າຍ, ຖັນ = ເດືອນຂອງປີການເງິນ. ງົບທີ່ແບ່ງລາຍເດືອນ: ຕົວໃຫຍ່ = ໃຊ້ຈິງ,
 * ຕົວນ້ອຍ = ງົບເດືອນ, ສີຕາມສະຖານະຂອງເດືອນນັ້ນ; ງົບທັງປີ ແລະ ປະເພດທີ່ບໍ່ມີງົບ ສະແດງແຕ່ຍອດໃຊ້ຈິງ
 */
const BudgetMonthly = ({ budget, onView }: { budget: BudgetData; onView: (row: BudgetRow | Unbudgeted) => void }) => {
  const t = useT();
  const { months, data: rows, unbudgeted } = budget;
  const currentMonth = moment().format('YYYY-MM');
  const all: (BudgetRow | Unbudgeted)[] = [...rows, ...unbudgeted];

  if (!all.length) {
    return <div className="acc-class-empty"><i className="fa-solid fa-calendar-days" /><p>{t('budgetEmpty')}</p></div>;
  }

  const actualOf = (m: string) => all.reduce((n, r) => n + (r.actual_months[m] ?? 0), 0);
  const plannedOf = (m: string) => rows.reduce((n, r) => n + (r.is_monthly ? r.months[m] ?? 0 : 0), 0);
  const hasMonthly = rows.some((r) => r.is_monthly);
  const colClass = (m: string) => (m === currentMonth ? ' is-now' : m > currentMonth ? ' is-future' : '');

  return (
    <section className="acc-rp-card acc-bg-card">
      <header>
        <h4><i className="fa-solid fa-calendar-days" /> {t('budgetMonthly')}</h4>
        <small>{t('budgetMonthlyNote')}</small>
      </header>
      <div className="acc-rp-scroll">
        <table className="acc-gl-table acc-bg-matrix">
          <thead>
            <tr>
              <th>{t('expenseCategory')}</th>
              {months.map((m) => <th key={m} className={`is-num${colClass(m)}`}>{monthLabel(m)}</th>)}
              <th className="is-num">{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {all.map((r) => {
              const planned = '_uuid' in r ? r : null;
              return (
                <tr key={r.category_id} className={`is-click${planned ? '' : ' is-loose'}`} onClick={() => onView(r)}>
                  <td>
                    <span className="acc-bg-cat">
                      <b className="acc-gl-code acc-tone is-coral">{r.category?.type_code ?? '—'}</b>
                      <span>
                        {r.category?.type_name ?? `#${r.category_id}`}
                        {!planned && <small className="acc-gl-ref">{t('budgetUnbudgetedShort')}</small>}
                      </span>
                    </span>
                  </td>
                  {months.map((m) => {
                    const used = r.actual_months[m] ?? 0;
                    const plan = planned?.is_monthly ? planned.months[m] ?? 0 : null;
                    const state = plan !== null && (plan > 0 || used > 0) ? ` is-${statusOf(plan, used)}` : '';
                    return (
                      <td key={m} className={`is-num acc-bg-cell${state}${colClass(m)}`}>
                        <b>{num(used)}</b>
                        {plan !== null && <small>/ {num(plan)}</small>}
                      </td>
                    );
                  })}
                  <td className="is-num is-strong">
                    {num(r.actual)}
                    {planned && <small className="acc-gl-ref">/ {num(planned.amount)}</small>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>{t('budgetUsed')}</td>
              {months.map((m) => <td key={m} className={`is-num${colClass(m)}`}>{num(actualOf(m))}</td>)}
              <td className="is-num">{kip(all.reduce((n, r) => n + r.actual, 0))}</td>
            </tr>
            {hasMonthly && (
              <tr className="acc-bg-matrix-plan">
                <td>{t('budgetMonthlyPlanned')}</td>
                {months.map((m) => <td key={m} className={`is-num${colClass(m)}`}>{num(plannedOf(m))}</td>)}
                <td className="is-num">{kip(months.reduce((n, m) => n + plannedOf(m), 0))}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </section>
  );
};

export default BudgetMonthly;
