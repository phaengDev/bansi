import { forwardRef } from 'react';
import moment from 'moment';
import { useT } from '../../../context/LanguageContext';
import { minutesText, periodLabel } from '../attendance/attendanceApi';
import type { Company } from '../hrApi';
import { kip, type Payroll, type PayrollLine } from './payrollApi';

/** ພິມສະລິບເງິນເດືອນ — A5 ໜຶ່ງຄົນຕໍ່ໜ້າ */
export const PAYSLIP_PRINT_CSS = `
  @page { size: A5 portrait; margin: 10mm; }
  html, body { background: #fff !important; margin: 0; padding: 0; }
  .pay-print-area { display: block !important; }
  .pay-slip { box-shadow: none !important; border: 1px solid #d5dee6 !important; margin: 0 auto; max-width: 100%; break-inside: avoid; }
  .pay-slip + .pay-slip { break-before: page; margin-top: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/** ສະລິບເງິນເດືອນຂອງ 1 ຄົນ */
export const Payslip = forwardRef<HTMLDivElement, { payroll: Payroll; line: PayrollLine; company: Company | null }>(
  ({ payroll, line, company }, ref) => {
    const t = useT();
    const item = (label: string, amount: number, sub?: string) => (amount ? (
      <div className="pay-slip-row">
        <span>{label}{sub && <small> · {sub}</small>}</span>
        <b>{kip(amount)}</b>
      </div>
    ) : null);
    const deductions = line.sso_employee + line.tax + line.other_deduction;
    return (
      <div ref={ref} className="pay-slip">
        <header className="pay-slip-head">
          {company?.logo_url && <img src={company.logo_url} alt="" />}
          <span>
            <b>{company?.name_la ?? ''}</b>
            {company?.name_en && <small>{company.name_en}</small>}
          </span>
          <em>
            <b>{t('paySlip')}</b>
            <small>{periodLabel(payroll.period)}{payroll.pay_date ? ` · ${t('payPaidOn')} ${moment(payroll.pay_date).format('DD/MM/YYYY')}` : ''}</small>
          </em>
        </header>
        <section className="pay-slip-person">
          <div><small>{t('hrEmployee')}</small><b>{line.employee_name}</b><span>{line.emp_code}</span></div>
          <div><small>{t('hrDepartment')} / {t('hrPosition')}</small><b>{line.department_name ?? '—'}</b><span>{line.position_name ?? ''}</span></div>
          <div><small>{t('paySalaryAccount')}</small><b>{line.bank_name ?? '—'}</b><span>{line.bank_account_no ?? ''}</span></div>
        </section>
        <section className="pay-slip-days">
          <span><b>{line.employed_days}/{line.workdays}</b> {t('attWorkdays')}</span>
          <span><b>{line.present_days}</b> {t('attStatePresent')}</span>
          <span><b>{line.absent_days + line.unpaid_days}</b> {t('attStateAbsent')}</span>
          <span><b>{line.leave_days}</b> {t('attStateLeave')}</span>
          <span><b>{minutesText(line.late_minutes, t)}</b> {t('attLateEarly')}</span>
        </section>
        <section className="pay-slip-cols">
          <div>
            <h5>{t('payEarnings')}</h5>
            {item(t('hrBasicSalary'), line.base_pay, line.employed_days < line.workdays ? `${line.employed_days}/${line.workdays} ${t('payDays')}` : undefined)}
            {item(t('payAbsenceDeduction'), -line.absence_deduction)}
            {item(t('payLateDeduction'), -line.late_deduction)}
            {item(t('payAllowance'), line.allowance)}
            {item(t('payOvertime'), line.overtime)}
            {item(t('payBonus'), line.bonus)}
            <div className="pay-slip-row is-total"><span>{t('payGross')}</span><b>{kip(line.gross)}</b></div>
          </div>
          <div>
            <h5>{t('payDeductions')}</h5>
            {item(t('paySsoEmployee'), line.sso_employee)}
            {item(t('payTax'), line.tax)}
            {item(t('payOtherDeduction'), line.other_deduction)}
            {!deductions && <div className="pay-slip-row"><span>—</span><b>0</b></div>}
            <div className="pay-slip-row is-total"><span>{t('payDeductionTotal')}</span><b>{kip(deductions)}</b></div>
          </div>
        </section>
        <footer className="pay-slip-net">
          <span>{t('payNet')}</span>
          <b>₭ {kip(line.net)}</b>
        </footer>
        {line.note && <p className="pay-slip-note"><i className="fa-regular fa-note-sticky" /> {line.note}</p>}
      </div>
    );
  }
);
Payslip.displayName = 'Payslip';
