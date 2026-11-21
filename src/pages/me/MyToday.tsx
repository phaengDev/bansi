import { Loader } from 'rsuite';
import moment from 'moment';
import { useT } from '../../context/LanguageContext';
import { fullName, workTimeText } from '../hr/hrApi';
import { HrAvatar } from '../hr/hrKit';
import { dayLabel, toPeriod, useGetData, weekdayKey } from '../hr/attendance/attendanceApi';
import { AttendanceSummary, LateCell, StatePill } from '../hr/attendance/attendanceKit';
import { useMyEmployee } from '../account/accountMenus';
import { kip } from '../hr/payroll/payrollApi';
import { ADV_PENDING } from '../hr/payroll/advanceApi';
import { pendingApprovals, unreadNotifications, useMyInbox } from './meInbox';
import type { MyAdvanceData, MyAttendanceData, MyCorrectionData, MyHolidays, MyLeaveData, MyOpen, MyPayPreview } from './meApi';

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
const MyToday = ({ onOpen }: { onOpen: MyOpen }) => {
  const t = useT();
  const me = useMyEmployee();
  const { data } = useGetData<MyAttendanceData>('/attendance/me', { month: toPeriod(new Date()) });
  const { data: holidays } = useGetData<MyHolidays>('/holiday/me', { year: moment().year() });
  const { data: leaves } = useGetData<MyLeaveData>('/leave/me', { year: moment().year() });
  const { data: corrections } = useGetData<MyCorrectionData>('/correction/me', { year: moment().year() });
  const { data: advances } = useGetData<MyAdvanceData>('/advance/me');
  const { data: pay } = useGetData<MyPayPreview>('/payroll/me/preview', { month: toPeriod(new Date()) });
  const inbox = useMyInbox();
  const waiting = pendingApprovals(inbox);
  const unread = unreadNotifications(inbox);

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

      {/* ລໍຂ້ອຍອະນຸມັດ / ແຈ້ງເຕືອນໃໝ່ — ກົດ = ເປີດ (ໜ້າຕ່າງ "ທີມ ແລະ ອະນຸມັດ" / "ແຈ້ງເຕືອນຂອງຂ້ອຍ") */}
      {(waiting > 0 || unread > 0) && (
        <div className="my-alerts">
          {waiting > 0 && (
            <button type="button" className="my-alert is-approve" onClick={() => onOpen('approvals')}>
              <i className="fa-solid fa-clipboard-check" />
              <span>{t('myTodayApprovals').replace('{n}', String(waiting))}</span>
              <i className="fa-solid fa-arrow-right" />
            </button>
          )}
          {unread > 0 && (
            <button type="button" className="my-alert is-inbox" onClick={() => onOpen('notifications')}>
              <i className="fa-solid fa-bell" />
              <span>{t('myTodayUnread').replace('{n}', String(unread))}</span>
              <i className="fa-solid fa-arrow-right" />
            </button>
          )}
        </div>
      )}

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
          <header><h3><i className="fa-solid fa-paper-plane" /> {t('myRequestsCard')}</h3></header>
          <ul className="my-requests">
            {[
              { key: 'leaves', icon: 'fa-plane-departure', label: 'myLeaves', action: 'myLeaveNew', pending: leaves?.summary?.pending },
              { key: 'corrections', icon: 'fa-fingerprint', label: 'myCorrections', action: 'myReport', pending: corrections?.summary?.pending },
              {
                key: 'advances', icon: 'fa-hand-holding-dollar', label: 'myAdvances', action: 'myAdvNew',
                pending: advances?.data?.filter((a) => a.status === ADV_PENDING).length,
                extra: advances && Number(advances.balance) > 0 ? `${t('advBalance')} ₭ ${kip(advances.balance)}` : undefined,
              },
            ].map((item) => (
              <li key={item.key}>
                <button type="button" className="my-request-open" onClick={() => onOpen(item.key)}>
                  <span className="my-request-icon"><i className={`fa-solid ${item.icon}`} /></span>
                  <span>
                    <b>{t(item.label)}</b>
                    <small>{item.pending ? `${item.pending} ${t('leaveStatusPending')}` : t('myNothingPending')}{item.extra ? ` · ${item.extra}` : ''}</small>
                  </span>
                  {!!item.pending && <em>{item.pending}</em>}
                </button>
                <button type="button" className="acc-rp-btn" onClick={() => onOpen(item.key, { action: 'new' })}>
                  <i className="fa-solid fa-plus" /> {t(item.action)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {pay?.line && (
          <section className="my-card">
            <header>
              <h3><i className="fa-solid fa-wallet" /> {t('myPayMonth')} {moment().format('MM/YYYY')}</h3>
              <button type="button" className="my-link" onClick={() => onOpen('pay')}>{t('myPaySeeSlip')} <i className="fa-solid fa-arrow-right" /></button>
            </header>
            <div className="my-pay-mini">
              <b>₭ {kip(pay.line.net)}</b>
              <small>{t(pay.status === 'paid' ? 'myPayPaid' : pay.status === 'draft' ? 'myPayDraft' : 'myPayEstimate')} · {t('payGross')} {kip(pay.line.gross)}</small>
            </div>
          </section>
        )}

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
