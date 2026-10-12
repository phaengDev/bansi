import { useState } from 'react';
import { Input, Loader } from 'rsuite';
import moment from 'moment';
import { putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { fullName, type EmployeeRef } from '../hrApi';
import { HrAvatar } from '../hrKit';
import { dayLabel, usePostData } from './attendanceApi';
import { SearchBox, SettingModal, YearStepper } from '../../account/setting/settingKit';

/** status ຂອງ tbl_attendance_request — 1 ລໍຖ້າ, 2 ອະນຸມັດ, 3 ປະຕິເສດ, 4 ພະນັກງານຍົກເລີກ (ຄືກັບຄຳຂໍລາພັກ) */
const PENDING = 1;
const STATUSES: Record<number, { label: string; tone: string; icon: string }> = {
  1: { label: 'leaveStatusPending', tone: 'is-late', icon: 'fa-hourglass-half' },
  2: { label: 'leaveStatusApproved', tone: 'is-present', icon: 'fa-circle-check' },
  3: { label: 'leaveStatusRejected', tone: 'is-absent', icon: 'fa-circle-xmark' },
  4: { label: 'leaveStatusCancelled', tone: 'is-off', icon: 'fa-ban' },
};

type Correction = {
  _uuid: number;
  employee_id: number;
  work_date: string;
  /** ເວລາທີ່ຂໍ "HH:mm" — null = ໃຊ້ເວລາທີ່ສະແກນໄວ້ */
  check_in: string | null;
  check_out: string | null;
  reason: string;
  status: number;
  review_note: string | null;
  createdAt: string;
  /** ເວລາທີ່ບັນທຶກໄວ້ໃນມື້ນັ້ນ (ທຽບກັບເວລາທີ່ຂໍ) */
  recorded_in: string | null;
  recorded_out: string | null;
  employee: (EmployeeRef & { position?: { _uuid: number; position_name: string } | null }) | null;
};

type CorrectionData = {
  year: string;
  data: Correction[];
  summary: { pending: number; approved: number; rejected: number; cancelled: number };
};

/** ເວລາທີ່ຂໍ (ຕົວເຂັ້ມ) ທຽບກັບທີ່ສະແກນໄວ້ — ບໍ່ໄດ້ຂໍ = ໃຊ້ທີ່ສະແກນໄວ້ (ຈາງ) */
const TimePair = ({ requested, recorded }: { requested: string | null; recorded: string | null }) =>
  requested ? (
    <span>
      <b>{requested}</b>
      {recorded && recorded !== requested && <small className="acc-gl-ref"> ({recorded})</small>}
    </span>
  ) : (
    <span className="acc-gl-ref">{recorded ?? '—'}</span>
  );

/** ອະນຸມັດ / ປະຕິເສດ + ໝາຍເຫດຂອງ HR */
const ReviewModal = ({ row, mode, onClose, onSaved }: {
  row: Correction;
  mode: 'approve' | 'reject';
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const approve = mode === 'approve';
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const employee = row.employee;
  const state = STATUSES[row.status] ?? STATUSES[PENDING];

  const submit = async () => {
    try {
      setSaving(true);
      const id = btoa(String(row._uuid));
      const res = await putApi(`/correction/${approve ? 'approve' : 'reject'}/${id}`, { note: note.trim() });
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
      hint={t(approve ? 'corrApproveHint' : 'corrRejectHint')}
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
            <small>{t('corrDate')}</small>
            <b>{dayLabel(row.work_date)}</b>
          </span>
          <span>
            <i className="fa-solid fa-right-to-bracket" />
            <small>{t('attCheckIn')}</small>
            <b><TimePair requested={row.check_in} recorded={row.recorded_in} /></b>
          </span>
          <span>
            <i className="fa-solid fa-right-from-bracket" />
            <small>{t('attCheckOut')}</small>
            <b><TimePair requested={row.check_out} recorded={row.recorded_out} /></b>
          </span>
        </div>

        <div className="lv-review-reason">
          <small><i className="fa-solid fa-quote-left" /> {t('leaveReason')}</small>
          <p>{row.reason || '—'}</p>
        </div>

        <div className="lv-review-field">
          <label>{t('leaveReviewNote')}</label>
          <Input as="textarea" rows={3} value={note} onChange={setNote} maxLength={255} placeholder={t('leaveReviewNotePlaceholder')} />
        </div>
      </div>
    </SettingModal>
  );
};

/**
 * ແຈ້ງລືມສະແກນ — ພະນັກງານສົ່ງຜ່ານ app ມືຖື (POST /correction/me) ພ້ອມເວລາເຂົ້າ/ອອກທີ່ລືມ; HR ອະນຸມັດ = ບັນທຶກເວລາລົງການເຂົ້າວຽກ
 * (ຄິດມາຊ້າ / ອອກກ່ອນ ໃໝ່), ປະຕິເສດ = ບໍ່ບັນທຶກຫຍັງ. ທັງສອງແຈ້ງເຕືອນພະນັກງານໃນ app. ຕ້ອງມີສິດແກ້ໄຂ (backend ກວດຊ້ຳ)
 */
const CorrectionPage = () => {
  const t = useT();
  const [year, setYear] = useState(moment().year());
  /** 0 = ທັງໝົດ */
  const [status, setStatus] = useState(PENDING);
  const [keyword, setKeyword] = useState('');
  const [reviewing, setReviewing] = useState<{ row: Correction; mode: 'approve' | 'reject' } | null>(null);
  const { data, loading, reload } = usePostData<CorrectionData>('/correction/fetch', { year, status });

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
            <YearStepper year={year} onChange={setYear} max={moment().year()} />
          </div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
          </div>
        </div>
      </div>
      <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('corrNote')}</p>

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
            <div className="acc-class-empty"><i className="fa-solid fa-fingerprint" /><p>{t('noData')}</p></div>
          ) : (
            <div className="acc-gl-group">
              <div className="acc-rp-scroll">
                <table className="acc-gl-table hr-table att-table">
                  <thead>
                    <tr>
                      <th>{t('hrEmployee')}</th>
                      <th>{t('corrDate')}</th>
                      <th>{t('attCheckIn')}</th>
                      <th>{t('attCheckOut')}</th>
                      <th>{t('leaveReason')}</th>
                      <th>{t('status')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const state = STATUSES[r.status] ?? STATUSES[PENDING];
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
                          <td>
                            <b>{dayLabel(r.work_date)}</b>
                            <small className="acc-gl-ref d-block">{t('leaveRequestedAt')} {moment(r.createdAt).format('DD/MM/YYYY HH:mm')}</small>
                          </td>
                          <td><TimePair requested={r.check_in} recorded={r.recorded_in} /></td>
                          <td><TimePair requested={r.check_out} recorded={r.recorded_out} /></td>
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

export default CorrectionPage;
