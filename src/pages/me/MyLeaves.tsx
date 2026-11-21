import { useEffect, useRef, useState } from 'react';
import { DatePicker, Form, Input, Loader } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { MAX_FILE, fileSizeText } from '../hr/hrApi';
import { leaveTone, toPeriod, useGetData } from '../hr/attendance/attendanceApi';
import { LeaveFileChips } from '../hr/attendance/LeaveFiles';
import { LeaveStatusCell, LeaveTypePicker, REQ_PENDING, isOver, rangeLabel, typeLabel } from '../hr/attendance/requestKit';
import { FormStep, SettingModal, YearStepper } from '../account/setting/settingKit';
import { idOf, type MyAttendanceData, type MyHolidays, type MyIntent, type MyLeaveData } from './meApi';

const MAX_FILES = 5;
const LEAVE_FILE = /\.(jpe?g|png|webp|pdf)$/i;
const toDay = (date: Date) => moment(date).format('YYYY-MM-DD');

/**
 * ມື້ເຮັດວຽກໃນຊ່ວງ (ໂດຍປະມານ) — ບໍ່ນັບວັນພັກປະຈຳອາທິດຂອງບໍລິສັດ ແລະ ວັນພັກ. backend ນັບແທ້ຕອນບັນທຶກ
 * (ລວມມື້ທີ່ບໍ່ໄດ້ເປັນພະນັກງານ / ມາວຽກແລ້ວ)
 */
const workdaysBetween = (start: string, end: string, daysOff: number[], holidays: Set<string>) => {
  let n = 0;
  for (let d = moment(start); d.isSameOrBefore(end, 'day'); d.add(1, 'day')) {
    if (!daysOff.includes(d.day()) && !holidays.has(d.format('YYYY-MM-DD'))) n += 1;
  }
  return n;
};

/**
 * ຂໍລາພັກ 3 ຂັ້ນ — ປະເພດ (ບັດ + ມື້ທີ່ເຫຼືອ), ວັນທີ (+ ມື້ເຮັດວຽກໂດຍປະມານ), ເຫດຜົນ + ໃບລາ (ຮູບ / PDF ≤ 5 ໄຟລ໌).
 * ສົ່ງ POST /leave/me (ມີໄຟລ໌ = multipart) → ລໍຫົວໜ້າທີມ / HR ອະນຸມັດ
 */
const LeaveForm = ({ balances, onClose, onSaved }: { balances: MyLeaveData['types']; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [typeId, setTypeId] = useState<number | null>(balances.length === 1 ? balances[0]._uuid : null);
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const year = moment(start ?? new Date()).year();
  const { data: work } = useGetData<MyAttendanceData>('/attendance/me', { month: toPeriod(new Date()) });
  const { data: holidays } = useGetData<MyHolidays>('/holiday/me', { year });

  const from = start ? toDay(start) : null;
  const to = end && start && end >= start ? toDay(end) : from;
  const days = from && to ? workdaysBetween(from, to, work?.company?.days_off ?? [0, 6], new Set((holidays?.data ?? []).map((h) => h.holiday_date))) : 0;
  const selected = balances.find((b) => b._uuid === typeId);
  const over = isOver(selected, days);

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    if (picked.some((f) => !LEAVE_FILE.test(f.name) || f.size > MAX_FILE)) Notific.warning('myFileWrongType');
    const ok = picked.filter((f) => LEAVE_FILE.test(f.name) && f.size <= MAX_FILE);
    const next = [...files, ...ok];
    if (next.length > MAX_FILES) Notific.warning('myFileTooMany');
    setFiles(next.slice(0, MAX_FILES));
  };

  const submit = async () => {
    if (!typeId) return Notific.warning('myPickType');
    if (!from || !to) return Notific.warning('myPickDates');
    if (!reason.trim()) return Notific.warning('myReasonRequired');
    const fields = { leave_type_id: String(typeId), start_date: from, end_date: to, reason: reason.trim() };
    let body: FormData | typeof fields = fields;
    if (files.length) {
      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      files.forEach((file) => form.append('files', file));
      body = form;
    }
    try {
      setSaving(true);
      await postApi('/leave/me', body);
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
    <SettingModal title={t('myLeaveNew')} hint={t('myLeaveNewHint')} icon="fa-plane-departure" saving={saving} onClose={onClose} onSubmit={submit}
      wide keyboard={false} className="is-steps"
      submit={{ label: t('mySend'), icon: 'fa-paper-plane' }}
    >
      <Form fluid>
        <FormStep no={1} done={!!typeId} title={t('myLeaveStepType')} hint={t('myLeaveStepTypeHint')}>
          <div className="rs-form-group is-wide">
            <label className="form-label">{t('leaveType')}<span className="text-danger">*</span></label>
            {balances.length
              ? <LeaveTypePicker balances={balances} days={days} value={typeId} onChange={setTypeId} />
              : <p className="acc-arap-empty">{t('lvNoTypes')}</p>}
          </div>
        </FormStep>

        <FormStep no={2} done={!!from} title={t('myLeaveStepDates')} hint={t('myLeaveStepDatesHint')}
          note={days > 0 ? <><i className="fa-regular fa-calendar-check" /> {t('myLeaveDaysEstimate').replace('{n}', String(days))}</> : undefined}
        >
          <div className="rs-form-group">
            <label className="form-label">{t('myDateFrom')}<span className="text-danger">*</span></label>
            <DatePicker value={start} onChange={(d) => { setStart(d); if (d && end && end < d) setEnd(null); }} format="dd/MM/yyyy" oneTap block />
          </div>
          <div className="rs-form-group">
            <label className="form-label">{t('myDateTo')}</label>
            <DatePicker value={end} onChange={setEnd} format="dd/MM/yyyy" oneTap block placeholder={start ? moment(start).format('DD/MM/YYYY') : undefined}
              shouldDisableDate={(d) => !!start && moment(d).isBefore(start, 'day')}
            />
          </div>
          {over && (
            <p className="is-wide my-form-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('myOverQuota')}</p>
          )}
        </FormStep>

        <FormStep no={3} done={!!reason.trim()} title={t('myLeaveStepReason')} hint={t('myLeaveStepReasonHint')}>
          <div className="rs-form-group is-wide">
            <label className="form-label">{t('leaveReason')}<span className="text-danger">*</span></label>
            <Input as="textarea" rows={2} value={reason} onChange={setReason} maxLength={255} />
          </div>
          <div className="rs-form-group is-wide">
            <label className="form-label">{t('lvFiles')} <small className="acc-gl-ref">({files.length}/{MAX_FILES})</small></label>
            <div className="my-files">
              {files.map((file, i) => (
                <span key={`${file.name}-${i}`} className="my-file">
                  <i className={`fa-solid ${/\.pdf$/i.test(file.name) ? 'fa-file-pdf' : 'fa-file-image'}`} />
                  <b>{file.name}</b>
                  <small>{fileSizeText(file.size)}</small>
                  <button type="button" aria-label={t('delete')} onClick={() => setFiles(files.filter((_, j) => j !== i))}><i className="fa-solid fa-xmark" /></button>
                </span>
              ))}
              {files.length < MAX_FILES && (
                <button type="button" className="my-file-add" onClick={() => fileRef.current?.click()}>
                  <i className="fa-solid fa-paperclip" /> {t('myAttach')}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
            <small className="pay-field-hint">{t('myAttachHint')}</small>
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/**
 * ລາພັກຂອງຂ້ອຍ — ສິດລາຂອງປີ (ແຕ່ລະປະເພດ: ເຫຼືອ / ໃຊ້ແລ້ວ / ລໍຖ້າ), ຄຳຂໍທັງໝົດຂອງປີ (ສະຖານະ + ຂັ້ນຫົວໜ້າທີມ + ໃບລາ),
 * ຂໍລາພັກໃໝ່ ແລະ ຍົກເລີກຄຳຂໍທີ່ຍັງລໍຖ້າ
 */
const MyLeaves = ({ intent, onIntentDone }: { intent?: MyIntent | null; onIntentDone: () => void }) => {
  const t = useT();
  const [year, setYear] = useState(moment().year());
  const [creating, setCreating] = useState(false);
  const { data, loading, reload } = useGetData<MyLeaveData>('/leave/me', { year });

  useEffect(() => {
    if (intent?.action !== 'new') return;
    setCreating(true);
    onIntentDone();
  }, [intent, onIntentDone]);

  const cancel = (id: number) => Notific.confirm(t('myCancelConfirm'), async () => {
    try {
      await putApi(`/leave/me/cancel/${idOf({ _uuid: id })}`, {});
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
          <div className="att-nav"><YearStepper year={year} onChange={setYear} max={moment().year() + 1} /></div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn is-primary" disabled={!data} onClick={() => setCreating(true)}>
              <i className="fa-solid fa-plus" /> {t('myLeaveNew')}
            </button>
          </div>
        </div>
      </div>

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <section className="my-card">
            <header><h3><i className="fa-solid fa-scale-balanced" /> {t('myLeaveBalances')} {data.year}</h3></header>
            <div className="my-balances">
              {data.types.map((b) => {
                const meta = leaveTone(b.paid);
                return (
                  <div key={b._uuid} className={`my-balance ${meta.tone}`}>
                    <span className="lv-type-icon"><i className={`fa-solid ${meta.icon}`} /></span>
                    <span>
                      <b>{b.name}</b>
                      <small>{t(meta.label)}</small>
                    </span>
                    <span className="my-balance-left">
                      {b.remaining === null ? <b>∞</b> : <b>{b.remaining}<small>/{b.max_per_year}</small></b>}
                      <small>{b.remaining === null ? t('lvTypeUnlimited') : t('lvBalanceLeft')}</small>
                    </span>
                    <em>{t('myLeaveUsed')} {b.used} · {t('myLeavePendingDays')} {b.pending} {t('leaveDayUnit')}</em>
                  </div>
                );
              })}
            </div>
          </section>

          {!data.data.length ? (
            <div className="acc-class-empty"><i className="fa-solid fa-plane-departure" /><p>{t('myNoRequests')}</p></div>
          ) : (
            <div className="acc-gl-group">
              <div className="acc-rp-scroll">
                <table className="acc-gl-table hr-table att-table">
                  <thead>
                    <tr>
                      <th>{t('leaveType')}</th>
                      <th>{t('leavePeriod')}</th>
                      <th>{t('leaveReason')}</th>
                      <th>{t('status')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((r) => {
                      const type = typeLabel(r, t);
                      return (
                        <tr key={r._uuid}>
                          <td><span className={`att-state ${type.tone}`}>{type.label}</span></td>
                          <td>
                            <b>{rangeLabel(r)}</b>
                            <small className="acc-gl-ref d-block">{r.days} {t('attWorkdays')} · {t('leaveRequestedAt')} {moment(r.createdAt).format('DD/MM/YYYY HH:mm')}</small>
                          </td>
                          <td className="att-note">
                            {r.reason}
                            <LeaveFileChips files={r.files} self />
                          </td>
                          <td><LeaveStatusCell row={r} /></td>
                          <td className="lv-actions">
                            {r.status === REQ_PENDING && (
                              <button type="button" className="lv-act is-reject" onClick={() => cancel(r._uuid)}>
                                <i className="fa-solid fa-ban" /> {t('myCancelRequest')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {creating && data && <LeaveForm balances={data.types} onClose={() => setCreating(false)} onSaved={reload} />}
    </div>
  );
};

export default MyLeaves;
