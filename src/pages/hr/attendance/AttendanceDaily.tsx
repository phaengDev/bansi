import { useState } from 'react';
import { DatePicker, Loader, SelectPicker } from 'rsuite';
import moment from 'moment';
import { deleteApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canDelete, canEdit } from '../../../utils/localStorage';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import {
  DAY_STATES, dayLabel, editableState, minutesText, toApiDay, usePostData, weekdayKey,
  type DailyData, type DailyRow, type DayState,
} from './attendanceApi';
import { ClockCell, LateCell, StatePill } from './attendanceKit';
import AttendanceForm from './AttendanceForm';
import { SearchBox } from '../../account/setting/settingKit';

type Filter = 'all' | 'in' | 'late' | 'absent' | 'leave';
const FILTERS: Record<Filter, DayState[]> = {
  all: [],
  in: ['present', 'late', 'offwork'],
  late: ['late'],
  absent: ['absent', 'pending'],
  leave: ['leave', 'unpaid'],
};

/**
 * ການເຂົ້າວຽກລາຍວັນ — ທຸກຄົນທີ່ເປັນພະນັກງານໃນມື້ນັ້ນ: ເວລາເຂົ້າ-ອອກ, ມາຊ້າ/ອອກກ່ອນ, ສະຖານະ.
 * ກົດແຖວ = ບັນທຶກ/ແກ້ໄຂແທນ (ເດືອນທີ່ຈ່າຍເງິນເດືອນແລ້ວ ແກ້ບໍ່ໄດ້)
 */
const AttendanceDaily = () => {
  const t = useT();
  const today = toApiDay(new Date());
  const [date, setDate] = useState(today);
  const [department, setDepartment] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<DailyRow | null>(null);
  const { data, loading, reload } = usePostData<DailyData>('/attendance/daily', { date });

  const rows = data?.data ?? [];
  const count = (...states: DayState[]) => rows.filter((r) => states.includes(r.state)).length;
  const departments = [...new Map(rows.filter((r) => r.employee.department).map((r) => [r.employee.department_id, r.employee.department!])).values()];
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) =>
    (filter === 'all' || FILTERS[filter].includes(r.state))
    && (!department || r.employee.department_id === department)
    && (!q || `${r.employee.emp_code} ${fullName(r.employee)} ${r.record?.note ?? ''}`.toLowerCase().includes(q)));
  const canChange = !!data && !data.locked && canEdit;
  const shift = (days: number) => setDate(moment(date).add(days, 'day').format('YYYY-MM-DD'));

  const remove = (row: DailyRow) =>
    Notific.confirm(`${t('attDeleteConfirm')} ${fullName(row.employee)} ${dayLabel(date)}`, async () => {
      try {
        await deleteApi(`/attendance/${btoa(String(row.record!._uuid))}`);
        Notific.success('acsDeleted');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  const exportRows = () => {
    exportExcel(shown.map((r) => ({
      [t('hrEmployeeCode')]: r.employee.emp_code,
      [t('hrEmployee')]: fullName(r.employee),
      [t('hrDepartment')]: r.employee.department?.depart_name ?? '',
      [t('attCheckIn')]: r.record?.check_in_time ?? '',
      [t('attCheckOut')]: r.record?.check_out_time ?? '',
      [t('attLateMinutes')]: r.record?.late_minutes ?? 0,
      [t('attEarlyMinutes')]: r.record?.early_minutes ?? 0,
      [t('status')]: t(DAY_STATES[r.state].label),
      [t('attNote')]: r.record?.note ?? '',
    })), `attendance_${date}`, `${t('attDaily')} ${dayLabel(date)}`);
  };

  const present = count('present', 'late', 'offwork');
  const filters: { key: Filter; label: string; value: number }[] = [
    { key: 'all', label: 'all', value: rows.length },
    { key: 'in', label: 'attStatePresent', value: present },
    { key: 'late', label: 'attStateLate', value: count('late') },
    { key: 'absent', label: date === today ? 'attAbsentOrPending' : 'attStateAbsent', value: count('absent', 'pending') },
    { key: 'leave', label: 'attStateLeave', value: count('leave', 'unpaid') },
  ];

  return (
    <div className="acc-rp att-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="att-nav">
            <button type="button" className="acc-rp-btn" aria-label={t('previous')} onClick={() => shift(-1)}><i className="fa-solid fa-chevron-left" /></button>
            <DatePicker value={moment(date).toDate()} oneTap format="dd/MM/yyyy" cleanable={false} className="att-nav-picker"
              shouldDisableDate={(d) => moment(d).isAfter(moment(), 'day')} onChange={(d) => d && setDate(toApiDay(d))}
            />
            <button type="button" className="acc-rp-btn" aria-label={t('next')} disabled={date >= today} onClick={() => shift(1)}><i className="fa-solid fa-chevron-right" /></button>
            {date !== today && <button type="button" className="acc-rp-btn" onClick={() => setDate(today)}>{t('today')}</button>}
            <span className="att-nav-day">{t(weekdayKey(date))}</span>
          </div>
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!shown.length}><i className="fa-solid fa-file-excel" /> Excel</button>
          </div>
        </div>
      </div>

      {data && (data.holiday || !data.workday) && (
        <p className="acc-bg-note is-warn"><i className="fa-solid fa-mug-hot" /> {data.holiday ? `${t('attHoliday')}: ${data.holiday}` : t('attWeeklyDayOff')}</p>
      )}
      {data?.locked && <p className="acc-bg-note is-warn"><i className="fa-solid fa-lock" /> {t('attLocked')}</p>}

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <div className="acc-rp-kpis">
            <div className="acc-rp-kpi is-main">
              <small>{t('attStatePresent')}</small>
              <b>{present} / {rows.length}</b>
              <em>{rows.length ? Math.round((present / rows.length) * 100) : 0}% · {t('hrCompanyWorkStart')} {data.work_start}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('attStateLate')}</small>
              <b className={count('late') ? 'att-tone-late' : ''}>{count('late')}</b>
              <em className="is-flat">
                {minutesText(rows.reduce((n, r) => n + (r.state === 'late' ? r.record?.late_minutes ?? 0 : 0), 0), t)}
                {data.grace ? ` · ${t('payGraceShort')} ${data.grace} ${t('attMin')}` : ''}
              </em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('attStateAbsent')}</small>
              <b className={count('absent') ? 'is-out' : ''}>{count('absent')}</b>
              <em className="is-flat">{count('pending') ? `${count('pending')} ${t('attStatePending')}` : t('attNoPending')}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('attStateLeave')}</small>
              <b>{count('leave', 'unpaid')}</b>
              <em className="is-flat">{count('unpaid')} {t('attStateUnpaid')}</em>
            </div>
          </div>

          {/* ສະຖານະ (ຊ້າຍ) · ພະແນກ + ຄົ້ນຫາ (ຂວາ) */}
          <div className="att-toolbar">
            <div className="acc-type-segment" role="tablist">
              {filters.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'is-active' : ''} onClick={() => setFilter(f.key)}>
                  {t(f.label)} <em>{f.value}</em>
                </button>
              ))}
            </div>
            <div className="att-toolbar-tools">
              <SelectPicker block className="att-dept" data={departments.map((d) => ({ value: d._uuid, label: d.depart_name }))}
                value={department} onChange={setDepartment} placeholder={t('hrAllDepartments')} searchable={false} placement="bottomEnd"
              />
              <SearchBox value={keyword} onChange={setKeyword} placeholder={t('search')} />
            </div>
          </div>

          {!shown.length ? (
            <div className="acc-class-empty"><i className="fa-solid fa-user-clock" /><p>{t('noData')}</p></div>
          ) : (
            <div className="acc-gl-group">
              <div className="acc-rp-scroll">
                <table className="acc-gl-table hr-table att-table">
                  <thead>
                    <tr>
                      <th>{t('hrEmployee')}</th>
                      <th>{t('attCheckIn')}</th>
                      <th>{t('attCheckOut')}</th>
                      <th>{t('attLateEarly')}</th>
                      <th>{t('status')}</th>
                      <th>{t('attNote')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const editable = canChange && editableState(r.state);
                      return (
                        <tr key={r.employee._uuid} className={editable ? 'is-click' : ''} onClick={() => editable && setEditing(r)}>
                          <td>
                            <span className="hr-person">
                              <HrAvatar url={r.employee.profile_url} name={r.employee.first_name} />
                              <span>
                                <b>{fullName(r.employee)}</b>
                                <small className="acc-gl-ref">{r.employee.emp_code}{r.employee.department ? ` · ${r.employee.department.depart_name}` : ''}</small>
                              </span>
                            </span>
                          </td>
                          <td><ClockCell record={r.record} side="in" /></td>
                          <td><ClockCell record={r.record} side="out" /></td>
                          <td><LateCell record={r.record} grace={data.grace} /></td>
                          <td><StatePill state={r.state} /></td>
                          <td className="att-note">{r.record?.note || <span className="acc-gl-ref">—</span>}</td>
                          <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="acc-gl-act" disabled={!editable} title={t(r.record ? 'edit' : 'attAdd')} onClick={() => setEditing(r)}>
                              <i className={`fa-solid ${r.record ? 'fa-pen' : 'fa-plus'}`} />
                            </button>
                            <button type="button" className="acc-gl-act is-danger" disabled={!r.record || !canDelete || data.locked} title={t('delete')} onClick={() => remove(r)}>
                              <i className="fa-solid fa-trash" />
                            </button>
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

      {editing && data && (
        <AttendanceForm employee={editing.employee} date={date} record={editing.record} workStart={data.work_start} workEnd={data.work_end}
          onClose={() => setEditing(null)} onSaved={reload}
        />
      )}
    </div>
  );
};

export default AttendanceDaily;
