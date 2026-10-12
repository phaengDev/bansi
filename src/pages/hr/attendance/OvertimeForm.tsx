import { useState } from 'react';
import { CheckPicker, DatePicker, Input, NumberInput, TimePicker } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../../utils/configApi';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { useEmployees } from '../../../utils/selectOption';
import { SettingModal } from '../../account/setting/settingKit';
import { runSave } from '../../account/setting/settingApi';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import { kip, kipFormatter } from '../payroll/payrollApi';
import {
  OT_KINDS, OT_PAY_HOURLY, OT_PAY_LUMP, OT_PAY_RATE, OT_PAY_TYPES, hoursText, suggestOtKind, toApiDay, weekdayKey,
  type Overtime, type OvertimeData,
} from './attendanceApi';

const toTime = (value: string | null | undefined) => (value ? moment(value, 'HH:mm').toDate() : null);
const toHHmm = (value: Date | null) => (value ? moment(value).format('HH:mm') : '');

/** ຊົ່ວໂມງຈາກເວລາເລີ່ມ–ເລີກ (ເລີກ ≤ ເລີ່ມ = ຂ້າມທ່ຽງຄືນ) — ຄືກັບ backend */
const hoursBetween = (start: string, end: string) => {
  if (!start || !end || start === end) return 0;
  const minutes = (text: string) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
  let diff = minutes(end) - minutes(start);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
};

/** ພະນັກງານໃນ picker — ຮູບ + ລະຫັດ ຊື່ + ພະແນກ */
const employeeLabel = (_: unknown, item: any) => item?.employee && (
  <span className="hr-opt">
    <HrAvatar url={item.employee.profile_url} name={item.employee.first_name} size="sm" />
    <span>
      <b>{item.employee.emp_code}</b> {fullName(item.employee)}
      {item.employee.department && <small>{item.employee.department.depart_name}</small>}
    </span>
  </span>
);

/**
 * ບັນທຶກ OT — ເລືອກວັນທີ (ໃນເດືອນທີ່ເບິ່ງຢູ່), ພະນັກງານ (ຫຼາຍຄົນພ້ອມກັນ; ແກ້ໄຂ = ຄົນເດີມ), ເວລາເລີ່ມ–ເລີກ (ຂ້າມທ່ຽງຄືນໄດ້)
 * ແລະ ປະເພດ — ລະບົບແນະນຳປະເພດຈາກມື້ (ມື້ເຮັດວຽກ / ວັນພັກ) ແລະ ເວລາເລີ່ມ ຈົນກວ່າຜູ້ໃຊ້ຈະເລືອກເອງ.
 * ວິທີຈ່າຍ: ຕາມອັດຕາ (ເງິນເດືອນ × % ຂອງປະເພດ), ກຳນົດເງິນຕໍ່ຊົ່ວໂມງ (× ຊົ່ວໂມງ) ຫຼື ເໝົາຈ່າຍ (ບໍ່ກ່ຽວກັບຊົ່ວໂມງ) —
 * ເວລາເລີ່ມ–ເລີກ ຍັງບັນທຶກທຸກວິທີ
 */
const OvertimeForm = ({ data, record, onClose, onSaved }: {
  data: OvertimeData;
  record: Overtime | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const employees = useEmployees();
  const today = toApiDay(new Date());
  const monthEnd = data.days[data.days.length - 1]?.date ?? today;
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(record?.work_date ?? (today <= monthEnd && today >= data.days[0]?.date ? today : monthEnd));
  const [employeeIds, setEmployeeIds] = useState<number[]>(record ? [record.employee_id] : []);
  const [start, setStart] = useState(record?.start_time ?? '17:00');
  const [end, setEnd] = useState(record?.end_time ?? '19:00');
  const dayOf = (d: string) => data.days.find((x) => x.date === d);
  const [kind, setKind] = useState(record?.kind ?? suggestOtKind(dayOf(date)?.workday ?? true, start));
  // ເລືອກປະເພດເອງແລ້ວ = ບໍ່ແນະນຳທັບ
  const [kindTouched, setKindTouched] = useState(!!record);
  const [payType, setPayType] = useState(record?.pay_type ?? OT_PAY_RATE);
  const [amount, setAmount] = useState(record?.amount ?? 0);
  const [note, setNote] = useState(record?.note ?? '');

  const day = dayOf(date);
  const hours = hoursBetween(start, end);
  const suggest = (nextDate: string, nextStart: string) => {
    if (!kindTouched) setKind(suggestOtKind(dayOf(nextDate)?.workday ?? true, nextStart));
  };
  const options = employees.map((e) => ({ value: e._uuid, label: `${e.emp_code} ${fullName(e)}`, employee: e }));

  const submit = async () => {
    if (!record && !employeeIds.length) return Notific.warning('otEmployeeRequired');
    if (!start || !end) return Notific.warning('otTimeRequired');
    if (!hours) return Notific.warning('otTimeSame');
    if (payType !== OT_PAY_RATE && !(amount > 0)) return Notific.warning('otAmountRequired');
    const body = { work_date: date, start_time: start, end_time: end, kind, pay_type: payType, amount: payType === OT_PAY_RATE ? 0 : amount, note: note.trim() };
    const ok = await runSave(
      () => (record
        ? putApi(`/overtime/${btoa(String(record._uuid))}`, body)
        : postApi('/overtime/create', { ...body, employee_ids: employeeIds })),
      setSaving,
    );
    if (ok) {
      onSaved();
      onClose();
    }
  };

  const picker = (value: string, onChange: (v: string) => void) => (
    <TimePicker value={toTime(value)} onChange={(v) => onChange(toHHmm(v))} format="HH:mm" block cleanable={false} placement="autoVerticalStart"
      hideMinutes={(minute: number) => minute % 5 !== 0}
    />
  );

  return (
    <SettingModal
      title={t(record ? 'otEdit' : 'otAdd')}
      hint={t('otFormHint')}
      icon="fa-business-time"
      saving={saving}
      onClose={onClose}
      onSubmit={submit}
      className="ot-modal"
    >
      <div className="ot-form">
        <div className="ot-form-row">
          <div className="ot-field">
            <label>{t('date')}<em>*</em></label>
            <DatePicker
              value={moment(date).toDate()} onChange={(d) => {
                if (!d) return;
                const next = toApiDay(d);
                setDate(next);
                suggest(next, start);
              }}
              oneTap format="dd/MM/yyyy" cleanable={false} block
              shouldDisableDate={(d) => !dayOf(toApiDay(d))}
            />
            <small className={`ot-day${day?.workday === false ? ' is-off' : ''}`}>
              <i className={`fa-solid ${day?.workday === false ? 'fa-mug-hot' : 'fa-briefcase'}`} />
              {t(weekdayKey(date))} · {day?.holiday ?? t(day?.workday === false ? 'otDayOff' : 'otWorkday')}
            </small>
          </div>
          <div className="ot-field">
            <label>{t('otStart')}<em>*</em></label>
            {picker(start, (v) => {
              setStart(v);
              suggest(date, v);
            })}
          </div>
          <div className="ot-field">
            <label>{t('otEnd')}<em>*</em></label>
            {picker(end, setEnd)}
          </div>
          <div className="ot-hours">
            <small>{t('otHours')}</small>
            <b>{hours ? hoursText(hours, t) : '—'}</b>
            {start && end && end <= start && hours > 0 && <em>{t('otOvernight')}</em>}
          </div>
        </div>

        <div className="ot-field">
          <label>{t('hrEmployee')}<em>*</em></label>
          {record ? (
            <div className="ot-person">
              <HrAvatar url={record.employee?.profile_url} name={record.employee?.first_name} />
              <span>
                <b>{fullName(record.employee) || '—'}</b>
                <small>{record.employee?.emp_code}{record.employee?.department ? ` · ${record.employee.department.depart_name}` : ''}</small>
              </span>
            </div>
          ) : (
            <CheckPicker
              block data={options} value={employeeIds} onChange={setEmployeeIds} placeholder={t('otPickEmployees')}
              renderMenuItem={employeeLabel} countable placement="autoVerticalStart"
            />
          )}
        </div>

        <div className="ot-field">
          <label>{t('otPayType')}</label>
          <div className="ot-pay-types" role="radiogroup">
            {Object.entries(OT_PAY_TYPES).map(([value, meta]) => {
              const on = payType === Number(value);
              return (
                <button key={value} type="button" role="radio" aria-checked={on} className={`ot-pay-type${on ? ' is-on' : ''}`}
                  onClick={() => setPayType(Number(value))}
                >
                  <i className={`fa-solid ${meta.icon}`} />
                  <span>
                    <b>{t(meta.label)}</b>
                    <small>{t(meta.hint)}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {payType !== OT_PAY_RATE && (
            <div className="ot-amount">
              <div className="ot-field">
                <label>{t(payType === OT_PAY_HOURLY ? 'otAmountPerHour' : 'otAmountLump')}<em>*</em></label>
                <NumberInput value={amount} onChange={(v) => setAmount(Math.max(0, Number(v) || 0))} formatter={kipFormatter}
                  controls={false} prefix="₭" min={0} postfix={payType === OT_PAY_HOURLY ? `/ ${t('attHour')}` : undefined}
                />
              </div>
              <div className="ot-hours is-money">
                <small>{t('otPayPerPerson')}</small>
                <b>₭ {kip(payType === OT_PAY_HOURLY ? amount * hours : amount)}</b>
                {payType === OT_PAY_HOURLY && <em>{kip(amount)} × {hours} {t('attHour')}</em>}
                {payType === OT_PAY_LUMP && <em>{t('otLumpNote')}</em>}
              </div>
            </div>
          )}
        </div>

        <div className="ot-field">
          <label>{t('otKind')}</label>
          <div className="ot-kinds" role="radiogroup">
            {Object.entries(OT_KINDS).map(([value, meta]) => {
              const on = kind === Number(value);
              return (
                <button
                  key={value} type="button" role="radio" aria-checked={on} className={`ot-kind ${meta.tone}${on ? ' is-on' : ''}`}
                  onClick={() => {
                    setKind(Number(value));
                    setKindTouched(true);
                  }}
                >
                  <i className={`fa-solid ${meta.icon}`} />
                  <span>{t(meta.label)}</span>
                  {payType === OT_PAY_RATE && <b>{data.rates[Number(value)] ?? 0}%</b>}
                </button>
              );
            })}
          </div>
          {!kindTouched && <small className="ot-help"><i className="fa-solid fa-wand-magic-sparkles" /> {t('otKindSuggested')}</small>}
        </div>

        <div className="ot-field">
          <label>{t('attNote')}</label>
          <Input value={note} onChange={setNote} maxLength={255} placeholder={t('otNotePlaceholder')} />
        </div>
      </div>
    </SettingModal>
  );
};

export default OvertimeForm;
