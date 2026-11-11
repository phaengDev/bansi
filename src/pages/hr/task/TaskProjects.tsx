import { useState } from 'react';
import { Button, Input, Modal, Toggle } from 'rsuite';
import { deleteApi, postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { PROJECT_COLORS as PALETTE, type TaskProject } from './taskApi';

/**
 * ຕັ້ງຄ່າໂປຣເຈັກ / ໝວດວຽກ — ເພີ່ມ, ແກ້ຊື່ / ສີ, ເປີດ-ປິດ, ລຶບ (ມີວຽກໃຊ້ຢູ່ = backend ປິດແທນການລຶບ)
 */
const TaskProjects = ({ projects, onClose, onChanged }: { projects: TaskProject[]; onClose: () => void; onChanged: () => void }) => {
  const t = useT();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [editing, setEditing] = useState<{ id: number; name: string; color: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<{ data?: { message?: string } }>) => {
    try {
      setBusy(true);
      const res = await task();
      Notific.success(res.data?.message ?? 'saveSuccessDone');
      onChanged();
      return true;
    } catch (error) {
      Notific.error(getErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!name.trim()) return Notific.warning('taskProjectNameRequired');
    if (await run(() => postApi('/task/project/create', { name: name.trim(), color }))) {
      setName('');
      setColor(PALETTE[(PALETTE.indexOf(color) + 1) % PALETTE.length]);
    }
  };
  const save = async () => {
    if (!editing?.name.trim()) return Notific.warning('taskProjectNameRequired');
    if (await run(() => putApi(`/task/project/${btoa(String(editing.id))}`, { name: editing.name.trim(), color: editing.color }))) setEditing(null);
  };
  const toggle = (p: TaskProject) => run(() => putApi(`/task/project/${btoa(String(p._uuid))}`, { status: Number(p.status) === 1 ? 0 : 1 }));
  const remove = (p: TaskProject) => Notific.confirm(`${t('taskProjectDeleteConfirm')} ${p.name}`, () => {
    run(() => deleteApi(`/task/project/${btoa(String(p._uuid))}`));
  });

  return (
    <Modal open onClose={onClose} size="sm" className="acc-gl-ledger-modal task-projects">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <span className="acc-gl-group-icon acc-tone is-violet"><i className="fa-solid fa-gear" /></span>
          <span>
            <Modal.Title>{t('taskProjects')}</Modal.Title>
            <small>{t('taskProjectsHint')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        {canCreate && (
          <div className="task-project-add">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label={t('taskProjectColor')} />
            <Input value={name} onChange={setName} maxLength={150} placeholder={t('taskProjectName')} onPressEnter={add} />
            <Button appearance="primary" loading={busy} onClick={add}><i className="fa-solid fa-plus" /> {t('taskProjectAdd')}</Button>
          </div>
        )}
        {!projects.length ? (
          <p className="acc-arap-empty">{t('taskNoProjects')}</p>
        ) : (
          <ul className="task-project-list">
            {projects.map((p) => (
              <li key={p._uuid} className={Number(p.status) === 1 ? '' : 'is-off'}>
                {editing?.id === p._uuid ? (
                  <>
                    <input type="color" value={editing.color} onChange={(e) => setEditing({ ...editing, color: e.target.value })} aria-label={t('taskProjectColor')} />
                    <Input value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} maxLength={150} onPressEnter={save} autoFocus />
                    <button type="button" className="acc-gl-act" aria-label={t('save')} title={t('save')} onClick={save}><i className="fa-solid fa-check" /></button>
                    <button type="button" className="acc-gl-act" aria-label={t('cancel')} title={t('cancel')} onClick={() => setEditing(null)}><i className="fa-solid fa-xmark" /></button>
                  </>
                ) : (
                  <>
                    <i className="task-project-dot" style={{ background: p.color }} />
                    <span>
                      <b>{p.name}</b>
                      <small>{p.tasks ?? 0} {t('taskTasks')}</small>
                    </span>
                    <Toggle size="sm" checked={Number(p.status) === 1} disabled={!canEdit || busy} onChange={() => toggle(p)} />
                    {canEdit && (
                      <button type="button" className="acc-gl-act" aria-label={t('edit')} title={t('edit')} onClick={() => setEditing({ id: p._uuid, name: p.name, color: p.color })}>
                        <i className="fa-solid fa-pen" />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" className="acc-gl-act is-danger" aria-label={t('delete')} title={t('delete')} onClick={() => remove(p)}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TaskProjects;
