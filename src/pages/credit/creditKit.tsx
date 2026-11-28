import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '../../context/LanguageContext';
import { formatNumber, getApi } from '../../utils/configApi';
import { useCurrency } from '../../utils/selectOption';
import { LOAN_METHODS, money, showDate } from '../account/loans/loanApi';
import { SearchBox } from '../account/setting/settingKit';
import {
  APP_STATUS, BORROWER_TYPES, FREQUENCIES, RISK_LEVELS, collateralTypeOf, frequencyOf, useCreditList,
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
export const InfoRows = ({ rows }: { rows: [string, ReactNode][] }) => {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false);
  // ບໍ່ມີຂໍ້ມູນຈັກແຖວ = ບໍ່ສະແດງບັດເປົ່າ (ບັດອື່ນໃນ .cr-split ຂະຫຍາຍເຕັມແຖວ)
  if (!shown.length) return null;
  return (
    <dl className="cr-info">
      {shown.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
};

/**
 * ເງື່ອນໄຂຫຼັກຂອງຜະລິດຕະພັນ — 6 ຂໍ້ສະເໝີ (ບໍ່ມີ = "ບໍ່ມີ") ໃຫ້ບັດທຸກໃບຮຽງກັນເປັນຕາລາງ: ວົງເງິນ, ງວດ, ດອກເບ້ຍ, ຄ່າທຳນຽມ, ຄ່າປັບ, ການອະນຸມັດ
 */
export const productFacts = (p: CreditProduct, cur: { genus?: string | null; name?: string | null }, t: (key: string) => string) => {
  const method = LOAN_METHODS.find((m) => m.value === Number(p.method));
  const fee = [p.upfront_fee_rate ? `${p.upfront_fee_rate}%` : '', p.upfront_fee_fixed ? money(p.upfront_fee_fixed, cur) : ''].filter(Boolean).join(' + ');
  const borrower = BORROWER_TYPES.find((b) => b.value === Number(p.borrower_type));
  // ວົງເງິນຍາວ (10,000,000 – 300,000,000) ບໍ່ພໍບັດ → "10 – 300 ລ້ານ"; ຕົວເລກເຕັມຢູ່ໃນ title
  const fullRange = `${formatNumber(p.min_amount)} – ${formatNumber(p.max_amount)}`;
  const million = (n: number) => `${formatNumber(Math.round((n / 1e6) * 100) / 100)}`;
  const range = fullRange.length <= 22 ? fullRange
    : p.min_amount >= 1e6 ? `${million(p.min_amount)} – ${million(p.max_amount)} ${t('crMillion')}`
      : `${formatNumber(p.min_amount)} – ${million(p.max_amount)} ${t('crMillion')}`;
  return [
    { icon: 'fa-coins', label: t('crFactAmount'), value: range, title: fullRange, sub: cur.name ?? 'LAK' },
    { icon: 'fa-list-ol', label: t('crFactTerm'), value: `${p.min_term}–${p.max_term} ${t('lnInstallments')}`, sub: t(frequencyOf(p.frequency_days, p.frequency_months).label) },
    { icon: 'fa-percent', label: t('crFactRate'), value: `${p.annual_rate}% / ${t('lnYear')}`, sub: `${monthlyRate(p.annual_rate)}% / ${t('crMonthShort')}${method ? ` · ${t(method.label)}` : ''}` },
    { icon: 'fa-receipt', label: t('crFee'), value: fee || t('crNone'), sub: p.prepayment_fee_rate ? `${t('crPrepayShort')} ${p.prepayment_fee_rate}%` : '' },
    { icon: 'fa-gavel', label: t('crPenalty'), value: p.penalty_rate ? `${p.penalty_rate}% / ${t('crDay')}` : t('crNone'), sub: p.penalty_rate && p.grace_days ? t('crGraceN').replace('{n}', String(p.grace_days)) : '' },
    { icon: 'fa-users', label: t('crFactApproval'), value: t('crLevelsN').replace('{n}', String(p.approval_levels)), sub: borrower ? t(borrower.label) : '' },
  ];
};

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
            <small>{[g.relationship, g.phone, g.id_no, g.occupation, g.guarantee_amount ? `${t('crGuaranteeAmount')} ₭ ${formatNumber(g.guarantee_amount)}` : null].filter(Boolean).join(' · ')}</small>
          </div>
          {g.monthly_income > 0 && (
            <div className="cr-collateral-value"><b>₭ {formatNumber(g.monthly_income)}</b><small>{t('crMonthlyIncome')}</small></div>
          )}
        </article>
      ))}
    </div>
  );
};

export type CreditTile = {
  icon: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** navy = ບັດຫຼັກ (ພື້ນເຂັ້ມ); ສີອື່ນ = ໄອຄອນສີນັ້ນ, ສີແດງ = ຕົວເລກແດງ */
  tone?: 'navy' | 'blue' | 'green' | 'violet' | 'gold' | 'red' | 'slate';
  hidden?: boolean;
};

/** ແຖວບັດສະຖິຕິເທິງລາຍການ (ລູກຄ້າ / ຄຳຮ້ອງ / ສັນຍາ / ຕິດຕາມໜີ້) — ໄອຄອນ + ຫົວຂໍ້ + ຕົວເລກ + ຄຳອະທິບາຍ */
export const CreditTiles = ({ tiles, className = '' }: { tiles: CreditTile[]; className?: string }) => (
  <div className={`cr-tiles ${className}`}>
    {tiles.filter((x) => !x.hidden).map((x) => (
      <div key={x.label} className={`cr-tile is-${x.tone ?? 'blue'}`}>
        <span className="cr-tile-icon"><i className={`fa-solid ${x.icon}`} /></span>
        <span className="cr-tile-text">
          <small>{x.label}</small>
          <b>{x.value}</b>
          {x.sub && <em>{x.sub}</em>}
        </span>
      </div>
    ))}
  </div>
);

/** ແຖບກັ່ນ (ພ້ອມຈຳນວນ) + ຊ່ອງຄົ້ນຫາ + ປຸ່ມເພີ່ມ ໃນແຖວດຽວ — ໃຊ້ຮ່ວມທຸກລາຍການສິນເຊື່ອ */
export const CreditListBar = <K extends string>({ tabs, value, onChange, keyword, onKeyword, placeholder, addLabel, onAdd, canAdd = true, extra }: {
  tabs: { key: K; label: string; count: number; icon?: string }[];
  value: K;
  onChange: (key: K) => void;
  keyword: string;
  onKeyword: (value: string) => void;
  placeholder: string;
  addLabel?: string;
  onAdd?: () => void;
  canAdd?: boolean;
  /** ຕົວກັ່ນເພີ່ມຕໍ່ທ້າຍແຖບ (ເຊັ່ນ ປ້າຍອາຍຸໜີ້ທີ່ເລືອກ) */
  extra?: ReactNode;
}) => (
  <div className="cr-listbar">
    <div className="acc-type-segment acc-fa-filter-tabs" role="tablist">
      {tabs.map((f) => (
        <button key={f.key} type="button" role="tab" aria-selected={value === f.key} className={value === f.key ? 'is-active' : ''} onClick={() => onChange(f.key)}>
          {f.icon && <i className={`fa-solid ${f.icon}`} />} {f.label} <small>{f.count}</small>
        </button>
      ))}
    </div>
    {extra}
    <span className="cr-filter-spacer" />
    <SearchBox value={keyword} onChange={onKeyword} placeholder={placeholder} />
    {onAdd && (
      <button type="button" className="acc-class-add" disabled={!canAdd} onClick={onAdd}>
        <i className="fa-solid fa-plus" /> {addLabel}
      </button>
    )}
  </div>
);

/**
 * ຖັນທຳອິດຂອງລາຍການ — ຮູບວົງມົນ (ໄອຄອນ + ສີຕາມສະຖານະ) + ຊື່ + ປ້າຍ, ແຖວລຸ່ມ: ລະຫັດ · ລາຍລະອຽດ
 */
export const IdentityCell = ({ icon, tone = 'is-blue', title, code, meta = [], chips }: {
  icon: string;
  tone?: string;
  title: ReactNode;
  code?: string | null;
  meta?: (string | null | undefined | false)[];
  chips?: ReactNode;
}) => {
  const rest = meta.filter(Boolean).join(' · ');
  return (
    <div className="cr-who">
      <span className={`cr-avatar ${tone}`}><i className={`fa-solid ${icon}`} /></span>
      <span className="cr-who-text">
        <span className="cr-who-name"><b>{title}</b>{chips}</span>
        <small>{code && <span className="cr-who-code">{code}</span>}{rest}</small>
      </span>
    </div>
  );
};

/** ຮູບລູກຄ້າ: ນິຕິບຸກຄົນ = ຕຶກ, ຍິງ / ຊາຍ ຄົນລະສີ, ບັນຊີດຳ = ສີເຂັ້ມ */
export const customerAvatar = (c: { customer_type?: number | null; gender?: number | null; blacklisted?: number | null }) => ({
  icon: Number(c.customer_type) === 2 ? 'fa-building' : 'fa-user',
  tone: Number(c.blacklisted) === 1 ? 'is-black' : Number(c.customer_type) === 2 ? 'is-teal' : Number(c.gender) === 2 ? 'is-pink' : 'is-blue',
});

/** ຮູບຈາກເອກະສານສິນເຊື່ອ (ດາວໂຫຼດຜ່ານ token → blob URL; ລ້າງເມື່ອປ່ຽນ / ປິດ) — null = ບໍ່ມີ ຫຼື ກຳລັງໂຫຼດ */
export const useCreditImage = (docId?: string | number | null) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!docId) {
      setSrc(null);
      return undefined;
    }
    let url: string | null = null;
    let alive = true;
    getApi(`/credit/document/download/${docId}`, { responseType: 'blob' })
      .then((res) => {
        if (!alive) return;
        url = URL.createObjectURL(res.data as Blob);
        setSrc(url);
      })
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [docId]);
  return src;
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
