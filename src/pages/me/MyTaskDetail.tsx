import { useEffect, useRef, useState } from 'react';
import { Button, Input, Loader, Modal, Slider } from 'rsuite';
import moment from 'moment';
import { CONFIG, deleteApi, getApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { HrAvatar } from '../hr/hrKit';
import { fileSizeText } from '../hr/hrApi';
import { ActiveTime, DueCell, PersonStatusPill, ProgressBar, QuadrantChip, TaskChoice, TaskStatusPill, TaskStatusSelect } from '../hr/task/TaskBits';
import { TaskCommentThread } from '../hr/task/TaskComments';
import { PERSON_STATUSES, assigneeName, partOf, type TaskComment } from '../hr/task/taskApi';
import { idOf, type MyTask } from './meApi';

const PART_TODO = 1;
const PART_DOING = 2;
const PART_DONE = 3;

/**
 * ລາຍລະອຽດວຽກໃນພື້ນທີ່ຂອງຂ້ອຍ — ຂໍ້ມູນ, ລາຍການຍ່ອຍ, ເອກະສານ, ຄວາມຄືບໜ້າຂອງທີມ ແລະ ຄອມເມັນ (ຄືໃນ app).
 * ຜູ້ຮັບຜິດຊອບ (received): ອັບເດດສ່ວນຂອງຕົນ (ສະຖານະ + % + ບັນທຶກ) ແລະ ຕິກລາຍການຍ່ອຍ.
 * ຫົວໜ້າທີ່ມອບໝາຍ (assigned): ປ່ຽນສະຖານະວຽກ, ລຶບວຽກ, ແຈ້ງເຖິງບາງຄົນໃນຄອມເມັນ
 */
const MyTaskDetail = ({ task: initial, mode, meId, onClose, onChanged }: {
  task: MyTask;
  mode: 'received' | 'assigned';
  meId: number;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const t = useT();
  const [task, setTask] = useState(initial);
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = task.assignees.find((a) => a.employee_id === meId);
  const myPart = mine ? partOf(task, mine) : null;
  const [partStatus, setPartStatus] = useState(myPart?.status ?? PART_TODO);
  const [progress, setProgress] = useState(myPart?.progress ?? 0);
  const [note, setNote] = useState('');
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    let alive = true;
    getApi(`/task/me/comment/${idOf(initial)}`)
      .then((res) => alive && setComments(res.data?.data ?? []))
      .catch((error) => {
        Notific.error(getErrorMessage(error));
        closeRef.current();
      });
    return () => {
      alive = false;
    };
  }, [initial]);

  /** ຄືນວຽກລ່າສຸດຈາກ backend — ຮວມກັບຂອງເດີມ (ບາງ route ບໍ່ມີຜູ້ມອບໝາຍ) */
  const apply = (data: Partial<MyTask> | null | undefined) => {
    if (data) setTask((current) => ({ ...current, ...data }));
    onChanged();
  };
  const run = async (task: () => Promise<{ data?: { data?: Partial<MyTask> } }>) => {
    try {
      setBusy(true);
      const res = await task();
      apply(res.data?.data);
      return true;
    } catch (error) {
      Notific.error(getErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changePart = (status: number) => {
    setPartStatus(status);
    if (status === PART_TODO) setProgress(0);
    if (status === PART_DONE) setProgress(100);
    if (status === PART_DOING && (progress === 0 || progress === 100)) setProgress(progress === 100 ? 90 : 10);
  };
  const saveProgress = async () => {
    const ok = await run(() => putApi(`/task/me/progress/${idOf(task)}`, { status: partStatus, progress, note: note.trim() || null }));
    if (ok) {
      setNote('');
      Notific.success('saveSuccessDone');
      if (note.trim()) getApi(`/task/me/comment/${idOf(task)}`).then((res) => setComments(res.data?.data ?? [])).catch(() => undefined);
    }
  };
  const toggleItem = (id: number, done: boolean) => run(() => putApi(`/task/me/item/${idOf({ _uuid: id })}`, { done }));
  const openFile = async (id: number) => {
    const tab = window.open('', '_blank');
    try {
      const res = await getApi(`/task/me/file/${idOf({ _uuid: id })}`);
      if (tab) tab.location.href = `${CONFIG.URLAPI}${res.data.url}`;
    } catch (error) {
      tab?.close();
      Notific.error(getErrorMessage(error));
    }
  };
  const changeStatus = (status: number) => run(() => putApi(`/task/me/assigned/${idOf(task)}/status`, { status }));
  const remove = () => Notific.confirm(`${t('myTaskDeleteConfirm')} ${task.title}`, async () => {
    try {
      await deleteApi(`/task/me/assigned/${idOf(task)}`);
      Notific.success('acsDeleted');
      onChanged();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });
  const send = async (body: string, to: number[]) => {
    try {
      const res = await postApi(`/task/me/comment/${idOf(task)}`, { body, to });
      setComments(res.data?.data ?? []);
      onChanged();
      return true;
    } catch (error) {
      Notific.error(getErrorMessage(error));
      return false;
    }
  };
  const removeComment = (comment: TaskComment) => Notific.confirm(`${t('taskCommentDelete')} ${comment.body.slice(0, 60)}`, async () => {
    try {
      const res = await deleteApi(`/task/me/comment/${idOf(comment)}`);
      setComments(res.data?.data ?? []);
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  const items = task.items ?? [];
  const files = task.files ?? [];

  return (
    <Modal open onClose={onClose} size="lg" keyboard={!hasDraft} backdrop={hasDraft ? 'static' : true} className="acc-gl-ledger-modal task-detail-modal my-task-modal">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <span className="acc-gl-group-icon acc-tone is-blue"><i className="fa-solid fa-list-check" /></span>
          <span>
            <Modal.Title>{task.title}</Modal.Title>
            <small>{mode === 'assigned' ? t('myTaskAssignedHint') : task.assigned_by ? `${t('myTaskFrom')} ${task.assigned_by.name}` : t('taskDetailHint')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="task-view">
          <div className="task-view-main">
            <div className="my-task-tags">
              {mode === 'assigned'
                ? <TaskStatusSelect status={task.status} onChange={changeStatus} disabled={busy} />
                : <TaskStatusPill status={task.status} />}
              <QuadrantChip task={task} />
              <DueCell task={task} />
            </div>
            {task.detail && <p className="task-detail-text">{task.detail}</p>}

            {mine && mode === 'received' && (
              <section className="my-task-part">
                <h6 className="task-detail-head"><i className="fa-solid fa-person-running" /> {t('myTaskMyPart')}</h6>
                <TaskChoice value={partStatus} onChange={changePart} options={[PART_TODO, PART_DOING, PART_DONE].map((s) => ({
                  value: s, label: t(PERSON_STATUSES[s].label), tone: PERSON_STATUSES[s].tone, icon: PERSON_STATUSES[s].icon,
                }))} />
                <div className="my-task-slider">
                  <Slider value={progress} min={0} max={100} step={5} progress disabled={partStatus !== PART_DOING}
                    onChange={(v) => setProgress(Math.min(99, Math.max(0, v)))}
                  />
                  <b>{progress}%</b>
                </div>
                <Input as="textarea" rows={2} value={note} onChange={setNote} maxLength={500} placeholder={t('myTaskNotePlaceholder')} />
                <div className="my-task-part-foot">
                  <small className="acc-gl-ref">{t('myTaskPartHint')}</small>
                  <button type="button" className="acc-rp-btn is-primary" disabled={busy} onClick={saveProgress}>
                    {busy ? <Loader size="xs" /> : <i className="fa-solid fa-check" />} {t('myTaskSaveProgress')}
                  </button>
                </div>
              </section>
            )}

            {!!items.length && (
              <>
                <h6 className="task-detail-head"><i className="fa-solid fa-list-check" /> {t('taskChecklist')} <em>{items.filter((i) => i.done).length}/{items.length}</em></h6>
                <div className="task-detail-checks">
                  {items.map((item) => (
                    <button key={item._uuid} type="button" className={`task-check-row${item.done ? ' is-done' : ''}`} disabled={!mine || busy}
                      onClick={() => item._uuid && toggleItem(item._uuid, !item.done)}
                    >
                      <span className="task-check"><i className={`fa-${item.done ? 'solid fa-square-check' : 'regular fa-square'}`} /></span>
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {!!files.length && (
              <>
                <h6 className="task-detail-head"><i className="fa-solid fa-paperclip" /> {t('hrDocuments')} <em>{files.length}</em></h6>
                <ul className="my-task-files">
                  {files.map((file) => (
                    <li key={file._uuid}>
                      <button type="button" onClick={() => openFile(file._uuid)}>
                        <i className={`fa-solid ${/\.pdf$/i.test(file.original_name) ? 'fa-file-pdf' : /\.(jpe?g|png|webp)$/i.test(file.original_name) ? 'fa-file-image' : 'fa-file-lines'}`} />
                        <b>{file.original_name}</b>
                        <small>{fileSizeText(file.file_size)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h6 className="task-detail-head"><i className="fa-solid fa-users" /> {t('taskAssignees')} <em>{task.assignees.length}</em></h6>
            <ul className="task-progress-list">
              {task.assignees.map((a) => {
                const part = partOf(task, a);
                return (
                  <li key={a.employee_id}>
                    <span className="task-progress-who">
                      <span className={`task-avatar${a.is_lead ? ' is-lead' : ''}`}>
                        {a.is_lead && <i className="fa-solid fa-crown" />}
                        <HrAvatar url={a.profile_url} name={a.first_name} size="sm" />
                      </span>
                      <span>
                        <b>{assigneeName(a)}{a.employee_id === meId ? ` (${t('myMe')})` : ''}</b>
                        <small><ActiveTime value={a.active_at} /></small>
                      </span>
                    </span>
                    <PersonStatusPill status={part.status} reported={part.reported} />
                    <ProgressBar value={part.progress} compact />
                  </li>
                );
              })}
            </ul>
            <p className="acc-gl-ref my-task-dates">
              {t('taskStart')} {task.start_date ? moment(task.start_date).format('DD/MM/YYYY') : '—'} · {t('taskCreated')} {moment(task.createdAt).format('DD/MM/YYYY HH:mm')}
            </p>
          </div>

          <TaskCommentThread comments={comments} total={task.comments_total} pickTo={mode === 'assigned' ? task : null}
            onSend={send} onDelete={removeComment} onDraftChange={setHasDraft}
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        {mode === 'assigned' && (
          <button type="button" className="acc-rp-btn is-danger hr-status-btn" disabled={busy} onClick={remove}>
            <i className="fa-solid fa-trash" /> {t('delete')}
          </button>
        )}
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MyTaskDetail;
