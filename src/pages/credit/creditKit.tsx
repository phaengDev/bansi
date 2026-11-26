import type { ReactNode } from 'react';
import { useT } from '../../context/LanguageContext';
import { formatNumber } from '../../utils/configApi';
import { useCurrency } from '../../utils/selectOption';
import { money, showDate } from '../account/loans/loanApi';
import {
  APP_STATUS, FREQUENCIES, RISK_LEVELS, collateralTypeOf, frequencyOf, useCreditList,
  type ClassRule, type Collateral, type CreditCustomer, type CreditProduct, type Guarantor,
} from './creditApi';

/** ປ້າຍສະຖານະຄຳຮ້ອງ — ລໍຖ້າພິຈາລະນາ ບອກຂັ້ນທີ່ກຳລັງລໍ (ຂັ້ນ 2/3) */
export const AppStatusChip = ({ status, level, levels }: { status: number; level?: number; levels?: number }) => {
  const t = useT();
  const s = APP_STATUS[status] ?? APP_STATUS[1];
  return (
    <span className={`cr-status ${s.tone}`}>
      <i className={`fa-solid ${s.icon}`} /> {t(s.label)}
      {status === 2 && levels && levels > 1 ? <small>{t('crLevelOf').replace('{n}', String((level ?? 0) + 1)).replace('{m}', String(levels))}</small> : null}
    </span>
  );
};

export const RiskChip = ({ level }: { level: number }) => {
  const t = useT();
  const r = RISK_LEVELS.find((x) => x.value === Number(level)) ?? RISK_LEVELS[0];
  return <span className={`cr-risk ${r.tone}`}><i className="fa-solid fa-signal" /> {t(r.label)}</span>;
};

/** ໄລຍະເວລາ ຕາມໄລຍະຈ່າຍ — 52 ງວດ ທຸກອາທິດ → "52 ງວດ · ທຸກອາທິດ" */
export const creditTermText = (term: number, days: number | null | undefined, months: number, t: (key: string) => string) =>
  `${term} ${t('lnInstallments')} · ${t(frequencyOf(days, months).label)}`;

/** ອັດຕາຕໍ່ປີ → ຕໍ່ເດືອນ (ສະຖາບັນການເງິນຂະໜາດນ້ອຍມັກບອກເປັນ % ຕໍ່ເດືອນ) */
export const monthlyRate = (annual: number) => Math.round((annual / 12) * 100) / 100;

/** ຜະລິດຕະພັນ + ເກນຈັດຊັ້ນໜີ້ (GET /credit/product) */
export const useCreditProducts = () => {
  const list = useCreditList<CreditProduct>('/credit/product');
  return { ...list, rules: (list.extra.class_rules as ClassRule[] | undefined) ?? [] };
};

/** ລູກຄ້າທັງໝົດ + ລະຫັດຖັດໄປ (GET /credit/customer) */
export const useCreditCustomers = () => {
  const list = useCreditList<CreditCustomer>('/credit/customer');
  return { ...list, nextCode: String(list.extra.next_code ?? '') };
};

/** ສັນຍາລັກສະກຸນຂອງຜະລິດຕະພັນ (ບໍ່ມີ = ກີບ) */
export const useProductCurrency = (currencyId: number | null | undefined) => {
  const currencies = useCurrency();
  const c = currencies.find((x) => x.value === Number(currencyId)) ?? currencies.find((x) => x.label === 'LAK');
  return { genus: c?.genus ?? '₭', name: c?.label ?? 'LAK' };
};

/** ແຖວ "ຫົວຂໍ້ : ຄ່າ" ໃນບັດຂໍ້ມູນ (ລາຍລະອຽດລູກຄ້າ / ຄຳຮ້ອງ / ສັນຍາ) — ຄ່າຫວ່າງ = ບໍ່ສະແດງແຖວ */
export const InfoRows = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="cr-info">
    {rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
      <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
    ))}
  </dl>
);

/** ບັດສະຫຼຸບເງື່ອນໄຂຂອງຜະລິດຕະພັນ (ວົງເງິນ, ງວດ, ດອກເບ້ຍ, ຄ່າທຳນຽມ, ຄ່າປັບ) */
export const productFacts = (p: CreditProduct, cur: { genus?: string | null; name?: string | null }, t: (key: string) => string) => [
  { icon: 'fa-coins', text: `${money(p.min_amount, cur)} – ${money(p.max_amount, cur)}` },
  { icon: 'fa-list-ol', text: `${p.min_term}–${p.max_term} ${t('lnInstallments')} · ${t(frequencyOf(p.frequency_days, p.frequency_months).label)}` },
  { icon: 'fa-percent', text: `${p.annual_rate}% ${t('lnPerYear')} (${monthlyRate(p.annual_rate)}% ${t('crPerMonth')})` },
  ...(p.upfront_fee_rate || p.upfront_fee_fixed
    ? [{ icon: 'fa-receipt', text: `${t('crFee')} ${[p.upfront_fee_rate ? `${p.upfront_fee_rate}%` : '', p.upfront_fee_fixed ? money(p.upfront_fee_fixed, cur) : ''].filter(Boolean).join(' + ')}` }]
    : []),
  ...(p.penalty_rate ? [{ icon: 'fa-gavel', text: `${t('crPenalty')} ${p.penalty_rate}% / ${t('crDay')}${p.grace_days ? ` · ${t('crGraceN').replace('{n}', String(p.grace_days))}` : ''}` }] : []),
];

/** ສະຖານະຫຼັກຊັບ: 1 ຖືຢູ່, 2 ສົ່ງຄືນແລ້ວ, 3 ຍຶດ */
const COLLATERAL_STATUS: Record<number, { label: string; tone: string; icon: string }> = {
  1: { label: 'crColHeld', tone: 'is-held', icon: 'fa-vault' },
  2: { label: 'crColReturned', tone: 'is-returned', icon: 'fa-rotate-left' },
  3: { label: 'crColSeized', tone: 'is-seized', icon: 'fa-gavel' },
};

/**
 * ລາຍການຫຼັກຊັບຄ້ຳປະກັນ — ໃຊ້ຮ່ວມ: ລາຍລະອຽດລູກຄ້າ (ມີປຸ່ມ), ຄຳຮ້ອງ ແລະ ສັນຍາ (ອ່ານຢ່າງດຽວ).
 * actions(c) = ປຸ່ມທ້າຍແຖວ (ແກ້ໄຂ / ສົ່ງຄືນ / ຍຶດ / ລຶບ)
 */
export const CollateralList = ({ rows, actions, empty }: { rows: Collateral[]; actions?: (c: Collateral) => ReactNode; empty?: ReactNode }) => {
  const t = useT();
  if (!rows.length) return <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-house-lock" /><p>{empty ?? t('crNoCollateral')}</p></div>;
  return (
    <div className="cr-collaterals">
      {rows.map((c) => {
        const type = collateralTypeOf(c.collateral_type);
        const st = COLLATERAL_STATUS[Number(c.status)] ?? COLLATERAL_STATUS[1];
        return (
          <article key={c._uuid} className={`cr-collateral${Number(c.status) !== 1 ? ' is-off' : ''}`}>
            <span className="cr-collateral-icon"><i className={`fa-solid ${type.icon}`} /></span>
            <div className="cr-collateral-body">
              <b>{c.description}</b>
              <small>
                {[c.collateral_code, t(type.label), c.document_no, c.owner_name].filter(Boolean).join(' · ')}
              </small>
              <span className={`cr-col-status ${st.tone}`}><i className={`fa-solid ${st.icon}`} /> {t(st.label)}{c.returned_date ? ` ${showDate(c.returned_date)}` : ''}</span>
            </div>
            <div className="cr-collateral-value">
              <b>₭ {formatNumber(c.appraised_value)}</b>
              <small>{t('crAppraisedShort')}{c.market_value ? ` · ${t('crMarketShort')} ${formatNumber(c.market_value)}` : ''}</small>
            </div>
            {actions && <div className="acc-fa-actions">{actions(c)}</div>}
          </article>
        );
      })}
    </div>
  );
};

/** ຜູ້ຄ້ຳປະກັນ (ອ່ານຢ່າງດຽວ) */
export const GuarantorList = ({ rows }: { rows: Guarantor[] }) => {
  const t = useT();
  if (!rows.length) return <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-user-shield" /><p>{t('crNoGuarantor')}</p></div>;
  return (
    <div className="cr-collaterals">
      {rows.map((g, i) => (
        <article key={g._uuid ?? i} className="cr-collateral">
          <span className="cr-collateral-icon is-person"><i className="fa-solid fa-user-shield" /></span>
          <div className="cr-collateral-body">
            <b>{g.full_name}</b>
            <small>{[g.relationship, g.phone, g.id_no, g.occupation].filter(Boolean).join(' · ')}</small>
          </div>
          {g.monthly_income > 0 && (
            <div className="cr-collateral-value"><b>₭ {formatNumber(g.monthly_income)}</b><small>{t('crMonthlyIncome')}</small></div>
          )}
        </article>
      ))}
    </div>
  );
};

/** ແຖບ (tab) ໃນລາຍລະອຽດ — ໄອຄອນ + ຊື່ + ຈຳນວນ */
export const DetailTabs = <K extends string>({ tabs, value, onChange }: {
  tabs: { key: K; icon: string; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
}) => (
  <div className="acc-type-segment cr-tabs" role="tablist">
    {tabs.map((tab) => (
      <button key={tab.key} type="button" role="tab" aria-selected={value === tab.key} className={value === tab.key ? 'is-active' : ''} onClick={() => onChange(tab.key)}>
        <i className={`fa-solid ${tab.icon}`} /> {tab.label}{tab.count !== undefined && <em>{tab.count}</em>}
      </button>
    ))}
  </div>
);

export { FREQUENCIES };
