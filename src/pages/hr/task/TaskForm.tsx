import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { DatePicker, Form, Input, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi, getApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useEmployees } from '../../../utils/selectOption';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { FormSection, SettingModal } from '../../account/setting/settingKit';
import { HrAvatar } from '../hrKit';
import { MAX_FILE, docIcon, downloadWithAuth, fileSizeText } from '../hrApi';
import {
  MAX_TASK_FILES, TASK_FILE_ACCEPT, TASK_FILE_TYPES, TASK_STATUSES, assigneeName, idOf, type Task, type TaskFile, type TaskPerson, type TaskProject,
} from './taskApi';
import TaskAssigneePicker from './TaskAssigneePicker';
import { QuadrantPicker, TaskChecklistEditor, TaskChoice, newChecklistRow, type ChecklistRow } from './TaskBits';
import TaskProjectField from './TaskProjectField';

type Row = ChecklistRow;
const toDate = (value: string | null) => (value ? moment(value, 'YYYY-MM-DD').toDate() : null);
const toDay = (value: Date | null) => (value ? moment(value).format('YYYY-MM-DD') : null);

/**
 * ສ້າງ / ແກ້ວຽກ — ຂໍ້ມູນວຽກ, ຜູ້ຮັບຜິດຊອບ (ກົດມົງກຸດ = ຫົວໜ້າວຽກ), ລາຍການຍ່ອຍ, ເອກະສານຄັດຕິດ. ບັນທຶກແລ້ວ ຄົນທີ່ຫາກໍ່ໄດ້ຮັບມອບໝາຍ
 * ໄດ້ຮັບແຈ້ງເຕືອນເດັ້ງຂຶ້ນຈໍມືຖື (backend ສົ່ງ). ໄຟລ໌ໃໝ່ອັບໂຫຼດຕອນບັນທຶກ ເທື່ອລະໄຟລ໌ (ບໍ່ໃຫ້ຄຳຂໍໃຫຍ່ເກີນຂີດຈຳກັດຂອງ nginx).
 * template = ສຳເນົາ: ຕື່ມຂໍ້ມູນຈາກວຽກເດີມໃຫ້ແກ້ກ່ອນ ຍັງບໍ່ສ້າງ / ບໍ່ແຈ້ງເຕືອນຈົນກວ່າຈະກົດມອບໝາຍ (ບໍ່ເອົາເອກະສານ, ຄອມເມັນ ແລະ ຄົນທີ່ລາອອກແລ້ວ)
 */
const TaskForm = ({ task, template, projects, onProjectsChanged, onClose, onSaved }: {
  /** null = ສ້າງໃໝ່ */
  task: Task | null;
  template?: Task | null;
  projects: TaskProject[];
  /** ເພີ່ມໂປຣເຈັກໃໝ່ຈາກຊ່ອງເລືອກໂປຣເຈັກ → ໃຫ້ໜ້າຫຼັກໂຫຼດລາຍຊື່ຄືນ */
  onProjectsChanged?: () => void;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) => {
  const t = useT();
  const employees = useEmployees();
  const source = task ?? template ?? null;
  // ສຳເນົາ: ຕັດຄົນທີ່ລາອອກແລ້ວ — backend ບໍ່ຮັບການມອບໝາຍວຽກໃໝ່ໃຫ້ເຂົາເຈົ້າ
  const sourcePeople = template && !task ? template.assignees.filter((a) => Number(a.work_status) !== 2) : task?.assignees ?? [];
  const [loaded, setLoaded] = useState<Task | null>(source ? null : ({} as Task));
  const [title, setTitle] = useState(source ? (task ? source.title : `${source.title} (${t('taskCopy')})`) : '');
  const [detail, setDetail] = useState(source?.detail ?? '');
  const [projectId, setProjectId] = useState<number | null>(source?.project_id ?? null);
  // ວຽກໃໝ່ເລີ່ມ "ສຳຄັນ · ບໍ່ເລັ່ງດ່ວນ" ຄືກັບ app (ວຽກທີ່ມອບໝາຍສ່ວນຫຼາຍ)
  const [important, setImportant] = useState<boolean | null>(source ? source.important ?? null : true);
  const [urgent, setUrgent] = useState<boolean | null>(source ? source.urgent ?? null : false);
  const [status, setStatus] = useState(task?.status ?? 1);
  const [startDate, setStartDate] = useState<Date | null>(toDate(source?.start_date ?? null));
  const [dueDate, setDueDate] = useState<Date | null>(toDate(source?.due_date ?? null));
  const [assigneeIds, setAssigneeIds] = useState<number[]>(sourcePeople.map((a) => a.employee_id));
  const [leadId, setLeadId] = useState<number | null>(sourcePeople.find((a) => a.is_lead)?.employee_id ?? null);
  const [items, setItems] = useState<Row[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // ແກ້ໄຂ / ສຳເນົາ: ໂຫຼດລາຍການຍ່ອຍ + ຜູ້ສ້າງ (ໂຫຼດບໍ່ໄດ້ = ປິດຟອມ); ສຳເນົາ = ລາຍການຍ່ອຍເລີ່ມໃໝ່ທັງໝົດ
  const sourceId = source ? idOf(source) : null;
  const isCopy = !task;
  useEffect(() => {
    if (!sourceId) return;
    let alive = true;
    getApi(`/task/${sourceId}`)
      .then((res) => {
        if (!alive) return;
        const full: Task = res.data?.data;
        setLoaded(full);
        setItems((full.items ?? []).map((i) => (isCopy ? newChecklistRow(i.title) : { ...newChecklistRow(i.title), _uuid: i._uuid, done: i.done })));
        if (!isCopy) setFiles(full.files ?? []);
      })
      .catch((error) => {
        Notific.error(getErrorMessage(error));
        closeRef.current();
      });
    return () => {
      alive = false;
    };
  }, [sourceId, isCopy]);

  // ພະນັກງານທີ່ເຮັດວຽກຢູ່ + ຜູ້ຮັບຜິດຊອບເດີມທີ່ລາອອກແລ້ວ (ຍັງຢູ່ໃນວຽກເກົ່າໄດ້)
  const people = useMemo(() => {
    const list: TaskPerson[] = employees.map((e) => ({ employee_id: e._uuid, emp_code: e.emp_code, first_name: e.first_name, last_name: e.last_name, profile_url: e.profile_url ?? null, department: e.department }));
    for (const a of task?.assignees ?? []) if (!list.some((p) => p.employee_id === a.employee_id)) list.push(a);
    return list;
  }, [employees, task]);
  const personOf = (id: number) => people.find((p) => p.employee_id === id);
  const lead = leadId && assigneeIds.includes(leadId) ? leadId : assigneeIds[0] ?? null;

  const canAttach = task ? canEdit : canCreate;
  const addFiles = (picked: File[]) => {
    if (!canAttach || !picked.length) return;
    if (picked.some((f) => !TASK_FILE_TYPES.test(f.name))) return Notific.warning('taskFileType');
    if (picked.some((f) => f.size > MAX_FILE)) return Notific.warning('incomeFileSize');
    const added = picked.filter((f) => !pending.some((p) => p.name === f.name && p.size === f.size));
    if (files.length + pending.length + added.length > MAX_TASK_FILES) return Notific.warning('taskFileMax');
    setPending([...pending, ...added]);
  };
  const pickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };
  // ວາງໄຟລ໌ບ່ອນໃດກໍ່ໄດ້ໃນຟອມ — ວາງພາດນອກກ່ອງ browser ຈະເປີດໄຟລ໌ນັ້ນແທນໜ້ານີ້ ແລ້ວຂໍ້ມູນທີ່ປ້ອນຫາຍ
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };
  const removeFile = (file: TaskFile) => Notific.confirm(`${t('hrDocumentDeleteConfirm')} ${file.original_name}`, async () => {
    try {
      const res = await deleteApi(`/task/file/${idOf(file)}`);
      setFiles((list) => list.filter((f) => f._uuid !== file._uuid));
      Notific.success('acsDeleted');
      onSaved(res.data.data);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });
  /** ອັບໂຫຼດໄຟລ໌ໃໝ່ຂອງວຽກທີ່ບັນທຶກແລ້ວ — ຄືນຊື່ໄຟລ໌ທີ່ບໍ່ສຳເລັດ */
  const uploadPending = async (saved: Task) => {
    const failed: string[] = [];
    for (const file of pending) {
      const body = new FormData();
      body.append('files', file);
      try {
        await postApi(`/task/file/${idOf(saved)}`, body);
      } catch {
        failed.push(file.name);
      }
    }
    return failed;
  };

  const submit = async () => {
    if (!title.trim()) return Notific.warning('taskTitleRequired');
    if (!assigneeIds.length) return Notific.warning('taskAssigneeRequired');
    if (startDate && dueDate && moment(dueDate).isBefore(startDate, 'day')) return Notific.warning('taskDueOrder');
    const body = {
      title: title.trim(),
      detail: detail.trim(),
      project_id: projectId,
      important,
      urgent,
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
      const failed = await uploadPending(res.data.data);
      if (failed.length) Notific.error(`${t('taskFilesFailed')} ${failed.join(', ')}`);
      else Notific.success(res.data?.message ?? 'saveSuccessDone');
      onSaved(res.data.data);
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <SettingModal title={t(task ? 'taskEdit' : 'taskNew')} hint={t('taskFormHint')} icon="fa-list-check" saving={saving}
      onClose={onClose} onSubmit={submit} wide className="task-modal" keyboard={false}
      submit={task ? undefined : { label: t('taskAssign'), icon: 'fa-paper-plane' }}
    >
      {!loaded ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
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
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('taskProject')}</label>
              <TaskProjectField value={projectId} onChange={setProjectId} projects={projects} keepId={source?.project_id} onCreated={onProjectsChanged} />
            </div>
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('taskPriority')}</label>
              <QuadrantPicker important={important} urgent={urgent} onChange={(i, u) => {
                setImportant(i);
                setUrgent(u);
              }} />
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
                <TaskChoice value={status} onChange={setStatus} options={[1, 2, 3].map((s) => ({
                  value: s, label: t(TASK_STATUSES[s].label), tone: TASK_STATUSES[s].tone, icon: TASK_STATUSES[s].icon,
                }))} />
              </div>
            )}
          </FormSection>

          <FormSection title={t('taskAssignees')}>
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
              <button type="button" className={`task-people-add${assigneeIds.length ? '' : ' is-empty'}`} title={t('taskPickAssignees')} aria-label={t('taskPickAssignees')} onClick={() => setPicking(true)}>
                <i className="fa-solid fa-plus" />{!assigneeIds.length && <span>{t('taskPickAssignees')}</span>}
              </button>
            </div>
            <small className="is-wide pay-field-hint">{t('taskAssigneeHint')}</small>
          </FormSection>

          <FormSection title={`${t('taskChecklist')}${items.length ? ` ${items.filter((i) => i.done).length}/${items.length}` : ''}`}>
            <TaskChecklistEditor items={items} onChange={setItems} />
          </FormSection>

          <FormSection title={`${t('hrDocuments')}${files.length + pending.length ? ` ${files.length + pending.length}` : ''}`}>
            <div className="is-wide task-files">
              {!!(files.length || pending.length) && (
                <ul className="hr-docs">
                  {files.map((file) => (
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
                      <button type="button" className="acc-gl-act is-danger" title={t('delete')} aria-label={t('delete')} disabled={!canEdit} onClick={() => removeFile(file)}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </li>
                  ))}
                  {pending.map((file) => (
                    <li key={`${file.name}-${file.size}`}>
                      <i className={`fa-solid ${docIcon({ mime_type: file.type, original_name: file.name })}`} />
                      <span>
                        <b>{file.name}</b>
                        <small>{fileSizeText(file.size)} · <span className="task-file-new">{t('taskFileNew')}</span></small>
                      </span>
                      <button type="button" className="acc-gl-act is-danger" title={t('delete')} aria-label={t('delete')} onClick={() => setPending((list) => list.filter((f) => f !== file))}>
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className={`task-drop${dragging ? ' is-over' : ''}${canAttach ? '' : ' is-disabled'}`}>
                <i className="fa-solid fa-cloud-arrow-up" />
                <span>{t('taskFileDrop')} <b>{t('taskFilePick')}</b></span>
                <input type="file" multiple hidden disabled={!canAttach} accept={TASK_FILE_ACCEPT} onChange={pickFiles} />
              </label>
              <small className="hr-docs-note">{t('taskFileNote')}</small>
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
        </div>
      )}
    </SettingModal>
    {picking && (
      <TaskAssigneePicker people={people} value={assigneeIds} lead={lead} onChange={setAssigneeIds} onLead={setLeadId} onClose={() => setPicking(false)} />
    )}
    </>
  );
};

export default TaskForm;
