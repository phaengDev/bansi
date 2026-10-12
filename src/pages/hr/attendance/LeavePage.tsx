import { useEffect, useState } from 'react';
import { Input, Loader } from 'rsuite';
import moment from 'moment';
import { postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { fullName, type EmployeeRef } from '../hrApi';
import { HrAvatar } from '../hrKit';
import { PAID_LEAVE, dayLabel, leaveTone, usePostData, type LeaveBalance, type LeaveType } from './attendanceApi';
import { SearchBox, SettingModal, YearStepper } from '../../account/setting/settingKit';

/** status ຂອງ tbl_leave_request — 1 ລໍຖ້າ, 2 ອະນຸມັດ, 3 ປະຕິເສດ, 4 ພະນັກງານຍົກເລີກ (ສີຢືມ .att-state) */
const PENDING = 1;
const LEAVE_STATUSES: Record<number, { label: string; tone: string; icon: string }> = {
  1: { label: 'leaveStatusPending', tone: 'is-late', icon: 'fa-hourglass-half' },
  2: { label: 'leaveStatusApproved', tone: 'is-present', icon: 'fa-circle-check' },
  3: { label: 'leaveStatusRejected', tone: 'is-absent', icon: 'fa-circle-xmark' },
  4: { label: 'leaveStatusCancelled', tone: 'is-off', icon: 'fa-ban' },
};

type LeaveRequest = {
  _uuid: number;
  employee_id: number;
  /** null = ຄຳຂໍເກົ່າກ່ອນມີປະເພດ — ສະແດງຕາມ leave_type (ໄດ້/ບໍ່ໄດ້ເງິນເດືອນ) */
  leave_type_id: number | null;
  /** status ຂອງ tbl_attendance ທີ່ບັນທຶກຕອນອະນຸມັດ: 2 ໄດ້ເງິນເດືອນ, 3 ບໍ່ໄດ້ */
  leave_type: number;
  type: Pick<LeaveType, '_uuid' | 'name' | 'paid' | 'max_per_year' | 'max_per_request'> | null;
  start_date: string;
  end_date: string;
  /** ມື້ເຮັດວຽກໃນຊ່ວງ (ຕອນຂໍ) / ມື້ທີ່ບັນທຶກແທ້ (ຕອນອະນຸມັດ) */
  days: number;
  reason: string;
  status: number;
  review_note: string | null;
  reviewedAt: string | null;
  createdAt: string;
  employee: (EmployeeRef & { position?: { _uuid: number; position_name: string } | null }) | null;
};

type LeaveData = {
  year: string;
  data: LeaveRequest[];
  summary: { pending: number; approved: number; rejected: number; cancelled: number };
};

const rangeLabel = (row: LeaveRequest) =>
  row.start_date === row.end_date ? dayLabel(row.start_date) : `${dayLabel(row.start_date)} – ${dayLabel(row.end_date)}`;

/** ຊື່ປະເພດຂອງຄຳຂໍ + ສີຕາມ ໄດ້/ບໍ່ໄດ້ເງິນເດືອນ (ຄຳຂໍເກົ່າບໍ່ມີປະເພດ = ປ້າຍ ໄດ້/ບໍ່ໄດ້ເງິນເດືອນ) */
const typeLabel = (row: LeaveRequest, t: (key: string) => string) => {
  const meta = leaveTone(row.type ? row.type.paid : row.leave_type === PAID_LEAVE);
  return { tone: meta.tone, label: row.type?.name ?? t(meta.label) };
};

/**
 * ປະເພດການລາ (ບັດ) + ມື້ທີ່ເຫຼືອຂອງພະນັກງານໃນປີ (ບໍ່ນັບຄຳຂໍນີ້) — ຄຳຂໍນີ້ເກີນຂີດຈຳກັດ = ບັດສີແດງ
 * (ຍັງອະນຸມັດໄດ້ — HR ເລືອກ ໄດ້ເງິນເດືອນ / ຕັດເງິນເດືອນ ຂ້າງລຸ່ມ)
 */
const LeaveTypeTiles = ({ balances, days, value, onChange }: {
  balances: LeaveBalance[];
  days: number;
  value: number | null;
  onChange: (value: number) => void;
}) => {
  const t = useT();
  return (
    <div className="lv-review-types" role="radiogroup">
      {balances.map((b) => {
        const meta = leaveTone(b.paid);
        const on = value === b._uuid;
        const overRequest = !!b.max_per_request && days > b.max_per_request;
        const overYear = b.remaining !== null && days > b.remaining;
        return (
          <button
            key={b._uuid} type="button" role="radio" aria-checked={on}
            className={`lv-type ${meta.tone}${on ? ' is-on' : ''}${overRequest || overYear ? ' is-over' : ''}`} onClick={() => onChange(b._uuid)}
          >
            <span className="lv-type-icon"><i className={`fa-solid ${meta.icon}`} /></span>
            <span>
              <b>{b.name}</b>
              <small>
                {t(meta.label)} · {b.max_per_year
                  ? `${t('lvBalanceLeft')} ${b.remaining} / ${b.max_per_year} ${t('leaveDayUnit')}`
                  : t('lvTypeUnlimited')}
              </small>
              {(overRequest || overYear) && (
                <small className="lv-type-over">
                  <i className="fa-solid fa-triangle-exclamation" />{' '}
                  {overRequest ? `${t('lvOverRequest')} ${b.max_per_request} ${t('leaveDayUnit')}` : t('lvOverYear')}
                </small>
              )}
            </span>
            <i className={`lv-type-check fa-${on ? 'solid fa-circle-check' : 'regular fa-circle'}`} />
          </button>
        );
      })}
    </div>
  );
};

/**
 * ອະນຸມັດ (ເລືອກປະເພດຄືນໄດ້) / ປະຕິເສດ + ໝາຍເຫດຂອງ HR — ສະແດງຄຳຂໍເປັນບັດ: ພະນັກງານ, ຊ່ວງວັນທີ / ຈຳນວນມື້ / ວັນສົ່ງ,
 * ເຫດຜົນ; ປຸ່ມຢືນຢັນເປັນ "ອະນຸມັດ" (ຂຽວ) ຫຼື "ປະຕິເສດ" (ແດງ)
 */
/** ຄຳຂໍນີ້ເກີນຂີດຈຳກັດຂອງປະເພດ (ຕໍ່ຄັ້ງ / ມື້ທີ່ເຫຼືອຂອງປີ) */
const isOver = (b: LeaveBalance | undefined, days: number) =>
  !!b && ((!!b.max_per_request && days > b.max_per_request) || (b.remaining !== null && days > b.remaining));

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

const ReviewModal = ({ row, mode, onClose, onSaved }: {
  row: LeaveRequest;
  mode: 'approve' | 'reject';
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const approve = mode === 'approve';
  const [leaveTypeId, setLeaveTypeId] = useState<number | null>(row.leave_type_id);
  /** null = ກຳລັງໂຫຼດ */
  const [balances, setBalances] = useState<LeaveBalance[] | null>(approve ? null : []);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  /** null = ຕາມຄ່າເລີ່ມຕົ້ນ (ປະເພດໄດ້ເງິນເດືອນ ແລະ ບໍ່ເກີນສິດ = ໄດ້, ອື່ນໆ = ຕັດ); ປ່ຽນປະເພດ = ກັບຄ່າເລີ່ມຕົ້ນ */
  const [paidPick, setPaidPick] = useState<boolean | null>(null);
  const employee = row.employee;
  const state = LEAVE_STATUSES[row.status] ?? LEAVE_STATUSES[PENDING];
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
        : await putApi(`/leave/reject/${id}`, { note: note.trim() });
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
      title={t(approve ? 'leaveApprove' : 'leaveReject')}
      hint={t(approve ? 'leaveApproveHint' : 'leaveRejectHint')}
      icon={approve ? 'fa-circle-check' : 'fa-circle-xmark'}
      saving={saving}
      onClose={onClose}
      onSubmit={submit}
      className={`lv-review-modal${approve ? '' : ' is-reject'}`}
      submit={{ label: t(approve ? 'leaveApprove' : 'leaveReject'), icon: approve ? 'fa-check' : 'fa-xmark', danger: !approve }}
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

        {approve && (
          <div className="lv-review-field">
            <label>{t('leaveType')}</label>
            {!balances ? (
              <Loader size="sm" content={t('loadingDots')} />
            ) : balances.length ? (
              <LeaveTypeTiles
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
  const [reviewing, setReviewing] = useState<{ row: LeaveRequest; mode: 'approve' | 'reject' } | null>(null);
  const { data, loading, reload } = usePostData<LeaveData>('/leave/fetch', { year, status });

  const rows = data?.data ?? [];
  const summary = data?.summary ?? { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) =>
    !q || `${r.employee?.emp_code ?? ''} ${fullName(r.employee)} ${r.reason}`.toLowerCase().includes(q));
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
                      const state = LEAVE_STATUSES[r.status] ?? LEAVE_STATUSES[PENDING];
                      const pending = r.status === PENDING;
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
                          <td className="att-note">{r.reason}</td>
                          <td>
                            <span className={`att-state ${state.tone}`}><i className={`fa-solid ${state.icon}`} /> {t(state.label)}</span>
                            {r.review_note && <small className="acc-gl-ref d-block">{r.review_note}</small>}
                          </td>
                          <td className="lv-actions">
                            {pending && canEdit && (
                              <>
                                <button type="button" className="lv-act is-approve" onClick={() => setReviewing({ row: r, mode: 'approve' })}>
                                  <i className="fa-solid fa-check" /> {t('leaveApprove')}
                                </button>
                                <button type="button" className="lv-act is-reject" title={t('leaveReject')} onClick={() => setReviewing({ row: r, mode: 'reject' })}>
                                  <i className="fa-solid fa-xmark" />
                                </button>
                              </>
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
