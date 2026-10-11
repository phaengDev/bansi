import { useEffect, useRef, useState } from 'react';
import { Drawer, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import {
  dayLabel, editableState, minutesText, periodLabel, usePostData, weekdayKey,
  type AttendanceEmployee, type EmployeeMonthData,
} from './attendanceApi';
import { ClockCell, LateCell, StatePill } from './attendanceKit';
import AttendanceForm from './AttendanceForm';

type Day = EmployeeMonthData['days'][number];

/**
 * ການເຂົ້າວຽກຂອງ 1 ຄົນ ທັງເດືອນ (Drawer ຂວາ) — ສະຫຼຸບ + ທຸກມື້ ພ້ອມເວລາ, ມາຊ້າ, ໝາຍເຫດ; ແກ້ໄຂ / ລຶບ ລາຍມື້.
 * focusDate = ມື້ທີ່ກົດມາຈາກຕາລາງເດືອນ (ເລື່ອນມາໃຫ້ເຫັນ ແລະ ໄຮໄລ້)
 */
const AttendanceEmployeeDrawer = ({ employee, period, focusDate, onClose, onChanged }: {
  employee: AttendanceEmployee;
  period: string;
  focusDate?: string;
  onClose: () => void;
  onChanged: () => void;
}) => {
  const t = useT();
  const focusRef = useRef<HTMLTableRowElement>(null);
  const [editing, setEditing] = useState<Day | null>(null);
  const { data, loading, reload } = usePostData<EmployeeMonthData>('/attendance/records', { employee_id: employee._uuid, month: period });

  useEffect(() => {
    if (data && focusRef.current) focusRef.current.scrollIntoView({ block: 'center' });
  }, [data]);

  const changed = () => {
    reload();
    onChanged();
  };

  const remove = (day: Day) =>
    Notific.confirm(`${t('attDeleteConfirm')} ${fullName(employee)} ${dayLabel(day.date)}`, async () => {
      try {
        await deleteApi(`/attendance/${btoa(String(day.record!._uuid))}`);
        Notific.success('acsDeleted');
        changed();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  const s = data?.summary;
  const canChange = !!data && !data.locked && canEdit;

  return (
    <Drawer open onClose={onClose} size="md" placement="right" className="acc-stmt-drawer att-drawer">
      <Drawer.Header>
        <div className="acc-stmt-head">
          <HrAvatar url={employee.profile_url} name={employee.first_name} />
          <span className="acc-stmt-title">
            <Drawer.Title>{fullName(employee)}</Drawer.Title>
            <small>{employee.emp_code}{employee.department ? ` · ${employee.department.depart_name}` : ''} · {periodLabel(period)}</small>
          </span>
        </div>
      </Drawer.Header>
      <Drawer.Body>
        {!data || !s ? (
          <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
        ) : (
          <div className={`att-drawer-body${loading ? ' is-refreshing' : ''}`}>
            {data.locked && <p className="acc-bg-note is-warn"><i className="fa-solid fa-lock" /> {t('attLocked')}</p>}
            <div className="att-summary">
              <span><b>{s.present_days}</b><small>{t('attPresentDays')}</small></span>
              <span className="is-late"><b>{s.late_days}</b><small>{t('attLateDays')} · {minutesText(s.late_minutes + s.early_minutes, t)}</small></span>
              <span className="is-absent"><b>{s.absent_days}</b><small>{t('attAbsentDays')}</small></span>
              <span className="is-leave"><b>{s.leave_days + s.unpaid_days}</b><small>{t('attLeaveDays')}{s.unpaid_days ? ` · ${s.unpaid_days} ${t('attStateUnpaid')}` : ''}</small></span>
              <span><b>{s.employed_days}/{s.workdays}</b><small>{t('attWorkdays')}</small></span>
            </div>
            <table className="acc-gl-table att-days">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('status')}</th>
                  <th>{t('attCheckIn')}</th>
                  <th>{t('attCheckOut')}</th>
                  <th>{t('attLateEarly')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => {
                  const editable = canChange && editableState(day.state);
                  const focused = day.date === focusDate;
                  return (
                    <tr key={day.date} ref={focused ? focusRef : undefined}
                      className={`${day.workday ? '' : 'is-off'}${focused ? ' is-focus' : ''}${editable ? ' is-click' : ''}`}
                      onClick={() => editable && setEditing(day)}
                    >
                      <td>
                        <b>{moment(day.date).format('DD/MM')}</b>
                        <small className="acc-gl-ref">{day.holiday ?? t(weekdayKey(day.date))}</small>
                      </td>
                      <td>
                        <StatePill state={day.state} />
                        {day.record?.note && <small className="acc-gl-ref att-note-line"><i className="fa-regular fa-note-sticky" /> {day.record.note}</small>}
                      </td>
                      <td><ClockCell record={day.record} side="in" /></td>
                      <td><ClockCell record={day.record} side="out" /></td>
                      <td><LateCell record={day.record} grace={data.grace} /></td>
                      <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="acc-gl-act" disabled={!editable} title={t(day.record ? 'edit' : 'attAdd')} onClick={() => setEditing(day)}>
                          <i className={`fa-solid ${day.record ? 'fa-pen' : 'fa-plus'}`} />
                        </button>
                        <button type="button" className="acc-gl-act is-danger" disabled={!day.record || !canDelete || data.locked} title={t('delete')} onClick={() => remove(day)}>
                          <i className="fa-solid fa-trash" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Drawer.Body>

      {editing && data && (
        <AttendanceForm employee={employee} date={editing.date} record={editing.record} workStart={data.work_start} workEnd={data.work_end}
          onClose={() => setEditing(null)} onSaved={changed}
        />
      )}
    </Drawer>
  );
};

export default AttendanceEmployeeDrawer;
