import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Input, Loader } from 'rsuite';
import moment from 'moment';
import { useT } from '../../../context/LanguageContext';
import { HrAvatar } from '../hrKit';
import { PERSON_DONE, partOf, type Task, type TaskComment } from './taskApi';

const stamp = (value: string) => moment(value).format('DD/MM/YYYY HH:mm');
const sameDay = (a: string, b: string) => moment(a).isSame(b, 'day');

/**
 * ຄອມເມັນຂອງວຽກ — ເກົ່າ → ໃໝ່ (ລ່າສຸດຢູ່ລຸ່ມ), ຄອມເມັນຕິດກັນຂອງຄົນດຽວກັນສະແດງຮູບ/ຊື່ເທື່ອດຽວ, ກ່ອງພິມ (Enter = ສົ່ງ,
 * Shift+Enter = ແຖວໃໝ່). ໃຊ້ຮ່ວມ: ລາຍລະອຽດວຽກຂອງ HR ແລະ ວຽກຂອງຂ້ອຍ.
 * pickTo = ວຽກ (ຫຼາຍກວ່າ 1 ຄົນ) → ເລືອກແຈ້ງເຖິງບາງຄົນໄດ້ (ທາງລັດ "ຄົນທີ່ຍັງບໍ່ສຳເລັດ"); closed = ສະແດງແທນກ່ອງພິມ;
 * onDraftChange = ກຳລັງພິມຢູ່ບໍ (ກ່ອງທີ່ຫໍ່ໄວ້ຈະບໍ່ປິດງ່າຍ ຂໍ້ຄວາມບໍ່ຫາຍ)
 */
export const TaskCommentThread = ({ comments, total, pickTo, canDeleteAll, closed, onSend, onDelete, onDraftChange }: {
  comments: TaskComment[] | null;
  total?: number;
  pickTo?: Pick<Task, 'status' | 'assignees'> | null;
  canDeleteAll?: boolean;
  closed?: ReactNode;
  /** ສົ່ງສຳເລັດ = true (ລ້າງກ່ອງພິມ) */
  onSend: (body: string, to: number[]) => Promise<boolean>;
  onDelete: (comment: TaskComment) => void;
  onDraftChange?: (hasDraft: boolean) => void;
}) => {
  const t = useT();
  const [draft, setDraft] = useState('');
  /** ຄົນທີ່ເລືອກແຈ້ງເຖິງ (ເຊັ່ນ ເລັ່ງວຽກບາງຄົນ) — ຫວ່າງ = ແຈ້ງທຸກຄົນ */
  const [to, setTo] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const people = pickTo?.assignees ?? [];
  /** ຄົນທີ່ສ່ວນຂອງຕົນຍັງບໍ່ສຳເລັດ — ທາງລັດເລືອກແຈ້ງເຖິງ (ເລັ່ງວຽກ) */
  const behind = pickTo ? people.filter((a) => partOf(pickTo, a).status !== PERSON_DONE).map((a) => a.employee_id) : [];

  // ຄອມເມັນລ່າສຸດຢູ່ລຸ່ມສຸດ
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [comments]);

  useEffect(() => {
    onDraftChange?.(!!draft.trim());
  }, [draft, onDraftChange]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await onSend(body, [...to]);
    setSending(false);
    if (ok) {
      setDraft('');
      setTo(new Set());
    }
  };
  const onDraftKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <aside className="task-comments">
      <h6 className="task-detail-head"><i className="fa-regular fa-comments" /> {t('taskComments')} <em>{comments?.length ?? total ?? 0}</em></h6>
      <div className="task-comment-list" ref={threadRef}>
        {!comments ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : !comments.length ? (
          <p className="task-comment-empty"><i className="fa-regular fa-comment-dots" /> {t('taskCommentEmpty')}</p>
        ) : comments.map((c, index) => {
          // ຄອມເມັນຕິດກັນຂອງຄົນດຽວກັນ (ເຖິງຕ່າງມື້) — ຮູບ ແລະ ຊື່ເທື່ອດຽວ; ຄອມເມັນຍັງລຽງຕາມເວລາ ໃຫ້ອ່ານເປັນການສົນທະນາ
          const prev = comments[index - 1];
          const cont = !!prev && prev.author_name === c.author_name && prev.from_app === c.from_app && prev.mine === c.mine;
          return (
            <div key={c._uuid} className={`task-comment${c.mine ? ' is-mine' : ''}${cont ? ' is-cont' : ''}`}>
              {cont ? <span className="task-comment-gap" /> : <HrAvatar url={c.author_photo} name={c.author_name} size="sm" />}
              <div className="task-comment-bubble">
                <header>
                  {!cont && <b>{c.author_name}</b>}
                  {!cont && c.from_app && <span className="task-comment-app"><i className="fa-solid fa-mobile-screen" /> {t('taskCommentFromApp')}</span>}
                  <small>{cont && sameDay(prev.createdAt, c.createdAt) ? moment(c.createdAt).format('HH:mm') : stamp(c.createdAt)}</small>
                  {!!c.to?.length && (
                    <span className="task-comment-to-tag" title={t('taskCommentTo')}><i className="fa-solid fa-at" /> {c.to.map((p) => p.name).join(', ')}</span>
                  )}
                  {(c.mine || canDeleteAll) && (
                    <button type="button" className="task-comment-x" title={t('delete')} aria-label={t('delete')} onClick={() => onDelete(c)}>
                      <i className="fa-solid fa-trash" />
                    </button>
                  )}
                </header>
                <p>{c.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      {closed ?? (
        <>
          {people.length > 1 && (
            // ແຈ້ງເຖິງ: ທຸກຄົນ (ຄ່າເລີ່ມຕົ້ນ) ຫຼື ເລືອກບາງຄົນ — ທາງລັດ "ຄົນທີ່ຍັງບໍ່ສຳເລັດ" ໄວ້ເລັ່ງວຽກ
            <div className="task-comment-to" role="group" aria-label={t('taskCommentTo')}>
              <span className="task-comment-to-label" title={t('taskCommentToHint')}><i className="fa-solid fa-bell" /> {t('taskCommentTo')}</span>
              <button type="button" className={to.size ? '' : 'is-on'} aria-pressed={!to.size} onClick={() => setTo(new Set())}>{t('taskCommentToAll')}</button>
              {people.map((a) => (
                <button key={a.employee_id} type="button" className={`has-avatar${to.has(a.employee_id) ? ' is-on' : ''}`} aria-pressed={to.has(a.employee_id)}
                  onClick={() => setTo((s) => {
                    const next = new Set(s);
                    if (next.has(a.employee_id)) next.delete(a.employee_id);
                    else next.add(a.employee_id);
                    return next;
                  })}
                >
                  <HrAvatar url={a.profile_url} name={a.first_name} size="sm" /> {a.first_name}
                </button>
              ))}
              {behind.length > 0 && behind.length < people.length && (
                <button type="button" className="task-comment-to-quick" onClick={() => setTo(new Set(behind))}>
                  <i className="fa-solid fa-bolt" /> {t('taskCommentToBehind')} ({behind.length})
                </button>
              )}
            </div>
          )}
          <div className="task-comment-box">
            <Input as="textarea" rows={2} value={draft} onChange={setDraft} onKeyDown={onDraftKey} maxLength={2000} placeholder={t('taskCommentPlaceholder')} aria-label={t('taskComments')} />
            <button type="button" className="task-comment-send" disabled={!draft.trim() || sending} title={t('taskCommentSend')} aria-label={t('taskCommentSend')} onClick={send}>
              {sending ? <Loader size="xs" /> : <i className="fa-solid fa-paper-plane" />}
            </button>
          </div>
        </>
      )}
    </aside>
  );
};
