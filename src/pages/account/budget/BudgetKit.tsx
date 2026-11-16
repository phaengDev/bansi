import type { ReactNode } from 'react';
import { useT } from '../../../context/LanguageContext';
import {
  BUDGET_STATUS, kip, percentOf, percentText, statusOf,
  type BudgetCheck, type BudgetRow, type BudgetStatus, type Unbudgeted,
} from './budgetApi';

export const BudgetStatusPill = ({ status }: { status: BudgetStatus }) => {
  const t = useT();
  const s = BUDGET_STATUS[status];
  return (
    <span className={`acc-bg-status is-${status}`}>
      <i className={`fa-solid ${s.icon}`} /> {t(s.label)}
    </span>
  );
};

/** ປ້າຍລາຍການຍ່ອຍທີ່ງົບຜູກ (› ຄ່ານ້ຳ) — payroll = ແຖວເງິນເດືອນ (ບໍ່ມີລາຍການຍ່ອຍ) */
export const BudgetSubTag = ({ name, payroll }: { name?: string | null; payroll?: boolean }) => {
  const t = useT();
  if (!name && !payroll) return null;
  return (
    <em className={`acc-bg-sub${payroll ? ' is-payroll' : ''}`}>
      <i className={`fa-solid ${payroll ? 'fa-users' : 'fa-angle-right'}`} /> {name ?? t('expenseFromPayroll')}
    </em>
  );
};

/**
 * ຊື່ງົບໃນຕາຕະລາງ (ຕິດຕາມງົບ, ລາຍເດືອນ) — ລະຫັດ + ຊື່ປະເພດ + ປ້າຍລາຍການຍ່ອຍ; children = ແຖວຂໍ້ຄວາມນ້ອຍລຸ່ມຊື່
 */
export const BudgetName = ({ row, children }: { row: BudgetRow | Unbudgeted; children?: ReactNode }) => (
  <span className="acc-bg-cat">
    <b className="acc-gl-code acc-tone is-coral">{row.category?.type_code ?? '—'}</b>
    <span>
      {row.category?.type_name ?? `#${row.category_id}`}
      <BudgetSubTag name={row.sub?.name} payroll={'payroll' in row && row.payroll} />
      {children && <small className="acc-gl-ref">{children}</small>}
    </span>
  </span>
);

/**
 * ແຖບຄວາມຄືບໜ້າ — ສີຕາມສະຖານະ, ເກີນງົບ = ເຕັມແຖບ; plan = ງົບທີ່ຄວນໃຊ້ຮອດມື້ນີ້ (ຂີດຕັ້ງ) —
 * ແຖບຍາວກາຍຂີດ = ໃຊ້ໄວກວ່າແຜນ
 */
export const BudgetBar = ({ budget, used, plan }: { budget: number; used: number; plan?: number }) => {
  const t = useT();
  const status = statusOf(budget, used);
  const planPct = budget > 0 && plan !== undefined ? Math.min(100, (plan / budget) * 100) : null;
  return (
    <span className={`acc-bg-bar is-${status}`}>
      <i style={{ width: `${Math.min(100, percentOf(budget, used))}%` }} />
      {planPct !== null && planPct > 0 && planPct < 100 && (
        <em style={{ left: `${planPct}%` }} title={`${t('budgetPlanMarker')}: ${kip(plan!)}`} />
      )}
    </span>
  );
};

/** ແຖບ + % + ສະຖານະ ໃນແຖວດຽວ (ຕາຕະລາງ, ລາຍລະອຽດ) */
export const BudgetProgress = ({ budget, used, plan }: { budget: number; used: number; plan?: number }) => (
  <span className="acc-bg-progress">
    <BudgetBar budget={budget} used={used} plan={plan} />
    <b>{percentText(budget, used)}</b>
  </span>
);

/**
 * ງົບຂອງປະເພດທີ່ເລືອກ ໃນຟອມລາຍຈ່າຍ (POST /budget/check) — ໃຊ້ແລ້ວ / ງົບ, ຍອດເຫຼືອຫຼັງຈ່າຍ ແລະ ຄຳເຕືອນເກີນງົບ
 * (ທັງປີ ແລະ ເດືອນ ສຳລັບງົບທີ່ແບ່ງລາຍເດືອນ). ເຕືອນເທົ່ານັ້ນ — ບັນທຶກໄດ້ຄືເກົ່າ
 */
export const BudgetHint = ({ check }: { check: BudgetCheck | null }) => {
  const t = useT();
  if (!check) return null;
  if (!check.has_budget) {
    return (
      <p className="acc-bg-hint is-none">
        <i className="fa-solid fa-bullseye" /> {t('expenseBudgetNone')}{check.fiscal_code ? ` ${check.fiscal_code}` : ''}
      </p>
    );
  }
  const adding = check.amount_lak ?? 0;
  const yearOver = check.after < 0;
  const monthOver = !!check.month && check.month.after < 0;
  const over = yearOver || monthOver;
  return (
    <div className={`acc-bg-hint${over ? ' is-over' : ''}`}>
      <div className="acc-bg-hint-head">
        <span><i className="fa-solid fa-bullseye" /> {t('accountAppBudget')} {check.fiscal_code} <BudgetSubTag name={check.sub_name} /></span>
        <b>{kip(check.used + adding)} / {kip(check.budget)}</b>
      </div>
      <BudgetBar budget={check.budget} used={check.used + adding} />
      <div className="acc-bg-hint-rows">
        <span><small>{t('budgetUsed')}</small> {kip(check.used)}</span>
        {adding > 0 && <span><small>{t('expenseBudgetThis')}</small> {kip(adding)}</span>}
        <span className={yearOver ? 'is-bad' : ''}>
          <small>{t(yearOver ? 'budgetOverBy' : 'expenseBudgetAfter')}</small> {kip(Math.abs(check.after))}
        </span>
        {check.month && (
          <span className={monthOver ? 'is-bad' : ''}>
            <small>{t('thisMonth')} ({kip(check.month.budget)})</small>
            {t(monthOver ? 'budgetOverBy' : 'budgetRemaining')} {kip(Math.abs(check.month.after))}
          </span>
        )}
      </div>
      {check.amount_lak === null && (
        <p><i className="fa-solid fa-circle-info" /> {t('expenseBudgetNoRate')}</p>
      )}
      {over && (
        <p><i className="fa-solid fa-triangle-exclamation" /> {t(yearOver ? 'expenseBudgetOver' : 'expenseBudgetMonthOver')}</p>
      )}
    </div>
  );
};
