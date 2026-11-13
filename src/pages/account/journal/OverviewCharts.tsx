import { useEffect, useRef, useState, type CSSProperties } from 'react';
import moment from 'moment';
import { formatNumber } from '../../../utils/configApi';
import { useT } from '../../../context/LanguageContext';
import { PlotFrame, compact, niceAxis } from '../statements/StatementBits';
import { levelOf, type CalendarDay, type Slot } from './overviewData';
import { Empty } from './OverviewCards';

/** ກຣາບຂອງໜ້າ ພາບລວມ ລາຍຮັບ-ລາຍຈ່າຍ — ຮັບ = ຂຽວ, ຈ່າຍ = ແດງ ທຸກກຣາບ; tooltip ແບບດຽວກັບໃບລາຍງານການເງິນ */

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const signed = (v: number) => `${v < 0 ? '−' : '+'}${formatNumber(Math.abs(v))}`;
const cols = (n: number): CSSProperties => ({ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` });
const order = (i: number): CSSProperties => ({ '--i': i } as CSSProperties);

/** ຕົວເລກແລ່ນຂຶ້ນຫາຄ່າໃໝ່ (ease-out ~0.9 ວິ); ຜູ້ໃຊ້ທີ່ປິດ animation = ສະແດງທັນທີ */
export const useCountUp = (value: number, duration = 900) => {
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const begin = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = reducedMotion() ? 1 : Math.min(1, (now - start) / duration);
      const next = begin + (value - begin) * (1 - (1 - p) ** 3);
      current.current = next;
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return shown;
};

export const CountUp = ({ value, prefix = '' }: { value: number; prefix?: string }) => {
  const shown = Math.round(useCountUp(value));
  return <>{shown < 0 ? '−' : ''}{prefix}{formatNumber(Math.abs(shown))}</>;
};

/** ເສັ້ນນ້ອຍໃນບັດ — ຄ່າລາຍຊ່ອງເວລາ (ສະເພາະທີ່ຜ່ານມາແລ້ວ) */
export const Sparkline = ({ values, tone }: { values: number[]; tone: 'in' | 'out' | 'net' }) => {
  if (values.length < 2) return null;
  const max = Math.max(...values, 0);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${4 + (1 - (v - min) / span) * 92}`).join(' ');
  return (
    <svg className={`acc-jo-spark is-${tone}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,100 ${pts} 100,100`} className="is-area" />
      <polyline points={pts} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export type FlowMode = 'bars' | 'cumulative' | 'net';

/**
 * ກຣາບຫຼັກ 3 ແບບ: ແທ່ງຄູ່ (ຮັບ/ຈ່າຍ ແຕ່ລະຊ່ອງ), ສະສົມ (ສອງເສັ້ນ — ຊ່ອງຫວ່າງລະຫວ່າງເສັ້ນ = ເງິນເຫຼືອ),
 * ສຸດທິ (ແທ່ງຂຶ້ນ-ລົງຈາກເສັ້ນ 0). ຊ່ອງທີ່ຍັງບໍ່ຮອດ ພື້ນຂີດອ່ອນ ແລະ ເສັ້ນສະສົມບໍ່ແຕ້ມຕໍ່
 */
export const FlowChart = ({ slots, mode }: { slots: Slot[]; mode: FlowMode }) => {
  const t = useT();
  const n = slots.length;
  const labels = slots.map((s) => s.label);
  const firstFuture = slots.findIndex((s) => s.future);
  const future = firstFuture < 0 ? undefined : firstFuture;
  const late = (i: number) => (i >= n / 2 ? ' is-late' : '');
  const busy = (s: Slot) => (s.incCount || s.expCount ? 0 : -1);
  if (!slots.some((s) => s.inc || s.exp)) return <Empty icon="fa-chart-column" text={t('joNoFlow')} />;

  if (mode === 'bars') {
    const axis = niceAxis(0, Math.max(1, ...slots.map((s) => Math.max(s.inc, s.exp))));
    const h = (v: number) => (v ? `max(2px, ${(v / axis.max) * 100}%)` : 0);
    return (
      <PlotFrame ticks={axis.ticks} labels={labels} future={future} height={220}>
        <div className="acc-fs-pairs acc-jo-grow" style={cols(n)}>
          {slots.map((s, i) => {
            const tip = `${s.tip} · ${t('joIn')} +${formatNumber(s.inc)} · ${t('joOut')} −${formatNumber(s.exp)}`;
            return (
              <span key={s.key} className={`acc-fs-pair${late(i)}`} data-tip={tip} aria-label={tip} tabIndex={busy(s)} style={order(i)}>
                <i className="is-in" style={{ height: h(s.inc) }} />
                <i className="is-out" style={{ height: h(s.exp) }} />
              </span>
            );
          })}
        </div>
      </PlotFrame>
    );
  }

  if (mode === 'net') {
    const nets = slots.map((s) => s.inc - s.exp);
    const axis = niceAxis(Math.min(0, ...nets), Math.max(0, ...nets));
    const span = axis.max - axis.min;
    const y = (v: number) => (1 - (v - axis.min) / span) * 100;
    return (
      <PlotFrame ticks={axis.ticks} labels={labels} future={future} height={220}>
        <span className="acc-jo-zero" style={{ top: `${y(0)}%` }} />
        <div className="acc-jo-net acc-jo-grow" style={cols(n)}>
          {slots.map((s, i) => {
            const v = nets[i];
            const tip = `${s.tip} · ${t('joNet')} ${signed(v)} (+${formatNumber(s.inc)} / −${formatNumber(s.exp)})`;
            return (
              <span key={s.key} className={`acc-jo-net-col${late(i)}`} data-tip={tip} aria-label={tip} tabIndex={busy(s)} style={order(i)}>
                {v !== 0 && (
                  <i className={v > 0 ? 'is-in' : 'is-out'}
                    style={{ top: `${y(Math.max(v, 0))}%`, height: `max(2px, ${(Math.abs(v) / span) * 100}%)` }}
                  />
                )}
              </span>
            );
          })}
        </div>
      </PlotFrame>
    );
  }

  // ສະສົມ
  const shown = slots.filter((s) => !s.future);
  const axis = niceAxis(0, Math.max(1, ...shown.map((s) => Math.max(s.cumInc, s.cumExp))));
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (v: number) => (1 - v / axis.max) * 100;
  const line = (pick: (s: Slot) => number) => shown.map((s, i) => `${x(i)},${y(pick(s))}`).join(' ');
  const area = (pick: (s: Slot) => number) => (shown.length ? `${x(0)},100 ${line(pick)} ${x(shown.length - 1)},100` : '');
  return (
    <PlotFrame ticks={axis.ticks} labels={labels} future={future} height={220}>
      <svg className="acc-fs-line acc-jo-reveal" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="acc-jo-cum-in" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0e9f86" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0e9f86" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="acc-jo-cum-out" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#e5484d" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#e5484d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {shown.length > 0 && <>
          <polygon points={area((s) => s.cumInc)} fill="url(#acc-jo-cum-in)" />
          <polygon points={area((s) => s.cumExp)} fill="url(#acc-jo-cum-out)" />
          <polyline points={line((s) => s.cumExp)} fill="none" stroke="#e5484d" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <polyline points={line((s) => s.cumInc)} fill="none" stroke="#0e9f86" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </>}
      </svg>
      <div className="acc-fs-hits" style={cols(n)}>
        {slots.map((s, i) => {
          if (s.future) return <span key={s.key} />;
          const tip = `${s.tip} · ${t('joIn')} ${formatNumber(s.cumInc)} · ${t('joOut')} ${formatNumber(s.cumExp)} · ${t('joNet')} ${signed(s.cumInc - s.cumExp)}`;
          return (
            <span key={s.key} className={`acc-jo-hit${late(i)}`} data-tip={tip} aria-label={tip} tabIndex={0}>
              <i className="is-in" style={{ top: `${y(s.cumInc)}%` }} />
              <i className="is-out" style={{ top: `${y(s.cumExp)}%` }} />
            </span>
          );
        })}
      </div>
    </PlotFrame>
  );
};

export type CalendarMode = 'net' | 'inc' | 'exp';

/**
 * ປະຕິທິນເງິນ — ສີແຕ່ລະມື້ຕາມຍອດ (ເຂັ້ມ = ຫຼາຍ). ຊ່ວງ ≤ 6 ອາທິດ = ປະຕິທິນເດືອນ (ມີເລກວັນ + ຍອດຫຍໍ້),
 * ຍາວກວ່ານັ້ນ = ຕາຕະລາງນ້ອຍແບບລາຍອາທິດ (ຖັນ = ອາທິດ, ແຖວ = ມື້)
 */
export const MoneyCalendar = ({ days, mode }: { days: CalendarDay[]; mode: CalendarMode }) => {
  const t = useT();
  if (!days.length) return null;
  const todayKey = moment().format('YYYY-MM-DD');
  const valueOf = (d: CalendarDay) => (mode === 'net' ? d.inc - d.exp : mode === 'inc' ? d.inc : d.exp);
  const peak = Math.max(0, ...days.map((d) => Math.abs(valueOf(d))));
  const classOf = (d: CalendarDay) => {
    if (d.future) return 'is-future';
    const v = valueOf(d);
    const level = levelOf(v, peak);
    if (!level) return 'is-l0';
    const tone = mode === 'inc' ? 'in' : mode === 'exp' ? 'out' : v > 0 ? 'in' : 'out';
    return `is-${tone} is-l${level}`;
  };
  const tipOf = (d: CalendarDay) => d.future
    ? d.date.format('DD/MM/YYYY')
    : `${d.date.format('DD/MM/YYYY')} · ${t('joIn')} +${formatNumber(d.inc)} · ${t('joOut')} −${formatNumber(d.exp)} · ${t('joNet')} ${signed(d.inc - d.exp)}`;
  const lead = (days[0].date.isoWeekday() + 6) % 7;
  const weekdays = [1, 2, 3, 4, 5, 6, 0];
  const month = days.length <= 42;
  const passed = days.filter((d) => !d.future);
  const hasData = passed.some((d) => d.inc || d.exp);

  // ສະຫຼຸບຈຳນວນມື້ຕາມໂໝດ
  const stats = mode === 'net'
    ? [
      { tone: 'in', text: t('joCalUp').replace('{n}', String(passed.filter((d) => d.inc > d.exp).length)) },
      { tone: 'out', text: t('joCalDown').replace('{n}', String(passed.filter((d) => d.exp > d.inc).length)) },
      { tone: 'quiet', text: t('joCalQuiet').replace('{n}', String(passed.filter((d) => !d.inc && !d.exp).length)) },
    ]
    : mode === 'inc'
      ? [{ tone: 'in', text: t('joCalInDays').replace('{n}', String(passed.filter((d) => d.inc).length)) },
        { tone: 'quiet', text: t('joCalQuiet').replace('{n}', String(passed.filter((d) => !d.inc).length)) }]
      : [{ tone: 'out', text: t('joCalOutDays').replace('{n}', String(passed.filter((d) => d.exp).length)) },
        { tone: 'quiet', text: t('joCalQuiet').replace('{n}', String(passed.filter((d) => !d.exp).length)) }];
  const statRow = (
    <div className="acc-jo-cal-stats">
      {stats.map((st) => <span key={st.tone} className={`is-${st.tone}`}><i />{st.text}</span>)}
    </div>
  );

  const legend = !hasData ? (
    <p className="acc-jo-cal-hint"><i className="fa-solid fa-wand-magic-sparkles" /> {t('joCalEmpty')}</p>
  ) : (
    <div className={`acc-jo-cal-legend${month ? ' is-soft' : ''}`}>
      {mode === 'net' ? <>
        <span>{t('joMoreOut')}</span>
        {[4, 3, 2, 1].map((l) => <i key={`o${l}`} className={`is-out is-l${l}`} />)}
        <i className="is-l0" />
        {[1, 2, 3, 4].map((l) => <i key={`i${l}`} className={`is-in is-l${l}`} />)}
        <span>{t('joMoreIn')}</span>
      </> : <>
        <span>{t('joLess')}</span>
        <i className="is-l0" />
        {[1, 2, 3, 4].map((l) => <i key={l} className={`is-${mode === 'inc' ? 'in' : 'out'} is-l${l}`} />)}
        <span>{t('joMore')}</span>
      </>}
    </div>
  );

  if (month) {
    // ແຖບນ້ອຍ ຮັບ/ຈ່າຍ ທຽບມື້ທີ່ໃຫຍ່ສຸດຂອງເດືອນ (ທັງສອງດ້ານໃຊ້ຕົວທຽບດຽວກັນ)
    const barPeak = Math.max(1, ...days.map((d) => Math.max(d.inc, d.exp)));
    const width = (v: number): CSSProperties => ({ width: v ? `max(6%, ${(v / barPeak) * 100}%)` : 0 });
    return (
      <>
        {statRow}
        <div className="acc-jo-cal">
          {weekdays.map((w, i) => <span key={w} className={`acc-jo-cal-head${i >= 5 ? ' is-weekend' : ''}`}>{t(`joWd${w}`)}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} className="acc-jo-cal-blank" />)}
          {days.map((d, i) => {
            const v = valueOf(d);
            const col = (lead + i) % 7;
            const today = d.key === todayKey;
            const has = !d.future && (d.inc > 0 || d.exp > 0);
            return (
              <span key={d.key}
                className={`acc-jo-cal-day ${classOf(d)}${today ? ' is-today' : ''}${col >= 4 ? ' is-late' : ''}${col >= 5 ? ' is-weekend' : ''}${has ? ' has-data' : ''}`}
                data-tip={tipOf(d)} aria-label={tipOf(d)} tabIndex={d.future ? -1 : 0} style={order(i)}
              >
                <span className="acc-jo-cal-top">
                  <b>{d.date.date()}</b>
                  {today && <em>{t('joToday')}</em>}
                </span>
                {has && v !== 0 && <small className="acc-jo-cal-amount">{mode === 'net' ? (v > 0 ? '+' : '−') : ''}{compact(Math.abs(v))}</small>}
                {has && (
                  <span className="acc-jo-cal-bars">
                    {mode !== 'exp' && <i className="is-in" style={width(d.inc)} />}
                    {mode !== 'inc' && <i className="is-out" style={width(d.exp)} />}
                  </span>
                )}
              </span>
            );
          })}
        </div>
        {legend}
      </>
    );
  }

  const cells = [...Array.from({ length: lead }, () => null), ...days];
  const weeks = Math.ceil(cells.length / 7);
  const months: { col: number; label: string }[] = [];
  days.forEach((d, i) => {
    if (i === 0 || d.date.date() === 1) months.push({ col: Math.floor((lead + i) / 7), label: d.date.format('MM/YY') });
  });
  return (
    <>
      {statRow}
      <div className="acc-jo-heat">
        <div className="acc-jo-heat-months" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
          {months.map((m) => <span key={m.label} style={{ gridColumn: `${m.col + 1} / span 4` }}>{m.label}</span>)}
        </div>
        <div className="acc-jo-heat-body">
          <span className="acc-jo-heat-days">
            {weekdays.map((w, i) => <span key={w}>{i % 2 === 0 ? t(`attWd${w}`) : ''}</span>)}
          </span>
          <div className="acc-jo-heat-grid" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
            {cells.map((d, i) => d ? (
              <span key={d.key} className={`acc-jo-heat-cell ${classOf(d)}${d.key === todayKey ? ' is-today' : ''}${i / 7 >= weeks / 2 ? ' is-late' : ''}`}
                data-tip={tipOf(d)} aria-label={tipOf(d)} tabIndex={d.future ? -1 : 0}
              />
            ) : <span key={`b${i}`} />)}
          </div>
        </div>
      </div>
      {legend}
    </>
  );
};

/** ຍອດຕາມມື້ໃນອາທິດ (ຈັນ → ອາທິດ) — ມື້ທີ່ຈ່າຍຫຼາຍສຸດ ຂຶ້ນປ້າຍ */
export const WeekdayChart = ({ rows }: { rows: { inc: number; exp: number }[] }) => {
  const t = useT();
  if (!rows.some((r) => r.inc || r.exp)) return <Empty icon="fa-calendar-week" text={t('joNoFlow')} />;
  const axis = niceAxis(0, Math.max(1, ...rows.map((r) => Math.max(r.inc, r.exp))));
  const h = (v: number) => (v ? `max(2px, ${(v / axis.max) * 100}%)` : 0);
  const names = [1, 2, 3, 4, 5, 6, 0].map((w) => t(`weekday${w}`));
  return (
    <PlotFrame ticks={axis.ticks} labels={names} height={210}>
      <div className="acc-fs-pairs acc-jo-grow is-wide" style={cols(7)}>
        {rows.map((r, i) => {
          const tip = `${names[i]} · ${t('joIn')} +${formatNumber(r.inc)} · ${t('joOut')} −${formatNumber(r.exp)}`;
          return (
            <span key={i} className={`acc-fs-pair${i >= 4 ? ' is-late' : ''}`} data-tip={tip} aria-label={tip} tabIndex={r.inc || r.exp ? 0 : -1} style={order(i * 3)}>
              <i className="is-in" style={{ height: h(r.inc) }} />
              <i className="is-out" style={{ height: h(r.exp) }} />
            </span>
          );
        })}
      </div>
    </PlotFrame>
  );
};
