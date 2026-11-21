import { useEffect, useState } from 'react';
import { Input, Loader } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canEdit } from '../../../utils/localStorage';
import { refreshHrPending } from '../hrPending';
import { useT } from '../../../context/LanguageContext';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import { PAID_LEAVE, leaveTone, usePostData, type LeaveBalance } from './attendanceApi';
import {
  LEAD_WAITING, LeaveStatusCell, LeaveTypePicker, REQUEST_STATUSES, REQ_APPROVED, REQ_PENDING, isOver, rangeLabel, typeLabel, type LeaveRequest,
} from './requestKit';
import { LeaveFileChips, LeaveFileGallery } from './LeaveFiles';
import { SearchBox, SettingModal, YearStepper } from '../../account/setting/settingKit';

const PENDING = REQ_PENDING;
const APPROVED = REQ_APPROVED;

type LeaveData = {
  year: string;
  data: LeaveRequest[];
  summary: { pending: number; approved: number; rejected: number; cancelled: number };
};

/**
 * ອະນຸມັດ (ເລືອກປະເພດຄືນໄດ້) / ປະຕິເສດ + ໝາຍເຫດຂອງ HR — ສະແດງຄຳຂໍເປັນບັດ: ພະນັກງານ, ຊ່ວງວັນທີ / ຈຳນວນມື້ / ວັນສົ່ງ,
 * ເຫດຜົນ; ປຸ່ມຢືນຢັນເປັນ "ອະນຸມັດ" (ຂຽວ) ຫຼື "ປະຕິເສດ" (ແດງ)
 */
/** HR ເລືອກ ໄດ້ເງິນເດືອນ / ຕັດເງິນເດືອນ ຂອງມື້ລາ */
const PayTiles = ({ value, onChange }: { value: boolean; onChange: (paid: boolean) => void }) => {
  const t = useT();
  return (
    <div className="lv-review-types" role="radiogroup">
      {[true, false].map((paid) => {
        const meta = leaveTone(paid);
        const on = value === paid;
        return (
          <button key={String(paid)} type="button" role="radio" aria-checked={on} className={`lv-type ${meta.tone}${on ? ' is-on' : ''}`} onClick={() => onChange(paid)}>
            <span className="lv-type-icon"><i className={`fa-solid ${paid ? 'fa-sack-dollar' : meta.icon}`} /></span>
            <span>
              <b>{t(paid ? 'leavePaid' : 'lvPayCut')}</b>
              <small>{t(meta.hint)}</small>
            </span>
            <i className={`lv-type-check fa-${on ? 'solid fa-circle-check' : 'regular fa-circle'}`} />
          </button>
        );
      })}
    </div>
  );
};

type ReviewMode = 'approve' | 'reject' | 'revoke';

/** ຂໍ້ຄວາມຂອງແຕ່ລະການກະທຳ: ອະນຸມັດ, ປະຕິເສດ, ຖອນການອະນຸມັດ (ລຶບມື້ລາອອກຈາກການເຂົ້າວຽກ) */
const REVIEW_COPY: Record<ReviewMode, { label: string; hint: string; icon: string }> = {
  approve: { label: 'leaveApprove', hint: 'leaveApproveHint', icon: 'fa-check' },
  reject: { label: 'leaveReject', hint: 'leaveRejectHint', icon: 'fa-xmark' },
  revoke: { label: 'leaveRevoke', hint: 'leaveRevokeHint', icon: 'fa-rotate-left' },
};

const ReviewModal = ({ row, mode, onClose, onSaved }: {
  row: LeaveRequest;
  mode: ReviewMode;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const approve = mode === 'approve';
  const copy = REVIEW_COPY[mode];
  const [leaveTypeId, setLeaveTypeId] = useState<number | null>(row.leave_type_id);
  /** null = ກຳລັງໂຫຼດ */
  const [balances, setBalances] = useState<LeaveBalance[] | null>(approve ? null : []);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  /** null = ຕາມຄ່າເລີ່ມຕົ້ນ (ປະເພດໄດ້ເງິນເດືອນ ແລະ ບໍ່ເກີນສິດ = ໄດ້, ອື່ນໆ = ຕັດ); ປ່ຽນປະເພດ = ກັບຄ່າເລີ່ມຕົ້ນ */
  const [paidPick, setPaidPick] = useState<boolean | null>(null);
  const employee = row.employee;
  const state = REQUEST_STATUSES[row.status] ?? REQUEST_STATUSES[PENDING];
  const selected = balances?.find((b) => b._uuid === leaveTypeId);
  const over = isOver(selected, row.days);
  const defaultPaid = selected ? Number(selected.paid) === 1 && !over : row.leave_type === PAID_LEAVE;
  const paid = paidPick ?? defaultPaid;

  // ມື້ທີ່ເຫຼືອຂອງແຕ່ລະປະເພດ — ຄຳຂໍເກົ່າບໍ່ມີປະເພດ (ຫຼື ປະເພດຖືກປິດ) ເລືອກປະເພດທຳອິດທີ່ ໄດ້/ບໍ່ໄດ້ເງິນເດືອນ ກົງກັນ
  useEffect(() => {
    if (!approve) return;
    let alive = true;
    postApi('/leave/balance', { leave_id: row._uuid })
      .then((res) => {
        if (!alive) return;
        const list: LeaveBalance[] = res.data?.data ?? [];
        setBalances(list);
        setLeaveTypeId((current) => {
          if (current && list.some((b) => b._uuid === current)) return current;
          const paid = row.type ? Number(row.type.paid) : row.leave_type === PAID_LEAVE ? 1 : 0;
          return list.find((b) => Number(b.paid) === paid)?._uuid ?? list[0]?._uuid ?? null;
        });
      })
      .catch((error) => {
        if (!alive) return;
        setBalances([]);
        Notific.error(getErrorMessage(error));
      });
    return () => {
      alive = false;
    };
  }, [approve, row]);

  const submit = async () => {
    try {
      setSaving(true);
      const id = btoa(String(row._uuid));
      const res = approve
        ? await putApi(`/leave/approve/${id}`, { leave_type_id: leaveTypeId, paid: paid ? 1 : 0, note: note.trim() })
        : await putApi(`/leave/${mode}/${id}`, { note: note.trim() });
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
      title={t(copy.label)}
      hint={t(copy.hint)}
      icon={approve ? 'fa-circle-check' : copy.icon}
      saving={saving}
      onClose={onClose}
      onSubmit={submit}
      className={`lv-review-modal${approve ? '' : ' is-reject'}`}
      submit={{ label: t(copy.label), icon: approve ? 'fa-check' : copy.icon, danger: !approve }}
    >
      <div className="lv-review">
        <div className="lv-review-person">
          <HrAvatar url={employee?.profile_url} name={employee?.first_name} />
          <span>
            <b>{fullName(employee) || '—'}</b>
            <small>
              {[employee?.emp_code, employee?.department?.depart_name, employee?.position?.position_name].filter(Boolean).join(' · ')}
            </small>
          </span>
          <span className={`att-state ${state.tone}`}><i className={`fa-solid ${state.icon}`} /> {t(state.label)}</span>
        </div>

        <div className="lv-review-facts">
          <span>
            <i className="fa-regular fa-calendar" />
            <small>{t('leavePeriod')}</small>
            <b>{rangeLabel(row)}</b>
          </span>
          <span>
            <i className="fa-solid fa-business-time" />
            <small>{t('attWorkdays')}</small>
            <b>{row.days} {t('leaveDayUnit')}</b>
          </span>
          <span>
            <i className="fa-regular fa-paper-plane" />
            <small>{t('leaveRequestedAt')}</small>
            <b>{moment(row.createdAt).format('DD/MM/YYYY HH:mm')}</b>
          </span>
        </div>

        <div className="lv-review-reason">
          <small><i className="fa-solid fa-quote-left" /> {t('leaveReason')}</small>
          <p>{row.reason || '—'}</p>
        </div>

        <LeaveFileGallery files={row.files} />

        {approve && (
          <div className="lv-review-field">
            <label>{t('leaveType')}</label>
            {!balances ? (
              <Loader size="sm" content={t('loadingDots')} />
            ) : balances.length ? (
              <LeaveTypePicker
                balances={balances} days={row.days} value={leaveTypeId}
                onChange={(id) => {
                  setLeaveTypeId(id);
                  setPaidPick(null);
                }}
              />
            ) : (
              <p className="hr-note"><i className="fa-solid fa-circle-info" /> {t('lvNoTypes')}</p>
            )}
          </div>
        )}

        {approve && (
          <div className="lv-review-field">
            <label>{t('lvPayChoice')}</label>
            <PayTiles value={paid} onChange={setPaidPick} />
            {over && <p className="hr-note"><i className="fa-solid fa-triangle-exclamation" /> {t('lvPayOverHint')}</p>}
          </div>
        )}

        <div className="lv-review-field">
          <label>{t('leaveReviewNote')}</label>
          <Input as="textarea" rows={3} value={note} onChange={setNote} maxLength={255} placeholder={t('leaveReviewNotePlaceholder')} />
        </div>
      </div>
    </SettingModal>
  );
};

/**
 * ຄຳຂໍລາພັກ — ພະນັກງານສົ່ງຜ່ານ app ມືຖື (POST /leave/me); HR ອະນຸມັດ = ບັນທຶກລາພັກລົງການເຂົ້າວຽກທຸກມື້ເຮັດວຽກໃນຊ່ວງ
 * (ເງິນເດືອນນັບຕາມ), ປະຕິເສດ = ບໍ່ບັນທຶກຫຍັງ. ຕ້ອງມີສິດແກ້ໄຂ (backend ກວດຊ້ຳ)
 */
const LeavePage = () => {
  const t = useT();
  const [year, setYear] = useState(moment().year());
  /** 0 = ທັງໝົດ */
  const [status, setStatus] = useState(PENDING);
  const [keyword, setKeyword] = useState('');
  const [reviewing, setReviewing] = useState<{ row: LeaveRequest; mode: ReviewMode } | null>(null);
  const { data, loading, reload: reloadList } = usePostData<LeaveData>('/leave/fetch', { year, status });
  // ລາຍການປ່ຽນ (ອະນຸມັດ / ປະຕິເສດ / ຈ່າຍ) = ຕົວເລກລໍຖ້າຢູ່ເມນູຊ້າຍ ແລະ ໄອຄອນ desktop ອັບເດດນຳ
  const reload = () => {
    reloadList();
    refreshHrPending();
  };

  const rows = data?.data ?? [];
  const summary = data?.summary ?? { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  const q = keyword.trim().toLowerCase();
  // ອັນທີ່ HR ເຮັດໄດ້ດຽວນີ້ຂຶ້ນກ່ອນ — ອັນທີ່ລໍຫົວໜ້າທີມຢູ່ ລົງລຸ່ມ
  const lockedLast = (r: LeaveRequest) => (r.status === PENDING && r.lead_status === LEAD_WAITING ? 1 : 0);
  const shown = rows
    .filter((r) => !q || `${r.employee?.emp_code ?? ''} ${fullName(r.employee)} ${r.reason}`.toLowerCase().includes(q))
    .sort((a, b) => lockedLast(a) - lockedLast(b));
  const tabs = [
    { key: PENDING, label: 'leaveStatusPending', value: summary.pending },
    { key: 2, label: 'leaveStatusApproved', value: summary.approved },
    { key: 3, label: 'leaveStatusRejected', value: summary.rejected },
    { key: 4, label: 'leaveStatusCancelled', value: summary.cancelled },
    { key: 0, label: 'all', value: summary.pending + summary.approved + summary.rejected + summary.cancelled },
  ];

  return (
    <div className="acc-rp att-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="att-nav">
            <YearStepper year={year} onChange={setYear} max={moment().year() + 1} />
          </div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
          </div>
        </div>
      </div>
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('leaveNote')}</p>

      {!data ? (
        <div className="text-center py-5">
          {loading ? <Loader size="md" content={t('loadingDots')} vertical /> : <p className="acc-gl-ref">{t('noData')}</p>}
        </div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <div className="att-toolbar">
            <div className="acc-type-segment" role="tablist">
              {tabs.map((tab) => (
                <button key={tab.key} type="button" role="tab" aria-selected={status === tab.key} className={status === tab.key ? 'is-active' : ''} onClick={() => setStatus(tab.key)}>
                  {t(tab.label)} <em>{tab.value}</em>
                </button>
              ))}
            </div>
            <div className="att-toolbar-tools">
              <SearchBox value={keyword} onChange={setKeyword} placeholder={t('search')} />
            </div>
          </div>

          {!shown.length ? (
            <div className="acc-class-empty"><i className="fa-solid fa-plane-departure" /><p>{t('noData')}</p></div>
          ) : (
            <div className="acc-gl-group">
              <div className="acc-rp-scroll">
                <table className="acc-gl-table hr-table att-table">
                  <thead>
                    <tr>
                      <th>{t('hrEmployee')}</th>
                      <th>{t('leaveType')}</th>
                      <th>{t('leavePeriod')}</th>
                      <th>{t('leaveReason')}</th>
                      <th>{t('status')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const type = typeLabel(r, t);
                      const pending = r.status === PENDING;
                      // ລູກທີມ: HR ອະນຸມັດ / ປະຕິເສດ ໄດ້ ຫຼັງຫົວໜ້າທີມອະນຸມັດແລ້ວເທົ່ານັ້ນ (backend ກວດຊ້ຳ)
                      const waitingLead = pending && r.lead_status === LEAD_WAITING;
                      return (
                        <tr key={r._uuid}>
                          <td>
                            <span className="hr-person">
                              <HrAvatar url={r.employee?.profile_url} name={r.employee?.first_name} />
                              <span>
                                <b>{fullName(r.employee) || '—'}</b>
                                <small className="acc-gl-ref">
                                  {r.employee?.emp_code}{r.employee?.department ? ` · ${r.employee.department.depart_name}` : ''}
                                </small>
                              </span>
                            </span>
                          </td>
                          <td><span className={`att-state ${type.tone}`}>{type.label}</span></td>
                          <td>
                            <b>{rangeLabel(r)}</b>
                            <small className="acc-gl-ref d-block">{r.days} {t('attWorkdays')} · {t('leaveRequestedAt')} {moment(r.createdAt).format('DD/MM/YYYY HH:mm')}</small>
                          </td>
                          <td className="att-note">
                            {r.reason}
                            <LeaveFileChips files={r.files} />
                          </td>
                          <td><LeaveStatusCell row={r} /></td>
                          <td className="lv-actions">
                            {waitingLead && canEdit && (
                              <span className="lv-act is-locked" title={t('leaveLeadLockedHint')}>
                                <i className="fa-solid fa-lock" /> {t('leaveLeadLocked')}
                              </span>
                            )}
                            {pending && !waitingLead && canEdit && (
                              <>
                                <button type="button" className="lv-act is-approve" onClick={() => setReviewing({ row: r, mode: 'approve' })}>
                                  <i className="fa-solid fa-check" /> {t('leaveApprove')}
                                </button>
                                <button type="button" className="lv-act is-reject" title={t('leaveReject')} onClick={() => setReviewing({ row: r, mode: 'reject' })}>
                                  <i className="fa-solid fa-xmark" />
                                </button>
                              </>
                            )}
                            {r.status === APPROVED && canEdit && (
                              <button type="button" className="lv-act is-reject" title={t('leaveRevoke')} aria-label={t('leaveRevoke')} onClick={() => setReviewing({ row: r, mode: 'revoke' })}>
                                <i className="fa-solid fa-rotate-left" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {reviewing && <ReviewModal row={reviewing.row} mode={reviewing.mode} onClose={() => setReviewing(null)} onSaved={reload} />}
    </div>
  );
};

export default LeavePage;
