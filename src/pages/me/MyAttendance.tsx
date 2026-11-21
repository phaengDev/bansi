import { useState } from 'react';
import { Loader } from 'rsuite';
import { useT } from '../../context/LanguageContext';
import { toPeriod, useGetData, type DayState } from '../hr/attendance/attendanceApi';
import { AttendanceDayTable, AttendanceSummary, MonthStepper, StateLegend } from '../hr/attendance/attendanceKit';
import type { MyAttendanceData } from './meApi';

const LEGEND: DayState[] = ['present', 'late', 'absent', 'leave', 'unpaid', 'offwork', 'off', 'pending'];

/**
 * ການເຂົ້າ-ອອກວຽກຂອງຕົນເອງເປັນເດືອນ — ສະຫຼຸບ + ທຸກມື້ (ເວລາເຂົ້າ/ອອກ, ໄລຍະຈາກບໍລິສັດ, ມາຊ້າ/ອອກກ່ອນ, ໝາຍເຫດ).
 * ເບິ່ງຢ່າງດຽວ — ສະແກນໃນ app ມືຖື (GPS/QR); ເວລາຜິດ = ແຈ້ງລືມສະແກນໃນ "ຄຳຮ້ອງ"
 */
const MyAttendance = () => {
  const t = useT();
  const [period, setPeriod] = useState(toPeriod(new Date()));
  const { data, loading, reload } = useGetData<MyAttendanceData>('/attendance/me', { month: period });

  return (
    <div className="acc-rp att-page my-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <MonthStepper period={period} onChange={setPeriod} />
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
          </div>
        </div>
      </div>
      <p className="my-phone-note"><i className="fa-solid fa-mobile-screen-button" /> {t('myScanOnPhone')}</p>
      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <AttendanceSummary summary={data.summary} />
          <StateLegend states={LEGEND} />
          <div className="acc-gl-group">
            <div className="acc-rp-scroll">
              <AttendanceDayTable days={data.days} grace={data.grace ?? 0} focusDate={data.today.date} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAttendance;
