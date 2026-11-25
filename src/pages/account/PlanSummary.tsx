import { useEffect, useRef, useState } from 'react';
import moment from 'moment';
import { useLanguage, useT } from '../../context/LanguageContext';
import { PLAN_MODULES, PLAN_WARN_DAYS, useCompanyPlan, type CompanyPlan } from './companyPlan';

type T = (key: string) => string;

/** ສະຖານະຂອງແພັກເກດ: ໂທນສີ + ຂໍ້ຄວາມສັ້ນ (ປ້າຍ taskbar) + ຂໍ້ຄວາມເຕັມ */
const statusOf = (plan: CompanyPlan, t: T) => {
  const date = plan.expires_at ? moment(plan.expires_at, 'YYYY-MM-DD').format('DD/MM/YYYY') : '';
  const days = plan.days_left ?? 0;
  if (plan.expired) {
    return { tone: 'is-over', icon: 'fa-lock', short: t('planExpiredShort'), text: t('planExpiredText').replace('{date}', date) };
  }
  if (plan.days_left === null) return { tone: 'is-ok', icon: 'fa-infinity', short: '', text: t('planNoExpiry') };
  const left = days === 0 ? t('planLastDay') : t('planDaysLeft').replace('{n}', String(days));
  return {
    tone: plan.trial ? 'is-trial' : days <= PLAN_WARN_DAYS ? 'is-warn' : 'is-ok',
    icon: plan.trial ? 'fa-flask' : 'fa-hourglass-half',
    short: plan.trial ? `${t('planTrial')} · ${left}` : left,
    text: `${plan.trial ? `${t('planTrial')} · ` : ''}${t('planUntil').replace('{date}', date)} · ${left}`,
  };
};

const Usage = ({ icon, label, used, limit }: { icon: string; label: string; used: number; limit: number | null }) => {
  const t = useT();
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className={`acc-plan-usage${limit !== null && used >= limit ? ' is-full' : ''}`}>
      <span><i className={`fa-solid ${icon}`} /> {label}</span>
      <b>{used}{limit !== null ? <small> / {limit}</small> : <small> · {t('planUnlimited')}</small>}</b>
      {limit !== null && <span className="acc-plan-usage-bar"><span style={{ width: `${percent}%` }} /></span>}
    </div>
  );
};

/** ລາຍລະອຽດແພັກເກດ: ຊື່, ສະຖານະ / ວັນໝົດອາຍຸ, ໂມດູນທີ່ມີ ແລະ ບໍ່ມີ, ຈຳນວນບັນຊີ / ພະນັກງານ ທີ່ໃຊ້ */
export const PlanSummary = ({ plan }: { plan: CompanyPlan }) => {
  const t = useT();
  const { lang } = useLanguage();
  const status = statusOf(plan, t);
  const name = plan.package ? (lang === 'la' ? plan.package.name_la : plan.package.name_en || plan.package.name_la) : t('planAllModules');
  return (
    <div className="acc-plan">
      <div className="acc-plan-head">
        <span className="acc-plan-name">
          <small>{t('planPackage')}</small>
          <b>{name}</b>
        </span>
        <span className={`acc-plan-status ${status.tone}`}><i className={`fa-solid ${status.icon}`} /> {status.text}</span>
      </div>
      <ul className="acc-plan-modules">
        {PLAN_MODULES.map((m) => {
          const on = plan.modules.includes(m.code);
          return (
            <li key={m.code} className={on ? 'is-on' : 'is-off'} title={on ? undefined : t('planNotIncluded')}>
              <i className={`fa-solid ${m.icon}`} />
              <span>{t(m.label)}</span>
              <i className={`fa-solid ${on ? 'fa-circle-check' : 'fa-lock'} acc-plan-mark`} />
            </li>
          );
        })}
      </ul>
      <div className="acc-plan-usages">
        <Usage icon="fa-user-shield" label={t('planUsers')} used={plan.usage.users} limit={plan.limits.users} />
        <Usage icon="fa-id-card" label={t('planEmployees')} used={plan.usage.employees} limit={plan.limits.employees} />
      </div>
      {(plan.expired || plan.trial || (plan.days_left !== null && plan.days_left <= PLAN_WARN_DAYS)) && (
        <p className={`acc-plan-note ${status.tone}`}>
          <i className="fa-solid fa-circle-info" /> {t(plan.expired ? 'planExpiredNote' : plan.trial ? 'planTrialNote' : 'planRenewNote')}
        </p>
      )}
    </div>
  );
};

/** ບັດແພັກເກດໃນໜ້າຂໍ້ມູນບໍລິສັດ — server ທີ່ບໍ່ມີແພັກເກດ = ບໍ່ສະແດງ */
export const CompanyPlanCard = () => {
  const t = useT();
  const plan = useCompanyPlan();
  if (!plan) return null;
  return (
    <section className="acc-book-step hr-company-card acc-plan-card">
      <header>
        <span className="hr-company-card-icon"><i className="fa-solid fa-box-open" /></span>
        <span className="acc-book-step-title"><b>{t('planTitle')}</b><small>{t('planHint')}</small></span>
      </header>
      <PlanSummary plan={plan} />
    </section>
  );
};

/**
 * ປ້າຍແພັກເກດໃນ taskbar (ຂ້າງປະຕິທິນ) — ຂຶ້ນສະເພາະຕອນທົດລອງໃຊ້, ໃກ້ໝົດອາຍຸ (≤ PLAN_WARN_DAYS ມື້) ຫຼື ໝົດແລ້ວ;
 * ກົດ = ເບິ່ງລາຍລະອຽດ (ທຸກຄົນເຫັນ ບໍ່ຂຶ້ນກັບສິດເມນູ)
 */
export const PlanBadge = () => {
  const t = useT();
  const plan = useCompanyPlan();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!plan || !(plan.trial || plan.expired || (plan.days_left !== null && plan.days_left <= PLAN_WARN_DAYS))) return null;
  const status = statusOf(plan, t);
  return (
    <div className="life-taskbar-plan" ref={ref}>
      <button type="button" className={`life-taskbar-plan-btn ${status.tone}${open ? ' is-active' : ''}`}
        aria-haspopup="dialog" aria-expanded={open} title={status.text} onClick={() => setOpen((v) => !v)}
      >
        <i className={`fa-solid ${status.icon}`} aria-hidden="true" /> <span>{status.short}</span>
      </button>
      {open && (
        <div className="life-plan-panel" role="dialog" aria-label={t('planPackage')}>
          <PlanSummary plan={plan} />
        </div>
      )}
    </div>
  );
};
