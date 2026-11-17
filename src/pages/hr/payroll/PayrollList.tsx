import { useState } from 'react';
import moment from 'moment';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { ListState } from '../../account/setting/settingKit';
import { periodLabel } from '../attendance/attendanceApi';
import { PAID, accountText, employeeDeductions, kip, usePayrolls, type Payroll } from './payrollApi';
import ViewSwitch, { useSavedView, type ViewOption } from '../../../components/Elements/ViewSwitch';

const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** "ຕຸລາ 2026" */
const useMonthName = () => {
  const t = useT();
  return (period: string) => `${t(MONTH_KEYS[Number(period.slice(5, 7)) - 1])} ${period.slice(0, 4)}`;
};

/** ແຖວໃນປຶ້ມ — ຊື່ ……… ຈຳນວນ */
const BookLine = ({ label, amount, tone }: { label: string; amount: string; tone?: 'minus' | 'total' }) => (
  <span className={`pay-book-line${tone ? ` is-${tone}` : ''}`}>
    <span>{label}</span>
    <i aria-hidden="true" />
    <b>{amount}</b>
  </span>
);

/** ໜ້າຂອງປຶ້ມເງິນເດືອນ 1 ເດືອນ — ກົດ = ເປີດລາຍລະອຽດ; ສະຖານະເປັນກາປະທັບ (ຈ່າຍແລ້ວ / ຮ່າງ) */
const PayrollBook = ({ run, onOpen }: { run: Payroll; onOpen: () => void }) => {
  const t = useT();
  const monthName = useMonthName();
  const paid = Number(run.status) === PAID;
  const deductions = employeeDeductions(run);
  return (
    <button type="button" className={`pay-book${paid ? ' is-paid' : ' is-draft'}`} onClick={onOpen}
      aria-label={`${monthName(run.period)} · ₭ ${kip(run.total_net)}`}
    >
      <span className="pay-book-stamp">
        <i className={`fa-solid ${paid ? 'fa-circle-check' : 'fa-pen-ruler'}`} /> {t(paid ? 'payStatusPaid' : 'payStatusDraft')}
      </span>
      <span className="pay-book-head">
        <small>{t('payBook')}</small>
        <b>{monthName(run.period)}</b>
        <em>{run.employees} {t('hrPeople')} · {run.workdays} {t('attWorkdays')}</em>
      </span>
      <span className="pay-book-lines">
        <BookLine label={t('payGross')} amount={kip(run.total_gross)} />
        <BookLine label={t('payDeductionTotal')} amount={deductions ? `−${kip(deductions)}` : '0'} tone="minus" />
        <BookLine label={t('paySsoEmployer')} amount={kip(run.total_sso_employer)} />
        <BookLine label={t('payNet')} amount={`₭ ${kip(run.total_net)}`} tone="total" />
      </span>
      <span className="pay-book-foot">
        {paid
          ? <><i className="fa-solid fa-calendar-check" /> {moment(run.pay_date).format('DD/MM/YYYY')}{run.account && <> · {accountText(run.account)}</>}</>
          : <><i className="fa-solid fa-hand-pointer" /> {t('payOpenToPay')}</>}
      </span>
    </button>
  );
};

type PageKind = 'upcoming' | 'current' | 'missed';

/** ວິທີສະແດງ: ປຶ້ມ (ໜ້າລະເດືອນ) ຫຼື ພາບລວມປີ (ກຣາບ 12 ເດືອນ + ຕາຕະລາງ) — ຈື່ໄວ້ໃນເຄື່ອງນີ້ */
type View = 'book' | 'year';
const VIEWS: ViewOption<View>[] = [
  { key: 'book', icon: 'fa-book-open', label: 'payViewBook' },
  { key: 'year', icon: 'fa-chart-column', label: 'payViewYear' },
];

/** 57,629,255 → "57.6" (ລ້ານ) ສຳລັບປ້າຍເທິງແທ່ງກຣາບ */
const millions = (value: number) => {
  const m = value / 1_000_000;
  return m >= 100 ? Math.round(m).toString() : m.toFixed(1);
};

type MonthCell = { period: string; run?: Payroll; kind?: PageKind };

/**
 * ພາບລວມປີ — ຕົວເລກລວມຂອງປີ, ກຣາບແທ່ງສຸດທິ 12 ເດືອນ (ຈ່າຍແລ້ວ = ຂຽວ, ຮ່າງ = ສົ້ມລາຍ, ຍັງບໍ່ສ້າງ = ເສັ້ນປະ)
 * ແລະ ຕາຕະລາງລາຍເດືອນ + ລວມ. ກົດເດືອນທີ່ມີ = ເປີດລາຍລະອຽດ; ເດືອນທີ່ສ້າງໄດ້ = ປຸ່ມສ້າງ
 */
const PayrollYearView = ({ year, months, creating, onOpen, onCreate }: {
  year: number;
  months: MonthCell[];
  creating: string | null;
  onOpen: (id: number) => void;
  onCreate: (period: string) => void;
}) => {
  const t = useT();
  const monthName = useMonthName();
  const runs = months.filter((m) => m.run).map((m) => m.run!);
  const paid = runs.filter((r) => Number(r.status) === PAID);
  const drafts = runs.filter((r) => Number(r.status) !== PAID);
  const sum = (list: Payroll[], pick: (r: Payroll) => number) => list.reduce((n, r) => n + (Number(pick(r)) || 0), 0);
  const peak = Math.max(1, ...runs.map((r) => Number(r.total_net) || 0));
  const remit = sum(paid, (r) => Number(r.total_sso_employee) + Number(r.total_sso_employer) + Number(r.total_tax));

  /** ປຸ່ມ/ສະຖານະຂອງເດືອນທີ່ບໍ່ມີເງິນເດືອນ */
  const emptyAction = (cell: MonthCell) => {
    if (cell.kind === 'upcoming') return <span className="pay-yr-muted"><i className="fa-solid fa-lock" /> {t('payOpensOn')} {moment(`${cell.period}-01`).format('DD/MM')}</span>;
    if (cell.kind) {
      return (
        <button type="button" className="acc-rp-btn is-primary" disabled={!canCreate || creating === cell.period} onClick={() => onCreate(cell.period)}>
          <i className={`fa-solid ${creating === cell.period ? 'fa-spinner fa-spin' : 'fa-plus'}`} /> {t('payCreate')}
        </button>
      );
    }
    return <span className="pay-yr-muted">—</span>;
  };

  return (
    <div className="pay-yr">
      <div className="pay-yr-kpis">
        <div className="is-main">
          <small>{t('payYrPaid')} · {paid.length} {t('payYrMonths')}</small>
          <b>₭ {kip(sum(paid, (r) => r.total_net))}</b>
          <em>{t('payGross')} ₭ {kip(sum(paid, (r) => r.total_gross))}</em>
        </div>
        <div className={drafts.length ? 'is-warn' : ''}>
          <small>{t('payYrDraft')} · {drafts.length} {t('payYrMonths')}</small>
          <b>₭ {kip(sum(drafts, (r) => r.total_net))}</b>
          <em>{drafts.length ? t('payYrDraftHint') : t('payYrNoDraft')}</em>
        </div>
        <div>
          <small>{t('payYrRemit')}</small>
          <b>₭ {kip(remit)}</b>
          <em>{t('payYrRemitHint')}</em>
        </div>
        <div>
          <small>{t('payYrPeople')}</small>
          <b>{runs.length ? Math.max(...runs.map((r) => Number(r.employees) || 0)) : 0} {t('hrPeople')}</b>
          <em>{t('payYrPeopleHint')}</em>
        </div>
      </div>

      <section className="pay-yr-card">
        <header>
          <h4><i className="fa-solid fa-chart-column" /> {t('payYrChart')} {year}</h4>
          <span className="pay-yr-legend">
            <span className="is-paid" /> {t('payStatusPaid')}
            <span className="is-draft" /> {t('payStatusDraft')}
            <small>{t('payYrUnit')}</small>
          </span>
        </header>
        <div className="pay-yr-bars">
          {months.map((cell) => {
            const net = Number(cell.run?.total_net) || 0;
            const state = cell.run ? (Number(cell.run.status) === PAID ? 'is-paid' : 'is-draft') : cell.kind ? `is-${cell.kind}` : 'is-none';
            const content = (
              <>
                <span className="pay-yr-track">
                  {cell.run
                    ? <><em>{millions(net)}</em><i style={{ height: `${Math.max(4, (net / peak) * 100)}%` }} /></>
                    : cell.kind && cell.kind !== 'upcoming' ? <b><i className="fa-solid fa-plus" /></b>
                      : cell.kind === 'upcoming' ? <b><i className="fa-solid fa-lock" /></b> : null}
                </span>
                <small>{moment(`${cell.period}-01`).format('MM')}</small>
              </>
            );
            const title = cell.run ? `${monthName(cell.period)} · ₭ ${kip(net)}` : monthName(cell.period);
            if (cell.run) {
              return <button key={cell.period} type="button" className={`pay-yr-bar ${state}`} title={title} onClick={() => onOpen(cell.run!._uuid)}>{content}</button>;
            }
            if (cell.kind && cell.kind !== 'upcoming') {
              return (
                <button key={cell.period} type="button" className={`pay-yr-bar ${state}`} title={`${t('payCreate')} · ${monthName(cell.period)}`}
                  disabled={!canCreate || creating === cell.period} onClick={() => onCreate(cell.period)}
                >
                  {content}
                </button>
              );
            }
            return <span key={cell.period} className={`pay-yr-bar ${state}`} title={title}>{content}</span>;
          })}
        </div>
      </section>

      <section className="pay-yr-card">
        <div className="pay-yr-scroll">
          <table className="pay-yr-table">
            <thead>
              <tr>
                <th>{t('payYrMonth')}</th>
                <th>{t('status')}</th>
                <th>{t('hrPeople')}</th>
                <th>{t('payGross')}</th>
                <th>{t('payDeductionTotal')}</th>
                <th>{t('paySsoEmployer')}</th>
                <th>{t('payNet')}</th>
                <th>{t('payYrPaidOn')}</th>
              </tr>
            </thead>
            <tbody>
              {months.map((cell) => {
                const run = cell.run;
                if (!run) {
                  return (
                    <tr key={cell.period} className="is-empty">
                      <td><b>{monthName(cell.period)}</b></td>
                      <td colSpan={6}>{cell.kind ? <span className="pay-yr-muted">{t(PAGE_LABEL[cell.kind])}</span> : <span className="pay-yr-muted">{t('payYrNone')}</span>}</td>
                      <td>{emptyAction(cell)}</td>
                    </tr>
                  );
                }
                const isPaid = Number(run.status) === PAID;
                const deductions = employeeDeductions(run);
                return (
                  <tr key={cell.period} className="is-click" onClick={() => onOpen(run._uuid)}>
                    <td><b>{monthName(cell.period)}</b><small>{run.workdays} {t('attWorkdays')}</small></td>
                    <td>
                      <span className={`pay-yr-pill ${isPaid ? 'is-paid' : 'is-draft'}`}>
                        <i className={`fa-solid ${isPaid ? 'fa-circle-check' : 'fa-pen-ruler'}`} /> {t(isPaid ? 'payStatusPaid' : 'payStatusDraft')}
                      </span>
                    </td>
                    <td>{run.employees}</td>
                    <td>{kip(run.total_gross)}</td>
                    <td className="is-minus">{deductions ? `−${kip(deductions)}` : '0'}</td>
                    <td>{kip(run.total_sso_employer)}</td>
                    <td className="is-net">{kip(run.total_net)}</td>
                    <td>
                      {isPaid
                        ? <>{moment(run.pay_date).format('DD/MM/YYYY')}{run.account && <small>{accountText(run.account)}</small>}</>
                        : <span className="pay-yr-muted"><i className="fa-solid fa-hand-pointer" /> {t('payOpenToPay')}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>{t('total')} · {runs.length} {t('payYrMonths')}</td>
                <td>{kip(sum(runs, (r) => r.total_gross))}</td>
                <td className="is-minus">−{kip(sum(runs, (r) => employeeDeductions(r)))}</td>
                <td>{kip(sum(runs, (r) => r.total_sso_employer))}</td>
                <td className="is-net">{kip(sum(runs, (r) => r.total_net))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
};

const PAGE_LABEL: Record<PageKind, string> = { upcoming: 'payUpcomingMonth', current: 'payNewMonth', missed: 'payMissedMonth' };

/**
 * ໜ້າເປົ່າຂອງເດືອນທີ່ຍັງບໍ່ໄດ້ສ້າງ — ກົດສ້າງ = ຄິດເງິນເດືອນຂອງເດືອນນັ້ນ ແລ້ວເປີດລາຍລະອຽດ.
 * upcoming = ເດືອນໜ້າ: ສະແດງລໍຖ້າໄວ້ ແຕ່ສ້າງບໍ່ໄດ້ຈົນຮອດວັນທີ 1 ຂອງເດືອນນັ້ນ
 */
const NewMonthPage = ({ period, kind, busy, onCreate }: { period: string; kind: PageKind; busy: boolean; onCreate: () => void }) => {
  const t = useT();
  const monthName = useMonthName();
  const upcoming = kind === 'upcoming';
  return (
    <article className={`pay-book is-new${upcoming ? ' is-upcoming' : ''}`}>
      <span className="pay-book-head">
        <small>{t(PAGE_LABEL[kind])}</small>
        <b>{monthName(period)}</b>
        <em>{periodLabel(period)}</em>
      </span>
      <span className="pay-book-new">
        <span className="pay-book-plus"><i className={`fa-solid ${upcoming ? 'fa-hourglass-half' : 'fa-plus'}`} /></span>
        <small>{upcoming ? `${t('payOpensOn')} ${moment(`${period}-01`).format('DD/MM/YYYY')}` : t('payNewMonthHint')}</small>
        <button type="button" className="acc-rp-btn is-primary" disabled={upcoming || !canCreate || busy} onClick={onCreate}>
          <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : upcoming ? 'fa-lock' : 'fa-money-check-dollar'}`} /> {t('payCreate')}
        </button>
      </span>
    </article>
  );
};

/**
 * ປຶ້ມເງິນເດືອນ — ໜ້າລະເດືອນຂອງປີທີ່ເລືອກ (‹ ປີ ›) ລຽງຕາມເວລາ ເກົ່າ → ໃໝ່ ຄືໜ້າປຶ້ມ. ປີປັດຈຸບັນມີໜ້າເປົ່າຢູ່ບ່ອນຂອງມັນ:
 * ເດືອນກ່ອນທີ່ລືມສ້າງ (ບໍ່ໃຫ້ຂ້າມເດືອນ), ເດືອນນີ້ທີ່ຍັງບໍ່ໄດ້ສ້າງ ແລະ ເດືອນໜ້າຢູ່ທ້າຍສຸດ (ລໍຖ້າ — ສ້າງໄດ້ເມື່ອຮອດເດືອນ)
 */
const PayrollList = ({ onOpen }: { onOpen: (id: number) => void }) => {
  const t = useT();
  const thisYear = moment().year();
  const [year, setYear] = useState(thisYear);
  const [creating, setCreating] = useState<string | null>(null);
  const [view, setView] = useSavedView('payrollView', VIEWS, 'book');
  const { rows, currentPeriod, loading } = usePayrolls(year);
  const current = currentPeriod ?? moment().format('YYYY-MM');
  const previous = moment(`${current}-01`).subtract(1, 'month').format('YYYY-MM');
  const next = moment(`${current}-01`).add(1, 'month').format('YYYY-MM');

  // ໜ້າເປົ່າ: ເດືອນນີ້ທີ່ຍັງບໍ່ມີ + ເດືອນກ່ອນທີ່ລືມສ້າງ (ສະເພາະເມື່ອມີເງິນເດືອນກ່ອນໜ້ານັ້ນແລ້ວ — ເລີ່ມໃຊ້ໃໝ່ບໍ່ຂຶ້ນ)
  const has = (period: string) => rows.some((r) => r.period === period);
  const pages: { period: string; kind: PageKind }[] = loading ? [] : [
    ...(year === thisYear ? [{ period: next, kind: 'upcoming' as const }] : []),
    ...(current.startsWith(String(year)) && !has(current) ? [{ period: current, kind: 'current' as const }] : []),
    ...(previous.startsWith(String(year)) && !has(previous) && rows.some((r) => r.period < previous)
      ? [{ period: previous, kind: 'missed' as const }] : []),
  ];

  // ໜ້າທີ່ສ້າງແລ້ວ + ໜ້າເປົ່າ ລຽງຕາມເດືອນ ເກົ່າ → ໃໝ່
  const timeline: { period: string; run?: Payroll; kind?: PageKind }[] = [
    ...rows.map((run) => ({ period: run.period, run })),
    ...pages,
  ].sort((a, b) => a.period.localeCompare(b.period));

  const create = async (period: string) => {
    try {
      setCreating(period);
      const res = await postApi('/payroll/create', { period });
      Notific.success('payCreated');
      onOpen(res.data.data._uuid);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="acs-page">
      <div className="pay-year-bar">
        <div className="pay-year-nav">
          <button type="button" className="acc-rp-btn" aria-label={t('previous')} onClick={() => setYear(year - 1)}>
            <i className="fa-solid fa-chevron-left" />
          </button>
          <b>{year}</b>
          <button type="button" className="acc-rp-btn" aria-label={t('next')} disabled={year >= thisYear} onClick={() => setYear(year + 1)}>
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
        <span className="pay-year-hint"><i className="fa-solid fa-circle-info" /> {t('payYearHint')}</span>
        <ViewSwitch views={VIEWS} value={view} onChange={setView} label="payViewLabel" className="pay-year-switch" />
      </div>

      <ListState loading={loading && !rows.length} empty={!rows.length && !pages.length} icon="fa-book">
        {view === 'year' ? (
          <PayrollYearView year={year} creating={creating} onOpen={onOpen} onCreate={create}
            months={Array.from({ length: 12 }, (_, i) => {
              const period = `${year}-${String(i + 1).padStart(2, '0')}`;
              return timeline.find((c) => c.period === period) ?? { period };
            })}
          />
        ) : (
        <div className="pay-books">
          {timeline.map((item) => (item.run
            ? <PayrollBook key={item.period} run={item.run} onOpen={() => onOpen(item.run!._uuid)} />
            : <NewMonthPage key={item.period} period={item.period} kind={item.kind!} busy={creating === item.period} onCreate={() => create(item.period)} />
          ))}
        </div>
        )}
      </ListState>
    </div>
  );
};

export default PayrollList;
