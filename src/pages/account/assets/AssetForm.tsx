import { useMemo, useRef, useState } from 'react';
import { Button, DatePicker, Form, Modal, NumberInput, Schema, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi, putApi } from '../../../utils/configApi';
import { InputField } from '../../../utils/inputFields';
import { useLangField, useT } from '../../../context/LanguageContext';
import { accountOptionLabel, amountFormatter, useAccountOptions, useChartAccounts } from '../gl/glKit';
import { ChoiceTiles, FormStep, PickerField, SettingModal } from '../setting/settingKit';
import { postfixProp, runSave } from '../setting/settingApi';
import { lifeText, type FixedAsset } from './faApi';

const { StringType, NumberType, DateType } = Schema.Types;

/** ຕົວເລກຈາກ NumberInput (string / number / ຫວ່າງ) */
const num = (value: unknown) => Number(String(value ?? '').replace(/,/g, '')) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;
const toKey = (d: Date | null | undefined) => (d ? moment(d).format('YYYY-MM-DD') : null);
const toDate = (s: string | null | undefined) => (s ? moment(s, 'YYYY-MM-DD').toDate() : null);
const LIFE_PRESETS = [3, 5, 10, 20];

/** ຄ່າຫຼຸ້ຍຫ້ຽນແບບເສັ້ນຊື່ — ສູດດຽວກັບ backend (fixedAssetController) ໃຊ້ສະແດງຕົວຢ່າງ */
export const depreciationPlan = (cost: number, salvage: number, life: number, start: Date | null, opening = 0) => {
  const base = Math.max(0, round2(cost - salvage));
  const monthly = life > 0 ? base / life : 0;
  const startMonth = start ? moment(start).startOf('month') : null;
  const remainingMonths = monthly > 0 ? Math.ceil(Math.max(0, base - opening) / monthly) : 0;
  const lastMonth = startMonth && remainingMonths ? startMonth.clone().add(remainingMonths - 1, 'month') : null;
  // ຄາດຄະເນຍອດສະສົມ ຖ້າລົງຄ່າຫຼຸ້ຍຫ້ຽນຄົບທຸກເດືອນຮອດເດືອນນີ້
  const monthsToDate = startMonth && !startMonth.isAfter(moment(), 'month') ? moment().startOf('month').diff(startMonth, 'months') + 1 : 0;
  const accumulatedToDate = Math.min(base, round2(opening + monthly * monthsToDate));
  return { base, monthly: round2(monthly), yearly: round2(monthly * 12), lastMonth, accumulatedToDate, nbvToDate: round2(cost - accumulatedToDate) };
};

type Inputs = {
  asset_code: string;
  name: string;
  asset_account_id: number | null;
  location: string;
  serial_no: string;
  acquisition_date: Date | null;
  depreciation_start: Date | null;
  cost: number | string | null;
  salvage_value: number | string | null;
  useful_life_months: number | string | null;
  opening_date: Date | null;
  opening_accumulated: number | string | null;
  accum_account_id: number | null;
  expense_account_id: number | null;
  note: string;
};

const inputsOf = (row: FixedAsset | null, nextCode: string): Inputs => ({
  asset_code: row?.asset_code ?? nextCode,
  name: row?.name ?? '',
  asset_account_id: row?.asset_account_id ?? null,
  location: row?.location ?? '',
  serial_no: row?.serial_no ?? '',
  acquisition_date: toDate(row?.acquisition_date) ?? new Date(),
  depreciation_start: toDate(row?.depreciation_start),
  cost: row?.cost ?? null,
  salvage_value: row?.salvage_value ?? 0,
  useful_life_months: row?.useful_life_months ?? 60,
  opening_date: toDate(row?.opening_date) ?? moment().startOf('year').toDate(),
  opening_accumulated: row?.opening_accumulated ?? 0,
  accum_account_id: row?.accum_account_id ?? null,
  expense_account_id: row?.expense_account_id ?? null,
  note: row?.note ?? '',
});

/**
 * ຟອມຊັບສົມບັດຄົງທີ່ — ແບບຂັ້ນຕອນ (ຄືຟອມບັນຊີເງິນຄັງ): ຊ້າຍ = ບັດຕົວຢ່າງ + ແຜນຄ່າຫຼຸ້ຍຫ້ຽນ (ອັບເດດຕາມທີ່ປ້ອນ),
 * ຂວາ = 1 ຂໍ້ມູນ, 2 ລາຄາ ແລະ ອາຍຸ, 3 ການບັນທຶກການຊື້, 4 ບັນຊີ (ພັບໄວ້ — ຫວ່າງ = ບັນຊີທີ່ຜູກໄວ້)
 */
export const AssetForm = ({ row, nextCode, onClose, onSaved }: { row: FixedAsset | null; nextCode: string; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const lf = useLangField();
  const formRef = useRef<FormInstance>(null);
  const { rows: accounts } = useChartAccounts();
  const assetOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === 1 && ['FIXED_ASSET', 'NONCURRENT_ASSET'].includes(a.account_type) && Number(a.normal_side) === 1);
  const accumOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === 1 && Number(a.normal_side) === 2);
  const expenseOptions = useAccountOptions(accounts, (a) => Number(a.account_group) === 5);
  const [inputs, setInputs] = useState<Inputs>(() => inputsOf(row, nextCode));
  const [mode, setMode] = useState<number>(row?.acquisition_mode ?? 0);
  const [accountsOpen, setAccountsOpen] = useState(!!(row?.accum_account_id || row?.expense_account_id || row?.note));
  const [saving, setSaving] = useState(false);

  const cost = num(inputs.cost);
  const salvage = num(inputs.salvage_value);
  const life = Math.round(num(inputs.useful_life_months));
  const opening = mode === 1 ? num(inputs.opening_accumulated) : 0;
  const start = inputs.depreciation_start ?? inputs.acquisition_date;
  const plan = depreciationPlan(cost, salvage, life, start, opening);
  const account = accounts.find((a) => a._uuid === inputs.asset_account_id);
  const posted = !!row?.last_period;

  const model = useMemo(() => Schema.Model<any>({
    name: StringType().isRequired(t('inputRequired')),
    asset_account_id: NumberType().isRequired(t('selectRequired')),
    acquisition_date: DateType().isRequired(t('selectRequired')),
    cost: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(0.01, t('faCostPositive')),
    salvage_value: NumberType(t('faNumberOnly')).min(0, t('faNumberOnly'))
      .addRule((value, data) => num(value) < num(data.cost) || !num(data.cost), t('faSalvageTooHigh')),
    useful_life_months: NumberType(t('faNumberOnly')).isRequired(t('inputRequired')).min(1, t('faLifeRange')).max(1200, t('faLifeRange')),
    ...(mode === 1 ? {
      opening_date: DateType().isRequired(t('selectRequired')),
      opening_accumulated: NumberType(t('faNumberOnly')).min(0, t('faNumberOnly'))
        .addRule((value, data) => num(value) <= num(data.cost) - num(data.salvage_value), t('faOpeningTooHigh')),
    } : {}),
  }), [mode, t]);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      asset_code: String(inputs.asset_code).trim(),
      name: inputs.name.trim(),
      asset_account_id: inputs.asset_account_id,
      accum_account_id: inputs.accum_account_id,
      expense_account_id: inputs.expense_account_id,
      acquisition_date: toKey(inputs.acquisition_date),
      depreciation_start: toKey(inputs.depreciation_start) ?? toKey(inputs.acquisition_date),
      cost,
      salvage_value: salvage,
      useful_life_months: life,
      acquisition_mode: mode,
      opening_date: mode === 1 ? toKey(inputs.opening_date) : null,
      opening_accumulated: opening,
      location: inputs.location,
      serial_no: inputs.serial_no,
      note: inputs.note,
    };
    if (await runSave(() => (row ? putApi(`/fixed-asset/${row._uuid}`, payload) : postApi('/fixed-asset/create', payload)), setSaving)) {
      onSaved();
      onClose();
    }
  };

  const accountSummary = [inputs.accum_account_id, inputs.expense_account_id].some(Boolean)
    ? [inputs.accum_account_id, inputs.expense_account_id].map((id) => accounts.find((a) => a._uuid === id)?.account_code ?? t('faDefaultShort')).join(' · ')
    : t('faUseDefault');

  return (
    <Modal open onClose={onClose} size="lg" keyboard={false} className="acc-book-modal is-steps">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className={`fa-solid ${row ? 'fa-pen-to-square' : 'fa-building'}`} /></span>
          <span>
            <Modal.Title>{t(row ? 'faEdit' : 'faAdd')}</Modal.Title>
            <small>{t('faFormHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-book-layout">
          {/* ---- ຊ້າຍ: ບັດຕົວຢ່າງ + ແຜນຄ່າຫຼຸ້ຍຫ້ຽນ ---- */}
          <aside className="acc-book-aside">
            <span className="acc-book-aside-label">{t('treasuryPreview')}</span>
            <div className={`acc-fa-cp${inputs.name.trim() ? '' : ' is-empty'}`}>
              <div className="acc-fa-cp-top">
                <span>
                  <b>{inputs.asset_code || 'FA-····'}</b>
                  <small>{account ? `${account.account_code} · ${lf(account, 'name')}` : t('faAssetAccount')}</small>
                </span>
                <i className="fa-solid fa-building" />
              </div>
              <div className="acc-fa-cp-name">{inputs.name.trim() || t('faName')}</div>
              <div className="acc-fa-cp-bottom">
                <span>{[inputs.location, inputs.serial_no].filter((x) => x.trim()).join(' · ') || t('faLocation')}</span>
                <em>{life ? lifeText(life, t) : '—'}</em>
              </div>
            </div>

            <dl className="acc-book-summary">
              <div><dt>{t('faCost')}</dt><dd>{formatNumber(cost)}</dd></div>
              <div><dt>{t('faSalvage')}</dt><dd>{salvage ? `(${formatNumber(salvage)})` : '–'}</dd></div>
              <div><dt>{t('faDepreciable')}</dt><dd>{formatNumber(plan.base)}</dd></div>
              <div><dt>{t('faMonthly')}</dt><dd>{formatNumber(plan.monthly)}</dd></div>
              <div><dt>{t('faYearly')}</dt><dd>{formatNumber(plan.yearly)}</dd></div>
              <div>
                <dt>{t('faPeriod')}</dt>
                <dd>{start ? moment(start).format('MM/YYYY') : '—'} – {plan.lastMonth ? plan.lastMonth.format('MM/YYYY') : '—'}</dd>
              </div>
              <div className="is-total">
                <dt>{t('faNbvToday')}</dt>
                <dd>{formatNumber(row ? row.nbv : plan.nbvToDate)}</dd>
              </div>
            </dl>

            {plan.base > 0 && (
              <div className="acc-fa-progress" title={t('faProgressHint')}>
                <span>
                  <small>{t('faDepreciatedSoFar')}</small>
                  <b>{Math.round(((row ? row.accumulated : plan.accumulatedToDate) / plan.base) * 100)}%</b>
                </span>
                <i><em style={{ width: `${Math.min(100, ((row ? row.accumulated : plan.accumulatedToDate) / plan.base) * 100)}%` }} /></i>
                <small>{t(row ? 'faProgressPosted' : 'faProgressEstimate')}</small>
              </div>
            )}
          </aside>

          {/* ---- ຂວາ: ຊ່ອງປ້ອນ ---- */}
          <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(next) => setInputs(next as Inputs)} className="acc-book-main">
            <FormStep no={1} done={!!inputs.name.trim() && !!inputs.asset_account_id} title={t('faStepInfo')} hint={t('faStepInfoHint')}>
              <div className="is-wide acs-code-name">
                <InputField name="asset_code" label={t('faCode')} required={false} icon={<i className="fa-solid fa-hashtag" />} />
                <InputField name="name" label={t('faName')} placeholder={t('faNamePlaceholder')} icon={<i className="fa-solid fa-signature" />} />
              </div>
              <PickerField name="asset_account_id" label={t('faAssetAccount')} data={assetOptions} className="is-wide"
                placeholder={t('select')} renderOption={accountOptionLabel} renderValue={(_: unknown, item: any) => accountOptionLabel(_, item)}
              />
              <InputField name="location" label={t('faLocation')} required={false} icon={<i className="fa-solid fa-location-dot" />} />
              <InputField name="serial_no" label={t('faSerial')} required={false} icon={<i className="fa-solid fa-barcode" />} />
            </FormStep>

            <FormStep no={2} done={cost > 0 && life > 0} title={t('faCostLife')} hint={t('faStepCostHint')}
              note={posted && <><i className="fa-solid fa-circle-info" /> {t('faPostedNote')} {moment(row!.last_period, 'YYYY-MM').format('MM/YYYY')}</>}
            >
              <InputField name="acquisition_date" label={t('faAcquisitionDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} />
              <InputField name="depreciation_start" label={t('faDepreciationStart')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block
                required={false} placeholder={inputs.acquisition_date ? moment(inputs.acquisition_date).format('DD/MM/YYYY') : undefined}
              />
              <div className="acc-fa-money">
                <InputField name="cost" label={t('faCost')} accepter={NumberInput} formatter={amountFormatter} prefix="₭" controls={false} />
              </div>
              <div className="acc-fa-money">
                <InputField name="salvage_value" label={t('faSalvage')} accepter={NumberInput} formatter={amountFormatter} prefix="₭" controls={false} required={false} />
              </div>
              <div className="is-wide acc-fa-life-row">
                <InputField name="useful_life_months" label={t('faLife')} accepter={NumberInput} {...postfixProp(t('faMonths'))} />
                <div className="acc-fa-presets" role="group" aria-label={t('faLife')}>
                  {LIFE_PRESETS.map((y) => (
                    <button key={y} type="button" className={life === y * 12 ? 'is-active' : ''}
                      onClick={() => setInputs({ ...inputs, useful_life_months: y * 12 })}
                    >
                      {y} {t('faYears')}
                    </button>
                  ))}
                </div>
              </div>
              <p className="is-wide acc-gl-hint"><i className="fa-solid fa-circle-info" /> {t('faStartRule')}</p>
            </FormStep>

            <FormStep no={3} done title={t('faAcquisition')} hint={t('faStepAcqHint')}>
              <ChoiceTiles<number>
                className="is-wide"
                label={t('faAcquisitionMode')}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 0, label: t('faModeRecorded'), hint: t('faModeRecordedHint'), icon: 'fa-receipt' },
                  { value: 1, label: t('faModeOpening'), hint: t('faModeOpeningHint'), icon: 'fa-flag-checkered' },
                ]}
              />
              {mode === 1 ? (
                <>
                  <InputField name="opening_date" label={t('faOpeningDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} />
                  <div className="acc-fa-money">
                    <InputField name="opening_accumulated" label={t('faOpeningAccumulated')} accepter={NumberInput} formatter={amountFormatter}
                      prefix="₭" controls={false} required={false}
                    />
                  </div>
                  <p className="is-wide acc-gl-hint"><i className="fa-solid fa-book" /> {t('faOpeningEntry')}</p>
                </>
              ) : (
                <p className="is-wide acc-gl-hint"><i className="fa-solid fa-lightbulb" /> {t('faRecordedHow')}</p>
              )}
            </FormStep>

            <FormStep no={4} done title={t('faAccounts')} hint={t('faAccountsNote')} summary={accountSummary}
              collapsed={!accountsOpen} onToggle={() => setAccountsOpen((open) => !open)}
            >
              <PickerField name="accum_account_id" label={t('faAccumAccount')} data={accumOptions} required={false}
                placeholder={t('faUseDefault')} renderOption={accountOptionLabel} renderValue={(_: unknown, item: any) => accountOptionLabel(_, item)}
              />
              <PickerField name="expense_account_id" label={t('faExpenseAccount')} data={expenseOptions} required={false}
                placeholder={t('faUseDefault')} renderOption={accountOptionLabel} renderValue={(_: unknown, item: any) => accountOptionLabel(_, item)}
              />
              <div className="is-wide">
                <InputField name="note" label={t('note')} accepter={Textarea} rows={2} required={false} />
              </div>
            </FormStep>
          </Form>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={submit}>
          <i className="fa-solid fa-check" /> {t('save')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

/**
 * ຈຳໜ່າຍ / ຂາຍ / ເສຍຫາຍ — ວັນທີ + ໝາຍເຫດ, ສະແດງຍອດ ແລະ ໃບບັນທຶກທີ່ຈະລົງ ກ່ອນຢືນຢັນ
 */
export const DisposeForm = ({ row, onClose, onSaved }: { row: FixedAsset; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [inputs, setInputs] = useState<{ date: Date | null; note: string }>({ date: new Date(), note: '' });
  const [saving, setSaving] = useState(false);
  const model = useMemo(() => Schema.Model<any>({ date: DateType().isRequired(t('selectRequired')) }), [t]);

  const submit = async () => {
    if (!formRef.current?.check()) return;
    if (await runSave(() => postApi(`/fixed-asset/dispose/${row._uuid}`, { date: toKey(inputs.date), note: inputs.note }), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t('faDispose')} hint={`${row.asset_code} · ${row.name}`} icon="fa-building-circle-xmark" saving={saving} className="is-steps"
      onClose={onClose} onSubmit={submit} submit={{ label: t('faDispose'), icon: 'fa-building-circle-xmark', danger: true }}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(next) => setInputs(next as typeof inputs)}>
        <FormStep no={1} done={!!inputs.date} title={t('faDisposeDetail')} hint={t('faDisposeDetailHint')}>
          <InputField name="date" label={t('faDisposalDate')} accepter={DatePicker} oneTap format="dd/MM/yyyy" block cleanable={false} />
          <InputField name="note" label={t('note')} required={false} placeholder={t('faDisposeNotePlaceholder')} />
        </FormStep>
        <FormStep no={2} done title={t('faDisposeEffect')} hint={t('faDisposeEffectHint')}>
          <dl className="is-wide acc-book-summary">
            <div><dt>{t('faCost')}</dt><dd>{formatNumber(row.cost)}</dd></div>
            <div><dt>{t('faAccumulated')}</dt><dd>({formatNumber(row.accumulated)})</dd></div>
            <div className="is-total"><dt>{t('faNbvLoss')}</dt><dd className={row.nbv > 0 ? 'is-negative' : ''}>{formatNumber(row.nbv)}</dd></div>
          </dl>
          <div className="is-wide acc-fa-entry">
            <span><b>{t('glDebit')}</b> {t('faAccumulated')}</span><em>{formatNumber(row.accumulated)}</em>
            {row.nbv > 0 && <><span><b>{t('glDebit')}</b> {t('glRoleAssetDisposalLoss')}</span><em>{formatNumber(row.nbv)}</em></>}
            <span className="is-credit"><b>{t('glCredit')}</b> {t('faAsset')} {row.asset_code}</span><em>{formatNumber(row.cost)}</em>
          </div>
          <p className="is-wide acc-gl-hint is-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('faDisposeHint')}</p>
        </FormStep>
      </Form>
    </SettingModal>
  );
};
