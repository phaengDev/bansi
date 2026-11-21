import { useEffect, useState, type ReactNode } from 'react';
import { Input, Loader } from 'rsuite';
import moment from 'moment';
import { putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { useGetData } from '../hr/attendance/attendanceApi';
import { REQUEST_STATUSES, REQ_APPROVED, REQ_CANCELLED, REQ_PENDING, REQ_REJECTED, StatusTag } from '../hr/attendance/requestKit';
import { LeaveFileChips } from '../hr/attendance/LeaveFiles';
import { HrAvatar } from '../hr/hrKit';
import { SettingModal } from '../account/setting/settingKit';
import { APPROVAL_KINDS, refreshMyInbox, useMyInbox } from './meInbox';
import { idOf, type ApprovalItem, type ApprovalKind, type ApprovalList, type ApprovalState, type MyIntent } from './meApi';

/** ແຕ່ລະປະເພດຄຳຂໍ: ຊື່ແຖບ, ໄອຄອນ, ຄຳອະທິບາຍ ແລະ ຄຳອະທິບາຍຂອງການອະນຸມັດ */
const KIND_META: Record<ApprovalKind, { label: string; icon: string; note: string; approveHint: string }> = {
  team: { label: 'myApvTeam', icon: 'fa-people-group', note: 'myApvTeamNote', approveHint: 'myApvTeamApproveHint' },
  leave: { label: 'myApvLeave', icon: 'fa-plane-departure', note: 'myApvHrNote', approveHint: 'myApvLeaveApproveHint' },
  correction: { label: 'myApvCorrection', icon: 'fa-fingerprint', note: 'myApvHrNote', approveHint: 'corrApproveHint' },
  advance: { label: 'myApvAdvance', icon: 'fa-hand-holding-dollar', note: 'myApvAdvanceNote', approveHint: 'myApvAdvanceApproveHint' },
};

const STATE_STATUS: Record<ApprovalState, number> = { pending: REQ_PENDING, approved: REQ_APPROVED, rejected: REQ_REJECTED, cancelled: REQ_CANCELLED };
const stateMeta = (state: ApprovalState) => REQUEST_STATUSES[STATE_STATUS[state] ?? REQ_PENDING];

const when = (date: string | null) => (date ? moment(date).format('DD/MM/YYYY HH:mm') : '—');

/** ຜູ້ຂໍ — ຮູບ, ຊື່, ລະຫັດ · ພະແນກ · ຕຳແໜ່ງ */
const Requester = ({ item, trailing }: { item: ApprovalItem; trailing?: ReactNode }) => (
  <div className="lv-review-person">
    <HrAvatar url={item.person.profile_url} name={item.person.name} />
    <span>
      <b>{item.person.name || '—'}</b>
      <small>{[item.person.emp_code, item.person.department, item.person.position].filter(Boolean).join(' · ')}</small>
    </span>
    {trailing}
  </div>
);

/** ລາຍລະອຽດ (backend ຂຽນໃຫ້ແລ້ວ) + ຄຳເຕືອນ + ເຫດຜົນ + ໃບລາທີ່ແນບ */
const Details = ({ item }: { item: ApprovalItem }) => {
  const t = useT();
  return (
    <>
      <div className="my-apv-what">
        <b><i className={`fa-solid ${KIND_META[item.kind].icon}`} /> {item.title}</b>
        {!!item.lines.length && <ul>{item.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>}
      </div>
      {!!item.warn.length && (
        <ul className="my-apv-warn">
          {item.warn.map((line, i) => <li key={i}><i className="fa-solid fa-triangle-exclamation" /> {line}</li>)}
        </ul>
      )}
      {item.reason && (
        <div className="lv-review-reason">
          <small><i className="fa-solid fa-quote-left" /> {t('leaveReason')}</small>
          <p>{item.reason}</p>
        </div>
      )}
      {!!item.files.length && (
        <p className="my-apv-files"><span>{t('lvFiles')}</span> <LeaveFileChips files={item.files} self /></p>
      )}
    </>
  );
};

/** ອະນຸມັດ / ປະຕິເສດ + ໝາຍເຫດ (ຜູ້ຂໍເຫັນ) → PUT /approve/me/:kind/:id/(approve|reject) — ຂັ້ນຕອນດຽວກັບ HR ໃນເວັບ */
const DecideModal = ({ item, approve, onClose, onSaved }: { item: ApprovalItem; approve: boolean; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    try {
      setSaving(true);
      const res = await putApi(`/approve/me/${item.kind}/${idOf(item)}/${approve ? 'approve' : 'reject'}`, { note: note.trim() });
      Notific.success(res.data?.message ?? 'saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingModal
      title={`${t(approve ? 'leaveApprove' : 'leaveReject')} · ${t(KIND_META[item.kind].label)}`}
      hint={t(approve ? KIND_META[item.kind].approveHint : 'myApvRejectHint')}
      icon={approve ? 'fa-circle-check' : 'fa-circle-xmark'}
      saving={saving}
      onClose={onClose}
      onSubmit={submit}
      className={`lv-review-modal${approve ? '' : ' is-reject'}`}
      submit={{ label: t(approve ? 'leaveApprove' : 'leaveReject'), icon: approve ? 'fa-check' : 'fa-xmark', danger: !approve }}
    >
      <div className="lv-review">
        <Requester item={item} trailing={<small className="my-apv-when">{when(item.created_at)}</small>} />
        <Details item={item} />
        <div className="lv-review-field">
          <label>{t('myApvNote')}</label>
          <Input as="textarea" rows={3} value={note} onChange={setNote} maxLength={255} placeholder={t(approve ? 'myApvNoteApprove' : 'myApvNoteReject')} />
        </div>
      </div>
    </SettingModal>
  );
};

/**
 * ອະນຸມັດຄຳຂໍ — ແຖບຕາມສິດ (ລາພັກລູກທີມ = ເປັນຫົວໜ້າທີມ; ລາພັກ / ລືມສະແກນ / ເບີກເງິນ = HR ຕິກສິດໃຫ້ໃນຟອມຜູ້ໃຊ້).
 * ລໍຖ້າ (ເກົ່າສຸດກ່ອນ) ພ້ອມປຸ່ມອະນຸມັດ / ປະຕິເສດ, ແລະ ທີ່ຕັດສິນແລ້ວໃນ 30 ມື້. ຄຳຂໍຂອງຕົນເອງບໍ່ສະແດງ
 */
const MyApprovals = ({ intent, onIntentDone }: { intent?: MyIntent | null; onIntentDone: () => void }) => {
  const t = useT();
  const inbox = useMyInbox();
  const kinds = APPROVAL_KINDS.filter((k) => inbox.approvals?.rights[k]);
  const [picked, setPicked] = useState<ApprovalKind | null>(null);
  const kind = picked && kinds.includes(picked) ? picked : kinds[0] ?? null;
  const { data, loading, reload } = useGetData<ApprovalList>(`/approve/me/${kind ?? 'team'}`, kind ? {} : null);
  const [deciding, setDeciding] = useState<{ item: ApprovalItem; approve: boolean } | null>(null);

  // ຈາກແຈ້ງເຕືອນ "ມີຄຳຂໍລໍທ່ານອະນຸມັດ" — ໄປແຖບຂອງປະເພດນັ້ນ
  useEffect(() => {
    if (intent?.action !== 'tab') return;
    setPicked(intent.tab as ApprovalKind);
    onIntentDone();
  }, [intent, onIntentDone]);

  const refresh = () => {
    reload();
    refreshMyInbox();
  };

  if (!inbox.approvals) {
    return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;
  }
  if (!kind) {
    return (
      <div className="acc-rp att-page my-page">
        <div className="acc-class-empty"><i className="fa-solid fa-user-shield" /><p>{t('myApvNoRights')}</p></div>
      </div>
    );
  }

  const meta = KIND_META[kind];
  // ລໍຖ້າຂອງແຖບນີ້ (ຈາກລາຍການທີ່ໂຫຼດ — ກົງກັບສິ່ງທີ່ເຫັນ)
  const pending = data?.pending ?? [];
  const recent = data?.recent ?? [];

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="acc-type-segment" role="tablist">
            {kinds.map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'is-active' : ''} onClick={() => setPicked(k)}>
                <i className={`fa-solid ${KIND_META[k].icon}`} /> {t(KIND_META[k].label)}
                {!!inbox.approvals!.pending[k] && <em className="is-alert">{inbox.approvals!.pending[k]}</em>}
              </button>
            ))}
          </div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={refresh} disabled={loading} aria-label={t('reload')}><i className="fa-solid fa-rotate-right" /></button>
          </div>
        </div>
      </div>
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t(meta.note)}</p>

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className={`my-apv${loading ? ' is-refreshing' : ''}`}>
          <section>
            <h4 className="my-apv-head"><i className="fa-solid fa-hourglass-half" /> {t('myApvWaiting')} <em>{pending.length}</em></h4>
            {!pending.length ? (
              <div className="acc-class-empty is-compact"><i className="fa-solid fa-mug-hot" /><p>{t('myApvNothing')}</p></div>
            ) : (
              <div className="my-apv-cards">
                {pending.map((item) => (
                  <article key={item._uuid} className="my-card my-apv-card">
                    <Requester item={item} trailing={<small className="my-apv-when">{when(item.created_at)}</small>} />
                    <Details item={item} />
                    <footer>
                      <button type="button" className="lv-act is-reject" onClick={() => setDeciding({ item, approve: false })}>
                        <i className="fa-solid fa-xmark" /> {t('leaveReject')}
                      </button>
                      <button type="button" className="lv-act is-approve" onClick={() => setDeciding({ item, approve: true })}>
                        <i className="fa-solid fa-check" /> {t('leaveApprove')}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="my-apv-head"><i className="fa-solid fa-clock-rotate-left" /> {t('myApvRecent')} <em>{recent.length}</em></h4>
            {!recent.length ? (
              <p className="my-empty">{t('myApvNoRecent')}</p>
            ) : (
              <div className="acc-gl-group">
                <div className="acc-rp-scroll">
                  <table className="acc-gl-table hr-table att-table">
                    <thead>
                      <tr>
                        <th>{t('myApvRequester')}</th>
                        <th>{t('myApvRequest')}</th>
                        <th>{t('status')}</th>
                        <th>{t('myApvDecidedBy')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((item) => (
                        <tr key={item._uuid}>
                          <td>
                            <span className="my-apv-who">
                              <HrAvatar url={item.person.profile_url} name={item.person.name} size="sm" />
                              <span><b>{item.person.name}</b><small className="acc-gl-ref d-block">{item.person.department ?? item.person.emp_code}</small></span>
                            </span>
                          </td>
                          <td>
                            <b>{item.title}</b>
                            {item.lines.map((line, i) => <small key={i} className="acc-gl-ref d-block">{line}</small>)}
                          </td>
                          <td><StatusTag meta={stateMeta(item.state)} /></td>
                          <td>
                            {item.reviewer ?? '—'}
                            <small className="acc-gl-ref d-block">{when(item.reviewed_at)}</small>
                            {item.review_note && <small className="acc-gl-ref d-block">“{item.review_note}”</small>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {deciding && <DecideModal item={deciding.item} approve={deciding.approve} onClose={() => setDeciding(null)} onSaved={refresh} />}
    </div>
  );
};

export default MyApprovals;
