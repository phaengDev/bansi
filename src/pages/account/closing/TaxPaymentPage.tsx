import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker, Form, Loader, NumberInput, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { InputField } from '../../../utils/inputFields';
import { amountFormatter } from '../gl/glKit';
import { FormStep, PickerField, SettingModal } from '../setting/settingKit';
import { runSave } from '../setting/settingApi';
import { ACCOUNT_POPUP_STYLE, AccountCode, accountOption, renderAccountOption } from '../ledger/accountOption';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';

const { DateType, NumberType } = Schema.Types;

/** ປະເພດອາກອນ (tax_kind ຂອງ api-bansi taxPaymentController) */
const KINDS: Record<number, { label: string; icon: string }> = {
  1: { label: 'tpKindVat', icon: 'fa-receipt' },
  2: { label: 'tpKindPit', icon: 'fa-user-tie' },
  3: { label: 'tpKindSso', icon: 'fa-shield-heart' },
  4: { label: 'tpKindWht', icon: 'fa-hand-holding-dollar' },
  5: { label: 'tpKindProfit', icon: 'fa-percent' },
};
const VAT = 1;

type Outstanding = { kind: number; account_id: number | null; payable: number; vat_output?: number; vat_input?: number; ready: boolean };
type TaxPayment = {
  _uuid: number;
  number: string | null;
  tax_kind: number;
  period_end: string;
  pay_date: string;
  amount: string | number;
  vat_output: string | number;
  vat_input: string | number;
  reference: string | null;
  note: string | null;
  status: number;
  account?: { account_code?: string | null; acountName: string; acount_number?: string | null; banks?: { abbr?: string } | null } | null;
};
type Inputs = {
  tax_kind: number | null;
  period_end: Date | null;
  pay_date: Date | null;
  treasury_account_id: number | null;
  amount: number | string | null;
  reference: string;
  note: string;
};

const day = (d: Date | null) => (d ? moment(d).format('YYYY-MM-DD') : '');
const num = (v: unknown) => Number(v) || 0;
const kip = (v: number) => `₭ ${formatNumber(v)}`;

/** ຍອດຄ້າງຂອງທຸກປະເພດທີ່ໃຊ້ ຮອດວັນທີ — ໃຊ້ທັງໜ້າ ແລະ ຟອມ */
const useOutstanding = (date: string) => {
  const [rows, setRows] = useState<Outstanding[] | null>(null);
  const load = useCallback(async () => {
    if (!date) return;
    try {
      const res = await postApi('/tax-payment/outstanding', { date });
      setRows(res.data?.data ?? []);
    } catch (err) {
      setRows([]);
      Notific.error(getErrorMessage(err));
    }
  }, [date]);
  useEffect(() => {
    load();
  }, [load]);
  return { rows, reload: load };
};

/** ຍອດຄ້າງຂອງປະເພດໜຶ່ງ ເປັນຂໍ້ຄວາມ (ອາກອນມູນຄ່າເພີ່ມ: ຂາອອກ − ຂາເຂົ້າ) */
const DueDetail = ({ row }: { row: Outstanding }) => {
  const t = useT();
  if (!row.ready) return <em className="is-bad">{t('tpNotMapped')}</em>;
  if (row.kind === VAT) {
    return (
      <em className="is-flat">
        {t('tpVatOut')} {formatNumber(num(row.vat_output))} − {t('tpVatIn')} {formatNumber(num(row.vat_input))}
        {row.payable < 0 && <> · {t('tpVatCarry')}</>}
      </em>
    );
  }
  return <em className="is-flat">{row.payable > 0 ? t('tpOutstanding') : t('tpNothing')}</em>;
};

/**
 * ຟອມນຳສົ່ງອາກອນ — 1 ປະເພດ + ສິ້ນງວດ (ຍອດຄ້າງຄິດຈາກສະໝຸດບັນຊີ ຮອດວັນທີນັ້ນ), 2 ຈ່າຍຈາກບັນຊີສະກຸນກີບ, ຈຳນວນ (ບາງສ່ວນໄດ້),
 * ເລກທີໃບຮັບເງິນອາກອນ. POST /tax-payment/create
 */
const TaxPaymentForm = ({ kinds, preset, onClose, onSaved }: {
  kinds: number[];
  preset: { kind: number | null; periodEnd: Date };
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [inputs, setInputs] = useState<Inputs>({
    tax_kind: preset.kind, period_end: preset.periodEnd, pay_date: new Date(), treasury_account_id: null,
    amount: null, reference: '', note: '',
  });
  const { rows } = useOutstanding(day(inputs.period_end));
  const due = rows?.find((r) => r.kind === inputs.tax_kind) ?? null;
  const payable = Math.max(0, due?.payable ?? 0);
  const amount = inputs.amount === null || inputs.amount === '' ? payable : num(inputs.amount);

  useEffect(() => {
    // ນຳສົ່ງອາກອນໄດ້ສະເພາະບັນຊີສະກຸນກີບທີ່ໃຊ້ງານ (backend ກວດຊ້ຳ)
    postApi('/treasury-account/fetch', {})
      .then((res) => setAccounts((res.data?.data ?? []).filter((a: TreasuryAccount) =>
        Number(a.status) === 1 && String(a.treasury?.currency?.name ?? 'LAK').toUpperCase() === 'LAK')))
      .catch((err) => Notific.error(getErrorMessage(err)));
  }, []);

  const model = useMemo(() => Schema.Model<any>({
    tax_kind: NumberType().isRequired(t('selectRequired')),
    period_end: DateType().isRequired(t('selectRequired')),
    pay_date: DateType().isRequired(t('selectRequired'))
      .addRule((value, data) => !data.period_end || !moment(value).isBefore(moment(data.period_end), 'day'), t('tpPayBeforePeriod')),
    treasury_account_id: NumberType().isRequired(t('selectRequired')),
    amount: NumberType(t('faNumberOnly')).min(0, t('faNumberOnly')),
  }), [t]);

  const account = accounts.find((a) => a._uuid === inputs.treasury_account_id);
  const short = !!account && num(account.balance_treasury) < amount;
  const renderAccount = renderAccountOption(t('treasuryNoBank'));
  const future = (d: Date) => moment(d).isAfter(moment(), 'day');

  const submit = async () => {
    if (!formRef.current?.check()) return;
    if (!(payable > 0)) return Notific.warning('tpNothing');
    if (!(amount > 0) || amount > payable + 0.004) return Notific.warning('tpOverDue');
    const ok = await runSave(() => postApi('/tax-payment/create', {
      tax_kind: inputs.tax_kind,
      period_end: day(inputs.period_end),
      pay_date: day(inputs.pay_date),
      treasury_account_id: inputs.treasury_account_id,
      amount,
      reference: inputs.reference,
      note: inputs.note,
    }), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('tpAdd')} hint={t('tpFormHint')} icon="fa-building-columns" saving={saving} onClose={onClose} onSubmit={submit}
      wide keyboard={false} className="is-steps"
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(next) => setInputs({ ...(next as Inputs), amount: next.tax_kind !== inputs.tax_kind || next.period_end !== inputs.period_end ? null : next.amount })}>
        <FormStep no={1} done={!!inputs.tax_kind && payable > 0} title={t('tpStepTax')} hint={t('tpStepTaxHint')}>
          <PickerField name="tax_kind" label={t('tpKind')} searchable={false} cleanable={false}
            data={kinds.map((k) => ({ value: k, label: t(KINDS[k]?.label ?? '') }))}
            renderOption={(label: React.ReactNode, item: any) => <span className="acc-sub-opt"><i className={`fa-solid ${KINDS[item.value]?.icon}`} />{label}</span>}
            renderValue={(_: unknown, item: any) => <span className="acc-sub-opt"><i className={`fa-solid ${KINDS[item.value]?.icon}`} />{item.label}</span>}
          />
          <InputField name="period_end" label={t('tpPeriodEnd')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
            shouldDisableDate={future}
          />
          {inputs.tax_kind && (
            <div className={`is-wide acc-tp-due${due && due.payable > 0 ? '' : ' is-empty'}`}>
              {!rows ? <Loader size="xs" /> : due ? (
                <>
                  <span>
                    <small>{t('tpOutstanding')} · {moment(inputs.period_end).format('DD/MM/YYYY')}</small>
                    <b>{kip(payable)}</b>
                  </span>
                  <DueDetail row={due} />
                </>
              ) : <em>{t('tpNothing')}</em>}
            </div>
          )}
        </FormStep>

        <FormStep no={2} done={!!inputs.treasury_account_id && amount > 0} title={t('tpStepPay')} hint={t('tpStepPayHint')}>
          <InputField name="pay_date" label={t('tpPayDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false}
            shouldDisableDate={future}
          />
          <div className="acc-fa-money">
            <InputField name="amount" label={t('tpAmount')} accepter={NumberInput} formatter={amountFormatter} prefix="₭" controls={false}
              required={false} placeholder={formatNumber(payable)}
            />
          </div>
          <PickerField name="treasury_account_id" label={t('tpPayFrom')} className="is-wide" data={accounts.map((a) => accountOption(a))}
            placeholder={accounts.length ? t('select') : t('tpNoLakAccount')} renderOption={renderAccount} renderValue={renderAccount}
            popupStyle={ACCOUNT_POPUP_STYLE}
          />
          {short && <p className="is-wide acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('expenseInsufficient')}</p>}
          <InputField name="reference" label={t('tpReceiptNo')} required={false} icon={<i className="fa-solid fa-hashtag" />} />
          <InputField name="note" label={t('note')} required={false} icon={<i className="fa-solid fa-note-sticky" />} />
          <dl className="is-wide acc-book-summary">
            <div><dt>{t('tpOutstanding')}</dt><dd>{formatNumber(payable)}</dd></div>
            <div><dt>{t('tpAmount')}</dt><dd>({formatNumber(amount)})</dd></div>
            <div className="is-total"><dt>{t('tpRemaining')}</dt><dd>{formatNumber(Math.max(0, payable - amount))}</dd></div>
          </dl>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/**
 * ນຳສົ່ງອາກອນ (ບັນຊີແບບຄົບຕາມມາດຕະຖານ) — ຍອດຄ້າງຈ່າຍຂອງແຕ່ລະປະເພດ ຮອດວັນທີທີ່ເລືອກ (ຈາກສະໝຸດບັນຊີ) + ປະຫວັດການນຳສົ່ງ.
 * ແຈ້ງ/ຈ່າຍຜ່ານ TaxRIS ຫຼື ທະນາຄານແລ້ວ ບັນທຶກຢູ່ນີ້: ເງິນອອກຈາກບັນຊີ ແລະ ຍອດຄ້າງຈ່າຍຫຼຸດລົງ
 */
const TaxPaymentPage = () => {
  const t = useT();
  const [asOf, setAsOf] = useState<Date>(() => moment().subtract(1, 'month').endOf('month').toDate());
  const { rows: outstanding, reload: reloadOutstanding } = useOutstanding(day(asOf));
  const [history, setHistory] = useState<TaxPayment[] | null>(null);
  const [paying, setPaying] = useState<{ kind: number | null } | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await postApi('/tax-payment/fetch', {});
      setHistory(res.data?.data ?? []);
    } catch (err) {
      setHistory([]);
      Notific.error(getErrorMessage(err));
    }
  }, []);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const reload = () => {
    reloadOutstanding();
    loadHistory();
  };
  const kinds = (outstanding ?? []).map((r) => r.kind);
  const totalDue = (outstanding ?? []).reduce((n, r) => n + Math.max(0, r.payable), 0);

  const cancel = (row: TaxPayment) =>
    Notific.confirm(`${t('tpCancelConfirm')} ${row.number ?? ''} · ${kip(num(row.amount))}`, async () => {
      try {
        await putApi(`/tax-payment/cancel/${row._uuid}`, {});
        Notific.success('acsSaved');
        reload();
      } catch (err) {
        Notific.error(getErrorMessage(err));
      }
    });

  const exportRows = () =>
    history && exportExcel(history.filter((r) => Number(r.status) === 1).map((r) => ({
      [t('tpPayDate')]: moment(r.pay_date).format('DD/MM/YYYY'),
      [t('glEntryNumber')]: r.number ?? '',
      [t('tpKind')]: t(KINDS[r.tax_kind]?.label ?? ''),
      [t('tpPeriodEnd')]: moment(r.period_end).format('DD/MM/YYYY'),
      [t('tpPayFrom')]: [r.account?.account_code, r.account?.acountName].filter(Boolean).join(' '),
      [t('tpReceiptNo')]: r.reference ?? '',
      [t('tpAmount')]: num(r.amount),
    })), 'tax_payments', t('closeTaxPayment'));

  return (
    <div className="acs-page acc-close">
      <section className="acc-rp-card">
        <header>
          <h4><i className="fa-solid fa-building-columns" /> {t('closeTaxPayment')}</h4>
          <span className="acc-rp-card-tools">
            <label className="acc-tp-asof">
              <small>{t('tpAsOf')}</small>
              <DatePicker value={asOf} onChange={(v) => v && setAsOf(v)} oneTap format="dd/MM/yyyy" cleanable={false} placement="bottomEnd"
                shouldDisableDate={(d) => moment(d).isAfter(moment(), 'day')}
              />
            </label>
            {canCreate && (
              <button type="button" className="acc-rp-btn" disabled={!kinds.length} onClick={() => setPaying({ kind: null })}>
                <i className="fa-solid fa-plus" /> {t('tpAdd')}
              </button>
            )}
          </span>
        </header>

        {!outstanding ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : (
          <div className="acc-rp-kpis">
            <div className="acc-rp-kpi is-main">
              <small>{t('tpOutstanding')} · {moment(asOf).format('DD/MM/YYYY')}</small>
              <b>{kip(totalDue)}</b>
              <em className="is-flat">{t('tpAllKinds')}</em>
            </div>
            {outstanding.map((r) => (
              <div key={r.kind} className="acc-rp-kpi acc-tp-kpi">
                <small><i className={`fa-solid ${KINDS[r.kind]?.icon}`} /> {t(KINDS[r.kind]?.label ?? '')}</small>
                <b className={r.payable > 0 ? 'is-out' : ''}>{kip(Math.max(0, r.payable))}</b>
                <DueDetail row={r} />
                {canCreate && r.ready && r.payable > 0 && (
                  <button type="button" className="acc-rp-btn is-primary" onClick={() => setPaying({ kind: r.kind })}>
                    <i className="fa-solid fa-paper-plane" /> {t('tpPay')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="acc-close-note"><i className="fa-solid fa-circle-info" /> {t('tpNote')}</p>
      </section>

      <section className="acc-rp-card">
        <header>
          <h4><i className="fa-solid fa-clock-rotate-left" /> {t('tpHistory')}</h4>
          <span className="acc-rp-card-tools">
            <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!history?.length}><i className="fa-solid fa-file-excel" /> Excel</button>
          </span>
        </header>
        {!history ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : (
          <div className="acc-rp-scroll">
            <table className="acc-fs-table acc-fx-table">
              <thead>
                <tr>
                  <th>{t('tpPayDate')}</th>
                  <th>{t('tpKind')}</th>
                  <th>{t('tpPayFrom')}</th>
                  <th>{t('tpAmount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.length ? history.map((r) => {
                  const cancelled = Number(r.status) !== 1;
                  return (
                    <tr key={r._uuid} className={`is-line${cancelled ? ' is-disposed' : ''}`}>
                      <td>
                        {moment(r.pay_date).format('DD/MM/YYYY')}
                        <small>{r.number}</small>
                      </td>
                      <td>
                        <b><i className={`fa-solid ${KINDS[r.tax_kind]?.icon}`} /> {t(KINDS[r.tax_kind]?.label ?? '')}</b>
                        <small>
                          {t('tpPeriodEnd')} {moment(r.period_end).format('DD/MM/YYYY')}
                          {r.reference && ` · ${r.reference}`}
                          {cancelled && ` · ${t('whtCancelled')}`}
                        </small>
                      </td>
                      <td>
                        <AccountCode code={r.account?.account_code} /> {r.account?.acountName ?? '—'}
                        <small>{[r.account?.banks?.abbr, r.account?.acount_number].filter(Boolean).join(' · ')}</small>
                      </td>
                      <td><b>{formatNumber(num(r.amount))}</b></td>
                      <td className="acc-fa-actions">
                        {!cancelled && canDelete && (
                          <button type="button" className="is-danger" onClick={() => cancel(r)} title={t('cancel')} aria-label={t('cancel')}>
                            <i className="fa-solid fa-ban" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr className="is-empty"><td colSpan={5}>{t('rpEmpty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {paying && (
        <TaxPaymentForm kinds={kinds} preset={{ kind: paying.kind, periodEnd: asOf }} onClose={() => setPaying(null)} onSaved={reload} />
      )}
    </div>
  );
};

export default TaxPaymentPage;
