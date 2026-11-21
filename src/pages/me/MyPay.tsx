import { useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { useT } from '../../context/LanguageContext';
import { periodLabel, toPeriod, useGetData } from '../hr/attendance/attendanceApi';
import { kip, lineDeductions, useCompany, type PayrollLine } from '../hr/payroll/payrollApi';
import { PayslipModal } from '../hr/payroll/Payslip';
import { MonthStepper } from '../hr/attendance/attendanceKit';
import { YearStepper } from '../account/setting/settingKit';
import type { MyPayPreview, MyPayslip, MyPayslipData } from './meApi';

/** ສະຖານະຂອງເງິນເດືອນເດືອນທີ່ເລືອກ: ຄາດຄະເນ / HR ກຳລັງກວດ / ຈ່າຍແລ້ວ */
const PREVIEW_STATUS: Record<MyPayPreview['status'], { label: string; hint: string; tone: string; icon: string }> = {
  estimate: { label: 'myPayEstimate', hint: 'myPayEstimateHint', tone: 'is-late', icon: 'fa-calculator' },
  draft: { label: 'myPayDraft', hint: 'myPayDraftHint', tone: 'is-leave', icon: 'fa-user-pen' },
  paid: { label: 'myPayPaid', hint: 'myPayPaidHint', tone: 'is-present', icon: 'fa-circle-check' },
};

/** ຍອດໂດຍຫຍໍ້ຂອງແຖວເງິນເດືອນ: ລວມກ່ອນຫັກ, ຫັກ (ປກສ + ອາກອນ + ອື່ນໆ + ເງິນເບີກ), ສຸດທິ */
const totalsOf = (line: PayrollLine) => ({ gross: line.gross, deducted: lineDeductions(line), net: line.net });

/**
 * ເງິນເດືອນຂອງຂ້ອຍ — ເງິນເດືອນເດືອນທີ່ເລືອກ (ຄາດຄະເນຈາກການເຂົ້າວຽກເຖິງມື້ນີ້ ຫຼື ຍອດທີ່ HR ກວດ / ຈ່າຍແລ້ວ) ພ້ອມເບິ່ງ
 * ລາຍລະອຽດເປັນສະລິບ; ສະລິບທີ່ຈ່າຍແລ້ວຂອງປີ — ກົດເບິ່ງ ແລະ ພິມໄດ້ (A5)
 */
const MyPay = () => {
  const t = useT();
  const [period, setPeriod] = useState(toPeriod(new Date()));
  const [year, setYear] = useState(moment().year());
  const [open, setOpen] = useState<{ payroll: { period: string; pay_date: string | null }; line: PayrollLine; estimate?: boolean } | null>(null);
  const { data: preview, loading: previewLoading } = useGetData<MyPayPreview>('/payroll/me/preview', { month: period });
  const { data: slips, loading } = useGetData<MyPayslipData>('/payroll/me', { year });
  const company = useCompany();
  const slipCompany = slips?.company ?? company;

  const status = preview ? PREVIEW_STATUS[preview.status] : null;
  const totals = preview ? totalsOf(preview.line) : null;

  return (
    <div className="acc-rp att-page my-page">
      <section className="my-card my-pay-now">
        <header>
          <h3><i className="fa-solid fa-wallet" /> {t('myPayMonth')} {periodLabel(period)}</h3>
          <MonthStepper period={period} onChange={setPeriod} />
        </header>
        {!preview || !status || !totals ? (
          <div className="text-center py-4"><Loader size="md" content={t('loadingDots')} vertical /></div>
        ) : (
          <div className={`my-pay-body${previewLoading ? ' is-refreshing' : ''}`}>
            <div className="my-pay-net">
              <span className={`att-state ${status.tone}`}><i className={`fa-solid ${status.icon}`} /> {t(status.label)}</span>
              <small>{t('payNet')}</small>
              <b>₭ {kip(totals.net)}</b>
              <em>{t(status.hint)}{preview.pay_date ? ` · ${t('payPaidOn')} ${moment(preview.pay_date).format('DD/MM/YYYY')}` : ''}</em>
            </div>
            <ul className="my-pay-lines">
              <li><span>{t('hrBasicSalary')}</span><b>{kip(preview.line.base_pay)}</b></li>
              {!!(preview.line.absence_deduction + preview.line.late_deduction) && (
                <li className="is-minus"><span>{t('payAbsenceDeduction')} / {t('payLateDeduction')}</span><b>−{kip(preview.line.absence_deduction + preview.line.late_deduction)}</b></li>
              )}
              {!!(preview.line.allowance + preview.line.overtime + preview.line.bonus) && (
                <li className="is-plus"><span>{t('payAllowance')} / {t('payOvertime')} / {t('payBonus')}</span><b>+{kip(preview.line.allowance + preview.line.overtime + preview.line.bonus)}</b></li>
              )}
              <li className="is-sub"><span>{t('payGross')}</span><b>{kip(totals.gross)}</b></li>
              <li className="is-minus"><span>{t('payDeductionTotal')}</span><b>−{kip(totals.deducted)}</b></li>
            </ul>
            <button type="button" className="acc-rp-btn" onClick={() => setOpen({ payroll: { period: preview.period, pay_date: preview.pay_date }, line: preview.line, estimate: preview.status !== 'paid' })}>
              <i className="fa-solid fa-receipt" /> {t('myPaySeeSlip')}
            </button>
          </div>
        )}
      </section>

      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <h3 className="my-section-title"><i className="fa-solid fa-receipt" /> {t('myPayslips')}</h3>
          <div className="att-nav"><YearStepper year={year} onChange={setYear} max={moment().year()} /></div>
        </div>
      </div>
      {!slips ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !slips.data.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-receipt" /><p>{t('myNoPayslips')}</p></div>
      ) : (
        <div className={`my-slips${loading ? ' is-refreshing' : ''}`}>
          {slips.data.map((slip: MyPayslip) => {
            const s = totalsOf(slip);
            return (
              <button key={slip._uuid} type="button" className="my-slip" onClick={() => setOpen({ payroll: slip.payroll, line: slip })}>
                <span className="my-slip-month">
                  <b>{moment(`${slip.payroll.period}-01`).format('MM')}</b>
                  <small>{moment(`${slip.payroll.period}-01`).format('YYYY')}</small>
                </span>
                <span className="my-slip-text">
                  <b>₭ {kip(s.net)}</b>
                  <small>{t('payGross')} {kip(s.gross)} · {t('payDeductionTotal')} {kip(s.deducted)}</small>
                  {slip.payroll.pay_date && <small>{t('payPaidOn')} {moment(slip.payroll.pay_date).format('DD/MM/YYYY')}</small>}
                </span>
                <i className="fa-solid fa-chevron-right" />
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <PayslipModal payroll={open.payroll} line={open.line} company={slipCompany} onClose={() => setOpen(null)}
          notice={open.estimate ? <p className="my-form-warn my-slip-notice"><i className="fa-solid fa-circle-info" /> {t('myPaySlipEstimate')}</p> : undefined}
        />
      )}
    </div>
  );
};

export default MyPay;
