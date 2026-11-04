import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CheckPicker, DatePicker, Form, Input, Loader, SelectPicker } from 'rsuite';
import moment from 'moment';
import { getApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useEmployees } from '../../../utils/selectOption';
import { useT } from '../../../context/LanguageContext';
import { FormSection, SettingModal } from '../../account/setting/settingKit';
import { HrAvatar } from '../hrKit';
import {
  TASK_PRIORITIES, TASK_STATUSES, assigneeName, idOf, type Task, type TaskAssignee, type TaskItem, type TaskProject,
} from './taskApi';

type Person = Pick<TaskAssignee, 'employee_id' | 'emp_code' | 'first_name' | 'last_name' | 'profile_url'>;
type Row = TaskItem & { key: number };

let seq = 0;
const toDate = (value: string | null) => (value ? moment(value, 'YYYY-MM-DD').toDate() : null);
const toDay = (value: Date | null) => (value ? moment(value).format('YYYY-MM-DD') : null);

/** ປຸ່ມເລືອກ 1 ຢ່າງ (ຄວາມສຳຄັນ, ສະຖານະ) */
const Choice = ({ options, value, onChange }: { options: { value: number; label: string; tone: string; icon?: string }[]; value: number; onChange: (v: number) => void }) => (
  <span className="task-choice" role="radiogroup">
    {options.map((o) => (
      <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
        className={`${o.tone}${value === o.value ? ' is-active' : ''}`} onClick={() => onChange(o.value)}
      >
        {o.icon && <i className={o.icon} />} {o.label}
      </button>
    ))}
  </span>
);

/**
 * ສ້າງ / ແກ້ວຽກ — ຂໍ້ມູນວຽກ, ຜູ້ຮັບຜິດຊອບ (ກົດມົງກຸດ = ຫົວໜ້າວຽກ), ລາຍການຍ່ອຍ. ບັນທຶກແລ້ວ ຄົນທີ່ຫາກໍ່ໄດ້ຮັບມອບໝາຍ
 * ໄດ້ຮັບແຈ້ງເຕືອນເດັ້ງຂຶ້ນຈໍມືຖື (backend ສົ່ງ)
 */
const TaskForm = ({ task, projects, onClose, onSaved }: {
  /** null = ສ້າງໃໝ່ */
  task: Task | null;
  projects: TaskProject[];
  onClose: () => void;
  onSaved: (task: Task) => void;
}) => {
  const t = useT();
  const employees = useEmployees();
  const [loaded, setLoaded] = useState<Task | null>(task ? null : ({} as Task));
  const [title, setTitle] = useState(task?.title ?? '');
  const [detail, setDetail] = useState(task?.detail ?? '');
  const [projectId, setProjectId] = useState<number | null>(task?.project_id ?? null);
  const [priority, setPriority] = useState(task?.priority ?? 1);
  const [status, setStatus] = useState(task?.status ?? 1);
  const [startDate, setStartDate] = useState<Date | null>(toDate(task?.start_date ?? null));
  const [dueDate, setDueDate] = useState<Date | null>(toDate(task?.due_date ?? null));
  const [assigneeIds, setAssigneeIds] = useState<number[]>(task?.assignees.map((a) => a.employee_id) ?? []);
  const [leadId, setLeadId] = useState<number | null>(task?.assignees.find((a) => a.is_lead)?.employee_id ?? null);
  const [items, setItems] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const lastInput = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // ແກ້ໄຂ: ໂຫຼດລາຍການຍ່ອຍ + ຜູ້ສ້າງ (ໂຫຼດບໍ່ໄດ້ = ປິດຟອມ)
  useEffect(() => {
    if (!task) return;
    let alive = true;
    getApi(`/task/${idOf(task)}`)
      .then((res) => {
        if (!alive) return;
        const full: Task = res.data?.data;
        setLoaded(full);
        setItems((full.items ?? []).map((i) => ({ ...i, key: ++seq })));
      })
      .catch((error) => {
        Notific.error(getErrorMessage(error));
        closeRef.current();
      });
    return () => {
      alive = false;
    };
  }, [task]);

  // ພະນັກງານທີ່ເຮັດວຽກຢູ່ + ຜູ້ຮັບຜິດຊອບເດີມທີ່ລາອອກແລ້ວ (ຍັງຢູ່ໃນວຽກເກົ່າໄດ້)
  const people = useMemo(() => {
    const list: Person[] = employees.map((e) => ({ employee_id: e._uuid, emp_code: e.emp_code, first_name: e.first_name, last_name: e.last_name, profile_url: e.profile_url ?? null }));
    for (const a of task?.assignees ?? []) if (!list.some((p) => p.employee_id === a.employee_id)) list.push(a);
    return list;
  }, [employees, task]);
  const personOf = (id: number) => people.find((p) => p.employee_id === id);
  const lead = leadId && assigneeIds.includes(leadId) ? leadId : assigneeIds[0] ?? null;

  const projectOptions = projects
    .filter((p) => Number(p.status) === 1 || p._uuid === task?.project_id)
    .map((p) => ({ value: p._uuid, label: p.name, color: p.color }));

  const addItem = () => {
    setItems((list) => [...list, { key: ++seq, title: '', done: false }]);
    window.setTimeout(() => lastInput.current?.focus(), 0);
  };
  const updateItem = (key: number, patch: Partial<Row>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const onItemKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  const submit = async () => {
    if (!title.trim()) return Notific.warning('taskTitleRequired');
    if (!assigneeIds.length) return Notific.warning('taskAssigneeRequired');
    if (startDate && dueDate && moment(dueDate).isBefore(startDate, 'day')) return Notific.warning('taskDueOrder');
    const body = {
      title: title.trim(),
      detail: detail.trim(),
      project_id: projectId,
      priority,
      start_date: toDay(startDate),
      due_date: toDay(dueDate),
      assignee_ids: assigneeIds,
      lead_id: lead,
      items: items.filter((i) => i.title.trim()).map((i) => ({ _uuid: i._uuid, title: i.title.trim(), done: i.done })),
      ...(task ? { status } : {}),
    };
    try {
      setSaving(true);
      const res = task ? await putApi(`/task/${idOf(task)}`, body) : await postApi('/task/create', body);
      Notific.success(res.data?.message ?? 'saveSuccessDone');
      onSaved(res.data.data);
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingModal title={t(task ? 'taskEdit' : 'taskNew')} hint={t('taskFormHint')} icon="fa-list-check" saving={saving}
      onClose={onClose} onSubmit={submit} wide className="task-modal" keyboard={false}
      submit={task ? undefined : { label: t('taskAssign'), icon: 'fa-paper-plane' }}
    >
      {!loaded ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <Form fluid>
          <FormSection title={t('taskInfo')}>
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('taskName')}<span className="text-danger">*</span></label>
              <Input value={title} onChange={setTitle} maxLength={255} placeholder={t('taskNamePlaceholder')} autoFocus={!task} />
            </div>
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('taskDetail')}</label>
              <Input as="textarea" rows={3} value={detail} onChange={setDetail} maxLength={5000} />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('taskProject')}</label>
              <SelectPicker block data={projectOptions} value={projectId} onChange={setProjectId} placeholder={t('taskNoProject')}
                popupClassName="acc-book-menu" searchable={projectOptions.length > 8}
                renderOption={(label, item) => <span className="task-project-opt"><i style={{ background: String(item.color) }} />{label}</span>}
              />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('taskPriority')}</label>
              <Choice value={priority} onChange={setPriority} options={[1, 2, 3].map((p) => ({
                value: p, label: t(TASK_PRIORITIES[p].label), tone: TASK_PRIORITIES[p].tone, icon: p > 1 ? 'fa-solid fa-fire' : undefined,
              }))} />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('taskStart')}</label>
              <DatePicker value={startDate} onChange={setStartDate} oneTap format="dd/MM/yyyy" block />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('taskDue')}</label>
              <DatePicker value={dueDate} onChange={setDueDate} oneTap format="dd/MM/yyyy" block
                shouldDisableDate={(d) => !!startDate && moment(d).isBefore(startDate, 'day')}
              />
            </div>
            {task && (
              <div className="is-wide rs-form-group">
                <label className="form-label">{t('status')}</label>
                <Choice value={status} onChange={setStatus} options={[1, 2, 3].map((s) => ({
                  value: s, label: t(TASK_STATUSES[s].label), tone: TASK_STATUSES[s].tone, icon: TASK_STATUSES[s].icon,
                }))} />
              </div>
            )}
          </FormSection>

          <FormSection title={t('taskAssignees')}>
            <div className="is-wide rs-form-group">
              <CheckPicker block data={people.map((p) => ({ ...p, value: p.employee_id, label: `${p.emp_code} ${assigneeName(p)}` }))}
                value={assigneeIds} onChange={setAssigneeIds} placeholder={t('taskPickAssignees')} countable popupClassName="acc-book-menu"
                renderOption={(_label, item) => (
                  <span className="task-person-opt">
                    <HrAvatar url={item.profile_url as string | null} name={String(item.first_name)} size="sm" />
                    <b>{assigneeName(item as unknown as Person)}</b> <small>{String(item.emp_code)}</small>
                  </span>
                )}
              />
              <small className="pay-field-hint">{t('taskAssigneeHint')}</small>
            </div>
            {!!assigneeIds.length && (
              <div className="is-wide task-people">
                {assigneeIds.map((id) => {
                  const p = personOf(id);
                  const isLead = id === lead;
                  return (
                    <span key={id} className={`task-person${isLead ? ' is-lead' : ''}`}>
                      <HrAvatar url={p?.profile_url} name={p?.first_name} size="sm" />
                      <b>{p ? assigneeName(p) : `#${id}`}</b>
                      <button type="button" className="task-crown" title={t('taskMakeLead')} aria-label={t('taskMakeLead')} aria-pressed={isLead} onClick={() => setLeadId(id)}>
                        <i className="fa-solid fa-crown" />
                      </button>
                      <button type="button" className="task-person-x" aria-label={t('delete')} onClick={() => setAssigneeIds((ids) => ids.filter((x) => x !== id))}>
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </FormSection>

          <FormSection title={`${t('taskChecklist')}${items.length ? ` ${items.filter((i) => i.done).length}/${items.length}` : ''}`}>
            <div className="is-wide task-checklist">
              {items.map((item, index) => (
                <div key={item.key} className={`task-check-row${item.done ? ' is-done' : ''}`}>
                  <button type="button" className="task-check" aria-pressed={item.done} aria-label={t('taskDone')} onClick={() => updateItem(item.key, { done: !item.done })}>
                    <i className={`fa-${item.done ? 'solid fa-square-check' : 'regular fa-square'}`} />
                  </button>
                  <input ref={index === items.length - 1 ? lastInput : undefined} value={item.title} maxLength={255}
                    placeholder={t('taskItemPlaceholder')} onChange={(e) => updateItem(item.key, { title: e.target.value })} onKeyDown={onItemKey}
                  />
                  <button type="button" className="acc-gl-act is-danger" aria-label={t('delete')} title={t('delete')} onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              ))}
              <button type="button" className="acc-rp-btn task-check-add" onClick={addItem}><i className="fa-solid fa-plus" /> {t('taskItemAdd')}</button>
            </div>
          </FormSection>

          {task && loaded.createdAt && (
            <p className="task-meta">
              <i className="fa-regular fa-clock" /> {t('taskCreated')} {moment(loaded.createdAt).format('DD/MM/YYYY HH:mm')}
              {loaded.createdby_name && <> · {loaded.createdby_name}</>}
              {loaded.done_at && <> · {t('taskDone')} {moment(loaded.done_at).format('DD/MM/YYYY HH:mm')}</>}
            </p>
          )}
        </Form>
      )}
    </SettingModal>
  );
};

export default TaskForm;
