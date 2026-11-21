import { useRef, type KeyboardEvent } from 'react';
import moment from 'moment';
import { SelectPicker } from 'rsuite';
import { useT } from '../../../context/LanguageContext';
import { HrAvatar } from '../hrKit';
import { PERSON_STATUSES, QUADRANTS, TASK_DONE, TASK_STATUSES, assigneeName, partOf, quadrantOf, teamOf, useQuadrantLabel, type Task, type TaskAssignee } from './taskApi';

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

/** ປ້າຍຄວາມສຳຄັນ (ຕາຕະລາງບໍລິຫານເວລາ) — ຍັງບໍ່ໄດ້ຈັດ = ບໍ່ສະແດງ; hideDrop = ບໍ່ສະແດງ "ບໍ່ສຳຄັນ · ບໍ່ເລັ່ງດ່ວນ" (ໃນຕາຕະລາງ) */
export const QuadrantChip = ({ task, hideDrop }: { task: Pick<Task, 'important' | 'urgent'>; hideDrop?: boolean }) => {
  const t = useT();
  const label = useQuadrantLabel();
  const q = quadrantOf(task.important, task.urgent);
  if (!q || (hideDrop && q === 'drop')) return null;
  return (
    <span className={`acs-chip task-prio ${QUADRANTS[q].tone}`} title={t(QUADRANTS[q].action)}>
      <i className={QUADRANTS[q].icon} /> {label(task.important, task.urgent)}
    </span>
  );
};

/** ແຖບ % (ສີຂຽວເມື່ອ 100) + ຕົວເລກ */
export const ProgressBar = ({ value, compact }: { value: number; compact?: boolean }) => (
  <span className={`task-bar${value >= 100 ? ' is-full' : ''}${compact ? ' is-compact' : ''}`}>
    <span className="task-bar-track"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
    <b>{value}%</b>
  </span>
);

/** ປ້າຍສະຖານະສ່ວນຂອງຕົນ — ຍັງບໍ່ເຄີຍອັບເດດ = "ຍັງບໍ່ໄດ້ລາຍງານ" */
export const PersonStatusPill = ({ status, reported = true }: { status: number; reported?: boolean }) => {
  const t = useT();
  if (!reported) return <span className="task-status is-silent"><i className="fa-regular fa-clock" /> {t('taskNotReported')}</span>;
  const meta = PERSON_STATUSES[status] ?? PERSON_STATUSES[1];
  return <span className={`task-status ${meta.tone}`}><i className={meta.icon} /> {t(meta.label)}</span>;
};

/** ເວລາອັບເດດລ່າສຸດ: ມື້ນີ້ 14:05 / ມື້ວານ 09:10 / 03/11/2026 09:10 */
export const ActiveTime = ({ value }: { value: string | null }) => {
  const t = useT();
  if (!value) return <span className="acc-gl-ref">—</span>;
  const at = moment(value);
  const day = at.isSame(moment(), 'day') ? t('today') : at.isSame(moment().subtract(1, 'day'), 'day') ? t('yesterday') : null;
  return <span className="task-active" title={at.format('DD/MM/YYYY HH:mm')}>{day ? `${day} ${at.format('HH:mm')}` : at.format('DD/MM/YYYY HH:mm')}</span>;
};

/** ຮູບຜູ້ຮັບຜິດຊອບຊ້ອນກັນ — ຫົວໜ້າວຽກຢູ່ໜ້າສຸດ ມີມົງກຸດ; ເກີນ max = +n; ຊີ້ເບິ່ງ = ລາຍຊື່ + ຄວາມຄືບໜ້າຂອງແຕ່ລະຄົນ */
export const AssigneeStack = ({ assignees, max = 5, task }: { assignees: TaskAssignee[]; max?: number; task?: Pick<Task, 'status'> }) => {
  const t = useT();
  if (!assignees.length) return <span className="acc-gl-ref">—</span>;
  const line = (a: TaskAssignee) => {
    const part = task ? partOf(task, a) : null;
    const state = !part ? '' : !part.reported ? ` — ${t('taskNotReported')}` : ` — ${t(PERSON_STATUSES[part.status].label)} ${part.progress}%`;
    return `${assigneeName(a)}${a.is_lead ? ` (${t('taskLead')})` : ''}${state}`;
  };
  return (
    <span className="task-avatars" title={assignees.map(line).join('\n')}>
      {assignees.slice(0, max).map((a) => (
        <span key={a.employee_id} className={`task-avatar${a.is_lead ? ' is-lead' : ''}${Number(a.work_status) === 2 ? ' is-resigned' : ''}`}>
          {a.is_lead && <i className="fa-solid fa-crown" />}
          <HrAvatar url={a.profile_url} name={a.first_name} size="sm" />
        </span>
      ))}
      {assignees.length > max && <em className="task-avatar-more">+{assignees.length - max}</em>}
    </span>
  );
};

/** ຄວາມຄືບໜ້າຂອງທີມ (ໃນຕາຕະລາງ): ແຖບ % ສະເລ່ຍ + ສຳເລັດກີ່ຄົນ */
export const TeamProgress = ({ task }: { task: Pick<Task, 'status' | 'assignees'> }) => {
  const t = useT();
  const team = teamOf(task);
  if (!team.total) return null;
  return (
    <span className="task-team" title={`${t('taskPersonDone')} ${team.done}/${team.total} ${t('taskPersons')}`}>
      <ProgressBar value={team.progress} compact />
      <em><i className="fa-solid fa-user-check" /> {team.done}/{team.total}</em>
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

export const PAGE_SIZES = [10, 20, 50, 100];

/** ແຖວຂອງໜ້າປັດຈຸບັນ (ໜ້າເກີນ = ໜ້າສຸດທ້າຍ) */
export const slicePage = <T,>(list: T[], page: number, pageSize: number) => {
  const current = Math.min(page, Math.max(1, Math.ceil(list.length / pageSize)));
  const from = (current - 1) * pageSize;
  return { current, from, rows: list.slice(from, from + pageSize) };
};

/** ແບ່ງໜ້າທ້າຍຕາຕະລາງ — ສະແດງ x–y ຈາກ n, ແຖວຕໍ່ໜ້າ, ເລກໜ້າ */
export const TaskPager = ({ total, page, pageSize, onPage, onPageSize }: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) => {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize;
  return (
    <div className="task-foot">
      <span className="acc-gl-ref">{t('taskShowing')} {from + 1}–{Math.min(from + pageSize, total)} {t('taskOf')} {total}</span>
      <SelectPicker data={PAGE_SIZES.map((n) => ({ value: n, label: `${n} ${t('taskPerPage')}` }))} value={pageSize}
        onChange={(v) => { if (v) onPageSize(v); }}
        cleanable={false} searchable={false} size="sm" placement="topEnd" className="task-page-size" popupClassName="acc-book-menu"
      />
      <span className="task-pages">
        <button type="button" className="acc-gl-act" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('previous')}><i className="fa-solid fa-chevron-left" /></button>
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
          .map((n, i, list) => (
            <span key={n}>
              {i > 0 && n - list[i - 1] > 1 && <em>…</em>}
              <button type="button" className={`acc-gl-act${n === page ? ' is-active' : ''}`} onClick={() => onPage(n)}>{n}</button>
            </span>
          ))}
        <button type="button" className="acc-gl-act" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t('next')}><i className="fa-solid fa-chevron-right" /></button>
      </span>
    </div>
  );
};

/** ປຸ່ມເລືອກ 1 ຢ່າງ (ສຳຄັນ / ເລັ່ງດ່ວນ, ສະຖານະ) */
export const TaskChoice = ({ options, value, onChange }: { options: { value: number; label: string; tone: string; icon?: string }[]; value: number; onChange: (v: number) => void }) => (
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
 * ຄວາມສຳຄັນ (ຄືກັບ app): ສຳຄັນ / ບໍ່ສຳຄັນ ແລະ ເລັ່ງດ່ວນ / ບໍ່ເລັ່ງດ່ວນ + ບອກວ່າຢູ່ຊ່ອງໃດ ແລະ ຄວນເຮັດແນວໃດ.
 * ເລືອກຂັ້ນໃດຂັ້ນໜຶ່ງ ອີກຂັ້ນເປັນ "ບໍ່…" ໄວ້ກ່ອນ; ລ້າງ = ຍັງບໍ່ໄດ້ຈັດ (ທັງສອງ null)
 */
export const QuadrantPicker = ({ important, urgent, onChange }: {
  important: boolean | null;
  urgent: boolean | null;
  onChange: (important: boolean | null, urgent: boolean | null) => void;
}) => {
  const t = useT();
  const label = useQuadrantLabel();
  const q = quadrantOf(important, urgent);
  const flagValue = (v: boolean | null) => (v === null ? -1 : Number(v));
  return (
    <div className="task-quadrant-pick">
      <div className="task-quadrant-rows">
        <TaskChoice value={flagValue(important)} onChange={(v) => onChange(v === 1, urgent ?? false)} options={[
          { value: 1, label: t('taskImportant'), tone: 'is-imp', icon: 'fa-solid fa-star' },
          { value: 0, label: t('taskNotImportant'), tone: 'is-off', icon: 'fa-regular fa-star' },
        ]} />
        <TaskChoice value={flagValue(urgent)} onChange={(v) => onChange(important ?? false, v === 1)} options={[
          { value: 1, label: t('taskUrgent'), tone: 'is-urg', icon: 'fa-solid fa-bolt' },
          { value: 0, label: t('taskNotUrgent'), tone: 'is-off', icon: 'fa-regular fa-hourglass' },
        ]} />
      </div>
      <div className={`task-quadrant${q ? ` ${QUADRANTS[q].tone}` : ''}`} aria-live="polite">
        {q ? (
          <>
            <b className="task-quadrant-mark">{QUADRANTS[q].roman}</b>
            <span className="task-quadrant-text">
              <strong>{t(QUADRANTS[q].action)}</strong>
              <small>{label(important, urgent)}</small>
            </span>
            <button type="button" onClick={() => onChange(null, null)}>{t('taskQClear')}</button>
          </>
        ) : <span className="task-quadrant-text"><small>{t('taskQNone')}</small></span>}
      </div>
    </div>
  );
};


/** ແຖວລາຍການຍ່ອຍໃນຟອມ — key = ໄອດີຊົ່ວຄາວຂອງແຖວ (ໃໝ່ຍັງບໍ່ມີ _uuid) */
export type ChecklistRow = { key: number; _uuid?: number; title: string; done: boolean };
let checklistSeq = 0;
export const newChecklistRow = (title = ''): ChecklistRow => ({ key: ++checklistSeq, title, done: false });

/** ແກ້ລາຍການຍ່ອຍ: ຕິກ / ພິມຊື່ / ລຶບ ແລະ ເພີ່ມແຖວ (Enter ໃນແຖວສຸດທ້າຍ = ເພີ່ມແຖວໃໝ່) — ຟອມວຽກຂອງ HR ແລະ ມອບໝາຍວຽກໃນພື້ນທີ່ຂອງຂ້ອຍ */
export const TaskChecklistEditor = ({ items, onChange, checkable = true }: { items: ChecklistRow[]; onChange: (items: ChecklistRow[]) => void; checkable?: boolean }) => {
  const t = useT();
  const lastInput = useRef<HTMLInputElement>(null);
  const addItem = () => {
    onChange([...items, newChecklistRow()]);
    window.setTimeout(() => lastInput.current?.focus(), 0);
  };
  const updateItem = (key: number, patch: Partial<ChecklistRow>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const onItemKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };
  return (
    <div className="is-wide task-checklist">
      {items.map((item, index) => (
        <div key={item.key} className={`task-check-row${item.done ? ' is-done' : ''}`}>
          {checkable ? (
            <button type="button" className="task-check" aria-pressed={item.done} aria-label={t('taskDone')} onClick={() => updateItem(item.key, { done: !item.done })}>
              <i className={`fa-${item.done ? 'solid fa-square-check' : 'regular fa-square'}`} />
            </button>
          ) : <span className="task-check"><i className="fa-regular fa-square" /></span>}
          <input ref={index === items.length - 1 ? lastInput : undefined} value={item.title} maxLength={255}
            placeholder={t('taskItemPlaceholder')} onChange={(e) => updateItem(item.key, { title: e.target.value })} onKeyDown={onItemKey}
          />
          <button type="button" className="acc-gl-act is-danger" aria-label={t('delete')} title={t('delete')} onClick={() => onChange(items.filter((i) => i.key !== item.key))}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      ))}
      <button type="button" className="acc-rp-btn task-check-add" onClick={addItem}><i className="fa-solid fa-plus" /> {t('taskItemAdd')}</button>
    </div>
  );
};
