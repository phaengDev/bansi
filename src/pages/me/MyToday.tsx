import { Loader } from 'rsuite';
import moment from 'moment';
import { useT } from '../../context/LanguageContext';
import { fullName, workTimeText } from '../hr/hrApi';
import { HrAvatar } from '../hr/hrKit';
import { dayLabel, toPeriod, useGetData, weekdayKey } from '../hr/attendance/attendanceApi';
import { AttendanceSummary, LateCell, StatePill } from '../hr/attendance/attendanceKit';
import { useMyEmployee } from '../account/accountMenus';
import type { MyAttendanceData, MyHolidays } from './meApi';

/** ເວລາເຂົ້າ ຫຼື ອອກຂອງມື້ນີ້ — ໃຫຍ່ໆ ຄືບັດໃນ app ພະນັກງານ */
const TodayClock = ({ side, time, distance }: { side: 'in' | 'out'; time: string | null | undefined; distance: number | null | undefined }) => {
  const t = useT();
  return (
    <div className={`my-clock is-${side}`}>
      <span className="my-clock-icon"><i className={`fa-solid ${side === 'in' ? 'fa-right-to-bracket' : 'fa-right-from-bracket'}`} /></span>
      <span>
        <small>{t(side === 'in' ? 'attCheckIn' : 'attCheckOut')}</small>
        <b>{time ?? '--:--'}</b>
        <em>
          {time
            ? (distance !== null && distance !== undefined ? <><i className="fa-solid fa-location-dot" /> {distance} {t('hrMeters')}</> : <><i className="fa-solid fa-pen" /> {t('attByHr')}</>)
            : t('myNotScanned')}
        </em>
      </span>
    </div>
  );
};

/**
 * ມື້ນີ້ — ສະບາຍດີ + ຂໍ້ມູນຕົນເອງ, ເວລາເຂົ້າ-ອອກວຽກມື້ນີ້ (ເບິ່ງຢ່າງດຽວ — ສະແກນໃນມືຖື), ສະຫຼຸບເດືອນນີ້ ແລະ ວັນພັກທີ່ຈະມາເຖິງ
 */
const MyToday = ({ onOpen }: { onOpen: (key: string) => void }) => {
  const t = useT();
  const me = useMyEmployee();
  const { data } = useGetData<MyAttendanceData>('/attendance/me', { month: toPeriod(new Date()) });
  const { data: holidays } = useGetData<MyHolidays>('/holiday/me', { year: moment().year() });

  if (!data || !me) {
    return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;
  }

  const { today, company } = data;
  const todayState = data.days.find((day) => day.date === today.date)?.state;
  const record = today.record;
  const upcoming = (holidays?.data ?? []).filter((h) => h.holiday_date >= today.date).slice(0, 4);
  const daysUntil = (date: string) => moment(date).diff(moment(today.date), 'days');

  return (
    <div className="acc-rp my-page">
      <section className="my-hero">
        <HrAvatar url={me.profile_url} name={me.first_name} size="lg" />
        <div className="my-hero-text">
          <small>{t('myHello')}</small>
          <h2>{fullName(me)}</h2>
          <span>
            {me.emp_code}
            {me.position ? ` · ${me.position.position_name}` : ''}
            {me.department ? ` · ${me.department.depart_name}` : ''}
          </span>
        </div>
        <div className="my-hero-date">
          <b>{t(weekdayKey(today.date))}</b>
          <span>{dayLabel(today.date)}</span>
        </div>
      </section>

      <div className="my-grid">
        <section className="my-card my-today">
          <header>
            <h3><i className="fa-solid fa-sun" /> {t('myToday')}</h3>
            {today.holiday
              ? <span className="att-state is-off"><i className="fa-solid fa-umbrella-beach" /> {today.holiday}</span>
              : !today.workday
                ? <span className="att-state is-off"><i className="fa-solid fa-mug-hot" /> {t('myNotWorkday')}</span>
                : todayState && <StatePill state={todayState} />}
          </header>
          <div className="my-clock-pair">
            <TodayClock side="in" time={record?.check_in_time} distance={record?.in_distance} />
            <TodayClock side="out" time={record?.check_out_time} distance={record?.out_distance} />
          </div>
          {record && (record.late_minutes > 0 || record.early_minutes > 0) && (
            <div className="my-today-late"><LateCell record={record} grace={data.grace ?? 0} /></div>
          )}
          {company && (
            <p className="my-hours">
              <i className="fa-regular fa-clock" /> {t('myWorkHours')} {workTimeText(company.work_start, company.work_end, company.break_start, company.break_end, t('hrLunchBreak'))}
            </p>
          )}
          <p className="my-phone-note"><i className="fa-solid fa-mobile-screen-button" /> {t('myScanOnPhone')}</p>
        </section>

        <section className="my-card">
          <header>
            <h3><i className="fa-solid fa-chart-column" /> {t('myMonthSummary')}</h3>
            <button type="button" className="my-link" onClick={() => onOpen('attendance')}>
              {t('myOpenAttendance')} <i className="fa-solid fa-arrow-right" />
            </button>
          </header>
          <AttendanceSummary summary={data.summary} />
        </section>

        <section className="my-card">
          <header><h3><i className="fa-solid fa-umbrella-beach" /> {t('myUpcomingHolidays')}</h3></header>
          {!upcoming.length ? (
            <p className="my-empty">{t('myNoUpcomingHolidays')}</p>
          ) : (
            <ul className="my-holidays">
              {upcoming.map((h) => {
                const n = daysUntil(h.holiday_date);
                return (
                  <li key={h.holiday_date}>
                    <span className="my-holiday-date">
                      <b>{moment(h.holiday_date).format('DD')}</b>
                      <small>{moment(h.holiday_date).format('MM/YY')}</small>
                    </span>
                    <span>
                      <b>{h.name}</b>
                      <small>{t(weekdayKey(h.holiday_date))}</small>
                    </span>
                    <em>{n === 0 ? t('myToday') : n === 1 ? t('myTomorrow') : t('myInDays').replace('{n}', String(n))}</em>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default MyToday;
