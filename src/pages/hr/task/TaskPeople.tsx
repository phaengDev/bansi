import { Fragment, useMemo, useState, type KeyboardEvent } from 'react';
import { useT } from '../../../context/LanguageContext';
import { HrAvatar } from '../hrKit';
import { ActiveTime, DueCell, PersonStatusPill, ProgressBar } from './TaskBits';
import { PERSON_DONE, TASK_DONE, assigneeName, partOf, type Task, type TaskAssignee } from './taskApi';

type PersonRow = {
  person: TaskAssignee;
  tasks: { task: Task; mine: TaskAssignee }[];
  todo: number;
  doing: number;
  done: number;
  /** ວຽກທີ່ເກີນກຳນົດ ແລະ ສ່ວນຂອງຄົນນີ້ຍັງບໍ່ສຳເລັດ */
  late: number;
  /** ສະເລ່ຍ % ຂອງທຸກວຽກ (ວຽກປິດແລ້ວ = 100) */
  progress: number;
  active: string | null;
};

/** ຈັດກຸ່ມວຽກຕາມຜູ້ຮັບຜິດຊອບ — ຄົນທີ່ມີວຽກເກີນກຳນົດຂຶ້ນກ່ອນ, ແລ້ວຄົນທີ່ມີວຽກຄ້າງຫຼາຍ */
const groupByPerson = (tasks: Task[]): PersonRow[] => {
  const people = new Map<number, PersonRow>();
  for (const task of tasks) {
    for (const mine of task.assignees) {
      const row = people.get(mine.employee_id) ?? { person: mine, tasks: [], todo: 0, doing: 0, done: 0, late: 0, progress: 0, active: null };
      row.tasks.push({ task, mine });
      people.set(mine.employee_id, row);
    }
  }
  const rows = [...people.values()];
  for (const row of rows) {
    let sum = 0;
    for (const { task, mine } of row.tasks) {
      const part = partOf(task, mine);
      if (part.status === PERSON_DONE) row.done += 1;
      else if (part.status > 1) row.doing += 1;
      else row.todo += 1;
      if (task.overdue && part.status !== PERSON_DONE) row.late += 1;
      sum += part.progress;
      if (mine.active_at && (!row.active || mine.active_at > row.active)) row.active = mine.active_at;
    }
    row.progress = Math.round(sum / row.tasks.length);
    // ວຽກຂອງຄົນນີ້: ເກີນກຳນົດ → ຍັງຄ້າງ (ກຳນົດສົ່ງໃກ້ສຸດ) → ສຳເລັດແລ້ວ
    const rank = ({ task, mine }: { task: Task; mine: TaskAssignee }) =>
      (partOf(task, mine).status === PERSON_DONE ? 2 : task.overdue ? 0 : 1);
    row.tasks.sort((a, b) => rank(a) - rank(b) || String(a.task.due_date ?? '9999').localeCompare(String(b.task.due_date ?? '9999')));
  }
  return rows.sort((a, b) => b.late - a.late || (b.todo + b.doing) - (a.todo + a.doing) || assigneeName(a.person).localeCompare(assigneeName(b.person)));
};

/**
 * ມຸມມອງ "ຕາມຄົນ" — ແຕ່ລະຜູ້ຮັບຜິດຊອບ: ຈຳນວນວຽກ, ຍັງບໍ່ເລີ່ມ / ກຳລັງເຮັດ / ສຳເລັດ (ສ່ວນຂອງຕົນ), ເກີນກຳນົດ, % ສະເລ່ຍ,
 * ອັບເດດລ່າສຸດ. ກົດແຖວ = ເບິ່ງວຽກຂອງຄົນນັ້ນ, ກົດວຽກ = ລາຍລະອຽດວຽກ. ໃຊ້ວຽກທີ່ກັ່ນແລ້ວ (ແຖບ, ໂປຣເຈັກ, ຄົ້ນຫາ, ດາວ) ຂອງໜ້າຫຼັກ
 */
const TaskPeople = ({ tasks, onOpen }: { tasks: Task[]; onOpen: (task: Task) => void }) => {
  const t = useT();
  const people = useMemo(() => groupByPerson(tasks), [tasks]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const onKey = (e: KeyboardEvent, run: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      run();
    }
  };
  const count = (n: number, tone = '') => (n ? <b className={tone}>{n}</b> : <span className="acc-gl-ref">—</span>);

  return (
    <div className="acc-gl-group">
      <div className="acc-rp-scroll">
        <table className="acc-gl-table hr-table task-table task-people-table">
          <thead>
            <tr>
              <th>{t('taskAssignees')}</th>
              <th className="task-num">{t('taskTasks')}</th>
              <th className="task-num">{t('taskPersonTodo')}</th>
              <th className="task-num">{t('taskPersonDoing')}</th>
              <th className="task-num">{t('taskPersonDone')}</th>
              <th className="task-num">{t('taskOverdue')}</th>
              <th>{t('taskTeamProgress')}</th>
              <th>{t('taskLastUpdate')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.map((row) => {
              const id = row.person.employee_id;
              const expanded = open.has(id);
              return (
                <Fragment key={id}>
                  <tr className={`is-click${expanded ? ' is-selected' : ''}${Number(row.person.work_status) === 2 ? ' is-done' : ''}`} tabIndex={0}
                    aria-expanded={expanded} onClick={() => toggle(id)} onKeyDown={(e) => onKey(e, () => toggle(id))}
                  >
                    <td>
                      <span className="task-person-cell">
                        <span className="task-avatar"><HrAvatar url={row.person.profile_url} name={row.person.first_name} size="sm" /></span>
                        <span>
                          <b>{assigneeName(row.person)}</b>
                          <small>{row.person.emp_code}</small>
                        </span>
                      </span>
                    </td>
                    <td className="task-num"><b>{row.tasks.length}</b></td>
                    <td className="task-num">{count(row.todo)}</td>
                    <td className="task-num">{count(row.doing, 'task-tone-doing')}</td>
                    <td className="task-num">{count(row.done, 'task-tone-done')}</td>
                    <td className="task-num">{row.late ? <span className="task-late-count">{row.late}</span> : <span className="acc-gl-ref">—</span>}</td>
                    <td><ProgressBar value={row.progress} /></td>
                    <td><ActiveTime value={row.active} /></td>
                    <td className="task-people-caret"><i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} /></td>
                  </tr>
                  {expanded && (
                    <tr className="task-people-sub">
                      <td colSpan={9}>
                        <ul className="task-people-tasks">
                          {row.tasks.map(({ task, mine }) => {
                            const part = partOf(task, mine);
                            return (
                              <li key={task._uuid} role="button" tabIndex={0} className={task.status === TASK_DONE ? 'is-closed' : ''}
                                onClick={() => onOpen(task)} onKeyDown={(e) => onKey(e, () => onOpen(task))}
                              >
                                <span className="task-people-title">
                                  <b>{task.title}</b>
                                  {task.project && <span className="task-project"><i style={{ background: task.project.color }} />{task.project.name}</span>}
                                </span>
                                <PersonStatusPill status={part.status} reported={part.reported} />
                                <ProgressBar value={part.progress} />
                                <DueCell task={task} />
                                <ActiveTime value={mine.active_at} />
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaskPeople;
