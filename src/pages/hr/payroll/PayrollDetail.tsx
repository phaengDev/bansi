import { useRef, useState } from 'react';
import { Button, Loader, Modal } from 'rsuite';
import moment from 'moment';
import { deleteApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canDelete, canEdit } from '../../../utils/localStorage';
import { exportExcel } from '../../../utils/exportHelpers';
import { printElementByFrame } from '../../../utils/Print';
import { useT } from '../../../context/LanguageContext';
import { minutesText, periodLabel } from '../attendance/attendanceApi';
import {
  DRAFT, MODE_POLICY, PAID, accountText, employeeDeductions, kip, useCompany, usePayroll, type Payroll, type PayrollLine,
} from './payrollApi';
import { PAYSLIP_PRINT_CSS, Payslip } from './Payslip';
import PayrollLineForm from './PayrollLineForm';
import PayrollPayModal from './PayrollPayModal';

export const PayrollStatusPill = ({ status }: { status: number }) => {
  const t = useT();
  const paid = Number(status) === PAID;
  return (
    <span className={`acs-pill ${paid ? 'is-green' : 'is-gold'}`}>
      <i className={`fa-solid ${paid ? 'fa-circle-check' : 'fa-pen-ruler'}`} /> {t(paid ? 'payStatusPaid' : 'payStatusDraft')}
    </span>
  );
};

/**
 * ໃບເງິນເດືອນ 1 ເດືອນ — ຍອດລວມ, ລາຍຄົນ (ກົດ = ແກ້ໄຂ ເມື່ອເປັນຮ່າງ / ເບິ່ງສະລິບ ເມື່ອຈ່າຍແລ້ວ), ຄິດໄລ່ໃໝ່,
 * ຈ່າຍ / ຍົກເລີກການຈ່າຍ, Excel (ລາຍລະອຽດ + ລາຍຊື່ໂອນເງິນເຂົ້າທະນາຄານ), ພິມສະລິບທຸກຄົນ
 */
const PayrollDetail = ({ id, onBack, onChanged }: { id: number; onBack: () => void; onChanged: () => void }) => {
  const t = useT();
  const { data, settings, loading, setData } = usePayroll(id);
  const company = useCompany();
  const printRef = useRef<HTMLDivElement>(null);
  const slipRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<PayrollLine | null>(null);
  const [slip, setSlip] = useState<PayrollLine | null>(null);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!data) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const draft = Number(data.status) === DRAFT;
  const lines = data.lines ?? [];
  const title = `${t('accountAppPayroll')} ${periodLabel(data.period)}`;

  const updated = (next: Payroll) => {
    setData(next);
    onChanged();
  };

  const run = async (task: () => Promise<Payroll | null>, message: string) => {
    try {
      setBusy(true);
      const next = await task();
      Notific.success(message);
      if (next) updated(next);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const recalc = () => run(async () => (await putApi(`/payroll/recalc/${btoa(String(id))}`)).data.data, 'payRecalculated');
  const unpay = () => Notific.confirm(`${t('payUnpayConfirm')} ${periodLabel(data.period)}`, () =>
    run(async () => (await putApi(`/payroll/unpay/${btoa(String(id))}`)).data.data, 'payUnpaid'));
  const removeRun = () => Notific.confirm(`${t('payDeleteConfirm')} ${periodLabel(data.period)}`, async () => {
    try {
      await deleteApi(`/payroll/${btoa(String(id))}`);
      Notific.success('acsDeleted');
      onChanged();
      onBack();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });
  const removeLine = (line: PayrollLine) => Notific.confirm(`${t('payLineDeleteConfirm')} ${line.employee_name}`, () =>
    run(async () => (await deleteApi(`/payroll/line/${btoa(String(line._uuid))}`)).data.data, 'acsDeleted'));

  const exportDetail = () => exportExcel(lines.map((l) => ({
    [t('hrEmployeeCode')]: l.emp_code,
    [t('hrEmployee')]: l.employee_name,
    [t('hrDepartment')]: l.department_name ?? '',
    [t('hrPosition')]: l.position_name ?? '',
    [t('hrBasicSalary')]: l.basic_salary,
    [t('attWorkdays')]: `${l.employed_days}/${l.workdays}`,
    [t('attPresentDays')]: l.present_days,
    [t('attAbsentDays')]: l.absent_days,
    [t('attUnpaidDays')]: l.unpaid_days,
    [t('attLateMinutes')]: l.late_minutes,
    [t('payBasePay')]: l.base_pay,
    [t('payAbsenceDeduction')]: l.absence_deduction,
    [t('payLateDeduction')]: l.late_deduction,
    [t('payAllowance')]: l.allowance,
    [t('payOvertime')]: l.overtime,
    [t('payBonus')]: l.bonus,
    [t('payGross')]: l.gross,
    [t('paySsoEmployee')]: l.sso_employee,
    [t('paySsoEmployer')]: l.sso_employer,
    [t('payTaxable')]: l.taxable,
    [t('payTax')]: l.tax,
    [t('payOtherDeduction')]: l.other_deduction,
    [t('payNet')]: l.net,
    [t('attNote')]: l.note ?? '',
  })), `payroll_${data.period}`, title);

  const exportBank = () => exportExcel(lines.map((l, i) => ({
    '#': i + 1,
    [t('hrEmployeeCode')]: l.emp_code,
    [t('hrEmployee')]: l.employee_name,
    [t('hrBank')]: l.bank_name ?? '',
    [t('hrBankAccountNo')]: l.bank_account_no ?? '',
    [t('hrBankAccountName')]: l.bank_account_name ?? '',
    [t('payNet')]: l.net,
  })), `payroll-bank_${data.period}`, `${t('payBankList')} ${periodLabel(data.period)}`);

  const noBank = lines.filter((l) => !l.bank_account_no).length;

  const printAll = () => {
    if (printRef.current) printElementByFrame(printRef.current, PAYSLIP_PRINT_CSS);
  };

  const sumOf = (pick: (l: PayrollLine) => number) => lines.reduce((n, l) => n + pick(l), 0);

  return (
    <div className="acc-rp pay-page">
      <div className="acc-rp-head">
        <button type="button" className="acc-rp-btn" onClick={onBack} aria-label={t('back')}><i className="fa-solid fa-arrow-left" /></button>
        <span className="acc-rp-icon"><i className="fa-solid fa-money-check-dollar" /></span>
        <span className="acc-rp-title">
          <h3>{title} <PayrollStatusPill status={data.status} /></h3>
          <small>
            {data.employees} {t('hrPeople')} · {data.workdays} {t('attWorkdays')}
            {data.number && ` · ${data.number}`}
          </small>
        </span>
        <div className="acc-rp-actions">
          {draft && (
            <>
              <button type="button" className="acc-rp-btn" disabled={!canEdit || busy} onClick={recalc} title={t('payRecalcHint')}>
                <i className={`fa-solid fa-rotate${busy ? ' fa-spin' : ''}`} /> {t('payRecalc')}
              </button>
              <button type="button" className="acc-rp-btn is-danger" disabled={!canDelete || busy} onClick={removeRun}>
                <i className="fa-solid fa-trash" /> {t('delete')}
              </button>
            </>
          )}
          <button type="button" className="acc-rp-btn" onClick={exportDetail} disabled={!lines.length}><i className="fa-solid fa-file-excel" /> Excel</button>
          <button type="button" className="acc-rp-btn" onClick={exportBank} disabled={!lines.length} title={t('payBankListHint')}>
            <i className="fa-solid fa-building-columns" /> {t('payBankList')}
          </button>
          <button type="button" className="acc-rp-btn" onClick={printAll} disabled={!lines.length}><i className="fa-solid fa-print" /> {t('paySlips')}</button>
          {draft ? (
            <button type="button" className="acc-rp-btn is-primary" disabled={!canEdit || busy || data.total_net <= 0} onClick={() => setPaying(true)}>
              <i className="fa-solid fa-money-bill-transfer" /> {t('payPaySalary')}
            </button>
          ) : (
            <button type="button" className="acc-rp-btn is-danger" disabled={!canEdit || busy} onClick={unpay}>
              <i className="fa-solid fa-rotate-left" /> {t('payUnpay')}
            </button>
          )}
        </div>
      </div>

      {draft && !data.complete && <p className="acc-bg-note is-warn"><i className="fa-solid fa-hourglass-half" /> {t('payIncompleteMonth')}</p>}
      {!draft && (
        <p className="acc-bg-note pay-paid-note">
          <i className="fa-solid fa-circle-check" /> {t('payPaidOn')} {data.pay_date && moment(data.pay_date).format('DD/MM/YYYY')}
          {data.account && <> · {accountText(data.account)}</>}
          {data.description && <> · {data.description}</>}
        </p>
      )}
      {!!noBank && <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {noBank} {t('payNoBankAccount')}</p>}

      <div className={`acc-rp-body${loading || busy ? ' is-refreshing' : ''}`}>
        <div className="acc-rp-kpis">
          <div className="acc-rp-kpi is-main">
            <small>{t('payNetTotal')}</small>
            <b>₭ {kip(data.total_net)}</b>
            <em>{data.employees} {t('hrPeople')}</em>
          </div>
          <div className="acc-rp-kpi">
            <small>{t('payGross')}</small>
            <b>{kip(data.total_gross)}</b>
            <em className="is-flat">
              {data.total_attendance_deduction ? `−${kip(data.total_attendance_deduction)} ${t('payAttendanceShort')}` : ''}
              {data.total_additions ? ` +${kip(data.total_additions)} ${t('payAdditionsShort')}` : ''}
            </em>
          </div>
          <div className="acc-rp-kpi">
            <small>{t('payDeductionTotal')}</small>
            <b>{kip(employeeDeductions(data))}</b>
            <em className="is-flat">{t('paySso')} {kip(data.total_sso_employee)} · {t('payTax')} {kip(data.total_tax)}</em>
          </div>
          <div className="acc-rp-kpi">
            <small>{t('payCompanyCost')}</small>
            <b>{kip(data.total_gross + data.total_sso_employer)}</b>
            <em className="is-flat">{t('paySsoEmployer')} {kip(data.total_sso_employer)}</em>
          </div>
        </div>

        {!lines.length ? (
          <div className="acc-class-empty"><i className="fa-solid fa-users" /><p>{t('payNoLines')}</p></div>
        ) : (
          <div className="acc-gl-group">
            <div className="acc-rp-scroll">
              <table className="acc-gl-table hr-table pay-table">
                <thead>
                  <tr>
                    <th>{t('hrEmployee')}</th>
                    <th>{t('payAttendance')}</th>
                    <th className="is-num">{t('payBasePay')}</th>
                    <th className="is-num">{t('payAttendanceShort')}</th>
                    <th className="is-num">{t('payAdditionsShort')}</th>
                    <th className="is-num">{t('payGross')}</th>
                    <th className="is-num">{t('paySso')}</th>
                    <th className="is-num">{t('payTax')}</th>
                    <th className="is-num">{t('payOtherShort')}</th>
                    <th className="is-num">{t('payNet')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const manual = [l.deduction_mode, l.sso_mode, l.tax_mode].some((mode) => mode !== MODE_POLICY);
                    return (
                      <tr key={l._uuid} className="is-click" onClick={() => (draft && canEdit ? setEditing(l) : setSlip(l))}>
                        <td>
                          <b>{l.employee_name}</b>
                          <small className="acc-gl-ref">
                            {l.emp_code}{l.department_name ? ` · ${l.department_name}` : ''}
                            {manual && <> · <i className="fa-solid fa-hand" title={t('payHasManual')} /></>}
                            {l.note && <> · <i className="fa-regular fa-note-sticky" title={l.note} /></>}
                          </small>
                        </td>
                        <td>
                          <span className="pay-days">
                            <b>{l.present_days}/{l.employed_days}</b>
                            {!!(l.absent_days + l.unpaid_days) && <em className="is-absent">{t('attShortAbsent')} {l.absent_days + l.unpaid_days}</em>}
                            {!!l.late_minutes && <em className="is-late" title={minutesText(l.late_minutes, t)}>{t('attShortLate')} {l.late_days}</em>}
                          </span>
                        </td>
                        <td className="is-num">
                          {kip(l.base_pay)}
                          {l.base_pay !== l.basic_salary && <small className="acc-gl-ref">/ {kip(l.basic_salary)}</small>}
                        </td>
                        <td className="is-num pay-minus">{l.absence_deduction + l.late_deduction ? `−${kip(l.absence_deduction + l.late_deduction)}` : '—'}</td>
                        <td className="is-num pay-plus">{l.allowance + l.overtime + l.bonus ? `+${kip(l.allowance + l.overtime + l.bonus)}` : '—'}</td>
                        <td className="is-num"><b>{kip(l.gross)}</b></td>
                        <td className="is-num">{kip(l.sso_employee)}</td>
                        <td className="is-num">{kip(l.tax)}</td>
                        <td className="is-num">{l.other_deduction ? kip(l.other_deduction) : '—'}</td>
                        <td className={`is-num pay-net${l.net < 0 ? ' is-bad' : ''}`}><b>{kip(l.net)}</b></td>
                        <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="acc-gl-act" title={t('paySlip')} onClick={() => setSlip(l)}><i className="fa-solid fa-receipt" /></button>
                          {draft && (
                            <button type="button" className="acc-gl-act is-danger" disabled={!canDelete || busy} title={t('delete')} onClick={() => removeLine(l)}>
                              <i className="fa-solid fa-user-minus" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}><b>{t('total')}</b></td>
                    <td className="is-num">{kip(data.total_base)}</td>
                    <td className="is-num pay-minus">{data.total_attendance_deduction ? `−${kip(data.total_attendance_deduction)}` : '—'}</td>
                    <td className="is-num pay-plus">{data.total_additions ? `+${kip(data.total_additions)}` : '—'}</td>
                    <td className="is-num"><b>{kip(data.total_gross)}</b></td>
                    <td className="is-num">{kip(data.total_sso_employee)}</td>
                    <td className="is-num">{kip(data.total_tax)}</td>
                    <td className="is-num">{kip(sumOf((l) => l.other_deduction))}</td>
                    <td className="is-num pay-net"><b>{kip(data.total_net)}</b></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ສະລິບທຸກຄົນສຳລັບພິມ (ເຊື່ອງ) */}
      <div className="pay-print-area" ref={printRef} aria-hidden="true">
        {lines.map((l) => <Payslip key={l._uuid} payroll={data} line={l} company={company} />)}
      </div>

      {editing && <PayrollLineForm line={editing} settings={settings} onClose={() => setEditing(null)} onSaved={updated} />}
      {paying && <PayrollPayModal payroll={data} onClose={() => setPaying(false)} onPaid={updated} />}
      {slip && (
        <Modal open onClose={() => setSlip(null)} size="sm" className="pay-slip-modal">
          <Modal.Body>
            <Payslip ref={slipRef} payroll={data} line={slip} company={company} />
          </Modal.Body>
          <Modal.Footer>
            <Button appearance="default" onClick={() => setSlip(null)}>{t('close')}</Button>
            <Button appearance="primary" onClick={() => slipRef.current && printElementByFrame(slipRef.current, PAYSLIP_PRINT_CSS)}>
              <i className="fa-solid fa-print" /> {t('print')}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default PayrollDetail;
