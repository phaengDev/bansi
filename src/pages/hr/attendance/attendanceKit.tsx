import { useT } from '../../../context/LanguageContext';
import { DAY_STATES, minutesText, type AttendanceRecord, type DayState } from './attendanceApi';

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
