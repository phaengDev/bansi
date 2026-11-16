import { useState, type ReactNode } from 'react';
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
  /** ງົບທີ່ມີແລ້ວໃນປີ — ປະເພດ / ລາຍການຍ່ອຍທີ່ມີງົບແລ້ວເລືອກຊ້ຳບໍ່ໄດ້ */
  budgets: BudgetRow[];
  /** null = ຕັ້ງງົບໃໝ່ */
  data: BudgetRow | null;
  /** ຕັ້ງງົບໃໝ່ໃຫ້ປະເພດ / ລາຍການຍ່ອຍນີ້ເລີຍ (ຈາກລາຍການ "ລາຍຈ່າຍທີ່ຍັງບໍ່ມີງົບ") — subId null = ທັງປະເພດ */
  presetCategoryId?: number;
  presetSubId?: number | null;
  onClose: () => void;
  onSaved: () => void;
};

/** ແບ່ງຍອດເທົ່າກັນເປັນກີບເຕັມ — ເສດໄປເດືອນສຸດທ້າຍ ລວມກັນຈຶ່ງເທົ່າຍອດເດີມພໍດີ */
const spreadEven = (total: number, months: string[]): MonthAmounts => {
  const each = Math.floor(total / months.length);
  return Object.fromEntries(months.map((m, i) => [m, i === months.length - 1 ? total - each * (months.length - 1) : each]));
};

const sumOf = (values: MonthAmounts) => Object.values(values).reduce((n, v) => n + (Number(v) || 0), 0);

/** ຄ່າຂອງຕົວເລືອກ "ທັງປະເພດ" ໃນຊ່ອງລາຍການຍ່ອຍ (ສົ່ງເປັນ sub_category_id null) */
const WHOLE = 0;

type SubOption = { label: string; value: number; taken?: boolean };

/**
 * ຟອມຕັ້ງ / ແກ້ໄຂງົບປະມານ ຂອງປະເພດລາຍຈ່າຍ (ທັງປະເພດ) ຫຼື ລາຍການຍ່ອຍໜຶ່ງ ໃນປີການເງິນ — ທັງປີ (ຍອດດຽວ) ຫຼື ແບ່ງລາຍເດືອນ
 * (ງົບທັງປີ = ຜົນລວມທຸກເດືອນ). POST /budget/create, PUT /budget/:id
 * ປະເພດໜຶ່ງເລືອກໄດ້ແບບດຽວ (backend ກວດຊ້ຳ): ງົບທັງປະເພດ (ນັບທຸກລາຍການຍ່ອຍ + ເງິນເດືອນ) ຫຼື ງົບແຍກແຕ່ລະລາຍການຍ່ອຍ.
 * ແກ້ໄຂ: ປະເພດ ແລະ ລາຍການຍ່ອຍປ່ຽນບໍ່ໄດ້ (ລຶບແລ້ວຕັ້ງໃໝ່)
 */
const BudgetForm = ({ fiscal, months, budgets, data, presetCategoryId, presetSubId, onClose, onSaved }: Props) => {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const categories = useFinanceCategories(2);
  const [categoryId, setCategoryId] = useState<number | null>(data?.category_id ?? presetCategoryId ?? null);
  /** WHOLE = ທັງປະເພດ, null = ຍັງບໍ່ເລືອກ */
  const [subId, setSubId] = useState<number | null>(() => {
    if (data) return data.sub_category_id ?? WHOLE;
    if (presetSubId) return presetSubId;
    // ຈາກ "ຍັງບໍ່ມີງົບ": ປະເພດທີ່ຍັງບໍ່ມີງົບເລີຍ = ທັງປະເພດ
    return presetCategoryId && !budgets.some((b) => b.category_id === presetCategoryId) ? WHOLE : null;
  });
  const [monthly, setMonthly] = useState(data?.is_monthly === 1);
  const [amount, setAmount] = useState<number | null>(data?.amount ?? null);
  const [values, setValues] = useState<MonthAmounts>(() => (data?.is_monthly ? { ...data.months } : {}));
  /** ຍອດທັງປີສຳລັບປຸ່ມ "ແບ່ງເທົ່າກັນ" */
  const [spread, setSpread] = useState<number | null>(data?.amount ?? null);
  const [description, setDescription] = useState(data?.description ?? '');
  const [checked, setChecked] = useState(false);

  const others = budgets.filter((b) => b._uuid !== data?._uuid);
  /** ປະເພດທີ່ຕັ້ງງົບເພີ່ມບໍ່ໄດ້ອີກ: ມີງົບທັງປະເພດແລ້ວ ຫຼື ແຍກງົບຄົບທຸກລາຍການຍ່ອຍແລ້ວ */
  const isFull = (categoryId: number) => {
    const own = others.filter((b) => b.category_id === categoryId);
    if (own.some((b) => !b.sub_category_id)) return true;
    const subs = categories.find((c) => c._uuid === categoryId)?.subs ?? [];
    return own.length > 0 && subs.every((s) => own.some((b) => b.sub_category_id === s._uuid));
  };
  const categoryOptions = categories
    .filter((c) => !isFull(c._uuid))
    .map((c) => ({ label: `${c.type_code} ${c.type_name}`, value: c._uuid, code: c.type_code, name: c.type_name, tone: 'is-coral' }));
  // ແກ້ໄຂ: ປະເພດທີ່ປິດໃຊ້ງານແລ້ວບໍ່ມີໃນ option — ສະແດງຈາກງົບເດີມ
  if (data?.category && !categoryOptions.some((o) => o.value === data.category_id)) {
    categoryOptions.unshift({
      label: `${data.category.type_code} ${data.category.type_name}`, value: data.category_id,
      code: data.category.type_code, name: data.category.type_name, tone: 'is-coral',
    });
  }

  // ---- ລາຍການຍ່ອຍຂອງປະເພດທີ່ເລືອກ: "ທັງປະເພດ" + ລາຍການຍ່ອຍທີ່ໃຊ້ງານ; ອັນທີ່ມີງົບແລ້ວ ເລືອກບໍ່ໄດ້ ----
  const sameCategory = others.filter((b) => b.category_id === categoryId);
  const split = sameCategory.some((b) => b.sub_category_id);
  const takenSubs = new Set(sameCategory.map((b) => b.sub_category_id).filter(Boolean));
  const subOptions: SubOption[] = [
    { label: t('budgetWholeCategory'), value: WHOLE, taken: split },
    ...(categories.find((c) => c._uuid === categoryId)?.subs ?? []).map((s) => ({ label: s.name, value: s._uuid, taken: takenSubs.has(s._uuid) })),
  ];
  // ແກ້ໄຂ: ລາຍການຍ່ອຍທີ່ປິດໃຊ້ແລ້ວ — ສະແດງຈາກງົບເດີມ
  if (data?.sub && !subOptions.some((o) => o.value === data.sub_category_id)) {
    subOptions.push({ label: `${data.sub.name} (${t('inactive')})`, value: data.sub._uuid });
  }
  const renderSub = (label: ReactNode, item: any) => (
    <span className={`acc-sub-opt${item?.value === WHOLE ? ' is-whole' : ''}`}>
      <i className={`fa-solid ${item?.value === WHOLE ? 'fa-layer-group' : 'fa-arrow-right'}`} />
      {label}
      {item?.taken && <small>{t(item.value === WHOLE ? 'budgetWholeBlocked' : 'budgetSubTaken')}</small>}
    </span>
  );

  /** ປ່ຽນປະເພດ → ລ້າງລາຍການຍ່ອຍ; ປະເພດທີ່ຍັງບໍ່ມີງົບ = ທັງປະເພດ, ທີ່ແຍກງົບແລ້ວ = ຕ້ອງເລືອກລາຍການຍ່ອຍ */
  const chooseCategory = (next: number | null) => {
    setCategoryId(next);
    setSubId(next && !others.some((b) => b.category_id === next) ? WHOLE : null);
  };

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
    if (subId === null) return Notific.warning('budgetPickSub');
    if (!(total > 0)) return Notific.warning(monthly ? 'budgetMonthRequired' : 'budgetAmountRequired');
    const payload = {
      fiscal_id: fiscal._uuid,
      category_id: categoryId,
      sub_category_id: subId || null,
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
            <SelectPicker data={categoryOptions} value={categoryId} onChange={chooseCategory} block cleanable={false}
              disabled={!!data} placeholder={t('select')} popupClassName="acc-book-menu"
              renderOption={codeLabel} renderValue={codeLabel} locale={{ noResultsText: t('budgetAllTaken') }}
              className={checked && !categoryId ? 'has-error' : ''}
            />
          </div>
          <div className="is-wide rs-form-group">
            <label className="form-label">{t('fcSubs')}<span className="text-danger">*</span></label>
            <SelectPicker data={subOptions} value={subId} onChange={(value) => setSubId(value as number | null)} block cleanable={false}
              disabled={!!data || !categoryId} searchable={subOptions.length > 8} placeholder={t('select')}
              popupClassName="acc-book-menu is-expense" disabledItemValues={subOptions.filter((o) => o.taken).map((o) => o.value)}
              renderOption={renderSub} renderValue={(_: unknown, item: any) => renderSub(item?.label, { ...item, taken: false })}
              className={checked && categoryId && subId === null ? 'has-error' : ''}
            />
            {subId !== null && (
              <small className="acc-bg-field-hint">
                <i className="fa-solid fa-circle-info" /> {t(subId === WHOLE ? 'budgetWholeHint' : 'budgetSubHint')}
              </small>
            )}
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
