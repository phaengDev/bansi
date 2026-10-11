import { useState } from 'react';
import { DatePicker, Loader, SelectPicker } from 'rsuite';
import moment from 'moment';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import {
  DAY_STATES, minutesText, periodLabel, toPeriod, usePostData,
  type AttendanceEmployee, type DayState, type MonthlyData,
} from './attendanceApi';
import { StateLegend } from './attendanceKit';
import AttendanceEmployeeDrawer from './AttendanceEmployeeDrawer';
import { SearchBox } from '../../account/setting/settingKit';

const LEGEND: DayState[] = ['present', 'late', 'absent', 'leave', 'unpaid', 'offwork', 'off', 'pending'];

/**
 * ການເຂົ້າວຽກລາຍເດືອນ — ຕາລາງ ພະນັກງານ × ວັນ (ສີຕາມສະຖານະ) + ສະຫຼຸບ ມາ / ຊ້າ / ຂາດ / ລາ.
 * ກົດຊື່ ຫຼື ຕາລາງ = ລາຍລະອຽດຂອງຄົນນັ້ນທັງເດືອນ (ແກ້ໄຂໄດ້ຈາກນັ້ນ)
 */
const AttendanceMonthly = () => {
  const t = useT();
  const current = toPeriod(new Date());
  const [period, setPeriod] = useState(current);
  const [department, setDepartment] = useState<number | null>(null);
  const [keyword, setKeyword] = useState('');
  const [viewing, setViewing] = useState<{ employee: AttendanceEmployee; date?: string } | null>(null);
  const { data, loading, reload } = usePostData<MonthlyData>('/attendance/monthly', { month: period });

  const rows = data?.data ?? [];
  const departments = [...new Map(rows.filter((r) => r.employee.department).map((r) => [r.employee.department_id, r.employee.department!])).values()];
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) =>
    (!department || r.employee.department_id === department)
    && (!q || `${r.employee.emp_code} ${fullName(r.employee)}`.toLowerCase().includes(q)));
  const shift = (months: number) => setPeriod(moment(`${period}-01`).add(months, 'month').format('YYYY-MM'));
  const sum = (pick: (s: MonthlyData['data'][number]['stats']) => number) => shown.reduce((n, r) => n + pick(r.stats), 0);

  const workdays = data?.days.filter((d) => d.workday).length ?? 0;
  const expected = sum((s) => s.employed_days - s.pending_days - s.leave_days - s.unpaid_days);
  const present = sum((s) => s.present_days);

  const exportRows = () => {
    if (!data) return;
    exportExcel(shown.map((r) => ({
      [t('hrEmployeeCode')]: r.employee.emp_code,
      [t('hrEmployee')]: fullName(r.employee),
      [t('hrDepartment')]: r.employee.department?.depart_name ?? '',
      ...Object.fromEntries(data.days.map((d, i) => [moment(d.date).format('DD'), t(DAY_STATES[r.states[i]].short) || (r.states[i] === 'off' ? '-' : '')])),
      [t('attPresentDays')]: r.stats.present_days,
      [t('attLateDays')]: r.stats.late_days,
      [t('attLateMinutes')]: r.stats.late_minutes,
      [t('attEarlyMinutes')]: r.stats.early_minutes,
      [t('attAbsentDays')]: r.stats.absent_days,
      [t('attLeaveDays')]: r.stats.leave_days,
      [t('attUnpaidDays')]: r.stats.unpaid_days,
      [t('attOffworkDays')]: r.stats.offday_work_days,
    })), `attendance_${period}`, `${t('attMonthly')} ${periodLabel(period)}`);
  };

  return (
    <div className="acc-rp att-page">
      <div className="acc-rp-filters">
        <div className="acc-rp-filter-row">
          <div className="att-nav">
            <button type="button" className="acc-rp-btn" aria-label={t('previous')} onClick={() => shift(-1)}><i className="fa-solid fa-chevron-left" /></button>
            <DatePicker value={moment(`${period}-01`).toDate()} format="MM/yyyy" cleanable={false} oneTap className="att-nav-picker"
              shouldDisableDate={(d) => moment(d).isAfter(moment(), 'month')} onChange={(d) => d && setPeriod(toPeriod(d))}
            />
            <button type="button" className="acc-rp-btn" aria-label={t('next')} disabled={period >= current} onClick={() => shift(1)}><i className="fa-solid fa-chevron-right" /></button>
            {period !== current && <button type="button" className="acc-rp-btn" onClick={() => setPeriod(current)}>{t('attThisMonth')}</button>}
          </div>
          <SelectPicker block className="att-dept" data={departments.map((d) => ({ value: d._uuid, label: d.depart_name }))}
            value={department} onChange={setDepartment} placeholder={t('hrAllDepartments')} searchable={false}
          />
          <SearchBox value={keyword} onChange={setKeyword} placeholder={t('search')} />
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!shown.length}><i className="fa-solid fa-file-excel" /> Excel</button>
          </div>
        </div>
      </div>

      {data?.locked && <p className="acc-bg-note is-warn"><i className="fa-solid fa-lock" /> {t('attLocked')}</p>}

      {!data ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <div className="acc-rp-kpis">
            <div className="acc-rp-kpi is-main">
              <small>{t('attRate')}</small>
              <b>{expected > 0 ? Math.round((present / expected) * 100) : 0}%</b>
              <em>{present} / {expected} {t('attPersonDays')}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('attWorkdays')}</small>
              <b>{workdays}</b>
              <em className="is-flat">{data.days.filter((d) => d.holiday).length} {t('attHolidays')}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('attStateLate')}</small>
              <b className={sum((s) => s.late_days) ? 'att-tone-late' : ''}>{sum((s) => s.late_days)}</b>
              <em className="is-flat">{minutesText(sum((s) => s.late_minutes + s.early_minutes), t)}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('attAbsentDays')}</small>
              <b className={sum((s) => s.absent_days) ? 'is-out' : ''}>{sum((s) => s.absent_days)}</b>
              <em className="is-flat">{sum((s) => s.unpaid_days)} {t('attStateUnpaid')}</em>
            </div>
          </div>

          <StateLegend states={LEGEND} />

          {!shown.length ? (
            <div className="acc-class-empty"><i className="fa-solid fa-table-cells" /><p>{t('noData')}</p></div>
          ) : (
            <div className="acc-gl-group att-grid-wrap">
              <div className="acc-rp-scroll">
                <table className="att-grid">
                  <thead>
                    <tr>
                      <th className="att-grid-person">{t('hrEmployee')}</th>
                      {data.days.map((d) => (
                        <th key={d.date} title={d.holiday ?? undefined}
                          className={`${d.workday ? '' : 'is-off'}${d.holiday ? ' is-holiday' : ''}${d.date === data.today ? ' is-today' : ''}`}
                        >
                          <b>{moment(d.date).format('D')}</b>
                          <small>{t(`attWd${moment(d.date).day()}`)}</small>
                        </th>
                      ))}
                      <th className="att-grid-stat" title={t('attPresentDays')}>{t('attShortPresent')}</th>
                      <th className="att-grid-stat" title={t('attLateDays')}>{t('attShortLate')}</th>
                      <th className="att-grid-stat" title={t('attAbsentDays')}>{t('attShortAbsent')}</th>
                      <th className="att-grid-stat" title={t('attLeaveDays')}>{t('attShortLeave')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.employee._uuid}>
                        <td className="att-grid-person">
                          <button type="button" className="hr-person" onClick={() => setViewing({ employee: r.employee })}>
                            <HrAvatar url={r.employee.profile_url} name={r.employee.first_name} size="sm" />
                            <span>
                              <b>{fullName(r.employee)}</b>
                              <small className="acc-gl-ref">{r.employee.emp_code}</small>
                            </span>
                          </button>
                        </td>
                        {r.states.map((state, i) => (
                          <td key={data.days[i].date} className={data.days[i].workday ? '' : 'is-off'}>
                            <button type="button" className={`att-cell is-${state}`} title={`${data.days[i].date} · ${t(DAY_STATES[state].label)}`}
                              disabled={state === 'none' || state === 'future'} onClick={() => setViewing({ employee: r.employee, date: data.days[i].date })}
                            >
                              {t(DAY_STATES[state].short)}
                            </button>
                          </td>
                        ))}
                        <td className="att-grid-stat is-present">{r.stats.present_days}</td>
                        <td className="att-grid-stat is-late" title={minutesText(r.stats.late_minutes + r.stats.early_minutes, t)}>{r.stats.late_days || ''}</td>
                        <td className="att-grid-stat is-absent">{r.stats.absent_days || ''}</td>
                        <td className="att-grid-stat is-leave">{r.stats.leave_days + r.stats.unpaid_days || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {viewing && (
        <AttendanceEmployeeDrawer employee={viewing.employee} period={period} focusDate={viewing.date}
          onClose={() => setViewing(null)} onChanged={reload}
        />
      )}
    </div>
  );
};

export default AttendanceMonthly;
