import type { ReactNode, Ref } from 'react';
import { DatePicker } from 'rsuite';
import moment from 'moment';
import { useT } from '../../../context/LanguageContext';
import {
  DAY_STATES, minutesText, toPeriod, weekdayKey,
  type AttendanceRecord, type DayInfo, type DayState, type MonthStats,
} from './attendanceApi';

/** ປ້າຍສະຖານະຂອງມື້ (ສີຕາມ .att-state.is-{state}) */
export const StatePill = ({ state }: { state: DayState }) => {
  const t = useT();
  const meta = DAY_STATES[state];
  return (
    <span className={`att-state is-${state}`}>
      <i className={`fa-solid ${meta.icon}`} /> {t(meta.label)}
    </span>
  );
};

/** ເວລາເຂົ້າ ຫຼື ອອກ + ທີ່ມາ (ສະແກນ = ໄລຍະຫ່າງຈາກບໍລິສັດ, HR = ໄອຄອນປາກກາ) */
export const ClockCell = ({ record, side }: { record: AttendanceRecord | null; side: 'in' | 'out' }) => {
  const t = useT();
  const time = side === 'in' ? record?.check_in_time : record?.check_out_time;
  if (!time) return <span className="acc-gl-ref">—</span>;
  const distance = side === 'in' ? record?.in_distance : record?.out_distance;
  const scanned = distance !== null && distance !== undefined;
  return (
    <span className="att-clock">
      <b>{time}</b>
      <small title={t(scanned ? 'attScanned' : 'attByHr')}>
        <i className={`fa-solid ${scanned ? 'fa-location-dot' : 'fa-pen'}`} />
        {scanned ? ` ${distance} ${t('hrMeters')}` : ` ${t('attByHr')}`}
      </small>
    </span>
  );
};

/** ມາຊ້າ / ອອກກ່ອນ (ສະເພາະທີ່ເກີນນາທີຜ່ອນຜັນ) */
export const LateCell = ({ record, grace }: { record: AttendanceRecord | null; grace: number }) => {
  const t = useT();
  const late = record && record.late_minutes > grace ? record.late_minutes : 0;
  const early = record && record.early_minutes > grace ? record.early_minutes : 0;
  if (!late && !early) return <span className="acc-gl-ref">—</span>;
  return (
    <span className="att-late">
      {!!late && <em className="is-late"><i className="fa-solid fa-person-running" /> {minutesText(late, t)}</em>}
      {!!early && <em className="is-early"><i className="fa-solid fa-door-open" /> {minutesText(early, t)}</em>}
    </span>
  );
};

/** ຄຳອະທິບາຍສີຂອງຕາລາງເດືອນ */
export const StateLegend = ({ states }: { states: DayState[] }) => {
  const t = useT();
  return (
    <div className="att-legend">
      {states.map((state) => (
        <span key={state}>
          <i className={`att-cell is-${state}`}>{t(DAY_STATES[state].short)}</i> {t(DAY_STATES[state].label)}
        </span>
      ))}
    </div>
  );
};

/**
 * ເລືອກເດືອນ: ກ່ອນ / ປະຕິທິນເດືອນ / ຖັດໄປ + "ເດືອນນີ້" — ໃຊ້ຮ່ວມກັນທຸກໜ້າທີ່ເບິ່ງເປັນເດືອນ (ບໍ່ເລືອກເດືອນອະນາຄົດ)
 */
export const MonthStepper = ({ period, onChange }: { period: string; onChange: (period: string) => void }) => {
  const t = useT();
  const current = toPeriod(new Date());
  const shift = (months: number) => onChange(moment(`${period}-01`).add(months, 'month').format('YYYY-MM'));
  return (
    <div className="att-nav">
      <button type="button" className="acc-rp-btn" aria-label={t('previous')} onClick={() => shift(-1)}><i className="fa-solid fa-chevron-left" /></button>
      <DatePicker value={moment(`${period}-01`).toDate()} format="MM/yyyy" cleanable={false} oneTap className="att-nav-picker"
        shouldDisableDate={(d) => moment(d).isAfter(moment(), 'month')} onChange={(d) => d && onChange(toPeriod(d))}
      />
      <button type="button" className="acc-rp-btn" aria-label={t('next')} disabled={period >= current} onClick={() => shift(1)}><i className="fa-solid fa-chevron-right" /></button>
      {period !== current && <button type="button" className="acc-rp-btn" onClick={() => onChange(current)}>{t('attThisMonth')}</button>}
    </div>
  );
};

/** ສະຫຼຸບເດືອນຂອງ 1 ຄົນ: ມາວຽກ, ມາຊ້າ (+ ນາທີ), ຂາດ, ລາພັກ, ມື້ເຮັດວຽກ */
export const AttendanceSummary = ({ summary }: { summary: MonthStats }) => {
  const t = useT();
  const s = summary;
  return (
    <div className="att-summary">
      <span><b>{s.present_days}</b><small>{t('attPresentDays')}</small></span>
      <span className="is-late"><b>{s.late_days}</b><small>{t('attLateDays')} · {minutesText(s.late_minutes + s.early_minutes, t)}</small></span>
      <span className="is-absent"><b>{s.absent_days}</b><small>{t('attAbsentDays')}</small></span>
      <span className="is-leave"><b>{s.leave_days + s.unpaid_days}</b><small>{t('attLeaveDays')}{s.unpaid_days ? ` · ${s.unpaid_days} ${t('attStateUnpaid')}` : ''}</small></span>
      <span><b>{s.employed_days}/{s.workdays}</b><small>{t('attWorkdays')}</small></span>
    </div>
  );
};

export type AttendanceDay = DayInfo & { state: DayState; record: AttendanceRecord | null };

/**
 * ທຸກມື້ຂອງເດືອນ: ວັນທີ (+ ວັນພັກ / ມື້ຂອງອາທິດ), ສະຖານະ (+ ໝາຍເຫດ), ເຂົ້າ, ອອກ, ມາຊ້າ/ອອກກ່ອນ.
 * actions = ຖັນສຸດທ້າຍຂອງແຖວ (ເຊັ່ນ ແກ້ໄຂ / ແຈ້ງລືມສະແກນ); onRowClick = ກົດທັງແຖວ (null = ກົດບໍ່ໄດ້)
 */
export const AttendanceDayTable = ({ days, grace, focusDate, focusRef, onRowClick, actions }: {
  days: AttendanceDay[];
  grace: number;
  focusDate?: string;
  focusRef?: Ref<HTMLTableRowElement>;
  onRowClick?: (day: AttendanceDay) => (() => void) | null;
  actions?: (day: AttendanceDay) => ReactNode;
}) => {
  const t = useT();
  return (
    <table className="acc-gl-table att-days">
      <thead>
        <tr>
          <th>{t('date')}</th>
          <th>{t('status')}</th>
          <th>{t('attCheckIn')}</th>
          <th>{t('attCheckOut')}</th>
          <th>{t('attLateEarly')}</th>
          {actions && <th />}
        </tr>
      </thead>
      <tbody>
        {days.map((day) => {
          const click = onRowClick?.(day) ?? null;
          const focused = day.date === focusDate;
          return (
            <tr key={day.date} ref={focused ? focusRef : undefined}
              className={`${day.workday ? '' : 'is-off'}${focused ? ' is-focus' : ''}${click ? ' is-click' : ''}`}
              onClick={click ?? undefined}
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
              <td><LateCell record={day.record} grace={grace} /></td>
              {actions && <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>{actions(day)}</td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};
