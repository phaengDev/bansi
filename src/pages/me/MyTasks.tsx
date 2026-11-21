import { useEffect, useMemo, useState } from 'react';
import { DatePicker, Form, Input, Loader } from 'rsuite';
import moment from 'moment';
import { postApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { HrAvatar } from '../hr/hrKit';
import { useGetData } from '../hr/attendance/attendanceApi';
import {
  AssigneeStack, DueCell, PersonStatusPill, ProgressBar, QuadrantChip, QuadrantPicker, TaskChecklistEditor, TaskStatusPill, TeamProgress, type ChecklistRow,
} from '../hr/task/TaskBits';
import TaskAssigneePicker from '../hr/task/TaskAssigneePicker';
import { TASK_DONE, partOf, type TaskPerson } from '../hr/task/taskApi';
import { FormStep, SettingModal } from '../account/setting/settingKit';
import { useMyEmployee } from '../account/accountMenus';
import MyTaskDetail from './MyTaskDetail';
import type { MyIntent, MyOpen, MyTask, MyTasksData, MyTeamMember } from './meApi';

type Filter = 'open' | 'done' | 'all';
const toDay = (value: Date | null) => (value ? moment(value).format('YYYY-MM-DD') : null);

/** ລູກທີມ → ຄົນໃນຕົວເລືອກຜູ້ຮັບຜິດຊອບ (API ສົ່ງພະແນກເປັນຊື່ → ໃຫ້ເລກລຳດັບຂອງຊື່ເປັນ id ສຳລັບຕົວກັ່ນ) */
const toPeople = (team: MyTeamMember[]): TaskPerson[] => {
  const deptIds = new Map([...new Set(team.map((m) => m.department).filter(Boolean) as string[])].map((name, i) => [name, i + 1]));
  return team.map((m) => ({
    employee_id: m._uuid,
    emp_code: m.emp_code,
    first_name: m.first_name,
    last_name: m.last_name,
    profile_url: m.profile_url,
    department: m.department ? { _uuid: deptIds.get(m.department)!, depart_name: m.department } : null,
  }));
};

/**
 * ມອບໝາຍວຽກໃຫ້ລູກທີມ 4 ຂັ້ນ — ວຽກ (ຊື່ + ລາຍລະອຽດ), ຄວາມສຳຄັນ + ກຳນົດ, ຜູ້ຮັບຜິດຊອບ (ສະເພາະລູກທີມຕາມໂຄງຮ່າງ, ມົງກຸດ = ຫົວໜ້າວຽກ),
 * ລາຍການຍ່ອຍ → POST /task/me/assigned (ແຈ້ງເຕືອນຜູ້ຮັບຜິດຊອບທັນທີ)
 */
const AssignForm = ({ team, onClose, onSaved }: { team: MyTeamMember[]; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const people = useMemo(() => toPeople(team), [team]);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [important, setImportant] = useState<boolean | null>(true);
  const [urgent, setUrgent] = useState<boolean | null>(false);
  const [start, setStart] = useState<Date | null>(new Date());
  const [due, setDue] = useState<Date | null>(null);
  const [ids, setIds] = useState<number[]>([]);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [items, setItems] = useState<ChecklistRow[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const lead = leadId && ids.includes(leadId) ? leadId : ids[0] ?? null;

  const submit = async () => {
    if (!title.trim()) return Notific.warning('myTaskTitleRequired');
    if (!ids.length) return Notific.warning('myTaskPickPeople');
    try {
      setSaving(true);
      const res = await postApi('/task/me/assigned', {
        title: title.trim(), detail: detail.trim() || null, important, urgent,
        start_date: toDay(start), due_date: toDay(due), assignee_ids: ids, lead_id: lead,
        items: items.filter((i) => i.title.trim()).map((i) => ({ title: i.title.trim() })),
      });
      Notific.success(res.data?.message ?? 'saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingModal title={t('myTaskAssign')} hint={t('myTaskAssignHint')} icon="fa-list-check" saving={saving} onClose={onClose} onSubmit={submit}
        wide keyboard={false} className="is-steps" submit={{ label: t('myTaskAssignSend'), icon: 'fa-paper-plane' }}
      >
        <Form fluid>
          <FormStep no={1} done={!!title.trim()} title={t('myTaskStepWhat')}>
            <div className="rs-form-group is-wide">
              <label className="form-label">{t('taskName')}<span className="text-danger">*</span></label>
              <Input value={title} onChange={setTitle} maxLength={255} />
            </div>
            <div className="rs-form-group is-wide">
              <label className="form-label">{t('taskDetail')}</label>
              <Input as="textarea" rows={3} value={detail} onChange={setDetail} maxLength={5000} />
            </div>
          </FormStep>
          <FormStep no={2} done={!!due} title={t('myTaskStepWhen')}>
            <div className="is-wide">
              <QuadrantPicker important={important} urgent={urgent} onChange={(i, u) => { setImportant(i); setUrgent(u); }} />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('taskStart')}</label>
              <DatePicker value={start} onChange={setStart} format="dd/MM/yyyy" oneTap block />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('taskDue')}</label>
              <DatePicker value={due} onChange={setDue} format="dd/MM/yyyy" oneTap block shouldDisableDate={(d) => !!start && moment(d).isBefore(start, 'day')} />
            </div>
          </FormStep>
          <FormStep no={3} done={!!ids.length} title={t('taskAssignees')} hint={t('myTaskTeamOnly')}
            note={ids.length ? <><i className="fa-solid fa-users" /> {ids.length}</> : undefined}
          >
            <div className="is-wide my-assignees">
              {ids.map((id) => {
                const p = people.find((x) => x.employee_id === id);
                if (!p) return null;
                return (
                  <button key={id} type="button" className={`my-assignee${lead === id ? ' is-lead' : ''}`} title={t('taskLeadHint')} onClick={() => setLeadId(id)}>
                    {lead === id && <i className="fa-solid fa-crown" />}
                    <HrAvatar url={p.profile_url} name={p.first_name} size="sm" />
                    <span>{p.first_name} {p.last_name ?? ''}</span>
                  </button>
                );
              })}
              <button type="button" className="my-file-add" onClick={() => setPicking(true)}>
                <i className="fa-solid fa-user-plus" /> {t('myTaskPickPeople')}
              </button>
            </div>
          </FormStep>
          <FormStep no={4} done={items.some((i) => i.title.trim())} title={t('taskChecklist')}>
            <TaskChecklistEditor items={items} onChange={setItems} checkable={false} />
          </FormStep>
        </Form>
      </SettingModal>
      {picking && (
        <TaskAssigneePicker people={people} value={ids} lead={lead} onChange={setIds} onLead={setLeadId} onClose={() => setPicking(false)} />
      )}
    </>
  );
};

/**
 * ວຽກຂອງຂ້ອຍ — received: ວຽກທີ່ໄດ້ຮັບມອບໝາຍ (ສ່ວນຂອງຕົນ + ຄວາມຄືບໜ້າ); assigned: ວຽກທີ່ຂ້ອຍມອບໝາຍໃຫ້ລູກທີມ (ຄວາມຄືບໜ້າຂອງທີມ,
 * ມອບໝາຍໃໝ່ໄດ້ ຖ້າມີລູກທີມ). ກົດບັດ = ລາຍລະອຽດ (ອັບເດດ, ລາຍການຍ່ອຍ, ເອກະສານ, ຄອມເມັນ)
 */
const MyTasks = ({ mode, intent, onIntentDone, onOpen }: {
  mode: 'received' | 'assigned';
  /** open = ເປີດວຽກ id (ຈາກແຈ້ງເຕືອນ) — ບໍ່ຢູ່ໃນວຽກທີ່ໄດ້ຮັບ = ລອງວຽກທີ່ຂ້ອຍມອບໝາຍ */
  intent?: MyIntent | null;
  onIntentDone?: () => void;
  onOpen?: MyOpen;
}) => {
  const t = useT();
  const me = useMyEmployee();
  const [filter, setFilter] = useState<Filter>('open');
  const [viewing, setViewing] = useState<MyTask | null>(null);
  const [assigning, setAssigning] = useState(false);
  const { data, loading, reload } = useGetData<MyTasksData>(mode === 'received' ? '/task/me' : '/task/me/assigned');

  useEffect(() => {
    if (intent?.action !== 'open' || !data) return;
    const task = data.data.find((row) => row._uuid === intent.id);
    onIntentDone?.();
    if (task) setViewing(task);
    else if (mode === 'received' && onOpen) onOpen('assigned', intent);
    else Notific.warning('myTaskNotFound');
  }, [intent, data, mode, onIntentDone, onOpen]);
  const meId = Number(me?._uuid) || 0;
  const team = data?.team ?? [];

  const rows = (data?.data ?? []).filter((r) => (filter === 'all' ? true : filter === 'done' ? r.status === TASK_DONE : r.status !== TASK_DONE));
  const counts = {
    open: (data?.data ?? []).filter((r) => r.status !== TASK_DONE).length,
    done: (data?.data ?? []).filter((r) => r.status === TASK_DONE).length,
    all: data?.data.length ?? 0,
  };

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="acc-type-segment" role="tablist">
            {(['open', 'done', 'all'] as Filter[]).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>
                {t(key === 'open' ? 'myTaskOpen' : key === 'done' ? 'myTaskDone' : 'all')} <em>{counts[key]}</em>
              </button>
            ))}
          </div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            {mode === 'assigned' && (
              <button type="button" className="acc-rp-btn is-primary" disabled={!team.length} title={team.length ? undefined : t('myTaskNoTeam')} onClick={() => setAssigning(true)}>
                <i className="fa-solid fa-plus" /> {t('myTaskAssign')}
              </button>
            )}
          </div>
        </div>
      </div>
      {mode === 'assigned' && data && !team.length && <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('myTaskNoTeam')}</p>}

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !rows.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-list-check" /><p>{t(mode === 'received' ? 'myNoTasks' : 'myNoAssigned')}</p></div>
      ) : (
        <div className={`my-tasks${loading ? ' is-refreshing' : ''}`}>
          {rows.map((task) => {
            const mine = task.assignees.find((a) => a.employee_id === meId);
            const part = mine ? partOf(task, mine) : null;
            const itemsDone = task.items?.filter((i) => i.done).length ?? task.items_done;
            const itemsTotal = task.items?.length ?? task.items_total;
            return (
              <button key={task._uuid} type="button" className={`my-task${task.overdue && task.status !== TASK_DONE ? ' is-late' : ''}`} onClick={() => setViewing(task)}>
                <span className="my-task-top">
                  <TaskStatusPill status={task.status} />
                  <QuadrantChip task={task} hideDrop />
                </span>
                <b className="my-task-title">{task.title}</b>
                <span className="my-task-meta">
                  <DueCell task={task} />
                  {mode === 'received'
                    ? task.assigned_by && <span className="my-task-by"><HrAvatar url={task.assigned_by.profile_url} name={task.assigned_by.name} size="sm" /> {task.assigned_by.name}</span>
                    : <AssigneeStack assignees={task.assignees} task={task} />}
                </span>
                <span className="my-task-progress">
                  {mode === 'received' && part
                    ? <><PersonStatusPill status={part.status} reported={part.reported} /><ProgressBar value={part.progress} compact /></>
                    : <TeamProgress task={task} />}
                </span>
                <span className="my-task-foot">
                  {!!itemsTotal && <span><i className="fa-solid fa-list-check" /> {itemsDone}/{itemsTotal}</span>}
                  {!!(task.files?.length ?? task.files_total) && <span><i className="fa-solid fa-paperclip" /> {task.files?.length ?? task.files_total}</span>}
                  <span><i className="fa-regular fa-comments" /> {task.comments_total}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {viewing && <MyTaskDetail task={viewing} mode={mode} meId={meId} onClose={() => setViewing(null)} onChanged={reload} />}
      {assigning && <AssignForm team={team} onClose={() => setAssigning(false)} onSaved={reload} />}
    </div>
  );
};

export default MyTasks;
