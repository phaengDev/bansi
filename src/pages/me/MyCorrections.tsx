import { useEffect, useState } from 'react';
import { DatePicker, Form, Input, Loader } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { dayLabel, toPeriod, useGetData, weekdayKey } from '../hr/attendance/attendanceApi';
import { ClockCell, StatePill, TimeField } from '../hr/attendance/attendanceKit';
import { REQUEST_STATUSES, REQ_PENDING, StatusTag, TimePair } from '../hr/attendance/requestKit';
import { FormStep, SettingModal, YearStepper } from '../account/setting/settingKit';
import { idOf, type MyAttendanceData, type MyCorrectionData, type MyIntent } from './meApi';

/**
 * ແຈ້ງລືມສະແກນ 3 ຂັ້ນ — ມື້ (ເຫັນສະຖານະ ແລະ ເວລາທີ່ບັນທຶກໄວ້ຂອງມື້ນັ້ນທັນທີ), ເວລາທີ່ຖືກຕ້ອງ (ຢ່າງໜ້ອຍ 1),
 * ເຫດຜົນ → POST /correction/me (HR ກວດ ແລະ ອະນຸມັດ)
 */
const CorrectionForm = ({ initialDate, onClose, onSaved }: { initialDate?: string; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [date, setDate] = useState<Date | null>(initialDate ? moment(initialDate).toDate() : null);
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const day = date ? moment(date).format('YYYY-MM-DD') : null;
  const { data: month } = useGetData<MyAttendanceData>('/attendance/me', day ? { month: toPeriod(day) } : null);
  const recorded = day ? month?.days.find((d) => d.date === day) : undefined;
  const company = month?.company;

  const submit = async () => {
    if (!day) return Notific.warning('myPickDates');
    if (!checkIn && !checkOut) return Notific.warning('myCorrNeedTime');
    if (!reason.trim()) return Notific.warning('myReasonRequired');
    try {
      setSaving(true);
      await postApi('/correction/me', { work_date: day, check_in: checkIn, check_out: checkOut, reason: reason.trim() });
      Notific.success('saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingModal title={t('myCorrections')} hint={t('myCorrNewHint')} icon="fa-fingerprint" saving={saving} onClose={onClose} onSubmit={submit}
      wide keyboard={false} className="is-steps"
      submit={{ label: t('mySend'), icon: 'fa-paper-plane' }}
    >
      <Form fluid>
        <FormStep no={1} done={!!day} title={t('myCorrStepDay')} hint={t('myCorrStepDayHint')}>
          <div className="rs-form-group">
            <label className="form-label">{t('corrDate')}<span className="text-danger">*</span></label>
            <DatePicker value={date} onChange={setDate} format="dd/MM/yyyy" oneTap block shouldDisableDate={(d) => moment(d).isAfter(moment(), 'day')} />
          </div>
          <div className="rs-form-group">
            <label className="form-label">{t('myCorrRecorded')}</label>
            {!day ? <p className="my-recorded is-empty">—</p> : !recorded ? <Loader size="xs" /> : (
              <div className="my-recorded">
                <StatePill state={recorded.state} />
                <span><small>{t('attCheckIn')}</small> <ClockCell record={recorded.record} side="in" /></span>
                <span><small>{t('attCheckOut')}</small> <ClockCell record={recorded.record} side="out" /></span>
              </div>
            )}
          </div>
        </FormStep>

        <FormStep no={2} done={!!checkIn || !!checkOut} title={t('myCorrStepTimes')} hint={t('myCorrStepTimesHint')}
          note={company ? <><i className="fa-regular fa-clock" /> {company.work_start}–{company.work_end}</> : undefined}
        >
          <div className="rs-form-group">
            <label className="form-label">{t('attCheckIn')}</label>
            <TimeField value={checkIn} onChange={setCheckIn} placeholder={recorded?.record?.check_in_time ?? company?.work_start} />
          </div>
          <div className="rs-form-group">
            <label className="form-label">{t('attCheckOut')}</label>
            <TimeField value={checkOut} onChange={setCheckOut} placeholder={recorded?.record?.check_out_time ?? company?.work_end} />
          </div>
        </FormStep>

        <FormStep no={3} done={!!reason.trim()} title={t('leaveReason')} hint={t('myCorrReasonHint')}>
          <div className="rs-form-group is-wide">
            <label className="form-label">{t('leaveReason')}<span className="text-danger">*</span></label>
            <Input as="textarea" rows={2} value={reason} onChange={setReason} maxLength={255} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/** ແຈ້ງລືມສະແກນຂອງຂ້ອຍ — ຄຳຮ້ອງຂອງປີ (ວັນທີ, ເວລາທີ່ຂໍ, ເຫດຜົນ, ສະຖານະ), ແຈ້ງໃໝ່ ແລະ ຍົກເລີກອັນທີ່ລໍຖ້າ */
const MyCorrections = ({ intent, onIntentDone }: { intent?: MyIntent | null; onIntentDone: () => void }) => {
  const t = useT();
  const [year, setYear] = useState(moment().year());
  const [creating, setCreating] = useState<{ date?: string } | null>(null);
  const { data, loading, reload } = useGetData<MyCorrectionData>('/correction/me', { year });

  useEffect(() => {
    if (intent?.action !== 'new') return;
    setCreating({ date: intent.date });
    onIntentDone();
  }, [intent, onIntentDone]);

  const cancel = (id: number) => Notific.confirm(t('myCancelConfirm'), async () => {
    try {
      await putApi(`/correction/me/cancel/${idOf({ _uuid: id })}`, {});
      Notific.success('saveSuccessDone');
      reload();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="att-nav"><YearStepper year={year} onChange={setYear} max={moment().year()} /></div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn is-primary" onClick={() => setCreating({})}>
              <i className="fa-solid fa-plus" /> {t('myCorrections')}
            </button>
          </div>
        </div>
      </div>
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('myCorrNote')}</p>

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !data.data.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-fingerprint" /><p>{t('myNoRequests')}</p></div>
      ) : (
        <div className={`acc-gl-group${loading ? ' is-refreshing' : ''}`}>
          <div className="acc-rp-scroll">
            <table className="acc-gl-table hr-table att-table">
              <thead>
                <tr>
                  <th>{t('corrDate')}</th>
                  <th>{t('attCheckIn')}</th>
                  <th>{t('attCheckOut')}</th>
                  <th>{t('leaveReason')}</th>
                  <th>{t('status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r._uuid}>
                    <td>
                      <b>{dayLabel(r.work_date)}</b>
                      <small className="acc-gl-ref d-block">{t(weekdayKey(r.work_date))} · {t('leaveRequestedAt')} {moment(r.createdAt).format('DD/MM HH:mm')}</small>
                    </td>
                    <td><TimePair requested={r.check_in} /></td>
                    <td><TimePair requested={r.check_out} /></td>
                    <td className="att-note">{r.reason}</td>
                    <td>
                      <StatusTag meta={REQUEST_STATUSES[r.status] ?? REQUEST_STATUSES[REQ_PENDING]} />
                      {r.review_note && <small className="acc-gl-ref d-block">{r.review_note}</small>}
                    </td>
                    <td className="lv-actions">
                      {r.status === REQ_PENDING && (
                        <button type="button" className="lv-act is-reject" onClick={() => cancel(r._uuid)}>
                          <i className="fa-solid fa-ban" /> {t('myCancelRequest')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && <CorrectionForm initialDate={creating.date} onClose={() => setCreating(null)} onSaved={reload} />}
    </div>
  );
};

export default MyCorrections;
