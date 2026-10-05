import moment, { type Moment } from 'moment';
import { formatNumber } from '../../../utils/configApi';
import { useT } from '../../../context/LanguageContext';

/** ສ່ວນຂອງໜ້າລາຍຮັບ (IncomePage) ແລະ ລາຍຈ່າຍ (ExpensePage) ທີ່ໃຊ້ຮ່ວມກັນ — ສີມາຈາກ .acc-jr / .acc-jr.is-expense */

/** ເລືອກເດືອນ ‹ 09/2026 › + ປຸ່ມກັບໄປເດືອນນີ້ */
export const MonthSwitch = ({ month, onChange }: { month: Moment; onChange: (month: Moment) => void }) => {
  const t = useT();
  return (
    <div className="acc-jr-month">
      <button type="button" onClick={() => onChange(month.clone().subtract(1, 'month'))}
        aria-label={t('lifePreviousMonth')} title={t('lifePreviousMonth')}
      >
        <i className="fa-solid fa-chevron-left" />
      </button>
      <span>
        <small>{t('stmtMonth')}</small>
        <b>{month.format('MM/YYYY')}</b>
      </span>
      <button type="button" onClick={() => onChange(month.clone().add(1, 'month'))}
        aria-label={t('lifeNextMonth')} title={t('lifeNextMonth')}
      >
        <i className="fa-solid fa-chevron-right" />
      </button>
      {!month.isSame(moment(), 'month') && (
        <button type="button" className="is-today" onClick={() => onChange(moment().startOf('month'))}>
          {t('incomeThisMonth')}
        </button>
      )}
    </div>
  );
};

/**
 * ກຣາຟລາຍວັນຂອງເດືອນ — 1 ແທ່ງຕໍ່ມື້ (ຍອດຂອງສະກຸນຫຼັກ). ກົດແທ່ງ = ກັ່ນລາຍການສະເພາະມື້ນັ້ນ (ກົດຊ້ຳ = ຍົກເລີກ).
 * entries = ວັນທີ + ຍອດ ຂອງແຕ່ລະລາຍການທີ່ໃຊ້ງານ; sign = "+" ລາຍຮັບ / "−" ລາຍຈ່າຍ (ສະແດງໃນ tooltip)
 */
export const DailyChart = ({ month, entries, label, symbol, sign, day, onDay }: {
  month: Moment;
  entries: { date: Moment; amount: number }[];
  label: string;
  symbol: string;
  sign: '+' | '−';
  /** ມື້ທີ່ເລືອກ YYYY-MM-DD */
  day: string | null;
  onDay: (day: string | null) => void;
}) => {
  const t = useT();
  const daysInMonth = month.daysInMonth();
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, total: 0, count: 0 }));
  entries.forEach(({ date, amount }) => {
    if (!date.isSame(month, 'month')) return;
    daily[date.date() - 1].total += amount;
    daily[date.date() - 1].count += 1;
  });
  const peak = Math.max(1, ...daily.map((d) => d.total));
  const today = moment();
  const isThisMonth = month.isSame(today, 'month');
  const columns = { gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` };

  return (
    <figure className="acc-jr-chart" aria-label={label}>
      <figcaption>
        <span>{label}{symbol ? ` · ${symbol}` : ''}</span>
        <small>{t('incomeDailyHint')}</small>
      </figcaption>
      <div className="acc-jr-bars" style={columns}>
        {daily.map((d) => {
          const key = month.clone().date(d.day).format('YYYY-MM-DD');
          const tip = `${month.clone().date(d.day).format('DD/MM')} · ${d.count ? `${sign}${formatNumber(d.total)} (${d.count})` : '0'}`;
          return (
            <button key={d.day} type="button" data-tip={tip} aria-label={tip}
              className={[
                'acc-jr-bar',
                d.count ? '' : 'is-empty',
                isThisMonth && d.day > today.date() ? 'is-future' : '',
                isThisMonth && d.day === today.date() ? 'is-today' : '',
                day === key ? 'is-selected' : '',
                d.day > daysInMonth / 2 ? 'is-late' : '',
              ].filter(Boolean).join(' ')}
              disabled={!d.count}
              onClick={() => onDay(day === key ? null : key)}
            >
              <i style={{ height: d.count ? `max(4px, ${(d.total / peak) * 100}%)` : undefined }} />
            </button>
          );
        })}
      </div>
      <div className="acc-jr-axis" style={columns}>
        {[1, 5, 10, 15, 20, 25, daysInMonth].map((n) => <span key={n} style={{ gridColumn: n }}>{n}</span>)}
      </div>
    </figure>
  );
};

/** ຫົວກຸ່ມມື້ — ວັນທີ + ວັນໃນອາທິດ + ມື້ນີ້/ມື້ວານ + ຈຳນວນລາຍການ + ຍອດຂອງມື້ */
export const DayHead = ({ day, count, total }: { day: string; count: number; total: string }) => {
  const t = useT();
  const date = moment(day);
  const today = moment();
  const relative = date.isSame(today, 'day') ? t('today') : date.isSame(today.clone().subtract(1, 'day'), 'day') ? t('yesterday') : null;
  return (
    <header className="acc-jr-day-head">
      <span className="acc-jr-day-num">{date.format('DD')}</span>
      <span className="acc-jr-day-label">
        <b>{t(`weekday${date.day()}`)}</b>
        <small>{date.format('DD/MM/YYYY')}</small>
      </span>
      {relative && <em className="acc-jr-day-rel">{relative}</em>}
      <span className="acc-jr-day-sum">
        <small>{count} {t('incomeItems')}</small>
        <b>{total}</b>
      </span>
    </header>
  );
};
