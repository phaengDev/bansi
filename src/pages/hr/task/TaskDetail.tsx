import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Button, Input, Loader, Modal } from 'rsuite';
import moment from 'moment';
import { deleteApi, getApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { HrAvatar } from '../hrKit';
import { docIcon, downloadWithAuth, fileSizeText } from '../hrApi';
import { DueCell, PriorityChip, TaskStatusPill, TaskStatusSelect } from './TaskBits';
import { TASK_STATUSES, assigneeName, idOf, type Task, type TaskComment, type TaskLog } from './taskApi';

const stamp = (value: string) => moment(value).format('DD/MM/YYYY HH:mm');

/** ຫົວຂໍ້ຂອງແຕ່ລະ action ໃນໄທມ໌ໄລນ໌ */
const LOG_LABELS: Record<string, string> = {
  create: 'taskLogCreate',
  update: 'taskLogUpdate',
  item_done: 'taskLogItemDone',
  item_undone: 'taskLogItemUndone',
  file_add: 'taskLogFileAdd',
  file_del: 'taskLogFileDel',
  archive: 'taskArchive',
  unarchive: 'taskUnarchive',
};

/** ຊື່ຊ່ອງທີ່ແກ້ (action update) */
const FIELD_LABELS: Record<string, string> = {
  title: 'taskName',
  detail: 'taskDetail',
  project: 'taskProject',
  priority: 'taskPriority',
  start_date: 'taskStart',
  due_date: 'taskDue',
  status: 'status',
  assignees: 'taskAssignees',
  items: 'taskChecklist',
};

/** ໄທມ໌ໄລນ໌ ໃໝ່ → ເກົ່າ; ຜູ້ເຮັດທີ່ເປັນຫົວໜ້າວຽກ ມີມົງກຸດ */
const TaskTimeline = ({ logs, leadId }: { logs: TaskLog[]; leadId?: number }) => {
  const t = useT();
  const [open, setOpen] = useState(true);
  const detailOf = (log: TaskLog) => {
    if (log.action !== 'update') return log.note;
    const fields = log.fields.map((field) => (field === 'status' && log.status && TASK_STATUSES[log.status]
      ? `${t('status')} (${t(TASK_STATUSES[log.status].label)})`
      : t(FIELD_LABELS[field] ?? field)));
    return `${t('taskLogEdited')} ${fields.join(', ')}`;
  };
  return (
    <>
      <div className="task-timeline-head">
        <h6 className="task-detail-head"><i className="fa-solid fa-clock-rotate-left" /> {t('taskTimeline')} <em>{logs.length}</em></h6>
        <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{t(open ? 'taskTimelineHide' : 'taskTimelineShow')}</button>
      </div>
      {open && (
        <ol className="task-timeline">
          {logs.map((log, index) => {
            const detail = detailOf(log);
            return (
              <li key={`${log._uuid}-${log.createdAt}`} className={index === 0 ? 'is-latest' : ''}>
                <div className="task-timeline-card">
                  <span className="task-avatar">
                    {log.author_employee_id !== null && log.author_employee_id === leadId && <i className="fa-solid fa-crown" />}
                    <HrAvatar url={log.author_photo} name={log.author_name} />
                  </span>
                  <span className="task-timeline-body">
                    <em>{t(LOG_LABELS[log.action] ?? log.action)}</em>
                    <b>{log.author_name}</b>
                    {detail && <small>{detail}</small>}
                  </span>
                  <time>{stamp(log.createdAt)}</time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
};

/**
 * ລາຍລະອຽດວຽກ (ກົດແຖວໃນລາຍການ) — ຂໍ້ມູນ, ຜູ້ຮັບຜິດຊອບ, ລາຍການຍ່ອຍ, ເອກະສານ, ໄທມ໌ໄລນ໌ ແລະ ຄອມເມັນ; ລຶບ / ສຳເນົາ / ແກ້ໄຂ ຢູ່ທ້າຍກ່ອງ.
 * ຄອມເມັນໃໝ່ແຈ້ງເຕືອນຜູ້ຮັບຜິດຊອບ (backend ສົ່ງ); ກຳລັງພິມຄອມເມັນຢູ່ = ກົດນອກກ່ອງ / Esc ບໍ່ປິດ ຂໍ້ຄວາມຈະບໍ່ຫາຍ
 */
const TaskDetail = ({ task: initial, onClose, onEdit, onCopy, onDelete, onChanged }: {
  task: Task;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onCopy: (task: Task) => void;
  onDelete: (task: Task) => void;
  /** ສະຖານະ / ລາຍການຍ່ອຍ / ຄອມເມັນປ່ຽນ — ໃຫ້ລາຍການໂຫຼດຄືນ */
  onChanged: () => void;
}) => {
  const t = useT();
  const [task, setTask] = useState(initial);
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const archived = Number(task.archived) === 1;
  const editable = canEdit && !archived;

  useEffect(() => {
    let alive = true;
    getApi(`/task/${idOf(initial)}`)
      .then((res) => {
        if (!alive) return;
        const full: Task = res.data?.data;
        setTask(full);
        setComments(full.comments ?? []);
      })
      .catch((error) => {
        Notific.error(getErrorMessage(error));
        closeRef.current();
      });
    return () => {
      alive = false;
    };
  }, [initial]);

  // ຄອມເມັນລ່າສຸດຢູ່ລຸ່ມສຸດ
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [comments]);

  /** ອັບເດດສະຖານະ / ລາຍການຍ່ອຍ — backend ຄືນວຽກລ່າສຸດ (ບໍ່ມີຊື່ຜູ້ສ້າງ ຈຶ່ງຮວມກັບຂອງເດີມ) */
  const update = async (path: string, body: object) => {
    try {
      setBusy(true);
      const res = await putApi(path, body);
      setTask((current) => ({ ...current, ...res.data.data }));
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  /** ເອົາອອກຈາກຄັງ — ກ່ອງຄອມເມັນ ແລະ ການແກ້ໄຂກັບມາໃຊ້ໄດ້ທັນທີ */
  const restore = async () => {
    try {
      setBusy(true);
      await postApi('/task/bulk', { ids: [task._uuid], action: 'unarchive' });
      const res = await getApi(`/task/${idOf(task)}`);
      setTask(res.data.data);
      Notific.success('saveSuccessDone');
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    try {
      setSending(true);
      const res = await postApi(`/task/comment/${idOf(task)}`, { body });
      setComments(res.data.data);
      setDraft('');
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };
  const onDraftKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };
  const removeComment = (comment: TaskComment) => Notific.confirm(`${t('taskCommentDelete')} ${comment.body.slice(0, 60)}`, async () => {
    try {
      const res = await deleteApi(`/task/comment/${idOf(comment)}`);
      setComments(res.data.data);
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  const facts: [string, ReactNode][] = [
    [t('taskProject'), task.project ? <span className="task-project"><i style={{ background: task.project.color }} />{task.project.name}</span> : '—'],
    [t('taskStart'), task.start_date ? moment(task.start_date, 'YYYY-MM-DD').format('DD/MM/YYYY') : '—'],
    [t('taskDue'), <DueCell key="due" task={task} />],
    [t('taskCreated'), <>{stamp(task.createdAt)}{task.createdby_name && <small className="acc-gl-ref">{task.createdby_name}</small>}</>],
    ...(task.done_at ? [[t('taskDone'), stamp(task.done_at)] as [string, ReactNode]] : []),
  ];

  return (
    <Modal open onClose={onClose} size="lg" keyboard={!draft.trim()} backdrop={draft.trim() ? 'static' : true} className="acc-gl-ledger-modal task-detail-modal">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <span className="acc-gl-group-icon acc-tone is-blue"><i className="fa-solid fa-list-check" /></span>
          <span>
            <Modal.Title>{task.title}</Modal.Title>
            <small>{archived ? t('taskArchiveView') : t('taskDetailHint')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="task-view">
          <div className="task-view-main">
            <div className="task-detail-status">
              {editable
                ? <TaskStatusSelect status={task.status} disabled={busy} onChange={(status) => update(`/task/status/${idOf(task)}`, { status })} />
                : <TaskStatusPill status={task.status} />}
              <PriorityChip priority={task.priority} />
              {task.overdue && <span className="acs-chip task-prio is-urgent"><i className="fa-solid fa-circle-exclamation" /> {t('taskOverdue')}</span>}
            </div>

            <dl className="task-facts">
              {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>

            <h6 className="task-detail-head"><i className="fa-solid fa-align-left" /> {t('taskDetail')}</h6>
            {task.detail ? <p className="task-detail-text">{task.detail}</p> : <p className="acc-arap-empty">{t('taskNoDetail')}</p>}

            <h6 className="task-detail-head"><i className="fa-solid fa-user-group" /> {t('taskAssignees')} <em>{task.assignees.length}</em></h6>
            <div className="task-people">
              {task.assignees.map((a) => (
                <span key={a.employee_id} className={`task-person is-readonly${a.is_lead ? ' is-lead' : ''}`} title={a.is_lead ? t('taskLead') : undefined}>
                  <HrAvatar url={a.profile_url} name={a.first_name} size="sm" />
                  <b>{assigneeName(a)}</b>
                  {a.is_lead && <i className="fa-solid fa-crown task-person-crown" />}
                </span>
              ))}
            </div>

            {!!task.items?.length && (
              <>
                <h6 className="task-detail-head">
                  <i className="fa-solid fa-list-check" /> {t('taskChecklist')} <em>{task.items.filter((i) => i.done).length}/{task.items.length}</em>
                </h6>
                <ul className="task-detail-checks">
                  {task.items.map((item) => (
                    <li key={item._uuid} className={item.done ? 'is-done' : ''}>
                      <button type="button" className="task-check" disabled={!editable || busy} aria-pressed={item.done} aria-label={item.title}
                        onClick={() => update(`/task/item/${btoa(String(item._uuid))}`, { done: !item.done })}
                      >
                        <i className={`fa-${item.done ? 'solid fa-square-check' : 'regular fa-square'}`} />
                      </button>
                      <span>{item.title}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!!task.files?.length && (
              <>
                <h6 className="task-detail-head"><i className="fa-solid fa-paperclip" /> {t('hrDocuments')} <em>{task.files.length}</em></h6>
                <ul className="hr-docs">
                  {task.files.map((file) => (
                    <li key={file._uuid}>
                      <i className={`fa-solid ${docIcon(file)}`} />
                      <span>
                        <b>{file.original_name}</b>
                        <small>{fileSizeText(file.file_size)} · {moment(file.createdAt).format('DD/MM/YYYY')}</small>
                      </span>
                      <button type="button" className="acc-gl-act" title={t('hrDownload')} aria-label={t('hrDownload')}
                        onClick={() => downloadWithAuth(`/task/file/download/${idOf(file)}`, file.original_name)}
                      >
                        <i className="fa-solid fa-download" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!!task.timeline?.length && <TaskTimeline logs={task.timeline} leadId={task.assignees.find((a) => a.is_lead)?.employee_id} />}
          </div>

          <aside className="task-comments">
            <h6 className="task-detail-head"><i className="fa-regular fa-comments" /> {t('taskComments')} <em>{comments?.length ?? task.comments_total ?? 0}</em></h6>
            <div className="task-comment-list" ref={threadRef}>
              {!comments ? (
                <div className="text-center py-4"><Loader size="sm" /></div>
              ) : !comments.length ? (
                <p className="task-comment-empty"><i className="fa-regular fa-comment-dots" /> {t('taskCommentEmpty')}</p>
              ) : comments.map((c) => (
                <div key={c._uuid} className={`task-comment${c.mine ? ' is-mine' : ''}`}>
                  <HrAvatar url={c.author_photo} name={c.author_name} size="sm" />
                  <div className="task-comment-bubble">
                    <header>
                      <b>{c.author_name}</b>
                      {c.from_app && <span className="task-comment-app"><i className="fa-solid fa-mobile-screen" /> {t('taskCommentFromApp')}</span>}
                      <small>{stamp(c.createdAt)}</small>
                      {(c.mine || canDelete) && (
                        <button type="button" className="task-comment-x" title={t('delete')} aria-label={t('delete')} onClick={() => removeComment(c)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      )}
                    </header>
                    <p>{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {archived ? (
              <div className="task-comment-archived">
                <p className="acc-bg-note"><i className="fa-solid fa-box-archive" /> {t('taskCommentArchived')}</p>
                {canEdit && (
                  <button type="button" className="acc-rp-btn" disabled={busy} onClick={restore}>
                    <i className="fa-solid fa-box-open" /> {t('taskUnarchive')}
                  </button>
                )}
              </div>
            ) : (
              <div className="task-comment-box">
                <Input as="textarea" rows={2} value={draft} onChange={setDraft} onKeyDown={onDraftKey} maxLength={2000} placeholder={t('taskCommentPlaceholder')} aria-label={t('taskComments')} />
                <button type="button" className="task-comment-send" disabled={!draft.trim() || sending} title={t('taskCommentSend')} aria-label={t('taskCommentSend')} onClick={send}>
                  {sending ? <Loader size="xs" /> : <i className="fa-solid fa-paper-plane" />}
                </button>
              </div>
            )}
          </aside>
        </div>
      </Modal.Body>
      <Modal.Footer>
        {canDelete && (
          <button type="button" className="acc-rp-btn is-danger hr-status-btn" onClick={() => onDelete(task)}>
            <i className="fa-solid fa-trash" /> {t('delete')}
          </button>
        )}
        {canCreate && (
          <button type="button" className="acc-rp-btn" onClick={() => onCopy(task)}>
            <i className="fa-regular fa-copy" /> {t('taskCopy')}
          </button>
        )}
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
        {canEdit && <Button appearance="primary" startIcon={<i className="fa-solid fa-pen" />} className="acc-book-btn is-save" onClick={() => onEdit(task)}>{t('edit')}</Button>}
      </Modal.Footer>
    </Modal>
  );
};

export default TaskDetail;
