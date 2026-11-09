import { useEffect, useState } from 'react';
import { DatePicker, Form, Input } from 'rsuite';
import moment from 'moment';
import { getApi, putApi } from '../../../utils/configApi';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { FormSection, PickerField, SettingModal, SwitchRow, codeLabel } from '../../account/setting/settingKit';
import { useFinanceCategories, type FinanceSubCategory } from '../../../utils/selectOption';
import SubCategoryField from '../../account/journal/SubCategoryField';
import { subOptionsOf, withCategory, type SubRef } from '../../account/journal/journalKit';
import { runSave } from '../../account/setting/settingApi';
import { periodLabel } from '../attendance/attendanceApi';
import { LakAccountSelect, useLakAccounts } from './LakAccountSelect';
import { kip, type Payroll } from './payrollApi';

/**
 * ຈ່າຍເງິນເດືອນ — ເລືອກບັນຊີເງິນຄັງສະກຸນກີບ (ຍອດໃຊ້ໄດ້ຕ້ອງພໍ) ແລະ ວັນທີຈ່າຍ. ບັນທຶກແລ້ວ: ເງິນອອກຈາກບັນຊີ +
 * ລົງບັນຊີຄູ່ອັດຕະໂນມັດ (ຕາມການຜູກບັນຊີ ຜັງບັນຊີ → ຜູກບັນຊີ). ຕິກ "ບັນທຶກເປັນລາຍຈ່າຍ" = ສ້າງລາຍຈ່າຍຄູ່ (ປະເພດ → ລາຍການຍ່ອຍ)
 * ໃຫ້ເຫັນໃນໜ້າລາຍຈ່າຍ / ລາຍງານ — ບໍ່ຫັກເງິນ ຫຼື ລົງບັນຊີຊ້ຳ. ຄ່າຕັ້ງຕົ້ນ = ຕາມການຈ່າຍເທື່ອກ່ອນ
 */
const PayrollPayModal = ({ payroll, onClose, onPaid }: { payroll: Payroll; onClose: () => void; onPaid: (payroll: Payroll) => void }) => {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const accounts = useLakAccounts();
  const [accountId, setAccountId] = useState<number | null>(null);
  const periodStart = moment(`${payroll.period}-01`);
  const [date, setDate] = useState<Date>(() => (moment().isBefore(periodStart) ? periodStart.toDate() : new Date()));
  const [description, setDescription] = useState(`${t('payPaySalary')} ${periodLabel(payroll.period)}`);
  const categories = useFinanceCategories(2);
  const [record, setRecord] = useState(false);
  const [expense, setExpense] = useState<{ category_id: number | null; sub_category_id: number | null }>({ category_id: null, sub_category_id: null });
  const [addedSubs, setAddedSubs] = useState<FinanceSubCategory[]>([]);

  // ຄ່າຕັ້ງຕົ້ນ: ຕິກ + ລາຍການຍ່ອຍ ຕາມການຈ່າຍເງິນເດືອນເທື່ອກ່ອນ
  useEffect(() => {
    let alive = true;
    getApi('/payroll/expense-default')
      .then((res) => {
        if (!alive) return;
        const sub: SubRef | null = res.data?.sub ?? null;
        setRecord(!!res.data?.record);
        if (sub) setExpense({ category_id: sub.category_id, sub_category_id: sub._uuid });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // ເລືອກບັນຊີທຳອິດທີ່ຍອດພໍຈ່າຍໃຫ້ເອງ
  useEffect(() => {
    const enough = accounts.find((a) => a.balance_treasury >= payroll.total_net);
    if (enough) setAccountId((current) => current ?? enough._uuid);
  }, [accounts, payroll.total_net]);

  const account = accounts.find((a) => a._uuid === accountId);
  const after = account ? account.balance_treasury - payroll.total_net : null;

  const categoryOptions = categories.map((c) => ({ label: `${c.type_code} ${c.type_name}`, value: c._uuid, code: c.type_code, name: c.type_name, tone: 'is-coral' }));
  const subOptions = subOptionsOf(categories, expense.category_id, null, '', addedSubs);

  const submit = async () => {
    if (!accountId) return Notific.warning('payPickAccount');
    if (after !== null && after < 0) return Notific.warning('payNotEnough');
    if (record && !expense.sub_category_id) return Notific.warning('payPickExpenseSub');
    await runSave(async () => {
      const res = await putApi(`/payroll/pay/${btoa(String(payroll._uuid))}`, {
        account_id: accountId,
        pay_date: moment(date).format('YYYY-MM-DD'),
        description,
        ...(record ? { expense_sub_id: expense.sub_category_id } : {}),
      });
      onPaid(res.data.data);
      onClose();
    }, setSaving);
  };

  return (
    <SettingModal title={`${t('payPaySalary')} ${periodLabel(payroll.period)}`} hint={t('payPayHint')} icon="fa-money-bill-transfer"
      saving={saving} onClose={onClose} onSubmit={submit} keyboard={false}
    >
      <Form fluid formValue={expense} onChange={(next) => setExpense(withCategory(next as typeof expense, expense.category_id, categories))}>
        <div className="pay-pay-total">
          <span>
            <small>{t('payNetTotal')}</small>
            <b>₭ {kip(payroll.total_net)}</b>
          </span>
          <em><i className="fa-solid fa-users" /> {payroll.employees} {t('hrPeople')}</em>
        </div>
        <FormSection title={t('payFromAccount')}>
          <div className="is-wide rs-form-group">
            <label className="form-label">{t('payAccount')}<span className="text-danger">*</span></label>
            <LakAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} amount={payroll.total_net} />
          </div>
          <div className="rs-form-group">
            <label className="form-label">{t('payDate')}<span className="text-danger">*</span></label>
            <DatePicker value={date} onChange={(d) => d && setDate(d)} oneTap format="dd/MM/yyyy" block cleanable={false}
              shouldDisableDate={(d) => moment(d).isAfter(moment(), 'day') || moment(d).isBefore(periodStart, 'day')}
            />
          </div>
          <div className="rs-form-group">
            <label className="form-label">{t('payDescription')}</label>
            <Input value={description} onChange={setDescription} maxLength={255} />
          </div>
        </FormSection>
        <FormSection title={t('payRecordExpense')}>
          <div className="is-wide">
            <SwitchRow checked={record} onChange={setRecord} className={`pay-record-toggle${record ? ' is-on' : ''}`} label={t('payRecordExpenseLabel')} end>
              <span className="pay-record-icon"><i className="fa-solid fa-receipt" /></span>
              <span className="pay-record-text">
                <b>{t('payRecordExpenseLabel')}</b>
                <small>{t('payRecordExpenseHint')} ₭ {kip(payroll.total_net)}</small>
              </span>
            </SwitchRow>
          </div>
          {record && (
            <>
              <PickerField name="category_id" label={t('expenseCategory')} data={categoryOptions} placeholder={t('select')}
                cleanable={false} renderOption={codeLabel} renderValue={codeLabel}
              />
              <SubCategoryField categoryId={expense.category_id} categoryLabel={categoryOptions.find((c) => c.value === expense.category_id)?.label ?? ''}
                options={subOptions} expense
                onCreated={(created) => {
                  setAddedSubs((list) => [...list.filter((x) => x._uuid !== created._uuid), created]);
                  setExpense((prev) => ({ ...prev, sub_category_id: created._uuid }));
                }}
              />
            </>
          )}
        </FormSection>
        <FormSection title={t('payPosting')}>
          <div className="is-wide pay-posting">
            <span><em className="is-dr">Dr</em> {t('payPostSalary')} <b>{kip(payroll.total_gross)}</b></span>
            {!!payroll.total_sso_employer && <span><em className="is-dr">Dr</em> {t('paySsoEmployer')} <b>{kip(payroll.total_sso_employer)}</b></span>}
            <span><em className="is-cr">Cr</em> {account?.acountName ?? t('payAccount')} <b>{kip(payroll.total_net)}</b></span>
            {!!(payroll.total_sso_employee + payroll.total_sso_employer) && (
              <span><em className="is-cr">Cr</em> {t('payPostSsoPayable')} <b>{kip(payroll.total_sso_employee + payroll.total_sso_employer)}</b></span>
            )}
            {!!payroll.total_tax && <span><em className="is-cr">Cr</em> {t('payPostTaxPayable')} <b>{kip(payroll.total_tax)}</b></span>}
            {!!payroll.total_other_deduction && <span><em className="is-cr">Cr</em> {t('payOtherDeduction')} <b>{kip(payroll.total_other_deduction)}</b></span>}
            {!!payroll.total_advance_deduction && <span><em className="is-cr">Cr</em> {t('advPostAccount')} <b>{kip(payroll.total_advance_deduction)}</b></span>}
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

export default PayrollPayModal;
