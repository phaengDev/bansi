import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, DatePicker, Form, Input, Modal, NumberInput, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { formatNumber, getApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { InputField } from '../../utils/inputFields';
import { useEmployees } from '../../utils/selectOption';
import { useT } from '../../context/LanguageContext';
import { amountFormatter } from '../account/gl/glKit';
import { FormStep, PickerField } from '../account/setting/settingKit';
import { postfixProp } from '../account/setting/settingApi';
import { LOAN_METHODS, money, showDate } from '../account/loans/loanApi';
import CollateralForm from './CollateralForm';
import { collateralTypeOf, type ApplicationDetail, type Collateral, type CreditCustomer, type Guarantor, type RouteChoice } from './creditApi';
import { RouteModal } from './RoutePicker';
import { creditTermText, monthlyRate, useCreditCustomers, useCreditProducts, useProductCurrency } from './creditKit';

const { NumberType, DateType } = Schema.Types;
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const toKey = (d: Date | null | undefined) => (d ? moment(d).format('YYYY-MM-DD') : null);
const PREVIEW_ROWS = 6;
const OPEN_APP = [1, 2, 3];

type Preview = { rows: { no: number; due_date: string; principal: number; interest: number; payment: number }[]; fee: number; net: number; monthly: number; debt_ratio: number | null; total_interest: number; total_payment: number };
type CustomerFull = CreditCustomer & { collaterals: Collateral[]; applications: { _uuid: number; status: number }[]; loans: { _uuid: number; closed: boolean; outstanding: number }[] };
type Check = { ok: boolean; label: string; hint?: string };

const emptyGuarantor = (): Guarantor => ({ full_name: '', relationship: '', id_no: '', phone: '', address: '', occupation: '', monthly_income: 0 });

/**
 * ຄຳຮ້ອງຂໍສິນເຊື່ອ — ຊ້າຍ: ສະຫຼຸບ (ຍອດຜ່ອນ, ຄ່າທຳນຽມ, ເງິນທີ່ລູກຄ້າໄດ້ຮັບ, ຕາຕະລາງຕົວຢ່າງ) + ຜົນກວດເງື່ອນໄຂຂອງຜະລິດຕະພັນ;
 * ຂວາ: 1 ລູກຄ້າ/ຜະລິດຕະພັນ, 2 ເງື່ອນໄຂທີ່ຂໍ, 3 ຫຼັກຊັບ, 4 ຜູ້ຄ້ຳ. ບັນທຶກຮ່າງ (ຍັງບໍ່ຄົບກໍ່ໄດ້) ຫຼື ສົ່ງພິຈາລະນາ (ຕ້ອງຜ່ານທຸກຂໍ້)
 */
const ApplicationForm = ({ row, customerId, onClose, onSaved }: {
  row: ApplicationDetail | null;
  customerId?: number;
  onClose: () => void;
  onSaved: (id: number) => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const { rows: customers } = useCreditCustomers();
  const { rows: allProducts } = useCreditProducts();
  const employees = useEmployees();
  const products = allProducts.filter((p) => Number(p.status) === 1 || p._uuid === row?.product_id);
  const [inputs, setInputs] = useState<Record<string, any>>(() => ({
    customer_id: row?.customer_id ?? customerId ?? null,
    product_id: row?.product_id ?? null,
    apply_date: row ? moment(row.apply_date, 'YYYY-MM-DD').toDate() : new Date(),
    officer_id: row?.officer_id ?? null,
    requested_amount: row?.requested_amount ?? null,
    requested_term: row?.requested_term ?? null,
    annual_rate: row?.annual_rate ?? null,
    purpose: row?.purpose ?? '',
    repayment_source: row?.repayment_source ?? '',
    item_description: row?.item_description ?? '',
    item_price: row?.item_price || null,
    down_payment: row?.down_payment || null,
    note: row?.note ?? '',
  }));
  const [collateralIds, setCollateralIds] = useState<number[]>(() => row?.collaterals.map((c) => c._uuid) ?? []);
  const [guarantors, setGuarantors] = useState<Guarantor[]>(() => row?.guarantors.map((g) => ({ ...g })) ?? []);
  const [customer, setCustomer] = useState<CustomerFull | null>(null);
  const [addingCollateral, setAddingCollateral] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const product = products.find((p) => p._uuid === inputs.product_id) ?? null;
  const cur = useProductCurrency(product?.currency_id);
  const prefix = cur.genus || cur.name;
  const amount = num(inputs.requested_amount);
  const term = Math.round(num(inputs.requested_term));
  const rate = inputs.annual_rate === null || inputs.annual_rate === '' ? product?.annual_rate ?? 0 : num(inputs.annual_rate);

  // ---- ລູກຄ້າທີ່ເລືອກ: ຫຼັກຊັບ, ຄຳຮ້ອງ, ສັນຍາ (ກວດວ່າຫຼັກຊັບໃດໃຊ້ຄ້ຳຢູ່) ----
  const loadCustomer = useCallback(async (id: number | null) => {
    if (!id) return setCustomer(null);
    try {
      const res = await getApi(`/credit/customer/${id}`);
      setCustomer(res.data?.data ?? null);
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  }, []);
  useEffect(() => {
    loadCustomer(inputs.customer_id);
  }, [inputs.customer_id, loadCustomer]);

  const usedElsewhere = (c: Collateral) =>
    (c.application_id && c.application_id !== row?._uuid && customer?.applications.some((a) => a._uuid === c.application_id && OPEN_APP.includes(Number(a.status))))
    || (c.loan_id && customer?.loans.some((l) => l._uuid === c.loan_id && !l.closed));
  const held = (customer?.collaterals ?? []).filter((c) => Number(c.status) === 1);
  const chosen = held.filter((c) => collateralIds.includes(c._uuid));
  const collateralValue = chosen.reduce((n, c) => n + c.appraised_value, 0);
  const ltv = collateralValue > 0 ? Math.round((amount / collateralValue) * 10000) / 100 : null;

  // ---- ຕົວຢ່າງ (POST /credit/preview) ລໍພິມແລ້ວ 300ms ----
  const previewKey = JSON.stringify({ p: inputs.product_id, amount, term, rate, c: inputs.customer_id });
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    if (!product || !(amount > 0) || !(term > 0)) {
      setPreview(null);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      postApi('/credit/preview', { product_id: product._uuid, amount, term, annual_rate: rate, customer_id: inputs.customer_id })
        .then((res) => alive && setPreview({ ...res.data, rows: res.data?.data ?? [] }))
        .catch(() => alive && setPreview(null));
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  /** ເລືອກຜະລິດຕະພັນ → ດອກເບ້ຍ ແລະ ງວດ ຕາມຜະລິດຕະພັນ (ຖ້າຍັງບໍ່ໄດ້ປ້ອນເອງ) */
  const onChange = (next: Record<string, any>) => {
    if (next.product_id !== inputs.product_id) {
      const p = products.find((x) => x._uuid === next.product_id);
      next = { ...next, annual_rate: p?.annual_rate ?? null, requested_term: next.requested_term ?? p?.min_term ?? null };
    }
    if (next.customer_id !== inputs.customer_id) setCollateralIds([]);
    if (product?.product_kind === 2 && (next.item_price !== inputs.item_price || next.down_payment !== inputs.down_payment)) {
      next = { ...next, requested_amount: Math.max(0, num(next.item_price) - num(next.down_payment)) || null };
    }
    setInputs(next);
  };

  // ---- ກວດເງື່ອນໄຂ (ຄືກັບ backend checkApplication — ສົ່ງພິຈາລະນາໄດ້ເມື່ອຜ່ານທຸກຂໍ້) ----
  const checks: Check[] = [];
  if (customer && product) {
    if (Number(customer.blacklisted) === 1) checks.push({ ok: false, label: t('crCheckBlacklist'), hint: customer.blacklist_reason ?? '' });
    if (Number(product.borrower_type) !== 3) {
      checks.push({ ok: Number(product.borrower_type) === Number(customer.customer_type), label: t('crCheckBorrower'), hint: t(Number(product.borrower_type) === 1 ? 'crBorrowerPerson' : 'crBorrowerCompany') });
    }
    checks.push({ ok: amount >= product.min_amount && amount <= product.max_amount, label: t('crCheckAmount'), hint: `${formatNumber(product.min_amount)} – ${formatNumber(product.max_amount)}` });
    checks.push({ ok: term >= product.min_term && term <= product.max_term, label: t('crCheckTerm'), hint: `${product.min_term} – ${product.max_term} ${t('lnInstallments')}` });
    if (customer.credit_limit > 0) {
      const exposure = customer.loans.filter((l) => !l.closed).reduce((n, l) => n + l.outstanding, 0) + amount;
      checks.push({ ok: exposure <= customer.credit_limit, label: t('crCheckLimit'), hint: `${formatNumber(exposure)} / ${formatNumber(customer.credit_limit)}` });
    }
    if (Number(product.require_collateral) === 1) checks.push({ ok: chosen.length > 0, label: t('crCheckCollateral') });
    if (product.max_ltv > 0 && chosen.length) checks.push({ ok: (ltv ?? 0) <= product.max_ltv, label: `LTV ${ltv ?? 0}%`, hint: `≤ ${product.max_ltv}%` });
    if (Number(product.require_guarantor) === 1) checks.push({ ok: guarantors.some((g) => g.full_name.trim()), label: t('crCheckGuarantor') });
    if (product.max_debt_ratio > 0) {
      const dti = preview?.debt_ratio ?? null;
      checks.push({ ok: dti !== null && dti <= product.max_debt_ratio, label: `${t('crDtiShort')} ${dti === null ? '—' : `${dti}%`}`, hint: dti === null ? t('crNoIncome') : `≤ ${product.max_debt_ratio}%` });
    }
  }
  const passed = checks.length > 0 && checks.every((c) => c.ok);
  /** ຂໍ້ທີ່ຍັງບໍ່ຜ່ານ — ບອກຢູ່ທ້າຍຟອມຄຽງປຸ່ມ "ສົ່ງພິຈາລະນາ" (ລາຍການກວດຢູ່ທາງຊ້າຍອາດເລື່ອນພົ້ນຈໍ) */
  const failed = checks.filter((c) => !c.ok);
  // LTV ເກີນ: ຫຼັກຊັບຕ້ອງມີມູນຄ່າຢ່າງໜ້ອຍເທົ່າໃດ ຫຼື ກູ້ໄດ້ສູງສຸດເທົ່າໃດ ກັບຫຼັກຊັບທີ່ເລືອກ
  const ltvOver = !!product && product.max_ltv > 0 && ltv !== null && ltv > product.max_ltv;
  const ltvNeedCollateral = ltvOver ? Math.ceil((amount * 100) / product!.max_ltv) : 0;
  const ltvMaxAmount = ltvOver ? Math.floor((collateralValue * product!.max_ltv) / 100) : 0;

  const model = useMemo(() => Schema.Model<any>({
    customer_id: NumberType().isRequired(t('selectRequired')),
    product_id: NumberType().isRequired(t('selectRequired')),
    apply_date: DateType().isRequired(t('selectRequired')),
    requested_amount: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnPrincipalPositive')),
    requested_term: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('lnTermRange')).max(600, t('lnTermRange')),
    annual_rate: NumberType(t('faNumberOnly')).min(0, t('crRateRange')).max(240, t('crRateRange')),
  }), [t]);

  const payloadOf = (submit: boolean, route?: RouteChoice) => ({
    ...inputs,
    apply_date: toKey(inputs.apply_date),
    requested_amount: amount, requested_term: term, annual_rate: rate,
    item_price: num(inputs.item_price), down_payment: num(inputs.down_payment),
    collateral_ids: collateralIds,
    guarantors: guarantors.filter((g) => g.full_name.trim()).map((g) => ({ ...g, monthly_income: num(g.monthly_income) })),
    submit,
    ...(route ? { route } : {}),
  });
  const send = (payload: ReturnType<typeof payloadOf>) => (row ? putApi(`/credit/application/${row._uuid}`, payload) : postApi('/credit/application', payload));
  /** ສົ່ງພິຈາລະນາ: ກວດຟອມແລ້ວເລືອກຜູ້ພິຈາລະນາ (RouteModal) ກ່ອນສົ່ງ */
  const [routing, setRouting] = useState(false);
  const submitTo = async (route: RouteChoice) => {
    const res = await send(payloadOf(true, route));
    onSaved(res.data?.data?._uuid ?? row?._uuid ?? 0);
    onClose();
  };
  const save = async (submit: boolean) => {
    if (!formRef.current?.check()) return;
    if (submit) {
      setRouting(true);
      return;
    }
    const payload = payloadOf(false);
    try {
      setSaving('draft');
      const res = await send(payload);
      const issues: string[] = res.data?.issues ?? [];
      if (issues.length) Notific.warning(`${t('crSavedWithIssues')} ${issues.join(' · ')}`);
      else Notific.success('saveSuccessDone');
      onSaved(res.data?.data?._uuid ?? row?._uuid ?? 0);
      onClose();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const setGuarantor = (i: number, patch: Partial<Guarantor>) => setGuarantors((list) => list.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const customerOptions = customers
    .filter((c) => Number(c.status) === 1 || c._uuid === inputs.customer_id)
    .map((c) => ({ value: c._uuid, label: `${c.customer_code} ${c.full_name}`, phone: c.phone, blacklisted: Number(c.blacklisted) === 1, outstanding: c.outstanding ?? 0 }));
  const productOptions = products.map((p) => ({ value: p._uuid, label: `${p.product_code} ${p.name_la}`, rate: p.annual_rate, p }));
  const first = preview?.rows[0];
  const last = preview?.rows[preview.rows.length - 1];

  return (
    <Modal open onClose={onClose} size="lg" keyboard={false} className="acc-book-modal is-steps acc-ln-modal cr-app-modal">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className="fa-solid fa-file-pen" /></span>
          <span>
            <Modal.Title>{row ? `${t('crAppEdit')} ${row.application_no}` : t('crAppAdd')}</Modal.Title>
            <small>{t('crAppHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-book-layout">
          {/* ---- ຊ້າຍ: ສະຫຼຸບ + ຜົນກວດ ---- */}
          <aside className="acc-book-aside">
            <span className="acc-book-aside-label">{t('treasuryPreview')}</span>
            <div className={`acc-ln-card is-lent${customer ? '' : ' is-empty'}`}>
              <div className="acc-ln-card-top">
                <span><b>{product?.product_code ?? 'APP'}</b><small>{product?.name_la ?? t('crPickProduct')}</small></span>
                <i className="fa-solid fa-hand-holding-dollar" />
              </div>
              <div className="acc-ln-card-name">{customer?.full_name ?? t('crCustomer')}</div>
              <div className="acc-ln-card-amount">{money(amount, cur)}</div>
              <div className="acc-ln-card-bottom">
                <span>{rate}% {t('lnPerYear')}</span>
                <em>{product && term ? creditTermText(term, product.frequency_days, product.frequency_months, t) : '—'}</em>
              </div>
            </div>

            <dl className="acc-book-summary">
              <div><dt>{t('lnAnnualRate')}</dt><dd>{rate}% · {monthlyRate(rate)}% {t('crPerMonth')}{product ? ` · ${t(LOAN_METHODS.find((m) => m.value === Number(product.method))?.label ?? '')}` : ''}</dd></div>
              <div><dt>{t('crInstallment')}</dt><dd>{first ? money(first.payment, cur) : '—'}</dd></div>
              {last && last !== first && last.payment !== first?.payment && <div><dt>{t('lnPaymentLast')}</dt><dd>{money(last.payment, cur)}</dd></div>}
              <div><dt>{t('lnTotalInterest')}</dt><dd>{preview ? money(preview.total_interest, cur) : '—'}</dd></div>
              <div><dt>{t('crFee')}</dt><dd>{preview ? money(preview.fee, cur) : '—'}</dd></div>
              <div><dt>{t('lnPeriod')}</dt><dd>{first ? `${showDate(first.due_date)} – ${showDate(last?.due_date)}` : '—'}</dd></div>
              <div className="is-total"><dt>{t('crNetToCustomer')}</dt><dd>{preview ? money(preview.net, cur) : '—'}</dd></div>
            </dl>

            {checks.length > 0 && (
              <div className={`cr-checks${passed ? ' is-ok' : ''}`}>
                <span className="cr-checks-title">
                  <i className={`fa-solid ${passed ? 'fa-shield-halved' : 'fa-clipboard-list'}`} /> {t(passed ? 'crChecksPassed' : 'crChecks')}
                </span>
                {checks.map((c) => (
                  <div key={c.label} className={c.ok ? 'is-ok' : 'is-bad'}>
                    <i className={`fa-solid ${c.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`} />
                    <span>{c.label}</span>
                    {c.hint && <small>{c.hint}</small>}
                  </div>
                ))}
              </div>
            )}

            {preview && preview.rows.length > 0 && (
              <div className="acc-ln-mini">
                <table>
                  <thead><tr><th>#</th><th>{t('lnDue')}</th><th>{t('lnPrincipalShort')}</th><th>{t('lnInterestShort')}</th></tr></thead>
                  <tbody>
                    {preview.rows.slice(0, PREVIEW_ROWS).map((r) => (
                      <tr key={r.no}><td>{r.no}</td><td>{showDate(r.due_date)}</td><td>{formatNumber(r.principal)}</td><td>{formatNumber(r.interest)}</td></tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > PREVIEW_ROWS && <small>+ {preview.rows.length - PREVIEW_ROWS} {t('lnMoreRows')}</small>}
              </div>
            )}
          </aside>

          {/* ---- ຂວາ: ຊ່ອງປ້ອນ ---- */}
          <Form fluid ref={formRef} model={model} formValue={inputs} onChange={onChange} className="acc-book-main">
            <FormStep no={1} done={!!inputs.customer_id && !!inputs.product_id} title={t('crStepWho')} hint={t('crStepWhoHint')}>
              <PickerField name="customer_id" label={t('crCustomer')} data={customerOptions} className="is-wide" disabled={!!row}
                placeholder={customers.length ? t('select') : t('crNoCustomers')}
                disabledItemValues={customerOptions.filter((c) => c.blacklisted).map((c) => c.value)}
                renderOption={(label: ReactNode, item: any) => (
                  <span className="cr-opt">
                    <b>{label}</b>
                    <small>{[item.phone, item.outstanding ? `${t('lnOutstanding')} ${formatNumber(item.outstanding)}` : '', item.blacklisted ? t('crBlacklist') : ''].filter(Boolean).join(' · ')}</small>
                  </span>
                )}
              />
              <PickerField name="product_id" label={t('crProduct')} data={productOptions} className="is-wide" placeholder={products.length ? t('select') : t('crNoProducts')}
                renderOption={(label: ReactNode, item: any) => (
                  <span className="cr-opt">
                    <b>{label}</b>
                    <small>{`${item.rate}% ${t('lnPerYear')} · ${formatNumber(item.p.min_amount)}–${formatNumber(item.p.max_amount)} · ${item.p.min_term}–${item.p.max_term} ${t('lnInstallments')}`}</small>
                  </span>
                )}
              />
              <InputField name="apply_date" label={t('crApplyDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
                shouldDisableDate={(d: Date) => moment(d).isAfter(moment(), 'day')}
              />
              <PickerField name="officer_id" label={t('crOfficer')} data={employees} required={false} placeholder={t('select')} />
            </FormStep>

            <FormStep no={2} done={amount > 0 && term > 0} title={t('crStepRequest')} hint={t(product ? 'crStepRequestHint' : 'crPickProductFirst')}>
              {product?.product_kind === 2 && (
                <>
                  <div className="is-wide">
                    <InputField name="item_description" label={t('crItem')} required={false} placeholder={t('crItemPlaceholder')} icon={<i className="fa-solid fa-cart-shopping" />} />
                  </div>
                  <div className="acc-fa-money">
                    <InputField name="item_price" label={t('crItemPrice')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} prefix={prefix} />
                  </div>
                  <div className="acc-fa-money">
                    <InputField name="down_payment" label={t('crDownPayment')} accepter={NumberInput} formatter={amountFormatter} controls={false} required={false} prefix={prefix} />
                  </div>
                </>
              )}
              <div className="acc-fa-money">
                <InputField name="requested_amount" label={t('crRequestedAmount')} accepter={NumberInput} formatter={amountFormatter} controls={false} prefix={prefix}
                  disabled={!product}
                />
              </div>
              <InputField name="requested_term" label={t('lnTerm')} accepter={NumberInput} {...postfixProp(t('lnInstallments'))} disabled={!product} />
              <InputField name="annual_rate" label={t('lnAnnualRate')} accepter={NumberInput} {...postfixProp(`% / ${t('lnYear')}`)} controls={false} required={false}
                placeholder={product ? String(product.annual_rate) : ''} disabled={!product}
              />
              <InputField name="purpose" label={t('lnPurpose')} required={false} icon={<i className="fa-solid fa-bullseye" />} />
              <div className="is-wide">
                <InputField name="repayment_source" label={t('crRepaymentSource')} required={false} placeholder={t('crRepaymentSourcePlaceholder')} icon={<i className="fa-solid fa-sack-dollar" />} />
              </div>
            </FormStep>

            <FormStep no={3} done={chosen.length > 0 && !ltvOver} title={t('crStepCollateralPick')}
              hint={product?.require_collateral ? t('crCollateralRequiredHint').replace('{p}', product.max_ltv ? String(product.max_ltv) : '—') : t('crCollateralOptionalHint')}
            >
              <div className="is-wide cr-pick-list">
                {!customer ? <p className="acc-gl-hint"><i className="fa-solid fa-user" /> {t('crPickCustomerFirst')}</p> : (
                  <>
                    {held.map((c) => {
                      const busy = usedElsewhere(c);
                      const on = collateralIds.includes(c._uuid);
                      const type = collateralTypeOf(c.collateral_type);
                      return (
                        <button key={c._uuid} type="button" disabled={!!busy} className={`cr-pick${on ? ' is-active' : ''}`}
                          onClick={() => setCollateralIds((ids) => (on ? ids.filter((x) => x !== c._uuid) : [...ids, c._uuid]))}
                        >
                          <i className={`fa-solid ${on ? 'fa-square-check' : 'fa-square'}`} />
                          <span className="cr-pick-icon"><i className={`fa-solid ${type.icon}`} /></span>
                          <span className="cr-pick-text"><b>{c.description}</b><small>{[c.collateral_code, t(type.label), c.document_no, busy ? t('crInUse') : ''].filter(Boolean).join(' · ')}</small></span>
                          <span className="cr-pick-value">₭ {formatNumber(c.appraised_value)}</span>
                        </button>
                      );
                    })}
                    <button type="button" className="cr-pick is-add" onClick={() => setAddingCollateral(true)}>
                      <i className="fa-solid fa-plus" /> {t('crCollateralAdd')}
                    </button>
                    {chosen.length > 0 && (
                      <p className="acc-gl-hint"><i className="fa-solid fa-scale-balanced" /> {t('crCollateralTotal')} <b>₭ {formatNumber(collateralValue)}</b>{ltv !== null && <> · LTV <b className={ltvOver ? 'cr-text-bad' : ''}>{ltv}%</b></>}</p>
                    )}
                    {ltvOver && (
                      <p className="cr-ltv-warn">
                        <i className="fa-solid fa-triangle-exclamation" />
                        <span>
                          <b>{t('crLtvOver').replace('{v}', String(ltv)).replace('{max}', String(product!.max_ltv))}</b>
                          {t('crLtvFix').replace('{c}', formatNumber(ltvNeedCollateral)).replace('{a}', formatNumber(ltvMaxAmount))}
                        </span>
                      </p>
                    )}
                  </>
                )}
              </div>
            </FormStep>

            <FormStep no={4} done={guarantors.some((g) => g.full_name.trim())} title={t('crStepGuarantor')} hint={t(product?.require_guarantor ? 'crGuarantorRequiredHint' : 'crGuarantorOptionalHint')}>
              <div className="is-wide cr-guarantors">
                {guarantors.map((g, i) => (
                  <div key={i} className="cr-guarantor">
                    <span className="cr-guarantor-no">{i + 1}</span>
                    <label><small>{t('crFullName')} <span className="text-danger">*</span></small><Input value={g.full_name} onChange={(v) => setGuarantor(i, { full_name: v })} /></label>
                    <label><small>{t('crRelationship')}</small><Input value={g.relationship ?? ''} placeholder={t('crRelationshipPlaceholder')} onChange={(v) => setGuarantor(i, { relationship: v })} /></label>
                    <label><small>{t('phone')}</small><Input value={g.phone ?? ''} onChange={(v) => setGuarantor(i, { phone: v })} /></label>
                    <label><small>{t('crIdNo')}</small><Input value={g.id_no ?? ''} onChange={(v) => setGuarantor(i, { id_no: v })} /></label>
                    <label><small>{t('crOccupation')}</small><Input value={g.occupation ?? ''} onChange={(v) => setGuarantor(i, { occupation: v })} /></label>
                    <label><small>{t('crMonthlyIncome')}</small><NumberInput value={g.monthly_income || ''} formatter={amountFormatter} controls={false} onChange={(v) => setGuarantor(i, { monthly_income: num(v) })} /></label>
                    <button type="button" className="acc-class-edit is-danger" aria-label={t('delete')} title={t('delete')} onClick={() => setGuarantors((list) => list.filter((_, j) => j !== i))}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                ))}
                <button type="button" className="cr-pick is-add" onClick={() => setGuarantors((list) => [...list, emptyGuarantor()])}>
                  <i className="fa-solid fa-plus" /> {t('crGuarantorAdd')}
                </button>
              </div>
              <div className="is-wide">
                <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
              </div>
            </FormStep>
          </Form>
        </div>
      </Modal.Body>

      <Modal.Footer>
        {failed.length ? (
          <span className="cr-submit-why" role="status">
            <i className="fa-solid fa-circle-exclamation" />
            <span><b>{t('crSubmitNeeds')}</b> {failed.map((c) => (c.hint ? `${c.label} (${c.hint})` : c.label)).join(' · ')}</span>
          </span>
        ) : <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>}
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="default" className="acc-book-btn" loading={saving === 'draft'} disabled={!!saving} onClick={() => save(false)}>
          <i className="fa-solid fa-floppy-disk" /> {t('crSaveDraft')}
        </Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving === 'submit' || routing} disabled={!!saving || !passed} onClick={() => save(true)}
          title={passed ? undefined : t('crSubmitBlocked')}
        >
          <i className="fa-solid fa-paper-plane" /> {t('crSubmit')}
        </Button>
      </Modal.Footer>

      {routing && (
        <RouteModal applicationId={row?._uuid} level={1} levels={product?.approval_levels ?? 1} title={t('crSubmit')} submitLabel={t('crSubmit')}
          hint={`${customer?.customer_code ?? ''} ${customer?.full_name ?? ''} · ₭ ${formatNumber(amount)} · ${t('crLevelOf').replace('{n}', '1').replace('{m}', String(product?.approval_levels ?? 1))}`}
          onClose={() => setRouting(false)} onConfirm={submitTo}
        />
      )}
      {addingCollateral && customer && (
        <CollateralForm customerId={customer._uuid} row={null} onClose={() => setAddingCollateral(false)}
          onSaved={async (id) => {
            await loadCustomer(customer._uuid);
            if (id) setCollateralIds((ids) => [...ids, id]);
          }}
        />
      )}
    </Modal>
  );
};

export default ApplicationForm;
