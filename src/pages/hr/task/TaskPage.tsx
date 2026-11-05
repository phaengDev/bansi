import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Loader, Popover, SelectPicker, Whisper } from 'rsuite';
import { postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { SettingToolbar } from '../../account/setting/settingKit';
import { AssigneeStack, DueCell, PAGE_SIZES, PriorityChip, TaskPager, TaskStatusSelect, slicePage } from './TaskBits';
import TaskDetail from './TaskDetail';
import TaskForm from './TaskForm';
import TaskProjects from './TaskProjects';
import { TASK_DOING, TASK_DONE, TASK_PENDING, TASK_STATUSES, assigneeName, idOf, useTaskProjects, useTasks, type Task } from './taskApi';

type SortKey = 'title' | 'detail' | 'project' | 'assignee' | 'due' | 'status';
type Column = 'detail' | 'project' | 'assignees' | 'due';
/** ແຖບກັ່ນ — 0 ທັງໝົດ, overdue ເກີນກຳນົດ, ອື່ນ = ສະຖານະ */
type Tab = 0 | 'overdue' | typeof TASK_PENDING | typeof TASK_DOING | typeof TASK_DONE;

const COLUMNS: Column[] = ['detail', 'project', 'assignees', 'due'];
const COLUMN_LABELS: Record<Column, string> = { detail: 'taskDetail', project: 'taskProject', assignees: 'taskAssignees', due: 'taskDue' };
const COLUMN_ICONS: Record<Column, string> = { detail: 'fa-solid fa-align-left', project: 'fa-regular fa-folder', assignees: 'fa-solid fa-user-group', due: 'fa-regular fa-calendar' };
const COLUMNS_KEY = 'taskColumns';

const readColumns = (): Column[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? 'null');
    return Array.isArray(saved) ? COLUMNS.filter((c) => saved.includes(c)) : COLUMNS;
  } catch {
    return COLUMNS;
  }
};

/** ຂໍ້ຄວາມທີ່ຄົ້ນຫາໄດ້ — ຊື່ວຽກ, ລາຍລະອຽດ, ໂປຣເຈັກ, ລະຫັດ + ຊື່ຜູ້ຮັບຜິດຊອບ */
const searchText = (task: Task) => [
  task.title, task.detail, task.project?.name, ...task.assignees.map((a) => `${a.emp_code} ${assigneeName(a)}`),
].filter(Boolean).join(' ').toLowerCase();

const sortValue = (task: Task, key: SortKey): string | number => {
  if (key === 'status') return task.status;
  if (key === 'title') return task.title;
  if (key === 'detail') return task.detail ?? '';
  if (key === 'project') return task.project?.name ?? '';
  if (key === 'assignee') return task.assignees[0] ? assigneeName(task.assignees[0]) : '';
  return task.due_date ?? '9999-12-31';
};

/**
 * ມອບໝາຍວຽກ — ແຖບສະຖານະ, ກັ່ນຕາມໂປຣເຈັກ / ຕິດດາວ, ຄົ້ນຫາ, ຕາຕະລາງ (ເລືອກຫຼາຍ, ປ່ຽນສະຖານະໃນແຖວ, ຈັດລຽງ, ແບ່ງໜ້າ),
 * ຄັງເກັບ, ຕັ້ງຄ່າໂປຣເຈັກ ແລະ ເລືອກຖັນທີ່ສະແດງ. ກົດແຖວ = ລາຍລະອຽດ + ຄອມເມັນ, ປຸ່ມດິນສໍ = ແກ້ໄຂ
 */
const TaskPage = () => {
  const t = useT();
  const [archived, setArchived] = useState(false);
  const { rows, setRows, summary, loading, reload } = useTasks(archived);
  const { projects, reload: reloadProjects } = useTaskProjects();
  const [tab, setTab] = useState<Tab>(0);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [columns, setColumns] = useState<Column[]>(readColumns);
  const [editing, setEditing] = useState<Task | null | 'new'>(null);
  const [viewing, setViewing] = useState<Task | null>(null);
  const [copying, setCopying] = useState<Task | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
    } catch {
      // storage ປິດ — ຈື່ສະເພາະໜ້ານີ້
    }
  }, [columns]);

  const switchArchive = () => {
    setArchived((v) => !v);
    setSelected(new Set());
    setTab(0);
    setPage(1);
  };

  /** ກັ່ນທຸກຢ່າງ ຍົກເວັ້ນແຖບ — ໃຊ້ນັບຕົວເລກໃນແຖບ */
  const base = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (rows ?? []).filter((task) => (!starredOnly || task.starred)
      && (!projectId || task.project_id === projectId)
      && (!q || searchText(task).includes(q)));
  }, [rows, keyword, starredOnly, projectId]);

  const shown = useMemo(() => {
    const list = base.filter((task) => (tab === 'overdue' ? task.overdue : !tab || task.status === tab));
    if (!sort) return list;
    return [...list].sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [base, tab, sort]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 0, label: 'taskAll', count: base.length },
    { key: TASK_PENDING, label: 'taskPending', count: base.filter((r) => r.status === TASK_PENDING).length },
    { key: TASK_DOING, label: 'taskDoing', count: base.filter((r) => r.status === TASK_DOING).length },
    { key: TASK_DONE, label: 'taskDone', count: base.filter((r) => r.status === TASK_DONE).length },
    { key: 'overdue', label: 'taskOverdue', count: base.filter((r) => r.overdue).length },
  ];

  const { rows: pageRows, current } = slicePage(shown, page, pageSize);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r._uuid));

  const filterBy = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const toggleSort = (key: SortKey) => setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));
  const toggleSelect = (id: number) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const togglePage = () => setSelected((s) => {
    const next = new Set(s);
    pageRows.forEach((r) => (allOnPage ? next.delete(r._uuid) : next.add(r._uuid)));
    return next;
  });

  /** ແກ້ແຖວໃນລາຍການທັນທີ (ບໍ່ຕ້ອງໂຫຼດໃໝ່ທັງໝົດ) */
  const patchRow = (task: Task) => setRows((list) => list?.map((r) => (r._uuid === task._uuid ? { ...r, ...task } : r)) ?? list);

  const changeStatus = async (task: Task, status: number) => {
    try {
      const res = await putApi(`/task/status/${idOf(task)}`, { status });
      patchRow(res.data.data);
      reload();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  };

  const toggleStar = async (task: Task) => {
    patchRow({ ...task, starred: !task.starred });
    try {
      const res = await putApi(`/task/star/${idOf(task)}`);
      patchRow({ ...task, starred: !!res.data?.starred });
    } catch (error) {
      patchRow(task);
      Notific.error(getErrorMessage(error));
    }
  };

  const bulk = async (action: 'status' | 'archive' | 'unarchive' | 'delete', status?: number, ids = [...selected]) => {
    try {
      setBusy(true);
      await postApi('/task/bulk', { ids, action, status });
      Notific.success('saveSuccessDone');
      setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
      reload();
      return true;
    } catch (error) {
      Notific.error(getErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const bulkDelete = () => Notific.confirm(`${t('taskDeleteConfirm')} ${selected.size} ${t('taskItems')}`, () => {
    bulk('delete');
  });
  const removeOne = (task: Task) => Notific.confirm(`${t('taskDeleteOne')} ${task.title}`, async () => {
    if (await bulk('delete', undefined, [task._uuid])) setViewing(null);
  });

  const sortHead = (key: SortKey, label: string, className = '') => (
    <th className={className}>
      <button type="button" className={`task-sort${sort?.key === key ? ' is-active' : ''}`} onClick={() => toggleSort(key)}>
        {t(label)} <i className={`fa-solid ${sort?.key === key ? (sort.dir === 1 ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort'}`} />
      </button>
    </th>
  );
  const has = (column: Column) => columns.includes(column);

  const toggleColumn = (c: Column) => setColumns((list) => (list.includes(c) ? list.filter((x) => x !== c) : COLUMNS.filter((x) => x === c || list.includes(x))));
  const columnPicker = (
    <Popover className="task-columns-pop" arrow={false}>
      <div className="task-pop-head">
        <b>{t('taskColumns')}</b>
        <small>{columns.length + 2}/{COLUMNS.length + 2}</small>
      </div>
      {/* ຊື່ວຽກ + ສະຖານະ ສະແດງສະເໝີ */}
      {[['fa-solid fa-heading', 'taskName'], ['fa-solid fa-circle-half-stroke', 'status']].map(([icon, label]) => (
        <div key={label} className="task-col-opt is-locked" title={t('taskColumnLocked')}>
          <i className={icon} />
          <span>{t(label)}</span>
          <i className="fa-solid fa-lock" />
        </div>
      ))}
      {COLUMNS.map((c) => (
        <button key={c} type="button" role="menuitemcheckbox" aria-checked={has(c)} className={`task-col-opt${has(c) ? ' is-on' : ''}`} onClick={() => toggleColumn(c)}>
          <i className={COLUMN_ICONS[c]} />
          <span>{t(COLUMN_LABELS[c])}</span>
          <i className="task-col-switch" />
        </button>
      ))}
      <button type="button" className="task-pop-foot" disabled={columns.length === COLUMNS.length} onClick={() => setColumns(COLUMNS)}>
        <i className="fa-solid fa-rotate-left" /> {t('taskColumnsShowAll')}
      </button>
    </Popover>
  );

  const statusMenu = (
    <Popover className="task-columns-pop" arrow={false}>
      {[TASK_PENDING, TASK_DOING, TASK_DONE].map((s) => (
        <button key={s} type="button" className="task-col-opt" onClick={() => bulk('status', s)}>
          <i className={`${TASK_STATUSES[s].icon} task-tone ${TASK_STATUSES[s].tone}`} /> <span>{t(TASK_STATUSES[s].label)}</span>
        </button>
      ))}
    </Popover>
  );

  const projectOptions = projects
    .filter((p) => Number(p.status) === 1 || p._uuid === projectId)
    .map((p) => ({ value: p._uuid, label: p.name, color: p.color }));

  return (
    <div className="acs-page task-page">
      <SettingToolbar
        stats={archived
          ? [{ label: t('taskArchiveView'), value: rows?.length ?? 0 }]
          : [
            { label: t('taskTasks'), value: summary?.total ?? 0 },
            { label: t('taskOverdue'), value: summary?.overdue ?? 0, tone: 'red' },
          ]}
        keyword={keyword}
        onKeyword={(v) => filterBy(() => setKeyword(v))}
        placeholder={t('taskSearch')}
        addLabel={t('taskNew')}
        onAdd={archived ? undefined : () => setEditing('new')}
        canAdd={canCreate}
      >
        <div className="acc-type-segment" role="tablist">
          {tabs.map((s) => (
            <button key={String(s.key)} type="button" role="tab" aria-selected={tab === s.key} className={`${tab === s.key ? 'is-active' : ''}${s.key === 'overdue' && s.count ? ' is-late' : ''}`}
              onClick={() => filterBy(() => setTab(s.key))}
            >
              {t(s.label)} <em>{s.count}</em>
            </button>
          ))}
        </div>
        <SelectPicker size="sm" className="hr-filter" data={projectOptions} value={projectId} onChange={(v) => filterBy(() => setProjectId(v))}
          placeholder={t('taskAllProjects')} searchable={projectOptions.length > 8} popupClassName="acc-book-menu"
          renderOption={(label, item) => <span className="task-project-opt"><i style={{ background: String(item.color) }} />{label}</span>}
        />
        <span className="task-tools">
          <button type="button" className={`acc-rp-btn${starredOnly ? ' is-on' : ''}`} onClick={() => filterBy(() => setStarredOnly((v) => !v))}
            title={t('taskStarredOnly')} aria-label={t('taskStarredOnly')} aria-pressed={starredOnly}
          >
            <i className={`fa-${starredOnly ? 'solid' : 'regular'} fa-star`} />
          </button>
          <button type="button" className={`acc-rp-btn${archived ? ' is-on' : ''}`} onClick={switchArchive} aria-pressed={archived}
            title={t(archived ? 'taskBackToList' : 'taskArchiveView')} aria-label={t(archived ? 'taskBackToList' : 'taskArchiveView')}
          >
            <i className="fa-solid fa-box-archive" />
            {!archived && !!summary?.archived && <em>{summary.archived}</em>}
          </button>
          <button type="button" className="acc-rp-btn" onClick={() => setSettingsOpen(true)} title={t('taskProjects')} aria-label={t('taskProjects')}>
            <i className="fa-regular fa-folder-open" />
          </button>
          <Whisper trigger="click" placement="bottomEnd" speaker={columnPicker}>
            <button type="button" className="acc-rp-btn" title={t('taskColumns')} aria-label={t('taskColumns')}><i className="fa-solid fa-table-columns" /></button>
          </Whisper>
        </span>
      </SettingToolbar>

      {archived && (
        <p className="acc-bg-note task-archive-note">
          <i className="fa-solid fa-box-archive" /> {t('taskArchiveView')}
          <button type="button" className="acc-rp-btn" onClick={switchArchive}><i className="fa-solid fa-arrow-left" /> {t('taskBackToList')}</button>
        </p>
      )}

      {!!selected.size && (
        <div className="task-bulk">
          <b><i className="fa-solid fa-square-check" /> {t('taskSelected')} {selected.size} {t('taskItems')}</b>
          {canEdit && !archived && (
            <Whisper trigger="click" placement="bottomStart" speaker={statusMenu}>
              <button type="button" className="acc-rp-btn" disabled={busy}><i className="fa-solid fa-circle-half-stroke" /> {t('taskChangeStatus')}</button>
            </Whisper>
          )}
          {canEdit && (
            <button type="button" className="acc-rp-btn" disabled={busy} onClick={() => bulk(archived ? 'unarchive' : 'archive')}>
              <i className={`fa-solid ${archived ? 'fa-box-open' : 'fa-box-archive'}`} /> {t(archived ? 'taskUnarchive' : 'taskArchive')}
            </button>
          )}
          {canDelete && (
            <button type="button" className="acc-rp-btn is-danger" disabled={busy} onClick={bulkDelete}><i className="fa-solid fa-trash" /> {t('delete')}</button>
          )}
          <button type="button" className="acc-rp-btn task-bulk-clear" onClick={() => setSelected(new Set())}><i className="fa-solid fa-xmark" /> {t('cancel')}</button>
        </div>
      )}

      {!rows ? (
        <div className="text-center py-5">{loading ? <Loader size="md" content={t('loadingDots')} vertical /> : <p className="acc-gl-ref">{t('noData')}</p>}</div>
      ) : !shown.length ? (
        <div className="acc-class-empty">
          <i className={`fa-solid ${archived ? 'fa-box-archive' : 'fa-list-check'}`} />
          <p>{t(rows.length ? 'taskNoMatch' : archived ? 'noData' : 'taskEmpty')}</p>
        </div>
      ) : (
        <div className={`acc-gl-group${loading ? ' is-refreshing' : ''}`}>
          <div className="acc-rp-scroll">
            <table className="acc-gl-table hr-table task-table">
              <thead>
                <tr>
                  <th className="task-col-check"><Checkbox checked={allOnPage} indeterminate={!allOnPage && pageRows.some((r) => selected.has(r._uuid))} onChange={togglePage} /></th>
                  {sortHead('title', 'taskName')}
                  {has('detail') && sortHead('detail', 'taskDetail')}
                  {has('project') && sortHead('project', 'taskProject')}
                  {has('assignees') && sortHead('assignee', 'taskAssignees')}
                  {has('due') && sortHead('due', 'taskDue')}
                  {sortHead('status', 'status')}
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((task) => (
                  <tr key={task._uuid} className={`is-click${selected.has(task._uuid) ? ' is-selected' : ''}${task.status === TASK_DONE ? ' is-done' : ''}`} onClick={() => setViewing(task)}>
                    <td className="task-col-check" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(task._uuid)} onChange={() => toggleSelect(task._uuid)} />
                    </td>
                    <td className="task-title">
                      <span className="task-title-row">
                        <button type="button" className={`task-star${task.starred ? ' is-on' : ''}`} onClick={(e) => { e.stopPropagation(); toggleStar(task); }}
                          title={t('taskStar')} aria-label={t('taskStar')} aria-pressed={task.starred}
                        >
                          <i className={`fa-${task.starred ? 'solid' : 'regular'} fa-star`} />
                        </button>
                        <span>
                          <b>{task.title}</b>
                          {(task.priority > 1 || !!task.items_total || !!task.files_total || !!task.comments_total) && (
                            <span className="task-meta-row">
                              <PriorityChip priority={task.priority} />
                              {!!task.items_total && (
                                <span className={`acs-chip${task.items_done === task.items_total ? ' is-green' : ''}`}>
                                  <i className="fa-solid fa-list-check" /> {task.items_done}/{task.items_total}
                                </span>
                              )}
                              {!!task.files_total && <span className="acs-chip" title={t('hrDocuments')}><i className="fa-solid fa-paperclip" /> {task.files_total}</span>}
                              {!!task.comments_total && <span className="acs-chip" title={t('taskComments')}><i className="fa-regular fa-comment" /> {task.comments_total}</span>}
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    {has('detail') && <td className="task-detail">{task.detail || <span className="acc-gl-ref">—</span>}</td>}
                    {has('project') && (
                      <td>{task.project ? <span className="task-project"><i style={{ background: task.project.color }} />{task.project.name}</span> : <span className="acc-gl-ref">—</span>}</td>
                    )}
                    {has('assignees') && <td><AssigneeStack assignees={task.assignees} /></td>}
                    {has('due') && <td><DueCell task={task} /></td>}
                    <td onClick={(e) => e.stopPropagation()}>
                      <TaskStatusSelect status={task.status} onChange={(s) => changeStatus(task, s)} disabled={!canEdit || archived} />
                    </td>
                    <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="acc-gl-act" disabled={!canEdit} title={t('edit')} aria-label={t('edit')} onClick={() => setEditing(task)}>
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button type="button" className="acc-gl-act is-danger" disabled={!canDelete || busy} title={t('delete')} aria-label={t('delete')} onClick={() => removeOne(task)}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length > PAGE_SIZES[0] && <TaskPager total={shown.length} page={current} pageSize={pageSize} onPage={setPage} onPageSize={(n) => filterBy(() => setPageSize(n))} />}
        </div>
      )}

      {viewing && (
        <TaskDetail task={viewing} onClose={() => setViewing(null)} onChanged={reload} onDelete={removeOne}
          onEdit={(task) => {
            setEditing(task);
            setViewing(null);
          }}
          onCopy={(task) => {
            setCopying(task);
            setViewing(null);
          }}
        />
      )}
      {copying && <TaskForm task={null} template={copying} projects={projects} onClose={() => setCopying(null)} onSaved={() => reload()} />}
      {editing && (
        <TaskForm task={editing === 'new' ? null : editing} projects={projects} onClose={() => setEditing(null)}
          onSaved={() => reload()}
        />
      )}
      {settingsOpen && <TaskProjects projects={projects} onClose={() => { setSettingsOpen(false); reload(); }} onChanged={reloadProjects} />}
    </div>
  );
};

export default TaskPage;
