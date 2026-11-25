import { useMemo, useState, type ReactNode } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { useT } from '../../context/LanguageContext';
import { formatNumber } from '../../utils/configApi';
import { FilterSelect, SearchBox } from '../account/setting/settingKit';
import { MonthStepper } from './attendance/attendanceKit';
import { useGetData } from './attendance/attendanceApi';

type Change = [unknown, unknown];
type AuditRow = {
  _uuid: number;
  at: string;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: number | null;
  label: string | null;
  changes: Record<string, Change> | null;
};
type AuditData = {
  month: string;
  data: AuditRow[];
  /** id → ຊື່ ຂອງຊ່ອງທີ່ເປັນ id (department_id, position_id, bank_id, partner_id) */
  names: Record<string, Record<string, string>>;
  users: { value: number; label: string }[];
  limited: boolean;
};

/** ການກະທຳ → ຊື່ + ໄອຄອນ + ສີ */
const ACTIONS: Record<string, { label: string; icon: string; tone: string }> = {
  update: { label: 'auditActUpdate', icon: 'fa-pen', tone: 'is-blue' },
  cancel: { label: 'auditActCancel', icon: 'fa-ban', tone: 'is-red' },
  delete: { label: 'auditActDelete', icon: 'fa-trash', tone: 'is-red' },
  reverse: { label: 'auditActReverse', icon: 'fa-rotate-left', tone: 'is-red' },
  close: { label: 'auditActClose', icon: 'fa-lock', tone: 'is-violet' },
  reopen: { label: 'auditActReopen', icon: 'fa-lock-open', tone: 'is-gold' },
  pay: { label: 'auditActPay', icon: 'fa-money-bill-wave', tone: 'is-green' },
  unpay: { label: 'auditActUnpay', icon: 'fa-rotate-left', tone: 'is-gold' },
  password: { label: 'auditActPassword', icon: 'fa-key', tone: 'is-violet' },
  lock: { label: 'auditActLock', icon: 'fa-lock', tone: 'is-violet' },
  unlock: { label: 'auditActUnlock', icon: 'fa-lock-open', tone: 'is-gold' },
};

/** ປະເພດລາຍການ → ຊື່ + ໄອຄອນ (ລຳດັບ = ລຳດັບໃນຕົວກັ່ນ) */
const ENTITIES: Record<string, { label: string; icon: string }> = {
  income: { label: 'auditEntIncome', icon: 'fa-arrow-down' },
  expense: { label: 'auditEntExpense', icon: 'fa-arrow-up' },
  recurring: { label: 'recurMenu', icon: 'fa-repeat' },
  invoice: { label: 'auditEntInvoice', icon: 'fa-file-invoice-dollar' },
  payment: { label: 'auditEntPayment', icon: 'fa-hand-holding-dollar' },
  journal: { label: 'auditEntJournal', icon: 'fa-book' },
  chart_account: { label: 'auditEntChartAccount', icon: 'fa-sitemap' },
  tax: { label: 'auditEntTax', icon: 'fa-percent' },
  account_setting: { label: 'auditEntAccountSetting', icon: 'fa-gears' },
  period: { label: 'auditEntPeriod', icon: 'fa-calendar-check' },
  fiscal_year: { label: 'auditEntFiscalYear', icon: 'fa-calendar' },
  company: { label: 'auditEntCompany', icon: 'fa-building' },
  company_doc: { label: 'auditEntCompanyDoc', icon: 'fa-folder-open' },
  employee: { label: 'auditEntEmployee', icon: 'fa-id-card' },
  payroll: { label: 'auditEntPayroll', icon: 'fa-money-check-dollar' },
  payroll_line: { label: 'auditEntPayrollLine', icon: 'fa-file-invoice' },
  advance: { label: 'auditEntAdvance', icon: 'fa-hand-holding-dollar' },
  user: { label: 'auditEntUser', icon: 'fa-user-shield' },
  menu: { label: 'auditEntMenu', icon: 'fa-table-cells' },
};

/** ຊ່ອງ → ຊື່ (dict key) */
const FIELDS: Record<string, string> = {
  income_date: 'date', expense_date: 'date', doc_date: 'date', due_date: 'auditFDueDate', start_date: 'hrStartDate', end_date: 'hrEndDate',
  incom_title: 'auditFTitle', expense_title: 'auditFTitle', name: 'name', name_la: 'name', name_en: 'hrCompanyNameEn', user_name: 'auditFUserName',
  acount_id_fk: 'auditFAccount', receive_type: 'auditFPayType', pay_type: 'auditFPayType', partner_id: 'auditFPartner', payee_name: 'auditFPayee', bill_no: 'auditFBillNo',
  balances: 'auditFSubtotal', subtotal: 'auditFSubtotal', tax: 'tax', balance_income: 'total', balance_expense: 'total', total: 'total', amount: 'amount',
  exchange_rate: 'exchangeRate', description: 'description', note: 'note', status: 'status', work_status: 'hrWorkStatus',
  basic_salary: 'hrBasicSalary', bank_id: 'hrBank', bank_account_no: 'hrBankAccountNo', department_id: 'hrDepartment', position_id: 'hrPosition',
  allowance: 'payAllowance', bonus: 'payBonus', overtime: 'payOvertime', other_deduction: 'payOtherDeduction', advance_deduction: 'payAdvanceDeduction',
  sso_employee: 'paySso', net: 'payNet', employees: 'auditFEmployees',
  type_user: 'auditFTypeUser', employee_id: 'auditFEmployeeLink', creates: 'auditFCreates', updates: 'auditFUpdates', deletes: 'auditFDeletes',
  menu_access: 'auditFMenus', approve_leave: 'auditFApproveLeave', approve_correction: 'auditFApproveCorrection', approve_advance: 'auditFApproveAdvance',
  account_code: 'auditFCode', tax_code: 'auditFCode', parent_id: 'auditFParent', account_type: 'auditFAccountType', is_postable: 'auditFPostable',
  doc_no: 'cdNo', issue_date: 'cdIssueDate', expiry_date: 'cdExpiryDate', original_name: 'auditFFile',
  day_of_month: 'recurDay',
  rate: 'auditFRate', calc_method: 'auditFCalcMethod', is_default: 'auditFDefault', lock_date: 'auditFLockDate',
  accounting_mode: 'acgMode', number_format: 'acgNumberFormat', tax_id: 'acgTaxId', chief_accountant: 'acgChiefAccountant', director: 'acgDirector',
  use_vat: 'acgVat', use_fixed_assets: 'acgFixedAssets', use_withholding: 'acgWithholding', use_fx_revaluation: 'acgFxReval', use_bank_reconciliation: 'acgBankRec',
  profit_tax_rate: 'acgProfitTaxRate', invoice_license: 'auditFInvoiceLicense', invoice_account_id: 'acgInvoiceBank', invoice_copies: 'acgInvoiceCopies',
};

/** ສະຖານະຕາມປະເພດ → dict key */
const STATUS: Record<string, Record<number, string>> = {
  income: { 1: 'auditStActive', 2: 'auditStCancelled' },
  expense: { 1: 'auditStActive', 2: 'auditStCancelled' },
  invoice: { 1: 'auditStActive', 2: 'auditStCancelled' },
  payment: { 1: 'auditStActive', 2: 'auditStCancelled' },
  payroll: { 1: 'auditStDraft', 2: 'auditStPaid' },
  fiscal_year: { 1: 'auditStOpen', 2: 'auditStClosed' },
  advance: { 1: 'leaveStatusPending', 2: 'leaveStatusApproved', 3: 'auditStPaid', 4: 'auditStSettled', 5: 'leaveStatusRejected', 6: 'leaveStatusCancelled' },
  employee: { 1: 'hrWorking', 2: 'hrResigned' },
};
const MONEY = new Set(['balances', 'subtotal', 'tax', 'balance_income', 'balance_expense', 'total', 'amount', 'basic_salary', 'allowance', 'bonus', 'overtime',
  'other_deduction', 'advance_deduction', 'sso_employee', 'net']);
const YES_NO = new Set(['use_vat', 'use_fixed_assets', 'use_withholding', 'use_fx_revaluation', 'use_bank_reconciliation', 'is_postable', 'is_default']);
/** ສິດຂອງຜູ້ໃຊ້: 1 = ອະນຸຍາດ, ອື່ນໆ = ບໍ່ອະນຸຍາດ */
const ALLOW = new Set(['creates', 'updates', 'deletes', 'approve_leave', 'approve_correction', 'approve_advance']);

/**
 * ປະຫວັດການແກ້ໄຂ — ໃຜ ແກ້ໄຂ / ຍົກເລີກ / ລຶບ ຫຍັງ ເມື່ອໃດ (ສະເພາະເລື່ອງສຳຄັນ: ເອກະສານເງິນ, ເງິນເດືອນ, ສິດຜູ້ໃຊ້, ຕັ້ງຄ່າ)
 * ພ້ອມຄ່າເກົ່າ → ໃໝ່ ຂອງຊ່ອງທີ່ປ່ຽນ. ກັ່ນຕາມເດືອນ, ປະເພດ, ຜູ້ໃຊ້ ແລະ ຄຳຄົ້ນ
 */
const AuditLogPage = () => {
  const t = useT();
  const [period, setPeriod] = useState(() => moment().format('YYYY-MM'));
  const [entity, setEntity] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const { data, loading, reload } = useGetData<AuditData>('/audit/fetch', { month: period, entity, user_id: userId });

  const entityOptions = useMemo(() => Object.entries(ENTITIES).map(([value, meta]) => ({ value, label: t(meta.label) })), [t]);
  const q = keyword.trim().toLowerCase();
  const rows = (data?.data ?? []).filter((row) => !q || `${row.label ?? ''} ${row.user_name ?? ''} ${t(ENTITIES[row.entity]?.label ?? row.entity)}`.toLowerCase().includes(q));

  const groups = rows.reduce<{ day: string; rows: AuditRow[] }[]>((list, row) => {
    const day = moment(row.at).format('YYYY-MM-DD');
    const last = list[list.length - 1];
    if (last?.day === day) last.rows.push(row);
    else list.push({ day, rows: [row] });
    return list;
  }, []);

  /** ຄ່າທີ່ອ່ານອອກຂອງຊ່ອງ */
  const show = (row: AuditRow, field: string, value: unknown): ReactNode => {
    // ເມນູທີ່ໃຊ້ໄດ້: NULL = ທຸກເມນູ
    if (field === 'menu_access' && (value === null || value === '')) return t('auditAllMenus');
    if (value === null || value === undefined || value === '') return <span className="audit-empty">—</span>;
    const names = data?.names?.[field];
    if (names && names[String(value)]) return names[String(value)];
    if (field === 'status' || field === 'work_status') {
      const key = STATUS[row.entity]?.[Number(value)];
      if (key) return t(key);
    }
    if (field === 'menu_access') {
      try {
        const list = JSON.parse(String(value));
        return Array.isArray(list) ? `${list.length} ${t('auditMenus')}` : t('auditAllMenus');
      } catch {
        return String(value);
      }
    }
    if (ALLOW.has(field)) return Number(value) === 1 ? t('auditAllowed') : t('auditDenied');
    if (YES_NO.has(field)) return Number(value) === 1 ? t('auditOn') : t('auditOff');
    if (MONEY.has(field) && Number.isFinite(Number(value))) return formatNumber(Number(value));
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return moment(value).format('DD/MM/YYYY');
    return String(value);
  };

  return (
    <div className="acc-rp audit-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <MonthStepper period={period} onChange={setPeriod} />
          <FilterSelect data={entityOptions} value={entity} onChange={setEntity} placeholder={t('auditAllTypes')} width={210} />
          <FilterSelect data={data?.users ?? []} value={userId} onChange={setUserId} placeholder={t('auditAllUsers')} width={180} />
          <SearchBox value={keyword} onChange={setKeyword} placeholder={t('auditSearch')} grow />
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading} aria-label={t('reload')}><i className="fa-solid fa-rotate-right" /></button>
          </div>
        </div>
        <p className="audit-note"><i className="fa-solid fa-circle-info" /> {t('auditNote')}</p>
      </div>

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !rows.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-clock-rotate-left" /><p>{t('auditEmpty')}</p></div>
      ) : (
        <div className={`audit-feed${loading ? ' is-refreshing' : ''}`}>
          {data.limited && <p className="audit-note is-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('auditLimited')}</p>}
          {groups.map((group) => (
            <section key={group.day}>
              <h4 className="audit-day"><i className="fa-regular fa-calendar" /> {moment(group.day).format('DD/MM/YYYY')} <em>{group.rows.length}</em></h4>
              <ul className="audit-list">
                {group.rows.map((row) => {
                  const action = ACTIONS[row.action] ?? { label: row.action, icon: 'fa-circle', tone: 'is-blue' };
                  const meta = ENTITIES[row.entity] ?? { label: row.entity, icon: 'fa-file' };
                  const changes = Object.entries(row.changes ?? {});
                  return (
                    <li key={row._uuid} className="audit-row">
                      <span className={`audit-action ${action.tone}`}><i className={`fa-solid ${action.icon}`} /> {t(action.label)}</span>
                      <div className="audit-main">
                        <b><i className={`fa-solid ${meta.icon}`} /> {t(meta.label)}{row.label ? <> · <span>{row.label}</span></> : row.entity_id ? ` #${row.entity_id}` : ''}</b>
                        {!!changes.length && (
                          <ul className="audit-changes">
                            {changes.map(([field, [before, after]]) => (
                              <li key={field}>
                                <em>{t(FIELDS[field] ?? field)}</em>
                                <s>{show(row, field, before)}</s>
                                <i className="fa-solid fa-arrow-right" />
                                <strong>{row.action === 'delete' ? <span className="audit-empty">{t('auditActDelete')}</span> : show(row, field, after)}</strong>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <span className="audit-who">
                        <b><i className="fa-solid fa-user" /> {row.user_name ?? t('auditSystem')}</b>
                        <small>{moment(row.at).format('HH:mm')}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
