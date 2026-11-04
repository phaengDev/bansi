import moment from 'moment';
import { SelectPicker } from 'rsuite';
import { useT } from '../../../context/LanguageContext';
import { HrAvatar } from '../hrKit';
import { TASK_DONE, TASK_PRIORITIES, TASK_STATUSES, assigneeName, type Task, type TaskAssignee } from './taskApi';

/** ປ້າຍສະຖານະ */
export const TaskStatusPill = ({ status, caret }: { status: number; caret?: boolean }) => {
  const t = useT();
  const meta = TASK_STATUSES[status] ?? TASK_STATUSES[1];
  return (
    <span className={`task-status ${meta.tone}`}>
      <i className={meta.icon} /> {t(meta.label)}
      {caret && <i className="fa-solid fa-chevron-down task-caret" />}
    </span>
  );
};

/** ປ້າຍສະຖານະທີ່ກົດປ່ຽນໄດ້ເລີຍ (ໃນຕາຕະລາງ) — disabled = ບໍ່ມີສິດແກ້ໄຂ */
export const TaskStatusSelect = ({ status, onChange, disabled }: { status: number; onChange: (status: number) => void; disabled?: boolean }) => {
  const t = useT();
  if (disabled) return <TaskStatusPill status={status} />;
  const data = Object.keys(TASK_STATUSES).map((key) => ({ value: Number(key), label: t(TASK_STATUSES[Number(key)].label) }));
  return (
    <SelectPicker
      data={data} value={status} onChange={(v) => v && v !== status && onChange(v)} cleanable={false} searchable={false} appearance="subtle"
      size="sm" className="task-status-picker" popupClassName="acc-book-menu"
      renderValue={(value: number) => <TaskStatusPill status={value} caret />}
      renderOption={(_: unknown, item: Record<string, unknown>) => <TaskStatusPill status={Number(item.value)} />}
    />
  );
};

/** ປ້າຍຄວາມສຳຄັນ — ປົກກະຕິ = ບໍ່ສະແດງ */
export const PriorityChip = ({ priority }: { priority: number }) => {
  const t = useT();
  if (priority < 2) return null;
  const meta = TASK_PRIORITIES[priority];
  return <span className={`acs-chip task-prio ${meta.tone}`}><i className={meta.icon} /> {t(meta.label)}</span>;
};

/** ຜູ້ຮັບຜິດຊອບ — ຫົວໜ້າວຽກ (ຄົນທຳອິດ) + ຈຳນວນຄົນອື່ນ; ຊີ້ເບິ່ງ = ລາຍຊື່ທັງໝົດ */
export const AssigneeCell = ({ assignees }: { assignees: TaskAssignee[] }) => {
  const t = useT();
  if (!assignees.length) return <span className="acc-gl-ref">—</span>;
  const [first, ...rest] = assignees;
  return (
    <span className="hr-person task-person-cell" title={assignees.map((a) => `${assigneeName(a)}${a.is_lead ? ` (${t('taskLead')})` : ''}`).join('\n')}>
      <HrAvatar url={first.profile_url} name={first.first_name} />
      <span>
        <b>{assigneeName(first)}</b>
        <small className="acc-gl-ref">
          {first.is_lead ? t('taskLead') : first.emp_code}
          {!!rest.length && <> · <span className="task-more">+{rest.length} {t('taskPeople')}</span></>}
        </small>
      </span>
    </span>
  );
};

/** ກຳນົດສົ່ງ + ຈຳນວນມື້ທີ່ເຫຼືອ / ເກີນ (ວຽກສຳເລັດແລ້ວ ບໍ່ນັບ) */
export const DueCell = ({ task }: { task: Task }) => {
  const t = useT();
  if (!task.due_date) return <span className="acc-gl-ref">—</span>;
  const due = moment(task.due_date, 'YYYY-MM-DD');
  const days = due.diff(moment().startOf('day'), 'days');
  let hint = '';
  if (task.status !== TASK_DONE) {
    if (task.overdue) hint = `${t('taskLateBy')} ${Math.max(1, -days)} ${t('days')}`;
    else hint = days === 0 ? t('today') : `${t('taskDueIn')} ${days} ${t('days')}`;
  }
  return (
    <span className={`task-due${task.overdue ? ' is-late' : ''}`}>
      {due.format('DD/MM/YYYY')}
      {hint && <small className="acc-gl-ref">{hint}</small>}
    </span>
  );
};
