import { useEffect, useState, type ReactNode } from 'react';
import moment from 'moment';
import { Input, NumberInput } from 'rsuite';
import { postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { useT } from '../../../context/LanguageContext';
import { FormSection, SettingModal } from '../../account/setting/settingKit';
import { runSave } from '../../account/setting/settingApi';
import { OT_KINDS, OT_PAY_TYPES, hoursText, minutesText, weekdayKey, type Overtime } from '../attendance/attendanceApi';
import {
  MODE_ALWAYS, MODE_MANUAL, MODE_NONE, MODE_POLICY, kip, kipFormatter,
  type LineResult, type ModeKey, type Payroll, type PayrollLine, type PayrollSettings,
} from './payrollApi';

type Values = Pick<PayrollLine,
  'allowance' | 'overtime' | 'bonus' | 'other_deduction' | 'absence_deduction' | 'late_deduction' | 'sso_employee'
  | 'sso_employer' | 'tax' | 'overtime_mode' | ModeKey> & { note: string };
type Amount = keyof LineResult & keyof Values;

const PREVIEW_DELAY = 300;

const MoneyInput = ({ label, value, onChange, disabled, hint }: {
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  hint?: ReactNode;
}) => (
  <div className="rs-form-group">
    <label className="form-label">{label}</label>
    <NumberInput value={value} onChange={(v) => onChange(Math.max(0, Number(v) || 0))} formatter={kipFormatter}
      controls={false} prefix="₭" min={0} disabled={disabled}
    />
    {hint && <small className="pay-field-hint" title={typeof hint === 'string' ? hint : undefined}>{hint}</small>}
  </div>
);

/** ຄ່າລ່ວງເວລາ: ຄິດຈາກບັນທຶກ OT (ໜ້າ ການເຂົ້າ-ອອກວຽກ → OT) ຫຼື ປ້ອນເອງ */
const OtSwitch = ({ value, onChange }: { value: number; onChange: (mode: number) => void }) => {
  const t = useT();
  return (
    <span className="pay-mode is-mini" role="radiogroup">
      {[
        { mode: MODE_POLICY, icon: 'fa-business-time', label: t('payOtFromRecords') },
        { mode: MODE_MANUAL, icon: 'fa-pen', label: t('payManual') },
      ].map((o) => (
        <button key={o.mode} type="button" role="radio" aria-checked={value === o.mode}
          className={`is-mode-${o.mode}${value === o.mode ? ' is-active' : ''}`} onClick={() => onChange(o.mode)}
        >
          <i className={`fa-solid ${o.icon}`} /> {o.label}
        </button>
      ))}
    </span>
  );
};

/**
 * ຄ່າລ່ວງເວລາ — ແຖວເຕັມ: ສະວິດ (ຕາມບັນທຶກ OT / ປ້ອນເອງ) + ຍອດ, ແລະ ລາຍການ OT ຂອງເດືອນ (ວັນທີ, ເວລາ, ປະເພດ, ວິທີຈ່າຍ, ເງິນ).
 * ຕາມບັນທຶກ OT = ຍອດມາຈາກລາຍການທັນທີ (ບັນທຶກ OT ໃໝ່ກໍ່ຂຶ້ນເອງ); ປ້ອນເອງ = ກຳນົດຍອດເອງ ບໍ່ສົນລາຍການ
 */
const OtBlock = ({ records, mode, manualValue, computed, onMode, onManual }: {
  records: Overtime[] | null;
  mode: number;
  manualValue: number;
  computed: number;
  onMode: (mode: number) => void;
  onManual: (value: number) => void;
}) => {
  const t = useT();
  const manual = mode === MODE_MANUAL;
  const list = records ?? [];
  const hours = list.reduce((n, r) => n + r.hours, 0);
  const total = list.reduce((n, r) => n + r.pay, 0);
  return (
    <div className={`is-wide pay-ot-block${manual ? ' is-manual' : ''}`}>
      <div className="rs-form-group">
        <label className="form-label">{t('payOvertime')}</label>
        <div className="pay-ot-control">
          <OtSwitch value={mode} onChange={onMode} />
          <NumberInput value={manual ? manualValue : computed} onChange={(v) => onManual(Math.max(0, Number(v) || 0))} formatter={kipFormatter}
            controls={false} prefix="₭" min={0} disabled={!manual}
          />
        </div>
        <small className="pay-field-hint">
          {manual
            ? (list.length ? `${t('payOtManualHint')} · ${t('payOtRecordsTotal')} ₭${kip(total)}` : t('payOtManualHint'))
            : (list.length ? `${list.length} ${t('otRecords')} · ${hoursText(hours, t)}` : t('payOtNone'))}
        </small>
      </div>

      {records === null ? null : list.length > 0 && (
        <div className="pay-ot-records">
          {list.map((r) => {
            const kind = OT_KINDS[r.kind] ?? OT_KINDS[1];
            const pay = OT_PAY_TYPES[r.pay_type] ?? OT_PAY_TYPES[1];
            return (
              <div key={r._uuid} className="pay-ot-record">
                <span className="pay-ot-date">
                  <b>{moment(r.work_date).format('DD/MM')}</b>
                  <small>{t(weekdayKey(r.work_date))}</small>
                </span>
                <span className="pay-ot-time">
                  <b>{r.start_time && r.end_time ? `${r.start_time}–${r.end_time}` : '—'}</b>
                  <small>{hoursText(r.hours, t)}</small>
                </span>
                <span className={`ot-pill ${kind.tone}`}><i className={`fa-solid ${kind.icon}`} /> {t(kind.label)}</span>
                <span className="pay-ot-method">
                  <i className={`fa-solid ${pay.icon}`} /> {t(pay.label)}
                  {r.pay_type === 2 && <small> · {kip(r.amount)}/{t('attHour')}</small>}
                </span>
                <b className="pay-ot-amount">₭ {kip(r.pay)}</b>
              </div>
            );
          })}
          <div className="pay-ot-record is-total">
            <span>{t('payOtRecordsTotal')}</span>
            <b className="pay-ot-amount">₭ {kip(total)}</b>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * ນະໂຍບາຍສະເພາະຄົນ ທີ່ຫົວຂອງກຸ່ມ: ຕາມບໍລິສັດ (ບອກວ່າບໍລິສັດຫັກ ຫຼື ບໍ່) / ຫັກ (ເຖິງບໍລິສັດປິດໄວ້) / ບໍ່ຫັກ / ກຳນົດເອງ.
 * policy = ສິ່ງທີ່ຕັ້ງຄ່າເງິນເດືອນກຳນົດ (null = ຍັງໂຫຼດບໍ່ແລ້ວ)
 */
const ModeSwitch = ({ value, policy, onChange }: { value: number; policy: 'on' | 'off' | 'partial' | null; onChange: (mode: number) => void }) => {
  const t = useT();
  const policyText = { on: 'payPolicyOn', off: 'payPolicyOff', partial: 'payPolicyPartial' } as const;
  const options = [
    { mode: MODE_POLICY, icon: 'fa-building', label: t('payModePolicy'), sub: policy ? t(policyText[policy]) : '', hint: t('payModePolicyHint') },
    { mode: MODE_ALWAYS, icon: 'fa-check', label: t('payPolicyOn'), hint: t('payModeAlwaysHint') },
    { mode: MODE_NONE, icon: 'fa-ban', label: t('payPolicyOff'), hint: t('payModeNoneHint') },
    { mode: MODE_MANUAL, icon: 'fa-pen', label: t('payManual'), hint: t('payModeManualHint') },
  ];
  return (
    <span className="pay-mode" role="radiogroup">
      {options.map((o) => (
        <button key={o.mode} type="button" role="radio" aria-checked={value === o.mode} title={o.hint}
          className={`is-mode-${o.mode}${value === o.mode ? ' is-active' : ''}`} onClick={() => onChange(o.mode)}
        >
          <i className={`fa-solid ${o.icon}`} /> {o.label}
          {o.sub && <small> ({o.sub})</small>}
        </button>
      ))}
    </span>
  );
};

/**
 * ແກ້ເງິນເດືອນລາຍຄົນ (ໃບຮ່າງ) — ເງິນເພີ່ມ, ຫັກຕາມການເຂົ້າວຽກ, ປກສ, ອາກອນ, ຫັກອື່ນ. ແຕ່ລະກຸ່ມການຫັກມີນະໂຍບາຍ
 * ສະເພາະຄົນ (ຕາມບໍລິສັດ / ຫັກ / ບໍ່ຫັກ / ກຳນົດເອງ); ຜົນລວມດ້ານຂວາມາຈາກ backend (preview) ທຸກຄັ້ງທີ່ປ່ຽນ
 */
const PayrollLineForm = ({ line, period, settings, onClose, onSaved }: {
  line: PayrollLine;
  /** ເດືອນຂອງໃບເງິນເດືອນ "YYYY-MM" — ດຶງບັນທຶກ OT ຂອງຄົນນີ້ */
  period: string;
  /** ຕັ້ງຄ່າເງິນເດືອນປັດຈຸບັນ — ສະແດງວ່ານະໂຍບາຍໃດປິດໄວ້ */
  settings: PayrollSettings | null;
  onClose: () => void;
  onSaved: (payroll: Payroll) => void;
}) => {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Values>({
    allowance: line.allowance,
    overtime: line.overtime,
    overtime_mode: line.overtime_mode,
    bonus: line.bonus,
    other_deduction: line.other_deduction,
    absence_deduction: line.absence_deduction,
    late_deduction: line.late_deduction,
    sso_employee: line.sso_employee,
    sso_employer: line.sso_employer,
    tax: line.tax,
    deduction_mode: line.deduction_mode,
    sso_mode: line.sso_mode,
    tax_mode: line.tax_mode,
    note: line.note ?? '',
  });
  const [result, setResult] = useState<LineResult>(line);
  const [warning, setWarning] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [otRecords, setOtRecords] = useState<Overtime[] | null>(null);

  useEffect(() => {
    postApi('/overtime/fetch', { period, employee_id: line.employee_id })
      .then((res) => setOtRecords(res.data?.data ?? []))
      .catch(() => setOtRecords([]));
  }, [period, line.employee_id]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  // ຂໍຜົນຈາກ backend ຫຼັງຢຸດພິມ — ກຸ່ມທີ່ບໍ່ແມ່ນ "ກຳນົດເອງ" ຈະເຫັນຕົວເລກທີ່ລະບົບຄິດທັນທີ
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setPreviewing(true);
        const res = await postApi(`/payroll/line/preview/${btoa(String(line._uuid))}`, values);
        if (cancelled) return;
        setResult(res.data.data);
        setWarning(res.data.warning ?? null);
      } catch (error) {
        if (!cancelled) setWarning(getErrorMessage(error));
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, PREVIEW_DELAY);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [values, line._uuid]);

  const manual = (key: ModeKey) => values[key] === MODE_MANUAL;
  // ປ່ຽນເປັນ "ກຳນົດເອງ" = ເລີ່ມຈາກຕົວເລກທີ່ລະບົບຄິດຢູ່ຕອນນັ້ນ
  const setMode = (key: ModeKey, fields: Amount[], mode: number) =>
    setValues((v) => ({ ...v, [key]: mode, ...(mode === MODE_MANUAL ? Object.fromEntries(fields.map((f) => [f, result[f]])) : {}) }));
  const shown = (key: ModeKey, field: Amount) => (manual(key) ? values[field] : result[field]);

  const submit = async () => {
    const ok = await runSave(async () => {
      const res = await putApi(`/payroll/line/${btoa(String(line._uuid))}`, values);
      onSaved(res.data.data);
    }, setSaving);
    if (ok) onClose();
  };

  const row = (label: ReactNode, amount: number, tone: '' | 'plus' | 'minus' | 'total' = '') => (
    <div className={`pay-preview-row${tone ? ` is-${tone}` : ''}`}>
      <span>{label}</span>
      <b>{tone === 'minus' && amount ? '−' : tone === 'plus' && amount ? '+' : ''}{kip(amount)}</b>
    </div>
  );
  const prorated = line.employed_days < line.workdays;
  const policyOf = (...on: boolean[]) => (!settings ? null : on.every(Boolean) ? 'on' : on.some(Boolean) ? 'partial' : 'off');
  /** ຄຳອະທິບາຍໃຕ້ຊ່ອງ — ບອກເຫດຜົນເມື່ອບໍ່ຫັກ (ຄົນນີ້ບໍ່ຫັກ / ບໍລິສັດບໍ່ຫັກ) */
  const hintOf = (key: ModeKey, policyOn: boolean | undefined, hint: string) => {
    if (values[key] === MODE_NONE) return t('payNoneForPerson');
    if (values[key] === MODE_POLICY && policyOn === false) return t('payNoneByCompany');
    return hint;
  };

  return (
    <SettingModal title={line.employee_name} hint={`${line.emp_code}${line.department_name ? ` · ${line.department_name}` : ''}${line.position_name ? ` · ${line.position_name}` : ''}`}
      icon="fa-money-check-dollar" saving={saving} onClose={onClose} onSubmit={submit} className="pay-line-modal"
    >
      <div className="pay-line-form">
        <div className="pay-line-inputs">
          <div className="pay-att-chips">
            <span><b>{line.employed_days}/{line.workdays}</b> {t('attWorkdays')}</span>
            <span className="is-present"><b>{line.present_days}</b> {t('attStatePresent')}</span>
            <span className="is-absent"><b>{line.absent_days}</b> {t('attStateAbsent')}</span>
            <span className="is-unpaid"><b>{line.unpaid_days}</b> {t('attStateUnpaid')}</span>
            <span className="is-leave"><b>{line.leave_days}</b> {t('attStateLeave')}</span>
            <span className="is-late"><b>{minutesText(line.late_minutes, t)}</b> {t('attLateEarly')}</span>
          </div>

          <FormSection title={t('payAdditions')}>
            <MoneyInput label={t('payAllowance')} value={values.allowance} onChange={(v) => set('allowance', v)} />
            <MoneyInput label={t('payBonus')} value={values.bonus} onChange={(v) => set('bonus', v)} />
            <OtBlock records={otRecords} mode={values.overtime_mode} manualValue={values.overtime} computed={result.overtime}
              onMode={(mode) => setValues((v) => ({ ...v, overtime_mode: mode, ...(mode === MODE_MANUAL ? { overtime: result.overtime } : {}) }))}
              onManual={(v) => set('overtime', v)}
            />
          </FormSection>

          <FormSection title={t('payAttendanceDeduction')} note={
            <ModeSwitch value={values.deduction_mode} policy={policyOf(!!settings?.deduct_absent, !!settings?.deduct_late)}
              onChange={(mode) => setMode('deduction_mode', ['absence_deduction', 'late_deduction'], mode)}
            />
          }>
            <MoneyInput label={t('payAbsenceDeduction')} value={shown('deduction_mode', 'absence_deduction')} disabled={!manual('deduction_mode')}
              onChange={(v) => set('absence_deduction', v)}
              hint={hintOf('deduction_mode', settings?.deduct_absent, `${line.absent_days + line.unpaid_days} ${t('payDays')}`)}
            />
            <MoneyInput label={t('payLateDeduction')} value={shown('deduction_mode', 'late_deduction')} disabled={!manual('deduction_mode')}
              onChange={(v) => set('late_deduction', v)} hint={hintOf('deduction_mode', settings?.deduct_late, minutesText(line.late_minutes, t))}
            />
          </FormSection>

          <FormSection title={t('paySso')} note={
            <ModeSwitch value={values.sso_mode} policy={policyOf(!!settings?.sso_enabled)}
              onChange={(mode) => setMode('sso_mode', ['sso_employee', 'sso_employer'], mode)}
            />
          }>
            <MoneyInput label={t('paySsoEmployee')} value={shown('sso_mode', 'sso_employee')} disabled={!manual('sso_mode')} onChange={(v) => set('sso_employee', v)}
              hint={hintOf('sso_mode', settings?.sso_enabled, `${t('paySsoBase')} ${kip(result.sso_base)}`)}
            />
            <MoneyInput label={t('paySsoEmployer')} value={shown('sso_mode', 'sso_employer')} disabled={!manual('sso_mode')} onChange={(v) => set('sso_employer', v)}
              hint={hintOf('sso_mode', settings?.sso_enabled, t('paySsoEmployerHint'))}
            />
          </FormSection>

          <FormSection title={t('payTax')} note={
            <ModeSwitch value={values.tax_mode} policy={policyOf(!!settings?.tax_enabled)} onChange={(mode) => setMode('tax_mode', ['tax'], mode)} />
          }>
            <MoneyInput label={t('payTax')} value={shown('tax_mode', 'tax')} disabled={!manual('tax_mode')} onChange={(v) => set('tax', v)}
              hint={hintOf('tax_mode', settings?.tax_enabled, `${t('payTaxable')} ${kip(result.taxable)}`)}
            />
            <MoneyInput label={t('payOtherDeduction')} value={values.other_deduction} onChange={(v) => set('other_deduction', v)} hint={t('payOtherDeductionHint')} />
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('attNote')}</label>
              <Input value={values.note} onChange={(v) => set('note', v)} maxLength={255} placeholder={t('payNotePlaceholder')} />
            </div>
          </FormSection>
        </div>

        <aside className={`pay-preview${previewing ? ' is-busy' : ''}`}>
          <header><i className="fa-solid fa-calculator" /> {t('payBreakdown')}</header>
          {row(<>{t('hrBasicSalary')}{prorated && <small> · {line.employed_days}/{line.workdays} {t('payDays')}</small>}</>, prorated ? result.base_pay : result.basic_salary)}
          {row(t('payAbsenceDeduction'), result.absence_deduction, 'minus')}
          {row(t('payLateDeduction'), result.late_deduction, 'minus')}
          {row(t('payAllowance'), result.allowance, 'plus')}
          {row(<>{t('payOvertime')}{values.overtime_mode !== MODE_MANUAL && !!otRecords?.length && <small> · {hoursText(otRecords.reduce((n, r) => n + r.hours, 0), t)}</small>}</>, result.overtime, 'plus')}
          {row(t('payBonus'), result.bonus, 'plus')}
          {row(t('payGross'), result.gross, 'total')}
          {row(t('paySsoEmployee'), result.sso_employee, 'minus')}
          {row(t('payTax'), result.tax, 'minus')}
          {row(t('payOtherDeduction'), result.other_deduction, 'minus')}
          <div className={`pay-preview-net${result.net < 0 ? ' is-bad' : ''}`}>
            <span>{t('payNet')}</span>
            <b>₭ {kip(result.net)}</b>
          </div>
          <p className="pay-preview-note"><i className="fa-solid fa-building" /> {t('paySsoEmployer')} {kip(result.sso_employer)}</p>
          {warning && <p className="pay-preview-warn"><i className="fa-solid fa-triangle-exclamation" /> {warning}</p>}
        </aside>
      </div>
    </SettingModal>
  );
};

export default PayrollLineForm;
