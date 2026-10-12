import { useEffect, useState } from 'react';
import { Button, Form, Loader, NumberInput, Toggle } from 'rsuite';
import moment from 'moment';
import { getApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { FormStep } from '../../account/setting/settingKit';
import { runSave } from '../../account/setting/settingApi';
import { kip, kipFormatter, type PayrollSettings, type TaxBracket } from './payrollApi';
import { OT_KINDS } from '../attendance/attendanceApi';

/** ຖັນອັດຕາ OT ໃນຕັ້ງຄ່າ ↔ ປະເພດ OT (tbl_overtime.kind) */
const OT_RATE_FIELDS = [
  ['ot_rate_normal', 1], ['ot_rate_night', 2], ['ot_rate_dayoff', 3], ['ot_rate_dayoff_night', 4],
] as const;

type Bracket = TaxBracket & { key: number };
let seq = 0;
const withKeys = (brackets: TaxBracket[]): Bracket[] => brackets.map((b) => ({ ...b, key: ++seq }));

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="rs-form-group">
    <label className="form-label">{label}</label>
    {children}
    {hint && <small className="pay-field-hint">{hint}</small>}
  </div>
);

/** ສະວິດນະໂຍບາຍ ຫັກ / ບໍ່ຫັກ ທີ່ຫົວຂອງແຕ່ລະຂັ້ນ */
const PolicySwitch = ({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) => {
  const t = useT();
  return (
    <label className={`pay-policy-switch${on ? ' is-on' : ''}`}>
      <Toggle checked={on} onChange={onChange} disabled={!canEdit} />
      <span>{t(on ? 'payPolicyOn' : 'payPolicyOff')}</span>
    </label>
  );
};

/** ແຖວນະໂຍບາຍ (ສະວິດ + ຫົວຂໍ້ + ຄຳອະທິບາຍ) — ໃຊ້ໃນຂັ້ນຫັກຕາມການເຂົ້າວຽກ ທີ່ມີ 2 ຢ່າງແຍກກັນ */
const PolicyRow = ({ on, onChange, title, hint }: { on: boolean; onChange: (on: boolean) => void; title: string; hint: string }) => {
  const t = useT();
  return (
    <label className={`is-wide pay-policy-row${on ? ' is-on' : ''}`}>
      <Toggle checked={on} onChange={onChange} disabled={!canEdit} />
      <span>
        <b>{title}</b>
        <small>{hint}</small>
      </span>
      <em>{t(on ? 'payPolicyOn' : 'payPolicyOff')}</em>
    </label>
  );
};

/**
 * ຕັ້ງຄ່າເງິນເດືອນ — ນະໂຍບາຍເປີດ/ປິດ ການຫັກ (ປກສ, ອາກອນ, ຂາດວຽກ, ມາຊ້າ), ອັດຕາປະກັນສັງຄົມ, ຂັ້ນອາກອນລາຍໄດ້,
 * ຄ່າລ່ວງເວລາທີ່ບໍ່ເສຍອາກອນ, ນາທີຜ່ອນຜັນມາຊ້າ ແລະ ອັດຕາຄ່າລ່ວງເວລາ (OT) ຕາມປະເພດ. ປິດ = ລະບົບຄິດເປັນ 0 (ແຕ່ລະຄົນຍັງກຳນົດເອງໄດ້ໃນໃບເງິນເດືອນ).
 * ໃຊ້ກັບໃບເງິນເດືອນທີ່ສ້າງ / ຄິດໄລ່ໃໝ່ ຫຼັງບັນທຶກ (ໃບທີ່ຈ່າຍແລ້ວບໍ່ປ່ຽນ)
 */
const PayrollSettingPage = () => {
  const t = useT();
  const [values, setValues] = useState<PayrollSettings | null>(null);
  const [defaults, setDefaults] = useState<PayrollSettings | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [saving, setSaving] = useState(false);

  const load = (data: PayrollSettings) => {
    setValues(data);
    setBrackets(withKeys(data.tax_brackets));
  };

  useEffect(() => {
    getApi('/payroll/setting')
      .then((res) => {
        load(res.data.data);
        setDefaults(res.data.defaults);
      })
      .catch((error) => Notific.error(getErrorMessage(error)));
  }, []);

  if (!values) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const set = <K extends keyof PayrollSettings>(key: K, value: PayrollSettings[K]) => setValues({ ...values, [key]: value });
  const num = (v: unknown) => Number(v) || 0;
  const updateBracket = (key: number, patch: Partial<TaxBracket>) =>
    setBrackets((list) => list.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  const addBracket = () => setBrackets((list) => {
    const last = list[list.length - 1];
    const prev = list[list.length - 2]?.upto ?? 0;
    // ແຊກຂັ້ນໃໝ່ກ່ອນຂັ້ນສຸດທ້າຍ ("ເກີນ…") — ຂັ້ນສຸດທ້າຍບໍ່ມີເພດານສະເໝີ
    return [...list.slice(0, -1), { key: ++seq, upto: prev * 2 || 1000000, rate: last?.rate ?? 0 }, ...(last ? [last] : [])];
  });

  const submit = async () => {
    const list = brackets.map((b, i) => ({ upto: i === brackets.length - 1 ? null : num(b.upto), rate: num(b.rate) }));
    for (let i = 1; i < list.length - 1; i++) {
      if (num(list[i].upto) <= num(list[i - 1].upto)) return Notific.warning('payBracketOrder');
    }
    const ok = await runSave(async () => {
      const res = await putApi('/payroll/setting', { ...values, tax_brackets: list });
      load(res.data.data);
    }, setSaving);
    return ok;
  };

  const money = (key: 'sso_salary_cap' | 'ot_tax_free_salary', off: boolean) => (
    <NumberInput value={values[key]} onChange={(v) => set(key, num(v))} formatter={kipFormatter} controls={false} prefix="₭" min={0} disabled={!canEdit || off} />
  );
  const rate = (key: 'sso_employee_rate' | 'sso_employer_rate') => (
    <NumberInput value={values[key]} onChange={(v) => set(key, num(v))} postfix="%" min={0} max={100} step={0.5} disabled={!canEdit || !values.sso_enabled} />
  );
  const offNote = (text: string) => <p className="is-wide pay-policy-off"><i className="fa-solid fa-ban" /> {text}</p>;

  return (
    <div className="acs-page hr-company pay-settings">
      <Form fluid className="acc-book-main">
        {/* ຈໍກວ້າງ 2 ຖັນ: ຊ້າຍ ປກສ + ຫັກຕາມການເຂົ້າວຽກ, ຂວາ ຂັ້ນອາກອນ (ຍາວສຸດ) */}
        <div className="pay-settings-grid">
          <div className="pay-settings-col">
            <FormStep no={1} done={values.sso_enabled} title={t('paySso')} hint={t('paySsoSettingHint')}
              note={<PolicySwitch on={values.sso_enabled} onChange={(on) => set('sso_enabled', on)} />}
            >
              {!values.sso_enabled && offNote(t('paySsoOffNote'))}
              <Field label={t('paySsoEmployeeRate')}>{rate('sso_employee_rate')}</Field>
              <Field label={t('paySsoEmployerRate')}>{rate('sso_employer_rate')}</Field>
              <Field label={t('paySsoCap')} hint={t('paySsoCapHint')}>{money('sso_salary_cap', !values.sso_enabled)}</Field>
            </FormStep>

            <FormStep no={2} done={values.deduct_absent || values.deduct_late} title={t('payAttendanceDeduction')} hint={t('payAttendanceSettingHint')}>
              <PolicyRow on={values.deduct_absent} onChange={(on) => set('deduct_absent', on)} title={t('payDeductAbsent')} hint={t('payDeductAbsentHint')} />
              <PolicyRow on={values.deduct_late} onChange={(on) => set('deduct_late', on)} title={t('payDeductLate')} hint={t('payDeductLateHint')} />
              <Field label={t('payGrace')} hint={t('payGraceHint')}>
                <NumberInput value={values.late_grace_minutes} onChange={(v) => set('late_grace_minutes', Math.max(0, Math.round(num(v))))}
                  postfix={t('attMin')} min={0} max={120} disabled={!canEdit}
                />
              </Field>
            </FormStep>

            <FormStep no={3} done title={t('payOtSetting')} hint={t('payOtSettingHint')}>
              <Field label={t('payOtHoursPerDay')} hint={t('payOtHoursPerDayHint')}>
                <NumberInput value={values.ot_hours_per_day} onChange={(v) => set('ot_hours_per_day', num(v))}
                  postfix={t('attHour')} min={1} max={24} step={0.5} disabled={!canEdit}
                />
              </Field>
              <div className="is-wide pay-ot-rates">
                {OT_RATE_FIELDS.map(([key, kind]) => (
                  <label key={key} className={`pay-ot-rate ${OT_KINDS[kind].tone}`}>
                    <span><i className={`fa-solid ${OT_KINDS[kind].icon}`} /> {t(OT_KINDS[kind].label)}</span>
                    <NumberInput value={values[key]} onChange={(v) => set(key, num(v))} postfix="%" min={0} max={1000} step={10} disabled={!canEdit} />
                  </label>
                ))}
              </div>
            </FormStep>
          </div>
          <div className="pay-settings-col">
            <FormStep no={4} done={values.tax_enabled} title={t('payTaxBrackets')} hint={t('payTaxBracketsHint')}
              note={<PolicySwitch on={values.tax_enabled} onChange={(on) => set('tax_enabled', on)} />}
            >
              {!values.tax_enabled && offNote(t('payTaxOffNote'))}
              <div className={`is-wide pay-brackets${values.tax_enabled ? '' : ' is-off'}`}>
                <div className="pay-bracket is-head">
                  <span>{t('payBracketFrom')}</span>
                  <span>{t('payBracketTo')}</span>
                  <span>{t('payBracketRate')}</span>
                  <span />
                </div>
                {brackets.map((b, i) => {
                  const last = i === brackets.length - 1;
                  const from = i === 0 ? 0 : num(brackets[i - 1].upto);
                  return (
                    <div key={b.key} className="pay-bracket">
                      <span className="pay-bracket-from">{i === 0 ? '0' : `> ${kip(from)}`}</span>
                      {last ? (
                        <span className="pay-bracket-open">{t('payBracketAbove')}</span>
                      ) : (
                        <NumberInput value={b.upto ?? 0} onChange={(v) => updateBracket(b.key, { upto: num(v) })} formatter={kipFormatter}
                          controls={false} prefix="≤ ₭" min={0} disabled={!canEdit || !values.tax_enabled}
                        />
                      )}
                      <NumberInput value={b.rate} onChange={(v) => updateBracket(b.key, { rate: num(v) })} postfix="%" min={0} max={100} step={1}
                        disabled={!canEdit || !values.tax_enabled}
                      />
                      <button type="button" className="acc-gl-act is-danger" title={t('delete')}
                        disabled={!canEdit || !values.tax_enabled || brackets.length <= 1 || last}
                        onClick={() => setBrackets((list) => list.filter((x) => x.key !== b.key))}
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </div>
                  );
                })}
                <button type="button" className="acc-rp-btn" disabled={!canEdit || !values.tax_enabled} onClick={addBracket}><i className="fa-solid fa-plus" /> {t('payBracketAdd')}</button>
              </div>
              <Field label={t('payOtTaxFree')} hint={t('payOtTaxFreeHint')}>{money('ot_tax_free_salary', !values.tax_enabled)}</Field>
            </FormStep>
          </div>
        </div>

        <div className="hr-company-bar">
          <span>
            {values.updatedAt
              ? <><i className="fa-regular fa-clock" /> {t('hrCompanyUpdated')} {moment(values.updatedAt).format('DD/MM/YYYY HH:mm')}</>
              : <><i className="fa-solid fa-circle-info" /> {t('paySettingDefault')}</>}
          </span>
          <span className="hr-company-actions">
            {defaults && (
              <Button appearance="default" className="hr-company-cancel" disabled={!canEdit || saving}
                onClick={() => load({ ...defaults, updatedAt: values.updatedAt })}
              >
                <i className="fa-solid fa-arrow-rotate-left" /> {t('payUseDefaults')}
              </Button>
            )}
            <Button appearance="primary" className="hr-company-save" loading={saving} disabled={!canEdit} onClick={submit}>
              <i className="fa-solid fa-check" /> {t('save')}
            </Button>
          </span>
        </div>
      </Form>
    </div>
  );
};

export default PayrollSettingPage;
