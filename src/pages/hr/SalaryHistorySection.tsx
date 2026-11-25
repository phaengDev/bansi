import { useEffect, useState } from 'react';
import moment from 'moment';
import { formatNumber, getApi } from '../../utils/configApi';
import { useT } from '../../context/LanguageContext';
import type { Employee } from './hrApi';

type SalaryHistory = {
  current: number;
  /** ຊ່ວງເດືອນທີ່ຈ່າຍເງິນເດືອນພື້ນຖານເທົ່າກັນ (ໃໝ່ສຸດກ່ອນ) — ຈາກໃບເງິນເດືອນທີ່ຈ່າຍແລ້ວ */
  periods: { from: string; to: string; basic_salary: number; months: number }[];
  /** ການປ່ຽນເງິນເດືອນໃນຟອມພະນັກງານ (ປະຫວັດການແກ້ໄຂ) */
  changes: { at: string; user_name: string | null; from: number; to: number }[];
};

const monthText = (period: string) => moment(period, 'YYYY-MM').format('MM/YYYY');

/**
 * ປະຫວັດເງິນເດືອນ (ລາຍລະອຽດພະນັກງານ) — ເງິນເດືອນພື້ນຖານແຕ່ລະຊ່ວງ ຈາກໃບເງິນເດືອນທີ່ຈ່າຍແລ້ວ + ໃຜປ່ຽນ ເມື່ອໃດ.
 * ບໍ່ມີທັງສອງ = ບໍ່ສະແດງ. ໃຊ້ສະເພາະຜູ້ມີສິດເມນູເງິນເດືອນ (ຜູ້ເອີ້ນກວດກ່ອນ — API ກໍ່ກວດ)
 */
const SalaryHistorySection = ({ employee }: { employee: Employee }) => {
  const t = useT();
  const [data, setData] = useState<SalaryHistory | null>(null);

  useEffect(() => {
    let alive = true;
    getApi(`/employee/salary-history/${btoa(String(employee._uuid))}`)
      .then((res) => alive && setData(res.data?.data ?? null))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [employee._uuid, employee.basic_salary]);

  if (!data || (!data.periods.length && !data.changes.length)) return null;
  const latestPaid = data.periods[0]?.basic_salary;
  return (
    <section className="hr-profile-block hr-salary-history">
      <header>
        <h6><i className="fa-solid fa-chart-line" /> {t('shTitle')}</h6>
        {latestPaid !== undefined && latestPaid !== data.current && (
          <small className="hr-salary-next"><i className="fa-solid fa-circle-info" /> {t('shNextPay')} ₭ {formatNumber(data.current)}</small>
        )}
      </header>
      {!!data.periods.length && (
        <ol className="hr-salary-periods">
          {data.periods.map((p, i) => {
            const before = data.periods[i + 1]?.basic_salary;
            const diff = before !== undefined ? p.basic_salary - before : 0;
            return (
              <li key={p.from}>
                <span className="hr-salary-range">
                  {monthText(p.from)}{p.to !== p.from ? ` – ${monthText(p.to)}` : ''}
                  <small>{p.months} {t('shMonths')}</small>
                </span>
                <b>₭ {formatNumber(p.basic_salary)}</b>
                {diff !== 0 && (
                  <em className={diff > 0 ? 'is-up' : 'is-down'}>
                    <i className={`fa-solid fa-arrow-${diff > 0 ? 'up' : 'down'}`} /> {formatNumber(Math.abs(diff))}
                  </em>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {!!data.changes.length && (
        <ul className="hr-salary-changes">
          {data.changes.map((c) => (
            <li key={c.at}>
              <i className="fa-solid fa-pen" />
              <span>{moment(c.at).format('DD/MM/YYYY HH:mm')} · {c.user_name ?? '—'}</span>
              <span className="hr-salary-change">₭ {formatNumber(c.from)} <i className="fa-solid fa-arrow-right" /> <b>₭ {formatNumber(c.to)}</b></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default SalaryHistorySection;
