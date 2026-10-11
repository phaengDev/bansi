import { useState } from 'react';
import { Form, Input, TimePicker } from 'rsuite';
import moment from 'moment';
import { postApi } from '../../../utils/configApi';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { ChoiceTiles, FormSection, SettingModal } from '../../account/setting/settingKit';
import { runSave } from '../../account/setting/settingApi';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import { PAID_LEAVE, PRESENT, UNPAID_LEAVE, dayLabel, weekdayKey, type AttendanceEmployee, type AttendanceRecord } from './attendanceApi';

const toTime = (value: string | null | undefined) => (value ? moment(value, 'HH:mm').toDate() : null);
const toHHmm = (value: Date | null) => (value ? moment(value).format('HH:mm') : '');

/**
 * HR ບັນທຶກ / ແກ້ໄຂ ການເຂົ້າວຽກຂອງ 1 ຄົນ 1 ມື້ (POST /attendance/save) — ລືມສະແກນ, ສະແກນບໍ່ໄດ້, ລາພັກ.
 * ເວລາທີ່ບໍ່ປ່ຽນ backend ຮັກສາເວລາສະແກນຈິງ ແລະ ພິກັດໄວ້
 */
const AttendanceForm = ({ employee, date, record, workStart, workEnd, onClose, onSaved }: {
  employee: AttendanceEmployee;
  date: string;
  record: AttendanceRecord | null;
  workStart: string;
  workEnd: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<number>(record?.status ?? PRESENT);
  const [checkIn, setCheckIn] = useState<Date | null>(toTime(record?.check_in_time ?? (record ? null : workStart)));
  const [checkOut, setCheckOut] = useState<Date | null>(toTime(record?.check_out_time ?? (record ? null : workEnd)));
  const [note, setNote] = useState(record?.note ?? '');

  const submit = async () => {
    const inText = toHHmm(checkIn);
    const outText = toHHmm(checkOut);
    if (status === PRESENT) {
      if (!inText) return Notific.warning('attNeedCheckIn');
      if (outText && outText <= inText) return Notific.warning('hrCompanyTimeOrder');
    }
    const ok = await runSave(() => postApi('/attendance/save', {
      employee_id: employee._uuid,
      work_date: date,
      status,
      check_in: status === PRESENT ? inText : '',
      check_out: status === PRESENT ? outText : '',
      note,
    }), setSaving);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  const picker = (value: Date | null, onChange: (v: Date | null) => void, cleanable: boolean) => (
    <TimePicker value={value} onChange={onChange} format="HH:mm" block cleanable={cleanable} placement="autoVerticalStart"
      hideMinutes={(minute: number) => minute % 5 !== 0 && minute !== value?.getMinutes()}
    />
  );

  return (
    <SettingModal title={t(record ? 'attEdit' : 'attAdd')} hint={`${t(weekdayKey(date))} ${dayLabel(date)} · ${t('hrCompanyWorkTime')} ${workStart}–${workEnd}`}
      icon="fa-user-clock" saving={saving} onClose={onClose} onSubmit={submit}
    >
      <Form fluid>
        <div className="att-form-person">
          <HrAvatar url={employee.profile_url} name={employee.first_name} />
          <span>
            <b>{fullName(employee)}</b>
            <small>{employee.emp_code}{employee.department ? ` · ${employee.department.depart_name}` : ''}</small>
          </span>
        </div>
        <FormSection title={t('status')}>
          <ChoiceTiles className="is-wide" label={t('attDayStatus')} value={status} onChange={setStatus}
            options={[
              { value: PRESENT, label: t('attStatePresent'), icon: 'fa-circle-check', hint: t('attPresentHint') },
              { value: PAID_LEAVE, label: t('attStateLeave'), icon: 'fa-umbrella-beach', hint: t('attLeaveHint') },
              { value: UNPAID_LEAVE, label: t('attStateUnpaid'), icon: 'fa-money-bill-1-wave', hint: t('attUnpaidHint') },
            ]}
          />
        </FormSection>
        {status === PRESENT && (
          <FormSection title={t('attTimes')} note={<><i className="fa-solid fa-circle-info" /> {t('attTimesNote')}</>}>
            <div className="rs-form-group">
              <label className="form-label">{t('attCheckIn')}<span className="text-danger">*</span></label>
              {picker(checkIn, setCheckIn, false)}
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('attCheckOut')}</label>
              {picker(checkOut, setCheckOut, true)}
            </div>
          </FormSection>
        )}
        <FormSection title={t('attNote')}>
          <div className="is-wide rs-form-group">
            <Input as="textarea" rows={2} value={note} onChange={setNote} placeholder={t('attNotePlaceholder')} maxLength={255} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

export default AttendanceForm;
