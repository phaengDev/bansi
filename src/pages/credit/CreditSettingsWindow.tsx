import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Form, Input, NumberInput, Schema, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import AppPage from '../../components/Elements/AppPage';
import { postApi, putApi } from '../../utils/configApi';
import { InputField } from '../../utils/inputFields';
import { canCreate, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { CurrencyField } from '../../components/Elements/CurrencyPicker';
import { CREDIT_SETTINGS_MENU, toRailNav } from '../account/config/SidebarPopup';
import { useRailKey } from '../account/windowMemory';
import { accountOptionLabel, amountFormatter, useAccountOptions, useChartAccounts } from '../account/gl/glKit';
import { ChoiceTiles, FormStep, ListState, PickerField, SettingModal, SettingToolbar } from '../account/setting/settingKit';
import { postfixProp, runSave } from '../account/setting/settingApi';
import { LOAN_METHODS } from '../account/loans/loanApi';
import { BORROWER_TYPES, FREQUENCIES, PRODUCT_KINDS, frequencyOf, type ClassRule, type CreditProduct } from './creditApi';
import { monthlyRate, productFacts, useCreditProducts, useProductCurrency } from './creditKit';

const { StringType, NumberType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;

/** ຕົວຢ່າງຜະລິດຕະພັນທີ່ໃຊ້ເລື້ອຍ — ກົດແລ້ວເຕີມໃຫ້ (ແກ້ຕໍ່ໄດ້) */
const PRESETS: { key: string; label: string; icon: string; values: Partial<CreditProduct> }[] = [
  {
    key: 'monthly', label: 'crPresetMonthly', icon: 'fa-calendar',
    values: { product_kind: 1, min_amount: 5_000_000, max_amount: 200_000_000, min_term: 6, max_term: 60, annual_rate: 18, method: 1, frequency_months: 1, frequency_days: null, upfront_fee_rate: 1, penalty_rate: 0.1, grace_days: 3, require_collateral: 1, max_ltv: 70, max_debt_ratio: 50, approval_levels: 2 },
  },
  {
    key: 'weekly', label: 'crPresetWeekly', icon: 'fa-store',
    values: { product_kind: 1, min_amount: 1_000_000, max_amount: 20_000_000, min_term: 10, max_term: 52, annual_rate: 36, method: 3, frequency_months: 1, frequency_days: 7, upfront_fee_rate: 2, penalty_rate: 0.2, grace_days: 1, require_guarantor: 1, max_debt_ratio: 40, approval_levels: 1 },
  },
  {
    key: 'hire', label: 'crPresetHire', icon: 'fa-motorcycle',
    values: { product_kind: 2, min_amount: 3_000_000, max_amount: 80_000_000, min_term: 6, max_term: 36, annual_rate: 24, method: 3, frequency_months: 1, frequency_days: null, upfront_fee_rate: 1, penalty_rate: 0.1, grace_days: 3, require_guarantor: 1, max_debt_ratio: 50, approval_levels: 1 },
  },
  {
    key: 'pawn', label: 'crPresetPawn', icon: 'fa-gem',
    values: { product_kind: 3, min_amount: 500_000, max_amount: 50_000_000, min_term: 1, max_term: 12, annual_rate: 30, method: 4, frequency_months: 1, frequency_days: null, upfront_fee_rate: 0, penalty_rate: 0.1, grace_days: 0, require_collateral: 1, max_ltv: 80, approval_levels: 1 },
  },
];

type Inputs = Record<string, string | number | null>;

const NUMERIC = ['min_amount', 'max_amount', 'min_term', 'max_term', 'annual_rate', 'upfront_fee_rate', 'upfront_fee_fixed', 'penalty_rate',
  'grace_days', 'prepayment_fee_rate', 'max_ltv', 'max_debt_ratio'] as const;
/** ຊ່ອງທີ່ບໍ່ບັງຄັບ — ຫວ່າງ = 0 (ວົງເງິນ, ງວດ, ດອກເບ້ຍ ຕ້ອງປ້ອນເອງ) */
const ZERO_DEFAULT: readonly string[] = ['upfront_fee_rate', 'upfront_fee_fixed', 'penalty_rate', 'grace_days', 'prepayment_fee_rate', 'max_ltv', 'max_debt_ratio'];

const inputsOf = (p: Partial<CreditProduct> | null): Inputs => ({
  product_code: p?.product_code ?? '',
  name_la: p?.name_la ?? '',
  name_en: p?.name_en ?? '',
  currency_id: p?.currency_id ?? null,
  ...Object.fromEntries(NUMERIC.map((k) => [k, p?.[k] ?? (ZERO_DEFAULT.includes(k) ? 0 : null)])),
  loan_account_id: p?.loan_account_id ?? null,
  interest_account_id: p?.interest_account_id ?? null,
  fee_account_id: p?.fee_account_id ?? null,
  penalty_account_id: p?.penalty_account_id ?? null,
  note: p?.note ?? '',
});

/**
 * ຟອມຜະລິດຕະພັນສິນເຊື່ອ — 1 ຂໍ້ມູນ, 2 ວົງເງິນ/ງວດ, 3 ດອກເບ້ຍ/ການຜ່ອນ, 4 ຄ່າທຳນຽມ/ຄ່າປັບ, 5 ເງື່ອນໄຂອະນຸມັດ, 6 ບັນຊີ (ພັບ).
 * ຄຳຮ້ອງ / ສັນຍາທີ່ສ້າງແລ້ວ ໃຊ້ເງື່ອນໄຂທີ່ຄັດລອກໄປແລ້ວ — ແກ້ຜະລິດຕະພັນບໍ່ກະທົບ
 */
const ProductForm = ({ row, onClose, onSaved }: { row: CreditProduct | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const { rows: accounts } = useChartAccounts();
  const assetOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === 1);
  const incomeOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === 4);
  const [inputs, setInputs] = useState<Inputs>(() => inputsOf(row));
  const [kind, setKind] = useState(row?.product_kind ?? 1);
  const [borrower, setBorrower] = useState(row?.borrower_type ?? 3);
  const [method, setMethod] = useState(row?.method ?? 1);
  const [freq, setFreq] = useState<string>(frequencyOf(row?.frequency_days, row?.frequency_months ?? 1).key);
  const [actualDays, setActualDays] = useState(Number(row?.day_basis) === 2);
  const [penaltyBase, setPenaltyBase] = useState(row?.penalty_base ?? 1);
  const [needCollateral, setNeedCollateral] = useState(!!row?.require_collateral);
  const [needGuarantor, setNeedGuarantor] = useState(!!row?.require_guarantor);
  const [levels, setLevels] = useState(row?.approval_levels ?? 1);
  const [active, setActive] = useState(row ? Number(row.status) === 1 : true);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [preset, setPreset] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const cur = useProductCurrency(Number(inputs.currency_id) || null);
  const frequency = FREQUENCIES.find((f) => f.key === freq)!;
  const prefix = cur.genus || cur.name;

  const applyPreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key)!;
    setPreset(key);
    setInputs((prev) => ({ ...prev, ...Object.fromEntries(NUMERIC.map((k) => [k, p.values[k] ?? prev[k] ?? 0])), name_la: prev.name_la || t(p.label) }));
    setKind(p.values.product_kind ?? 1);
    setMethod(p.values.method ?? 1);
    setFreq(frequencyOf(p.values.frequency_days, p.values.frequency_months ?? 1).key);
    setNeedCollateral(!!p.values.require_collateral);
    setNeedGuarantor(!!p.values.require_guarantor);
    setLevels(p.values.approval_levels ?? 1);
  };

  const model = useMemo(() => Schema.Model<any>({
    product_code: StringType().isRequired(t('inputRequired')),
    name_la: StringType().isRequired(t('inputRequired')),
    min_amount: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0, t('faNumberOnly')),
    max_amount: NumberType(t('faNumberOnly')).isRequired(t('inputRequired'))
      .addRule((v, d) => num(v) > 0 && num(v) >= num(d.min_amount), t('crMaxAmountRule')),
    min_term: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnTermRange')),
    max_term: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).max(600, t('lnTermRange'))
      .addRule((v, d) => num(v) >= num(d.min_term), t('crMaxTermRule')),
    annual_rate: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0, t('crRateRange')).max(240, t('crRateRange')),
    penalty_rate: NumberType(t('faNumberOnly')).min(0, t('crPenaltyRange')).max(10, t('crPenaltyRange')),
    max_ltv: NumberType(t('faNumberOnly')).min(0, t('crPctRange')).max(100, t('crPctRange')),
    max_debt_ratio: NumberType(t('faNumberOnly')).min(0, t('crPctRange')).max(100, t('crPctRange')),
  }), [t]);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      ...Object.fromEntries(NUMERIC.map((k) => [k, num(inputs[k])])),
      product_code: String(inputs.product_code ?? '').trim(),
      name_la: String(inputs.name_la ?? '').trim(),
      product_kind: kind, borrower_type: borrower, method, day_basis: actualDays ? 2 : 1,
      frequency_days: frequency.days, frequency_months: frequency.months,
      penalty_base: penaltyBase, require_collateral: needCollateral ? 1 : 0, require_guarantor: needGuarantor ? 1 : 0,
      approval_levels: levels, status: active ? 1 : 0,
    };
    const ok = await runSave(() => (row ? putApi(`/credit/product/${row._uuid}`, payload) : postApi('/credit/product', payload)), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  const rate = num(inputs.annual_rate);
  const accountPicker = (name: string, label: string, options: typeof incomeOptions, placeholder: string) => (
    <PickerField name={name} label={label} data={options} required={false} placeholder={placeholder}
      renderOption={accountOptionLabel} renderValue={(_: unknown, item: any) => accountOptionLabel(_, item)}
    />
  );

  return (
    <SettingModal title={t(row ? 'crProductEdit' : 'crProductAdd')} hint={t('crProductHint')} icon="fa-box-open" saving={saving}
      onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide
    >
      {!row && (
        <div className="lv-presets">
          <span><i className="fa-solid fa-wand-magic-sparkles" /> {t('crPresets')}</span>
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className={preset === p.key ? 'is-active' : ''} onClick={() => applyPreset(p.key)}>
              <b><i className={`fa-solid ${p.icon}`} /> {t(p.label)}</b>
              <small>{p.values.annual_rate}% · {t(frequencyOf(p.values.frequency_days, p.values.frequency_months ?? 1).label)}</small>
            </button>
          ))}
        </div>
      )}
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(v) => setInputs(v as Inputs)}>
        <FormStep no={1} done={!!String(inputs.product_code).trim() && !!String(inputs.name_la).trim()} title={t('crStepProduct')} hint={t('crStepProductHint')}>
          <div className="is-wide acs-code-name">
            <InputField name="product_code" label={t('faCode')} placeholder="PL-01" icon={<i className="fa-solid fa-hashtag" />} />
            <InputField name="name_la" label={t('crProductName')} placeholder={t('crProductNamePlaceholder')} icon={<i className="fa-solid fa-box-open" />} />
          </div>
          <InputField name="name_en" label={t('crNameEn')} required={false} icon={<i className="fa-solid fa-language" />} />
          <CurrencyField name="currency_id" label={t('accountTypeCurrency')} required={false} cleanable={false} placeholder="LAK" />
          <ChoiceTiles<number> className="is-wide" label={t('crProductKind')} value={kind} onChange={setKind}
            options={PRODUCT_KINDS.map((k) => ({ value: k.value, label: t(k.label), icon: k.icon, hint: t(`${k.label}Hint`) }))}
          />
          <ChoiceTiles<number> className="is-wide" label={t('crBorrowerType')} value={borrower} onChange={setBorrower}
            options={BORROWER_TYPES.map((b) => ({ value: b.value, label: t(b.label) }))}
          />
          {row && (
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('status')}</label>
              <div className={`acs-toggle-field${active ? ' is-on' : ''}`}>
                <Toggle checked={active} onChange={setActive} />
                <span>{t(active ? 'crProductOn' : 'crProductOff')}</span>
              </div>
            </div>
          )}
        </FormStep>

        <FormStep no={2} done={num(inputs.max_amount) > 0 && num(inputs.max_term) > 0} title={t('crStepLimits')} hint={t('crStepLimitsHint')}>
          <div className="acc-fa-money">
            <InputField name="min_amount" label={t('crMinAmount')} accepter={NumberInput} formatter={amountFormatter} controls={false} prefix={prefix} />
          </div>
          <div className="acc-fa-money">
            <InputField name="max_amount" label={t('crMaxAmount')} accepter={NumberInput} formatter={amountFormatter} controls={false} prefix={prefix} />
          </div>
          <InputField name="min_term" label={t('crMinTerm')} accepter={NumberInput} {...postfixProp(t('lnInstallments'))} />
          <InputField name="max_term" label={t('crMaxTerm')} accepter={NumberInput} {...postfixProp(t('lnInstallments'))} />
        </FormStep>

        <FormStep no={3} done={inputs.annual_rate !== null && inputs.annual_rate !== ''} title={t('crStepRate')} hint={t('crStepRateHint')}>
          <InputField name="annual_rate" label={t('lnAnnualRate')} accepter={NumberInput} {...postfixProp(`% / ${t('lnYear')}`)} controls={false} />
          <div className="rs-form-group">
            <label className="form-label">{t('lnDayBasis')}</label>
            <div className={`acs-toggle-field${actualDays ? ' is-on' : ''}`}>
              <Toggle checked={actualDays} onChange={setActualDays} />
              <span>{t(actualDays ? 'lnDayBasisActual' : 'lnDayBasisMonthly')}</span>
            </div>
          </div>
          {rate > 0 && <p className="is-wide acc-gl-hint"><i className="fa-solid fa-calculator" /> {t('crRateEquals').replace('{m}', String(monthlyRate(rate))).replace('{d}', String(Math.round((rate / 365) * 1000) / 1000))}</p>}
          <ChoiceTiles<number> className="is-wide" label={t('lnMethod')} value={method} onChange={setMethod}
            options={LOAN_METHODS.map((m) => ({ value: m.value, label: t(m.label), hint: t(m.hint), icon: m.icon }))}
          />
          <ChoiceTiles<string> className="is-wide" label={t('lnFrequency')} value={freq} onChange={setFreq}
            options={FREQUENCIES.map((f) => ({ value: f.key, label: t(f.label) }))}
          />
        </FormStep>

        <FormStep no={4} done title={t('crStepFees')} hint={t('crStepFeesHint')}>
          <InputField name="upfront_fee_rate" label={t('crFeeRate')} accepter={NumberInput} {...postfixProp('%')} controls={false} required={false} />
          <div className="acc-fa-money">
            <InputField name="upfront_fee_fixed" label={t('crFeeFixed')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} prefix={prefix} />
          </div>
          <InputField name="penalty_rate" label={t('crPenaltyRate')} accepter={NumberInput} {...postfixProp(`% / ${t('crDay')}`)} controls={false} required={false} />
          <InputField name="grace_days" label={t('crGraceDays')} accepter={NumberInput} {...postfixProp(t('crDays'))} required={false} />
          <ChoiceTiles<number> className="is-wide" label={t('crPenaltyBase')} value={penaltyBase} onChange={setPenaltyBase}
            options={[
              { value: 1, label: t('crPenaltyBaseDue'), hint: t('crPenaltyBaseDueHint'), icon: 'fa-layer-group' },
              { value: 2, label: t('crPenaltyBasePrincipal'), hint: t('crPenaltyBasePrincipalHint'), icon: 'fa-coins' },
            ]}
          />
          <InputField name="prepayment_fee_rate" label={t('crPrepayFee')} accepter={NumberInput} {...postfixProp('%')} controls={false} required={false} />
        </FormStep>

        <FormStep no={5} done title={t('crStepRules')} hint={t('crStepRulesHint')}>
          <div className="rs-form-group">
            <label className="form-label">{t('crNeedCollateral')}</label>
            <div className={`acs-toggle-field${needCollateral ? ' is-on' : ''}`}>
              <Toggle checked={needCollateral} onChange={setNeedCollateral} />
              <span>{t(needCollateral ? 'crRequired' : 'crOptional')}</span>
            </div>
          </div>
          <InputField name="max_ltv" label={t('crMaxLtv')} accepter={NumberInput} {...postfixProp('%')} controls={false} required={false} placeholder="0 = —" />
          <div className="rs-form-group">
            <label className="form-label">{t('crNeedGuarantor')}</label>
            <div className={`acs-toggle-field${needGuarantor ? ' is-on' : ''}`}>
              <Toggle checked={needGuarantor} onChange={setNeedGuarantor} />
              <span>{t(needGuarantor ? 'crRequired' : 'crOptional')}</span>
            </div>
          </div>
          <InputField name="max_debt_ratio" label={t('crMaxDti')} accepter={NumberInput} {...postfixProp('%')} controls={false} required={false} placeholder="0 = —" />
          <ChoiceTiles<number> className="is-wide" label={t('crApprovalLevels')} value={levels} onChange={setLevels}
            options={[1, 2, 3].map((n) => ({ value: n, label: t('crLevelsN').replace('{n}', String(n)), hint: t(`crLevels${n}Hint`), icon: n === 1 ? 'fa-user-check' : 'fa-users' }))}
          />
        </FormStep>

        <FormStep no={6} done title={t('faAccounts')} hint={t('crAccountsHint')}
          summary={[inputs.loan_account_id, inputs.interest_account_id, inputs.fee_account_id, inputs.penalty_account_id].some(Boolean)
            ? [inputs.loan_account_id, inputs.interest_account_id, inputs.fee_account_id, inputs.penalty_account_id]
              .map((id) => accounts.find((a) => a._uuid === id)?.account_code ?? t('faDefaultShort')).join(' · ')
            : t('faUseDefault')}
          collapsed={!accountsOpen} onToggle={() => setAccountsOpen((open) => !open)}
        >
          {accountPicker('loan_account_id', t('lnLoanAccountLent'), assetOptions, '1180 · ' + t('faUseDefault'))}
          {accountPicker('interest_account_id', t('lnInterestIncomeAccount'), incomeOptions, t('faUseDefault'))}
          {accountPicker('fee_account_id', t('crFeeAccount'), incomeOptions, '4230 · ' + t('faUseDefault'))}
          {accountPicker('penalty_account_id', t('crPenaltyAccount'), incomeOptions, '4240 · ' + t('faUseDefault'))}
          <div className="is-wide">
            <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/** ສີຂອງບັດຕາມປະເພດ: ເງິນສົດ, ຂາຍຜ່ອນ, ຈຳນຳ */
const KIND_TONES: Record<number, string> = { 1: 'is-emerald', 2: 'is-sky', 3: 'is-gold' };

/**
 * ບັດຜະລິດຕະພັນ — ຫົວ (ໄອຄອນຕາມປະເພດ, ຊື່, ລະຫັດ · ປະເພດ, ສະຖານະ, ແກ້ໄຂ), ຕາລາງເງື່ອນໄຂ 3 ຖັນ (ປ້າຍ + ຄ່າ),
 * ແຖວລຸ່ມ = ເງື່ອນໄຂການອະນຸມັດ (ຫຼັກຊັບ / LTV, ຜູ້ຄ້ຳ, ອັດຕາສ່ວນໜີ້ຕໍ່ລາຍຮັບ)
 */
const ProductCard = ({ p, onEdit }: { p: CreditProduct; onEdit: () => void }) => {
  const t = useT();
  const cur = useProductCurrency(p.currency_id);
  const kind = PRODUCT_KINDS.find((k) => k.value === Number(p.product_kind)) ?? PRODUCT_KINDS[0];
  const active = Number(p.status) === 1;
  const rules = [
    Number(p.require_collateral) === 1 && { icon: 'fa-house-lock', text: `${t('crNeedCollateral')}${p.max_ltv ? ` · LTV ≤ ${p.max_ltv}%` : ''}` },
    Number(p.require_guarantor) === 1 && { icon: 'fa-user-shield', text: t('crNeedGuarantor') },
    p.max_debt_ratio > 0 && { icon: 'fa-scale-unbalanced', text: `${t('crDtiShort')} ≤ ${p.max_debt_ratio}%` },
  ].filter(Boolean) as { icon: string; text: string }[];
  return (
    <article className={`cr-product${active ? '' : ' is-off'}`}>
      <header>
        <span className={`acc-class-code cr-product-badge ${KIND_TONES[Number(p.product_kind)] ?? 'is-emerald'}`}><i className={`fa-solid ${kind.icon}`} /></span>
        <div>
          <h4>{p.name_la}</h4>
          <small><span className="acc-fs-code">{p.product_code}</span> {t(kind.label)}</small>
        </div>
        <span className={`acc-class-status${active ? ' is-active' : ''}`}><i className="fa-solid fa-circle" /> {active ? t('active') : t('inactive')}</span>
        <button type="button" className="acc-class-edit" disabled={!canEdit} aria-label={t('edit')} title={t('edit')} onClick={onEdit}>
          <i className="fa-solid fa-pen" />
        </button>
      </header>
      <dl className="cr-product-facts">
        {productFacts(p, cur, t).map((f) => (
          <div key={f.icon}>
            <dt><i className={`fa-solid ${f.icon}`} /> {f.label}</dt>
            <dd title={'title' in f ? f.title : undefined}>{f.value}</dd>
            {f.sub && <small>{f.sub}</small>}
          </div>
        ))}
      </dl>
      <footer>
        {rules.length ? rules.map((r) => <span key={r.icon} className="cr-product-rule"><i className={`fa-solid ${r.icon}`} /> {r.text}</span>)
          : <span className="cr-muted"><i className="fa-solid fa-circle-check" /> {t('crNoExtraRules')}</span>}
      </footer>
    </article>
  );
};

const ProductsPage = () => {
  const t = useT();
  const { rows, loading, error, reload } = useCreditProducts();
  const [editing, setEditing] = useState<CreditProduct | null | 'new'>(null);
  const [keyword, setKeyword] = useState('');
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((p) => !q || `${p.product_code} ${p.name_la} ${p.name_en ?? ''}`.toLowerCase().includes(q));
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;
  return (
    <div className="acs-page cr-page">
      <SettingToolbar
        stats={[
          { label: t('crProductsActive'), value: rows.filter((p) => Number(p.status) === 1).length, tone: 'green' },
          { label: t('crProductsAll'), value: rows.length },
        ]}
        keyword={keyword} onKeyword={setKeyword} addLabel={t('crProductAdd')} onAdd={() => setEditing('new')} canAdd={canCreate}
      />
      {!loading && !rows.length ? (
        <div className="acc-class-empty acc-fa-empty">
          <i className="fa-solid fa-box-open" />
          <p><b>{t('crNoProducts')}</b><br />{t('crNoProductsHint')}</p>
          {canCreate && <button type="button" className="acc-rp-btn" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> {t('crProductAdd')}</button>}
        </div>
      ) : (
        <ListState loading={loading && !rows.length} empty={!shown.length} icon="fa-box-open">
          <div className="cr-products">
            {shown.map((p) => <ProductCard key={p._uuid} p={p} onEdit={() => setEditing(p)} />)}
          </div>
        </ListState>
      )}
      {editing && <ProductForm row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
};

/**
 * ເກນຈັດຊັ້ນໜີ້ A–E (ຕາມມື້ກາຍກຳນົດ) ແລະ ອັດຕາເງິນແຮ — ຄ່າເລີ່ມຕົ້ນອີງຕາມແນວປະຕິບັດຂອງ ທຫລ;
 * ຊັ້ນຕໍ່ໄປເລີ່ມຕໍ່ຈາກມື້ສຸດທ້າຍຂອງຊັ້ນກ່ອນ (ບໍ່ມີຊ່ອງຫວ່າງ)
 */
const ClassRulesPage = () => {
  const t = useT();
  const { rules, loading, reload } = useCreditProducts();
  const [draft, setDraft] = useState<ClassRule[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(rules.map((r) => ({ ...r }))), [rules]);
  const set = (i: number, patch: Partial<ClassRule>) => setDraft((rows) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    // ຊັ້ນຖັດໄປເລີ່ມຕໍ່ຈາກມື້ສຸດທ້າຍຂອງຊັ້ນນີ້
    for (let j = 1; j < next.length; j += 1) next[j] = { ...next[j], min_days: (Number(next[j - 1].max_days) || 0) + 1 };
    return next;
  });
  const dirty = JSON.stringify(draft) !== JSON.stringify(rules);
  const save = async () => {
    if (await runSave(() => putApi('/credit/class-rule', { rules: draft }), setSaving)) reload();
  };
  if (loading && !draft.length) return <ListState loading empty={false} icon="fa-layer-group"><></></ListState>;
  const cell = (node: ReactNode) => <td>{node}</td>;
  return (
    <div className="acs-page cr-page">
      <section className="cr-card cr-rules-card">
        <header className="cr-rules-head">
          <span>
            <b>{t('crRulesMenu')}</b>
            <small><i className="fa-solid fa-scale-balanced" /> {t('crRulesHint')}</small>
          </span>
          {canEdit && (
            <button type="button" className="acc-rp-btn is-primary" disabled={!dirty || saving} onClick={save}>
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`} /> {t('save')}
            </button>
          )}
        </header>
        {/* ຂັ້ນໄດຊັ້ນໜີ້ — ເບິ່ງໄລຍະມື້ ແລະ ເງິນແຮຂອງທຸກຊັ້ນໃນແຖວດຽວ (ປ່ຽນຕາມທີ່ແກ້ຢູ່ລຸ່ມທັນທີ) */}
        <ol className="cr-ladder">
          {draft.map((r, i) => (
            <li key={r.loan_class} className={`is-${r.class_code}`}>
              <span className={`cr-class is-${r.class_code}`}>{r.class_code}</span>
              <span>
                <b>{r.name_la}</b>
                <small>{i === draft.length - 1 ? `${r.min_days}+ ${t('crDays')}` : `${r.min_days}–${r.max_days ?? '…'} ${t('crDays')}`}</small>
                <em>{t('crProvision')} {r.provision_rate}%</em>
              </span>
              {!!r.is_npl && <span className="cr-npl">NPL</span>}
            </li>
          ))}
        </ol>
        <div className="acc-rp-scroll">
          <table className="acc-fs-table cr-rules">
            <thead>
              <tr>
                <th>{t('crClass')}</th>
                <th>{t('crClassName')}</th>
                <th>{t('crDaysFrom')}</th>
                <th>{t('crDaysTo')}</th>
                <th>{t('crProvisionRate')}</th>
                <th>NPL</th>
              </tr>
            </thead>
            <tbody>
              {draft.map((r, i) => (
                <tr key={r.loan_class} className="is-line">
                  {cell(<span className={`cr-class is-${r.class_code}`}>{r.class_code}</span>)}
                  {cell(<Input value={r.name_la} disabled={!canEdit} onChange={(v) => set(i, { name_la: v })} />)}
                  {cell(<b>{r.min_days}</b>)}
                  {cell(i === draft.length - 1
                    ? <span className="cr-muted">{t('crAndAbove')}</span>
                    : <NumberInput min={r.min_days} value={r.max_days ?? ''} disabled={!canEdit} postfix={t('crDays')} onChange={(v) => set(i, { max_days: v === '' || v === null ? null : Number(v) })} />)}
                  {cell(<NumberInput min={0} max={100} value={r.provision_rate} disabled={!canEdit} postfix="%" onChange={(v) => set(i, { provision_rate: Number(v) || 0 })} />)}
                  {cell(<Toggle size="sm" checked={!!r.is_npl} disabled={!canEdit} onChange={(on) => set(i, { is_npl: on ? 1 : 0 })} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="acc-gl-hint cr-rules-foot"><i className="fa-solid fa-circle-info" /> {t('crRulesFoot')}</p>
      </section>
    </div>
  );
};

/** ໜ້າຕ່າງ ຕັ້ງຄ່າສິນເຊື່ອ — ຜະລິດຕະພັນ ແລະ ການຈັດຊັ້ນໜີ້ */
const CreditSettingsWindow = () => {
  const t = useT();
  const railNav = useMemo(() => toRailNav(CREDIT_SETTINGS_MENU, t), [t]);
  const [activeKey, setActiveKey] = useRailKey('creditSettings', CREDIT_SETTINGS_MENU);
  const active = railNav.find((item) => item.key === activeKey);
  const pages: Record<string, ReactNode> = { products: <ProductsPage />, rules: <ClassRulesPage /> };
  return (
    <AppPage title={active?.label ?? t('accountAppCreditSettings')} subtitle={t('accountAppCreditSettings')}
      railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}
    >
      {pages[activeKey] ?? null}
    </AppPage>
  );
};

export default CreditSettingsWindow;
