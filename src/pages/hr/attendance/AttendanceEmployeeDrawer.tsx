import { useEffect, useRef, useState } from 'react';
import { Drawer, Loader } from 'rsuite';
import { deleteApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import { dayLabel, editableState, periodLabel, usePostData, type AttendanceEmployee, type EmployeeMonthData } from './attendanceApi';
import { AttendanceDayTable, AttendanceSummary } from './attendanceKit';
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
            <AttendanceSummary summary={s} />
            <AttendanceDayTable days={data.days} grace={data.grace} focusDate={focusDate} focusRef={focusRef}
              onRowClick={(day) => (canChange && editableState(day.state) ? () => setEditing(day) : null)}
              actions={(day) => (
                <>
                  <button type="button" className="acc-gl-act" disabled={!(canChange && editableState(day.state))} title={t(day.record ? 'edit' : 'attAdd')} onClick={() => setEditing(day)}>
                    <i className={`fa-solid ${day.record ? 'fa-pen' : 'fa-plus'}`} />
                  </button>
                  <button type="button" className="acc-gl-act is-danger" disabled={!day.record || !canDelete || data.locked} title={t('delete')} onClick={() => remove(day)}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </>
              )}
            />
          </div>
        )}
      </Drawer.Body>

      {editing && data && (
        <AttendanceForm employee={employee} date={editing.date} record={editing.record} workStart={data.work_start} workEnd={data.work_end} breakStart={data.break_start} breakEnd={data.break_end}
          onClose={() => setEditing(null)} onSaved={changed}
        />
      )}
    </Drawer>
  );
};

export default AttendanceEmployeeDrawer;
