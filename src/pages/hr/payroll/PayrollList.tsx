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
      </div>

      <ListState loading={loading && !rows.length} empty={!rows.length && !pages.length} icon="fa-book">
        <div className="pay-books">
          {timeline.map((item) => (item.run
            ? <PayrollBook key={item.period} run={item.run} onOpen={() => onOpen(item.run!._uuid)} />
            : <NewMonthPage key={item.period} period={item.period} kind={item.kind!} busy={creating === item.period} onCreate={() => create(item.period)} />
          ))}
        </div>
      </ListState>
    </div>
  );
};

export default PayrollList;
