import { useEffect, useState } from 'react';
import { Button, DatePicker, Form, Input, Loader, Modal, Slider } from 'rsuite';
import moment from 'moment';
import { deleteApi, getApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { useGetData } from '../hr/attendance/attendanceApi';
import { ProgressBar, QuadrantChip, QuadrantPicker } from '../hr/task/TaskBits';
import { FormStep, SettingModal } from '../account/setting/settingKit';
import { idOf, type WorkPlan, type WorkPlanPage, type WorkPlanScope } from './meApi';

const toDay = (value: Date | null) => (value ? moment(value).format('YYYY-MM-DD') : null);
const rangeText = (plan: Pick<WorkPlan, 'start_date' | 'end_date'>) => (plan.start_date === plan.end_date
  ? moment(plan.start_date).format('DD/MM/YYYY')
  : `${moment(plan.start_date).format('DD/MM')} – ${moment(plan.end_date).format('DD/MM/YYYY')}`);
const isDone = (plan: WorkPlan) => plan.done === true || Number(plan.done) === 1;

/** ສ້າງ / ແກ້ແຜນວຽກ — ຊື່ + ລາຍລະອຽດ, ຊ່ວງວັນທີ, ຄວາມສຳຄັນ (ຕາຕະລາງບໍລິຫານເວລາ) */
const PlanForm = ({ plan, onClose, onSaved }: { plan: WorkPlan | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [title, setTitle] = useState(plan?.title ?? '');
  const [note, setNote] = useState(plan?.note ?? '');
  const [start, setStart] = useState<Date | null>(plan ? moment(plan.start_date).toDate() : new Date());
  const [end, setEnd] = useState<Date | null>(plan ? moment(plan.end_date).toDate() : new Date());
  const [important, setImportant] = useState<boolean | null>(plan ? plan.important : null);
  const [urgent, setUrgent] = useState<boolean | null>(plan ? plan.urgent : null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) return Notific.warning('myTaskTitleRequired');
    if (!start) return Notific.warning('myPickDates');
    const body = {
      title: title.trim(), note: note.trim() || null, start_date: toDay(start), end_date: toDay(end && end >= start ? end : start),
      important: important === null ? null : Number(important), urgent: urgent === null ? null : Number(urgent),
    };
    try {
      setSaving(true);
      if (plan) await putApi(`/employee/me/workplan/${idOf(plan)}`, body);
      else await postApi('/employee/me/workplan', body);
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
    <SettingModal title={t(plan ? 'myPlanEdit' : 'myPlanNew')} hint={t('myPlanHint')} icon="fa-calendar-week" saving={saving} onClose={onClose} onSubmit={submit}
      wide keyboard={false} className="is-steps"
    >
      <Form fluid>
        <FormStep no={1} done={!!title.trim()} title={t('myPlanStepWhat')}>
          <div className="rs-form-group is-wide">
            <label className="form-label">{t('taskName')}<span className="text-danger">*</span></label>
            <Input value={title} onChange={setTitle} maxLength={255} />
          </div>
          <div className="rs-form-group is-wide">
            <label className="form-label">{t('taskDetail')}</label>
            <Input as="textarea" rows={2} value={note} onChange={setNote} maxLength={2000} />
          </div>
        </FormStep>
        <FormStep no={2} done={!!start} title={t('myPlanStepWhen')}>
          <div className="rs-form-group">
            <label className="form-label">{t('myDateFrom')}<span className="text-danger">*</span></label>
            <DatePicker value={start} onChange={(d) => { setStart(d); if (d && end && end < d) setEnd(d); }} format="dd/MM/yyyy" oneTap block cleanable={false} />
          </div>
          <div className="rs-form-group">
            <label className="form-label">{t('myDateTo')}</label>
            <DatePicker value={end} onChange={setEnd} format="dd/MM/yyyy" oneTap block shouldDisableDate={(d) => !!start && moment(d).isBefore(start, 'day')} />
          </div>
          <div className="is-wide">
            <QuadrantPicker important={important} urgent={urgent} onChange={(i, u) => { setImportant(i); setUrgent(u); }} />
          </div>
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/** ລາຍລະອຽດແຜນ: ອັບເດດຄວາມຄືບໜ້າ (100% = ປິດແຜນ, ປິດແລ້ວອັບເດດຕ່ຳກວ່າ = ເປີດຄືນ) + ປະຫວັດ; ແກ້ໄຂ / ລຶບ */
const PlanDetail = ({ plan: initial, onClose, onEdit, onChanged }: { plan: WorkPlan; onClose: () => void; onEdit: (plan: WorkPlan) => void; onChanged: () => void }) => {
  const t = useT();
  const [plan, setPlan] = useState(initial);
  const [progress, setProgress] = useState(initial.progress);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getApi(`/employee/me/workplan/${idOf(initial)}`)
      .then((res) => alive && res.data?.data && setPlan(res.data.data))
      .catch((error) => Notific.error(getErrorMessage(error)));
    return () => {
      alive = false;
    };
  }, [initial]);

  const save = async () => {
    if (progress === plan.progress && !note.trim()) return Notific.warning('myPlanNeedChange');
    try {
      setBusy(true);
      const res = await postApi(`/employee/me/workplan/${idOf(plan)}/progress`, { progress, note: note.trim() || null });
      if (res.data?.data) setPlan(res.data.data);
      setNote('');
      Notific.success('saveSuccessDone');
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const remove = () => Notific.confirm(`${t('myPlanDeleteConfirm')} ${plan.title}`, async () => {
    try {
      await deleteApi(`/employee/me/workplan/${idOf(plan)}`);
      Notific.success('acsDeleted');
      onChanged();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  return (
    <Modal open onClose={onClose} size="sm" className="acc-gl-ledger-modal my-plan-modal">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <span className="acc-gl-group-icon acc-tone is-blue"><i className="fa-solid fa-calendar-week" /></span>
          <span>
            <Modal.Title>{plan.title}</Modal.Title>
            <small>{rangeText(plan)}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="my-task-tags"><QuadrantChip task={plan} /><ProgressBar value={plan.progress} /></div>
        {plan.note && <p className="task-detail-text">{plan.note}</p>}
        <section className="my-task-part">
          <h6 className="task-detail-head"><i className="fa-solid fa-chart-line" /> {t('myPlanUpdate')}</h6>
          <div className="my-task-slider">
            <Slider value={progress} min={0} max={100} step={5} progress onChange={setProgress} />
            <b>{progress}%</b>
          </div>
          <Input as="textarea" rows={2} value={note} onChange={setNote} maxLength={500} placeholder={t('myTaskNotePlaceholder')} />
          <div className="my-task-part-foot">
            <small className="acc-gl-ref">{t('myPlanUpdateHint')}</small>
            <button type="button" className="acc-rp-btn is-primary" disabled={busy} onClick={save}>
              {busy ? <Loader size="xs" /> : <i className="fa-solid fa-check" />} {t('myTaskSaveProgress')}
            </button>
          </div>
        </section>
        {!!plan.updates?.length && (
          <>
            <h6 className="task-detail-head"><i className="fa-solid fa-clock-rotate-left" /> {t('taskTimeline')} <em>{plan.updates.length}</em></h6>
            <ul className="my-plan-updates">
              {[...plan.updates].reverse().map((u, i) => (
                <li key={`${u.at}-${i}`}>
                  <b>{u.progress}%</b>
                  <span>{u.note ?? (u.kind === 'create' ? t('taskLogCreate') : '—')}</span>
                  <time>{moment(u.at).format('DD/MM HH:mm')}</time>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="acc-rp-btn is-danger hr-status-btn" onClick={remove}><i className="fa-solid fa-trash" /> {t('delete')}</button>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" startIcon={<i className="fa-solid fa-pen" />} onClick={() => onEdit(plan)}>{t('edit')}</Button>
      </Modal.Footer>
    </Modal>
  );
};

/** ແຜນວຽກຂອງຂ້ອຍ (ຄືໃນ app) — ກຳລັງເຮັດ / ຈະມາເຖິງ / ສຳເລັດແລ້ວ, ເກີນກຳນົດ = ສີແດງ; ສ້າງ, ອັບເດດຄວາມຄືບໜ້າ, ແກ້, ລຶບ */
const MyWorkPlans = () => {
  const t = useT();
  const [scope, setScope] = useState<WorkPlanScope>('active');
  const [viewing, setViewing] = useState<WorkPlan | null>(null);
  const [editing, setEditing] = useState<WorkPlan | null | 'new'>(null);
  const { data, loading, reload } = useGetData<WorkPlanPage>('/employee/me/workplan', { scope });
  const tabs: { key: WorkPlanScope; label: string }[] = [
    { key: 'active', label: 'myPlanActive' },
    { key: 'upcoming', label: 'myPlanUpcoming' },
    { key: 'history', label: 'myPlanHistory' },
  ];

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="acc-type-segment" role="tablist">
            {tabs.map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={scope === tab.key} className={scope === tab.key ? 'is-active' : ''} onClick={() => setScope(tab.key)}>
                {t(tab.label)} {data && <em>{data.counts[tab.key]}</em>}
              </button>
            ))}
          </div>
          {!!data?.counts.overdue && <span className="att-state is-absent"><i className="fa-solid fa-triangle-exclamation" /> {t('myPlanOverdue')} {data.counts.overdue}</span>}
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn is-primary" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> {t('myPlanNew')}</button>
          </div>
        </div>
      </div>

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !data.data.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-calendar-week" /><p>{t('myNoPlans')}</p></div>
      ) : (
        <div className={`my-tasks${loading ? ' is-refreshing' : ''}`}>
          {data.data.map((plan) => {
            const late = !isDone(plan) && plan.end_date < data.today;
            return (
              <button key={plan._uuid} type="button" className={`my-task${late ? ' is-late' : ''}`} onClick={() => setViewing(plan)}>
                <span className="my-task-top">
                  {isDone(plan)
                    ? <span className="att-state is-present"><i className="fa-solid fa-circle-check" /> {t('myTaskDone')}</span>
                    : late ? <span className="att-state is-absent"><i className="fa-solid fa-triangle-exclamation" /> {t('myPlanOverdue')}</span>
                      : <span className="att-state is-leave"><i className="fa-solid fa-calendar-week" /> {rangeText(plan)}</span>}
                  <QuadrantChip task={plan} hideDrop />
                </span>
                <b className="my-task-title">{plan.title}</b>
                {(isDone(plan) || late) && <span className="my-task-meta"><span className="acc-gl-ref">{rangeText(plan)}</span></span>}
                <span className="my-task-progress"><ProgressBar value={plan.progress} compact /></span>
                {plan.last_update?.note && <span className="my-task-note"><i className="fa-regular fa-note-sticky" /> {plan.last_update.note}</span>}
              </button>
            );
          })}
        </div>
      )}

      {viewing && <PlanDetail plan={viewing} onClose={() => setViewing(null)} onChanged={reload} onEdit={(plan) => { setViewing(null); setEditing(plan); }} />}
      {editing && <PlanForm plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
};

export default MyWorkPlans;
