import { useState } from 'react';
import { Button, Form, Input, Loader, Modal, SelectPicker } from 'rsuite';
import moment from 'moment';
import { deleteApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { useGetData } from '../hr/attendance/attendanceApi';
import { SearchBox, SettingModal } from '../account/setting/settingKit';
import { MarkedText, NoteInk, hasInk } from './NoteView';
import { idOf, type MyNote, type MyNoteBook, type MyNoteFolder } from './meApi';

/** ສີພື້ນບັດໂນດ — ຄືກັບ app (null = ຂາວ) */
const NOTE_COLORS: (string | null)[] = [null, '#FFF4C2', '#FFE1D6', '#FCE1EF', '#E5E1FB', '#DCEEFF', '#DDF5E6'];
const isPinned = (note: MyNote) => note.pinned === true || Number(note.pinned) === 1;

/** ຫົວຂໍ້ທີ່ສະແດງ: ຫົວຂໍ້ ຫຼື ແຖວທຳອິດຂອງຂໍ້ຄວາມ (ຄືກັບ app) */
const headingOf = (note: MyNote, t: (key: string) => string) => {
  const title = (note.title ?? '').trim();
  if (title) return { heading: title, preview: note.body ?? '', previewStart: 0 };
  const body = note.body ?? '';
  const lead = body.length - body.trimStart().length;
  const newline = body.indexOf('\n', lead);
  const first = (newline < 0 ? body.slice(lead) : body.slice(lead, newline)).trim();
  const start = newline < 0 ? body.length : newline + 1;
  return { heading: first || (hasInk(note.ink) ? t('myNoteDrawing') : t('myNotes')), preview: body, previewStart: start };
};

/**
 * ເປີດ / ຂຽນໂນດ — ຫົວຂໍ້, ຂໍ້ຄວາມ, ສີບັດ, ປັກໝຸດ, ໂຟນເດີ. ຮູບຂີດແຕ້ມຈາກ app ສະແດງໃຫ້ເບິ່ງ (ແກ້ໃນ app).
 * ສີ / ໂຕໜາ ທີ່ຕັ້ງໃນ app ຢູ່ຄືເດີມ ຈົນກວ່າຈະແກ້ຂໍ້ຄວາມໃນຄອມ (ແກ້ແລ້ວ = ລຶບຮູບແບບ ຕຳແໜ່ງເກົ່າຈະບໍ່ກົງ)
 */
const NoteEditor = ({ note, folders, defaultFolder, onClose, onSaved }: {
  note: MyNote | null;
  folders: MyNoteFolder[];
  defaultFolder: number | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [color, setColor] = useState<string | null>(note?.color ?? null);
  const [pinned, setPinned] = useState(note ? isPinned(note) : false);
  const [folderId, setFolderId] = useState<number | null>(note ? note.folder_id : defaultFolder);
  const [saving, setSaving] = useState(false);
  const bodyChanged = (note?.body ?? '') !== body;
  const hasMarks = !!note?.marks && note.marks !== '[]';
  /** ມີສີ / ໂຕໜາ ຈາກ app = ສະແດງຕາມນັ້ນກ່ອນ; ກົດ "ແກ້ຂໍ້ຄວາມ" ຈຶ່ງເປັນກ່ອງພິມ (ບັນທຶກແລ້ວຮູບແບບຫາຍ) */
  const [editText, setEditText] = useState(!hasMarks);

  const save = async () => {
    if (!title.trim() && !body.trim() && !hasInk(note?.ink ?? null)) return Notific.warning('myNoteEmpty');
    const payload: Record<string, unknown> = { title: title.trim() || null, body: body || null, color, pinned: pinned ? 1 : 0, folder_id: folderId };
    if (note && bodyChanged && hasMarks) payload.marks = null;
    try {
      setSaving(true);
      if (note) await putApi(`/note/me/${idOf(note)}`, payload);
      else await postApi('/note/me', payload);
      Notific.success('saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const remove = () => note && Notific.confirm(t('myNoteDeleteConfirm'), async () => {
    try {
      await deleteApi(`/note/me/${idOf(note)}`);
      Notific.success('acsDeleted');
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });

  return (
    <Modal open onClose={onClose} size="md" keyboard={false} className="acc-gl-ledger-modal my-note-modal">
      <Modal.Body style={{ background: color ?? '#fff' }}>
        <Form fluid>
          <Input className="my-note-title" value={title} onChange={setTitle} maxLength={255} placeholder={t('myNoteTitle')} />
          {note && !editText ? (
            <div className="my-note-marked"><MarkedText text={body} marks={note.marks} /></div>
          ) : (
            <Input as="textarea" className="my-note-body" rows={10} value={body} onChange={setBody} placeholder={t('myNoteBody')} />
          )}
          {note && hasMarks && (
            <p className="my-note-hint">
              <i className="fa-solid fa-circle-info" /> {t(editText ? 'myNoteMarksCleared' : 'myNoteMarksKept')}
              {!editText && <button type="button" className="my-link" onClick={() => setEditText(true)}><i className="fa-solid fa-pen" /> {t('myNoteEditText')}</button>}
            </p>
          )}
          {hasInk(note?.ink ?? null) && (
            <figure className="my-note-ink">
              <NoteInk ink={note!.ink} />
              <figcaption><i className="fa-solid fa-pen-nib" /> {t('myNoteInkHint')}</figcaption>
            </figure>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <div className="my-note-tools">
          <span className="my-note-colors" role="radiogroup" aria-label={t('myNoteColor')}>
            {NOTE_COLORS.map((c) => (
              <button key={c ?? 'none'} type="button" role="radio" aria-checked={color === c} className={color === c ? 'is-on' : ''}
                style={{ background: c ?? '#fff' }} onClick={() => setColor(c)} aria-label={c ?? t('myNoteWhite')}
              />
            ))}
          </span>
          <button type="button" className={`my-note-pin${pinned ? ' is-on' : ''}`} aria-pressed={pinned} onClick={() => setPinned(!pinned)} title={t('myNotePin')}>
            <i className="fa-solid fa-thumbtack" /> {t('myNotePin')}
          </button>
          <SelectPicker size="sm" data={folders.map((f) => ({ value: f._uuid, label: f.name }))} value={folderId} onChange={setFolderId}
            placeholder={t('myNoteNoFolder')} searchable={false} cleanable popupClassName="acc-book-menu" className="my-note-folder"
          />
        </div>
        {note && <button type="button" className="acc-rp-btn is-danger hr-status-btn" onClick={remove}><i className="fa-solid fa-trash" /></button>}
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={save}><i className="fa-solid fa-check" /> {t('save')}</Button>
      </Modal.Footer>
    </Modal>
  );
};

/** ເພີ່ມ / ປ່ຽນຊື່ໂຟນເດີ */
const FolderModal = ({ folder, onClose, onSaved }: { folder: MyNoteFolder | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [name, setName] = useState(folder?.name ?? '');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!name.trim()) return Notific.warning('myNoteFolderName');
    try {
      setSaving(true);
      if (folder) await putApi(`/note/me/folders/${idOf(folder)}`, { name: name.trim() });
      else await postApi('/note/me/folders', { name: name.trim() });
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SettingModal title={t(folder ? 'myNoteFolderRename' : 'myNoteFolderAdd')} icon="fa-folder" compact saving={saving} onClose={onClose} onSubmit={submit}>
      <Form fluid>
        <div className="rs-form-group">
          <label className="form-label">{t('myNoteFolderName')}<span className="text-danger">*</span></label>
          <Input value={name} onChange={setName} maxLength={60} autoFocus onPressEnter={submit} />
        </div>
      </Form>
    </SettingModal>
  );
};

/**
 * ໂນດຂອງຂ້ອຍ (ຄືໃນ app) — ໂຟນເດີ (ເພີ່ມ / ປ່ຽນຊື່ / ລຶບ — ໂນດຂ້າງໃນອອກມາຢູ່ນອກ), ຄົ້ນຫາ, ບັດໂນດ (ປັກໝຸດກ່ອນ, ສີບັດ,
 * ສີ/ໂຕໜາ ແລະ ຮູບຂີດແຕ້ມຈາກ app), ຂຽນ / ແກ້ / ລຶບ
 */
const MyNotes = () => {
  const t = useT();
  const [keyword, setKeyword] = useState('');
  /** 0 = ທັງໝົດ, -1 = ນອກໂຟນເດີ, > 0 = ໂຟນເດີ */
  const [folder, setFolder] = useState(0);
  const [editing, setEditing] = useState<MyNote | null | 'new'>(null);
  const { data, loading, reload } = useGetData<MyNoteBook>('/note/me', keyword.trim() ? { q: keyword.trim() } : {});
  const folders = data?.folders ?? [];
  const notes = (data?.data ?? []).filter((n) => (folder === 0 ? true : folder === -1 ? !n.folder_id : n.folder_id === folder));

  /** ໂຟນເດີທີ່ກຳລັງຕັ້ງຊື່ — null = ບໍ່ມີ, 'new' = ເພີ່ມໃໝ່ */
  const [naming, setNaming] = useState<MyNoteFolder | 'new' | null>(null);
  const removeFolder = (f: MyNoteFolder) => Notific.confirm(`${t('myNoteFolderDelete')} ${f.name}`, async () => {
    try {
      await deleteApi(`/note/me/folders/${idOf(f)}`);
      setFolder(0);
      reload();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  });
  const current = folders.find((f) => f._uuid === folder);

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <SearchBox value={keyword} onChange={setKeyword} placeholder={t('search')} />
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn is-primary" onClick={() => setEditing('new')}><i className="fa-solid fa-plus" /> {t('myNoteNew')}</button>
          </div>
        </div>
        <div className="my-note-folders">
          <button type="button" className={folder === 0 ? 'is-on' : ''} onClick={() => setFolder(0)}><i className="fa-solid fa-note-sticky" /> {t('all')} <em>{data?.data.length ?? 0}</em></button>
          <button type="button" className={folder === -1 ? 'is-on' : ''} onClick={() => setFolder(-1)}><i className="fa-regular fa-folder-open" /> {t('myNoteNoFolder')}</button>
          {folders.map((f) => (
            <button key={f._uuid} type="button" className={folder === f._uuid ? 'is-on' : ''} onClick={() => setFolder(f._uuid)}>
              <i className="fa-solid fa-folder" /> {f.name} <em>{f.count}</em>
            </button>
          ))}
          <button type="button" className="is-add" onClick={() => setNaming('new')}><i className="fa-solid fa-folder-plus" /> {t('myNoteFolderAdd')}</button>
          {current && (
            <span className="my-note-folder-tools">
              <button type="button" className="acc-gl-act" title={t('edit')} onClick={() => setNaming(current)}><i className="fa-solid fa-pen" /></button>
              <button type="button" className="acc-gl-act is-danger" title={t('delete')} onClick={() => removeFolder(current)}><i className="fa-solid fa-trash" /></button>
            </span>
          )}
        </div>
      </div>

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !notes.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-note-sticky" /><p>{t('myNoNotes')}</p></div>
      ) : (
        <div className={`my-notes${loading ? ' is-refreshing' : ''}`}>
          {notes.map((note) => {
            const { heading, preview, previewStart } = headingOf(note, t);
            const rest = preview.slice(previewStart).trim();
            return (
              <button key={note._uuid} type="button" className="my-note" style={{ background: note.color ?? '#fff' }} onClick={() => setEditing(note)}>
                {isPinned(note) && <i className="fa-solid fa-thumbtack my-note-pinned" />}
                <b>{heading}</b>
                {rest && (
                  <p>
                    {previewStart === 0 ? <MarkedText text={preview} marks={note.marks} /> : rest}
                  </p>
                )}
                {hasInk(note.ink) && <NoteInk ink={note.ink} className="my-note-thumb" />}
                <small>{moment(note.updatedAt).format('DD/MM/YYYY HH:mm')}</small>
              </button>
            );
          })}
        </div>
      )}

      {naming && <FolderModal folder={naming === 'new' ? null : naming} onClose={() => setNaming(null)} onSaved={reload} />}
      {editing && (
        <NoteEditor note={editing === 'new' ? null : editing} folders={folders} defaultFolder={folder > 0 ? folder : null}
          onClose={() => setEditing(null)} onSaved={reload}
        />
      )}
    </div>
  );
};

export default MyNotes;
