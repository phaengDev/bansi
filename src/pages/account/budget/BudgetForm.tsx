import { useState } from 'react';
import { Form, NumberInput, SelectPicker, Textarea } from 'rsuite';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { useFinanceCategories } from '../../../utils/selectOption';
import { amountFormatter } from '../gl/glKit';
import { ChoiceTiles, FormSection, SettingModal, codeLabel } from '../setting/settingKit';
import { runSave, saveSetting } from '../setting/settingApi';
import { kip, monthLabel, type BudgetRow, type FiscalYear, type MonthAmounts } from './budgetApi';

type Props = {
  fiscal: FiscalYear;
  /** ເດືອນທັງໝົດຂອງປີການເງິນ "YYYY-MM" */
  months: string[];
  /** ງົບທີ່ມີແລ້ວໃນປີ — ປະເພດທີ່ມີງົບແລ້ວເລືອກຊ້ຳບໍ່ໄດ້ */
  budgets: BudgetRow[];
  /** null = ຕັ້ງງົບໃໝ່ */
  data: BudgetRow | null;
  /** ຕັ້ງງົບໃໝ່ໃຫ້ປະເພດນີ້ເລີຍ (ຈາກລາຍການ "ລາຍຈ່າຍທີ່ຍັງບໍ່ມີງົບ") */
  presetCategoryId?: number;
  onClose: () => void;
  onSaved: () => void;
};

/** ແບ່ງຍອດເທົ່າກັນເປັນກີບເຕັມ — ເສດໄປເດືອນສຸດທ້າຍ ລວມກັນຈຶ່ງເທົ່າຍອດເດີມພໍດີ */
const spreadEven = (total: number, months: string[]): MonthAmounts => {
  const each = Math.floor(total / months.length);
  return Object.fromEntries(months.map((m, i) => [m, i === months.length - 1 ? total - each * (months.length - 1) : each]));
};

const sumOf = (values: MonthAmounts) => Object.values(values).reduce((n, v) => n + (Number(v) || 0), 0);

/**
 * ຟອມຕັ້ງ / ແກ້ໄຂງົບປະມານ ຂອງປະເພດລາຍຈ່າຍໜຶ່ງ ໃນປີການເງິນ — ທັງປີ (ຍອດດຽວ) ຫຼື ແບ່ງລາຍເດືອນ
 * (ງົບທັງປີ = ຜົນລວມທຸກເດືອນ). POST /budget/create, PUT /budget/:id
 */
const BudgetForm = ({ fiscal, months, budgets, data, presetCategoryId, onClose, onSaved }: Props) => {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const categories = useFinanceCategories(2);
  const [categoryId, setCategoryId] = useState<number | null>(data?.category_id ?? presetCategoryId ?? null);
  const [monthly, setMonthly] = useState(data?.is_monthly === 1);
  const [amount, setAmount] = useState<number | null>(data?.amount ?? null);
  const [values, setValues] = useState<MonthAmounts>(() => (data?.is_monthly ? { ...data.months } : {}));
  /** ຍອດທັງປີສຳລັບປຸ່ມ "ແບ່ງເທົ່າກັນ" */
  const [spread, setSpread] = useState<number | null>(data?.amount ?? null);
  const [description, setDescription] = useState(data?.description ?? '');
  const [checked, setChecked] = useState(false);

  const taken = new Set(budgets.filter((b) => b._uuid !== data?._uuid).map((b) => b.category_id));
  const categoryOptions = categories
    .filter((c) => !taken.has(c._uuid))
    .map((c) => ({ label: `${c.type_code} ${c.type_name}`, value: c._uuid, code: c.type_code, name: c.type_name, tone: 'is-coral' }));
  // ແກ້ໄຂ: ປະເພດທີ່ປິດໃຊ້ງານແລ້ວບໍ່ມີໃນ option — ສະແດງຈາກງົບເດີມ
  if (data?.category && !categoryOptions.some((o) => o.value === data.category_id)) {
    categoryOptions.unshift({
      label: `${data.category.type_code} ${data.category.type_name}`, value: data.category_id,
      code: data.category.type_code, name: data.category.type_name, tone: 'is-coral',
    });
  }

  const monthTotal = sumOf(values);
  const total = monthly ? monthTotal : Number(amount) || 0;

  const chooseMonthly = (next: number) => {
    const on = next === 1;
    if (on === monthly) return;
    // ສະຫຼັບໄປລາຍເດືອນຄັ້ງທຳອິດ — ແບ່ງງົບທັງປີທີ່ປ້ອນໄວ້ໃຫ້ເລີຍ; ກັບເປັນທັງປີ — ໃຊ້ຜົນລວມຂອງເດືອນ
    if (on && !monthTotal && Number(amount) > 0) {
      setValues(spreadEven(Math.round(Number(amount)), months));
      setSpread(Math.round(Number(amount)));
    }
    if (!on && monthTotal > 0) setAmount(monthTotal);
    setMonthly(on);
  };

  const setMonth = (period: string, value: unknown) =>
    setValues((current) => ({ ...current, [period]: Math.max(0, Number(value) || 0) }));

  const submit = async () => {
    setChecked(true);
    if (!categoryId) return Notific.warning('budgetPickCategory');
    if (!(total > 0)) return Notific.warning(monthly ? 'budgetMonthRequired' : 'budgetAmountRequired');
    const payload = {
      fiscal_id: fiscal._uuid,
      category_id: categoryId,
      is_monthly: monthly ? 1 : 0,
      amount: total,
      months: monthly ? Object.fromEntries(months.map((m) => [m, Number(values[m]) || 0])) : {},
      description: description.trim(),
    };
    if (await runSave(() => saveSetting('/budget', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal
      title={t(data ? 'budgetEdit' : 'budgetAdd')}
      hint={`${fiscal.fiscal_name || fiscal.fiscal_code} · ${t('budgetFormHint')}`}
      icon="fa-bullseye" saving={saving} onClose={onClose} onSubmit={submit} wide={monthly}
    >
      {/* Form fluid = ປ້າຍຢູ່ເທິງຊ່ອງ ຄືຟອມອື່ນ (ຄ່າເກັບໃນ state ເອງ ບໍ່ໃຊ້ model) */}
      <Form fluid>
        <FormSection title={t('budgetFormInfo')}>
          <div className="is-wide rs-form-group">
            <label className="form-label">{t('expenseCategory')}<span className="text-danger">*</span></label>
            <SelectPicker data={categoryOptions} value={categoryId} onChange={setCategoryId} block cleanable={false}
              disabled={!!data} placeholder={t('select')} popupClassName="acc-book-menu"
              renderOption={codeLabel} renderValue={codeLabel} locale={{ noResultsText: t('budgetAllTaken') }}
              className={checked && !categoryId ? 'has-error' : ''}
            />
          </div>
          <ChoiceTiles<number>
            className="is-wide"
            label={t('budgetSplit')}
            value={monthly ? 1 : 0}
            onChange={chooseMonthly}
            options={[
              { value: 0, label: t('budgetYearly'), icon: 'fa-calendar', hint: t('budgetYearlyHint') },
              { value: 1, label: t('budgetSplitMonthly'), icon: 'fa-calendar-days', hint: t('budgetSplitMonthlyHint') },
            ]}
          />
          {!monthly && (
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('budgetAmountYear')}<span className="text-danger">*</span></label>
              <NumberInput value={amount} min={0} prefix="₭" controls={false} formatter={amountFormatter}
                onChange={(value) => setAmount(value === '' || value === null ? null : Number(value))}
                className={checked && !(total > 0) ? 'has-error' : ''}
              />
            </div>
          )}
        </FormSection>

        {monthly && (
          <FormSection title={t('budgetMonths')} note={<>{t('budgetYearTotal')} <b>{kip(monthTotal)}</b></>}>
            <div className="is-wide acc-bg-spread">
              <NumberInput value={spread} min={0} prefix="₭" controls={false} formatter={amountFormatter} placeholder={t('budgetAmountYear')}
                onChange={(value) => setSpread(value === '' || value === null ? null : Number(value))}
              />
              <button type="button" className="acc-rp-btn" disabled={!(Number(spread) > 0)}
                onClick={() => setValues(spreadEven(Math.round(Number(spread)), months))}
              >
                <i className="fa-solid fa-equals" /> {t('budgetSpreadEven')}
              </button>
              <small>{t('budgetSpreadHint')}</small>
            </div>
            <div className="is-wide acc-bg-months">
              {months.map((period) => {
                const used = data?.actual_months[period] ?? 0;
                return (
                  <label key={period} className="acc-bg-month">
                    <span>{monthLabel(period)}</span>
                    <NumberInput size="sm" value={values[period] ?? null} min={0} controls={false} formatter={amountFormatter}
                      onChange={(value) => setMonth(period, value)}
                    />
                    {used > 0 && <small className={used > (values[period] ?? 0) ? 'is-bad' : ''}>{t('budgetUsed')} {kip(used)}</small>}
                  </label>
                );
              })}
            </div>
          </FormSection>
        )}

        <FormSection title={t('detail')}>
          <div className="is-wide rs-form-group">
            <label className="form-label">{t('budgetNoteLabel')}</label>
            <Textarea rows={2} value={description} onChange={setDescription} maxLength={255} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

export default BudgetForm;
