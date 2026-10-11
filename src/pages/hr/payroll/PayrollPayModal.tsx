import { useEffect, useState, type ReactNode } from 'react';
import { DatePicker, Form, Input, SelectPicker } from 'rsuite';
import moment from 'moment';
import { getApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { FormSection, SettingModal } from '../../account/setting/settingKit';
import { runSave } from '../../account/setting/settingApi';
import { periodLabel } from '../attendance/attendanceApi';
import { kip, type Payroll } from './payrollApi';

type CashAccount = {
  _uuid: number;
  acountName: string;
  acount_number?: string | null;
  balance_treasury: number;
  banks?: { abbr?: string; url?: string | null } | null;
  treasury?: { currency?: { name?: string } | null } | null;
};

const BASE_CURRENCY = 'LAK';

/**
 * ຈ່າຍເງິນເດືອນ — ເລືອກບັນຊີເງິນຄັງສະກຸນກີບ (ຍອດໃຊ້ໄດ້ຕ້ອງພໍ) ແລະ ວັນທີຈ່າຍ. ບັນທຶກແລ້ວ: ເງິນອອກຈາກບັນຊີ +
 * ລົງບັນຊີຄູ່ອັດຕະໂນມັດ (ຕາມການຜູກບັນຊີ ຜັງບັນຊີ → ຜູກບັນຊີ)
 */
const PayrollPayModal = ({ payroll, onClose, onPaid }: { payroll: Payroll; onClose: () => void; onPaid: (payroll: Payroll) => void }) => {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<CashAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const periodStart = moment(`${payroll.period}-01`);
  const [date, setDate] = useState<Date>(() => (moment().isBefore(periodStart) ? periodStart.toDate() : new Date()));
  const [description, setDescription] = useState(`${t('payPaySalary')} ${periodLabel(payroll.period)}`);

  useEffect(() => {
    getApi('/treasury-account/option')
      .then((res) => {
        const rows: CashAccount[] = (res.data?.data ?? [])
          .filter((a: CashAccount) => String(a.treasury?.currency?.name ?? '').toUpperCase() === BASE_CURRENCY)
          .map((a: CashAccount) => ({ ...a, balance_treasury: Number(a.balance_treasury) || 0 }));
        setAccounts(rows);
        const enough = rows.find((a) => a.balance_treasury >= payroll.total_net);
        if (enough) setAccountId(enough._uuid);
      })
      .catch((error) => Notific.error(getErrorMessage(error)));
  }, [payroll.total_net]);

  const account = accounts.find((a) => a._uuid === accountId);
  const after = account ? account.balance_treasury - payroll.total_net : null;

  const submit = async () => {
    if (!accountId) return Notific.warning('payPickAccount');
    if (after !== null && after < 0) return Notific.warning('payNotEnough');
    await runSave(async () => {
      const res = await putApi(`/payroll/pay/${btoa(String(payroll._uuid))}`, {
        account_id: accountId,
        pay_date: moment(date).format('YYYY-MM-DD'),
        description,
      });
      onPaid(res.data.data);
      onClose();
    }, setSaving);
  };

  const options = accounts.map((a) => ({
    value: a._uuid,
    label: [a.banks?.abbr, a.acountName, a.acount_number].filter(Boolean).join(' · '),
    balance: a.balance_treasury,
  }));

  return (
    <SettingModal title={`${t('payPaySalary')} ${periodLabel(payroll.period)}`} hint={t('payPayHint')} icon="fa-money-bill-transfer"
      saving={saving} onClose={onClose} onSubmit={submit}
    >
      <Form fluid>
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
            <SelectPicker block data={options} value={accountId} onChange={setAccountId} searchable={options.length > 6} cleanable={false}
              placeholder={accounts.length ? t('select') : t('payNoLakAccount')} popupClassName="acc-book-menu"
              renderMenuItem={(label: ReactNode, item: Record<string, unknown>) => (
                <span className="pay-acc-opt">
                  <span>{label}</span>
                  <em className={Number(item.balance) < payroll.total_net ? 'is-bad' : ''}>₭ {kip(Number(item.balance))}</em>
                </span>
              )}
            />
            {account && (
              <small className={`pay-field-hint${after! < 0 ? ' is-bad' : ''}`}>
                {t('payBalance')} {kip(account.balance_treasury)} → {t('payAfter')} {kip(after!)}
              </small>
            )}
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
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

export default PayrollPayModal;
