import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker, DateRangePicker, Form, Loader, NumberInput, Schema, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { accountOptionLabel, amountFormatter, useAccountOptions, useChartAccounts } from '../gl/glKit';
import { FormStep, PickerField, SettingModal } from '../setting/settingKit';
import { InputField } from '../../../utils/inputFields';

const { StringType, NumberType, DateType } = Schema.Types;
import { postfixProp, runSave } from '../setting/settingApi';

/** ປະເພດລາຍໄດ້ — rate = ອັດຕາຕັ້ງຕົ້ນ (ແກ້ໄດ້); ອັດຕາ 10/10/5 ຕາມກົດໝາຍອາກອນລາຍໄດ້, ອື່ນໆ ໃຫ້ປ້ອນເອງ */
const INCOME_TYPES = [
  { value: 1, label: 'whtTypeService', rate: 0 },
  { value: 2, label: 'whtTypeDividend', rate: 10 },
  { value: 3, label: 'whtTypeInterest', rate: 10 },
  { value: 4, label: 'whtTypeRoyalty', rate: 5 },
  { value: 5, label: 'whtTypeRent', rate: 0 },
  { value: 9, label: 'whtTypeOther', rate: 0 },
];
const typeLabel = (v: number) => INCOME_TYPES.find((x) => x.value === Number(v))?.label ?? 'whtTypeOther';

type Wht = {
  _uuid: number;
  wht_date: string;
  payee_name: string;
  payee_tax_id: string | null;
  income_type: number;
  gross_amount: string;
  rate: string;
  wht_amount: string;
  reference: string | null;
  note: string | null;
  status: number;
};

/** ຕົວເລກຈາກ NumberInput (string / number / ຫວ່າງ) */
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;

type WhtInputs = {
  wht_date: Date | null;
  income_type: number;
  payee_name: string;
  payee_tax_id: string;
  gross_amount: number | string | null;
  rate: number | string;
  wht_amount: number | string | null;
  reference: string;
  debit_account_id: number | null;
  note: string;
};

/**
 * ຟອມບັນທຶກອາກອນທີ່ຫັກໄວ້ — 1 ຜູ້ຮັບເງິນ, 2 ຈຳນວນເງິນ (ອາກອນ = ຈຳນວນ × ອັດຕາ, ແກ້ໄດ້) + ສະຫຼຸບຈ່າຍແທ້,
 * 3 ການລົງບັນຊີ (ພັບໄວ້: ບັນຊີຝັ່ງໜີ້ ຫວ່າງ = ລາຍຈ່າຍຕັ້ງຕົ້ນ)
 */
const WhtForm = ({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const { rows: accounts } = useChartAccounts();
  const options = useAccountOptions(accounts, (a) => [2, 5].includes(Number(a.account_group)));
  const [inputs, setInputs] = useState<WhtInputs>({
    wht_date: new Date(), income_type: 1, payee_name: '', payee_tax_id: '', gross_amount: null,
    rate: 0, wht_amount: null, reference: '', debit_account_id: null, note: '',
  });
  const [postingOpen, setPostingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const gross = num(inputs.gross_amount);
  const computed = Math.round(gross * num(inputs.rate)) / 100;
  const wht = inputs.wht_amount === null || inputs.wht_amount === '' ? computed : num(inputs.wht_amount);

  const model = useMemo(() => Schema.Model<any>({
    wht_date: DateType().isRequired(t('selectRequired')),
    payee_name: StringType().isRequired(t('inputRequired')),
    gross_amount: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0.01, t('faCostPositive')),
    rate: NumberType(t('faNumberOnly')).min(0, t('faNumberOnly')).max(100, t('faNumberOnly')),
    wht_amount: NumberType(t('faNumberOnly')).addRule((value, data) => num(value) <= num(data.gross_amount), t('whtTooHigh')),
  }), [t]);

  /** ປ່ຽນປະເພດລາຍໄດ້ → ຕັ້ງອັດຕາຕາມປະເພດ (ຖ້າມີ) */
  const handleChange = (next: WhtInputs) => {
    if (next.income_type !== inputs.income_type) {
      const type = INCOME_TYPES.find((x) => x.value === Number(next.income_type));
      if (type?.rate) next = { ...next, rate: type.rate };
    }
    setInputs(next);
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    if (!(wht > 0)) {
      Notific.warning('whtNeedAmount');
      return;
    }
    const ok = await runSave(() => postApi('/wht/create', {
      ...inputs,
      wht_date: moment(inputs.wht_date).format('YYYY-MM-DD'),
      gross_amount: gross,
      rate: num(inputs.rate),
      wht_amount: wht,
    }), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  const debit = accounts.find((a) => a._uuid === inputs.debit_account_id);

  return (
    <SettingModal title={t('whtAdd')} hint={t('whtFormHint')} icon="fa-hand-holding-dollar" saving={saving} onClose={onClose} onSubmit={submit}
      wide keyboard={false} className="is-steps"
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(next) => handleChange(next as WhtInputs)}>
        <FormStep no={1} done={!!inputs.payee_name.trim()} title={t('whtPayee')} hint={t('whtPayeeHint')}>
          <InputField name="wht_date" label={t('date')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} />
          <PickerField name="income_type" label={t('whtIncomeType')} searchable={false} cleanable={false}
            data={INCOME_TYPES.map((x) => ({ value: x.value, label: `${t(x.label)}${x.rate ? ` · ${x.rate}%` : ''}` }))}
          />
          <InputField name="payee_name" label={t('whtPayeeName')} icon={<i className="fa-solid fa-user-tie" />} />
          <InputField name="payee_tax_id" label={t('vatPartyTaxNo')} required={false} icon={<i className="fa-solid fa-id-card" />} />
        </FormStep>

        <FormStep no={2} done={gross > 0 && wht > 0} title={t('whtAmounts')} hint={t('whtAmountsHint')}>
          <div className="acc-fa-money">
            <InputField name="gross_amount" label={t('whtGross')} accepter={NumberInput} formatter={amountFormatter} prefix="₭" controls={false} />
          </div>
          <InputField name="rate" label={t('whtRate')} accepter={NumberInput} {...postfixProp('%')} required={false} />
          <div className="acc-fa-money">
            <InputField name="wht_amount" label={t('whtAmount')} accepter={NumberInput} formatter={amountFormatter} prefix="₭" controls={false}
              required={false} placeholder={formatNumber(computed)}
            />
          </div>
          <InputField name="reference" label={t('vatDocNo')} required={false} icon={<i className="fa-solid fa-hashtag" />} />
          <dl className="is-wide acc-book-summary">
            <div><dt>{t('whtGross')}</dt><dd>{formatNumber(gross)}</dd></div>
            <div><dt>{t('whtAmount')}</dt><dd>({formatNumber(wht)})</dd></div>
            <div className="is-total"><dt>{t('whtNet')}</dt><dd>{formatNumber(gross - wht)}</dd></div>
          </dl>
        </FormStep>

        <FormStep no={3} done title={t('whtPosting')} hint={t('whtFlowHint')}
          summary={debit ? `${debit.account_code} → 2147` : t('whtDebitDefault')} collapsed={!postingOpen} onToggle={() => setPostingOpen((v) => !v)}
        >
          <PickerField name="debit_account_id" label={t('whtDebitAccount')} data={options} required={false} className="is-wide"
            placeholder={t('whtDebitDefault')} renderOption={accountOptionLabel} renderValue={(_: unknown, item: any) => accountOptionLabel(_, item)}
          />
          <div className="is-wide">
            <InputField name="note" label={t('note')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/**
 * ອາກອນຫັກ ນ ທີ່ຈ່າຍ — ທະບຽນອາກອນທີ່ຫັກໄວ້ຕອນຈ່າຍເງິນ + ສະຫຼຸບຕາມປະເພດລາຍໄດ້ຂອງງວດ (ໃຊ້ແຈ້ງ ແລະ ນຳສົ່ງອາກອນ)
 */
const WithholdingPage = () => {
  const t = useT();
  const [range, setRange] = useState<[Date, Date]>(() => [moment().subtract(1, 'month').startOf('month').toDate(), moment().subtract(1, 'month').endOf('month').toDate()]);
  const [data, setData] = useState<{ data: Wht[]; summary: { income_type: number; count: number; gross: number; wht: number }[]; total: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const startKey = moment(range[0]).format('YYYY-MM-DD');
  const endKey = moment(range[1]).format('YYYY-MM-DD');

  const load = useCallback(async () => {
    try {
      const res = await postApi('/wht/fetch', { start_date: startKey, end_date: endKey });
      setData(res.data);
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  }, [startKey, endKey]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = (row: Wht) =>
    Notific.confirm(`${t('whtCancelConfirm')} ${row.payee_name}`, async () => {
      try {
        await putApi(`/wht/cancel/${row._uuid}`, {});
        Notific.success('acsSaved');
        load();
      } catch (err) {
        Notific.error(getErrorMessage(err));
      }
    });

  const exportRows = () =>
    data && exportExcel(data.data.filter((r) => Number(r.status) === 1).map((r) => ({
      [t('date')]: moment(r.wht_date).format('DD/MM/YYYY'),
      [t('whtPayeeName')]: r.payee_name,
      [t('vatPartyTaxNo')]: r.payee_tax_id ?? '',
      [t('whtIncomeType')]: t(typeLabel(r.income_type)),
      [t('vatDocNo')]: r.reference ?? '',
      [t('whtGross')]: Number(r.gross_amount),
      [t('whtRate')]: Number(r.rate),
      [t('whtAmount')]: Number(r.wht_amount),
    })), `withholding_${startKey}_${endKey}`, `${t('closeWithholding')} ${moment(range[0]).format('DD/MM/YYYY')} – ${moment(range[1]).format('DD/MM/YYYY')}`);

  return (
    <div className="acs-page acc-close">
      <section className="acc-rp-card">
        <header>
          <h4><i className="fa-solid fa-hand-holding-dollar" /> {t('closeWithholding')}</h4>
          <span className="acc-rp-card-tools">
            <DateRangePicker format="dd/MM/yyyy" character=" – " cleanable={false} placement="bottomEnd" value={range} onChange={(v) => v && setRange(v)} />
            <button type="button" className="acc-rp-btn" onClick={exportRows}><i className="fa-solid fa-file-excel" /> Excel</button>
            {canCreate && <button type="button" className="acc-rp-btn" onClick={() => setAdding(true)}><i className="fa-solid fa-plus" /> {t('whtAdd')}</button>}
          </span>
        </header>

        {!data ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : (
          <>
            <div className="acc-rp-kpis">
              <div className="acc-rp-kpi is-main">
                <small>{t('whtTotal')}</small>
                <b>₭ {formatNumber(data.total)}</b>
                <em className="is-flat">{t('whtTotalHint')}</em>
              </div>
              {data.summary.map((s) => (
                <div key={s.income_type} className="acc-rp-kpi">
                  <small>{t(typeLabel(s.income_type))} · {s.count}</small>
                  <b>₭ {formatNumber(s.wht)}</b>
                  <em className="is-flat">{t('whtGross')} ₭ {formatNumber(s.gross)}</em>
                </div>
              ))}
            </div>
            <div className="acc-rp-scroll">
              <table className="acc-fs-table acc-fx-table">
                <thead>
                  <tr>
                    <th>{t('date')}</th>
                    <th>{t('whtPayeeName')}</th>
                    <th>{t('whtGross')}</th>
                    <th>{t('whtRate')}</th>
                    <th>{t('whtAmount')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.data.length ? data.data.map((r) => {
                    const cancelled = Number(r.status) !== 1;
                    return (
                      <tr key={r._uuid} className={`is-line${cancelled ? ' is-disposed' : ''}`}>
                        <td>{moment(r.wht_date).format('DD/MM/YYYY')}</td>
                        <td>
                          <b>{r.payee_name}</b>
                          <small>{t(typeLabel(r.income_type))}{r.reference && ` · ${r.reference}`}{cancelled && ` · ${t('whtCancelled')}`}</small>
                        </td>
                        <td>{formatNumber(Number(r.gross_amount))}</td>
                        <td>{Number(r.rate)}%</td>
                        <td><b>{formatNumber(Number(r.wht_amount))}</b></td>
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
                    <tr className="is-empty"><td colSpan={6}>{t('rpEmpty')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="acc-close-note"><i className="fa-solid fa-money-bill-wave" /> {t('whtRemitHint')}</p>
          </>
        )}
      </section>
      {adding && <WhtForm onClose={() => setAdding(false)} onSaved={load} />}
    </div>
  );
};

export default WithholdingPage;
