import { useState } from 'react';
import { DatePicker, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { fullName } from '../hrApi';
import { HrAvatar } from '../hrKit';
import { SearchBox } from '../../account/setting/settingKit';
import { kip } from '../payroll/payrollApi';
import {
  OT_KINDS, OT_PAY_HOURLY, OT_PAY_LUMP, OT_PAY_TYPES, dayLabel, hoursText, periodLabel, toPeriod, usePostData, weekdayKey, type Overtime, type OvertimeData,
} from './attendanceApi';
import OvertimeForm from './OvertimeForm';

const KindPill = ({ kind }: { kind: number }) => {
  const t = useT();
  const meta = OT_KINDS[kind] ?? OT_KINDS[1];
  return <span className={`ot-pill ${meta.tone}`}><i className={`fa-solid ${meta.icon}`} /> {t(meta.label)}</span>;
};

/** ວິທີຈ່າຍ + ເງິນ: ຕາມອັດຕາ "150%" / ຕໍ່ຊົ່ວໂມງ "50,000/ຊມ → 175,000" / ເໝົາ "200,000" */
const PayCell = ({ row, rate }: { row: Overtime; rate: number }) => {
  const t = useT();
  const meta = OT_PAY_TYPES[row.pay_type] ?? OT_PAY_TYPES[1];
  return (
    <span className={`ot-pay is-pay-${row.pay_type}`}>
      <small><i className={`fa-solid ${meta.icon}`} /> {t(meta.label)}</small>
      <b>
        {row.pay_type === OT_PAY_HOURLY ? `₭ ${kip(row.fixed_amount)}` : row.pay_type === OT_PAY_LUMP ? `₭ ${kip(row.amount)}` : `${rate}%`}
      </b>
      {row.pay_type === OT_PAY_HOURLY && <small>{kip(row.amount)} / {t('attHour')}</small>}
    </span>
  );
};

/**
 * ການເຮັດວຽກລ່ວງເວລາ (OT) ລາຍເດືອນ — ລາຍວັນ (ມື້ໃດ ໃຜເຮັດ OT ເວລາໃດ) ແລະ ສະຫຼຸບລາຍຄົນ (ຊົ່ວໂມງຕາມປະເພດ + ຄ່າ OT ໂດຍປະມານ).
 * ເງິນເດືອນຂອງເດືອນລວມ OT ໃຫ້ອັດຕະໂນມັດ (ໃບຮ່າງ ກົດຄິດໄລ່ໃໝ່); ເດືອນທີ່ຈ່າຍເງິນເດືອນແລ້ວ ແກ້ບໍ່ໄດ້
 */
const OvertimePage = () => {
  const t = useT();
  const current = toPeriod(new Date());
  const [period, setPeriod] = useState(current);
  const [view, setView] = useState<'daily' | 'summary'>('daily');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Overtime | 'new' | null>(null);
  const { data, loading, reload } = usePostData<OvertimeData>('/overtime/fetch', { period });

  const q = keyword.trim().toLowerCase();
  const match = (e: Overtime['employee']) => !q || `${e?.emp_code ?? ''} ${fullName(e)}`.toLowerCase().includes(q);
  const rows = (data?.data ?? []).filter((r) => match(r.employee));
  const summary = (data?.summary ?? []).filter((s) => match(s.employee));
  const byDate = [...rows.reduce((map, r) => map.set(r.work_date, [...(map.get(r.work_date) ?? []), r]), new Map<string, Overtime[]>())];
  const totalHours = summary.reduce((n, s) => n + s.hours, 0);
  const totalEstimate = summary.reduce((n, s) => n + s.estimate, 0);
  const locked = !!data?.paid;
  const shift = (months: number) => setPeriod(moment(`${period}-01`).add(months, 'month').format('YYYY-MM'));

  const remove = (row: Overtime) =>
    Notific.confirm(`${t('otDeleteConfirm')} ${fullName(row.employee)} (${dayLabel(row.work_date)})`, async () => {
      try {
        await deleteApi(`/overtime/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  const exportRows = () => {
    exportExcel(rows.map((r) => ({
      [t('date')]: dayLabel(r.work_date),
      [t('hrEmployeeCode')]: r.employee?.emp_code ?? '',
      [t('hrEmployee')]: fullName(r.employee),
      [t('otStart')]: r.start_time ?? '',
      [t('otEnd')]: r.end_time ?? '',
      [t('otHours')]: r.hours,
      [t('otKind')]: t(OT_KINDS[r.kind]?.label ?? ''),
      [t('otPayType')]: t(OT_PAY_TYPES[r.pay_type]?.label ?? ''),
      [t('otRate')]: r.pay_type === 1 ? `${data?.rates[r.kind] ?? 0}%` : '',
      [t('otAmountPerHour')]: r.pay_type === OT_PAY_HOURLY ? r.amount : '',
      [t('otPayAmount')]: r.fixed_amount || '',
      [t('attNote')]: r.note ?? '',
    })), `overtime_${period}`, `${t('attOvertime')} ${periodLabel(period)}`);
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
          <SearchBox value={keyword} onChange={setKeyword} placeholder={t('search')} />
          <div className="acc-rp-actions">
            <button type="button" className="acc-rp-btn" onClick={reload} disabled={loading}><i className="fa-solid fa-rotate-right" /></button>
            <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!rows.length}><i className="fa-solid fa-file-excel" /> Excel</button>
            <button type="button" className="acc-class-add" disabled={!canCreate || !data || locked} onClick={() => setEditing('new')}>
              <i className="fa-solid fa-plus" /> {t('otAdd')}
            </button>
          </div>
        </div>
      </div>

      {locked
        ? <p className="acc-bg-note is-warn"><i className="fa-solid fa-lock" /> {t('otLockedNote')}</p>
        : <p className="acc-bg-note"><i className="fa-solid fa-circle-info" /> {t('otNote')}</p>}

      {!data ? (
        <div className="text-center py-5">
          {loading ? <Loader size="md" content={t('loadingDots')} vertical /> : <p className="acc-gl-ref">{t('noData')}</p>}
        </div>
      ) : (
        <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
          <div className="acc-rp-kpis">
            <div className="acc-rp-kpi is-main">
              <small>{t('otTotalHours')}</small>
              <b>{hoursText(totalHours, t)}</b>
              <em>{rows.length} {t('otRecords')}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('otEmployees')}</small>
              <b>{summary.length}</b>
              <em>{byDate.length} {t('otDays')}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('otEstimate')}</small>
              <b>₭ {kip(totalEstimate)}</b>
              <em>{t('otEstimateHint')}</em>
            </div>
            <div className="acc-rp-kpi">
              <small>{t('otRates')}</small>
              <b className="ot-rates">
                {Object.entries(OT_KINDS).map(([k, meta]) => (
                  <span key={k} className={meta.tone} title={t(meta.label)}><i className={`fa-solid ${meta.icon}`} /> {data.rates[Number(k)]}%</span>
                ))}
              </b>
              <em>{t('otRatesHint')}</em>
            </div>
          </div>

          <div className="att-toolbar">
            <div className="acc-type-segment" role="tablist">
              {([['daily', 'otViewDaily', byDate.length], ['summary', 'otViewSummary', summary.length]] as const).map(([key, label, count]) => (
                <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'is-active' : ''} onClick={() => setView(key)}>
                  {t(label)} <em>{count}</em>
                </button>
              ))}
            </div>
          </div>

          {!rows.length ? (
            <div className="acc-class-empty"><i className="fa-solid fa-business-time" /><p>{t('otEmpty')}</p></div>
          ) : view === 'daily' ? (
            <div className="ot-days">
              {byDate.map(([date, list]) => {
                const day = data.days.find((d) => d.date === date);
                return (
                  <section key={date} className="ot-day-group">
                    <header>
                      <span className={`ot-date${day?.workday === false ? ' is-off' : ''}`}>
                        <b>{moment(date).format('DD')}</b>
                        <small>{moment(date).format('MM/YYYY')}</small>
                      </span>
                      <span className="ot-day-title">
                        <b>{t(weekdayKey(date))}</b>
                        <small>{day?.holiday ?? t(day?.workday === false ? 'otDayOff' : 'otWorkday')}</small>
                      </span>
                      <span className="ot-day-total">
                        <b>{hoursText(list.reduce((n, r) => n + r.hours, 0), t)}</b>
                        <small>{list.length} {t('otPeople')}</small>
                      </span>
                    </header>
                    <div className="acc-rp-scroll">
                      <table className="acc-gl-table hr-table att-table ot-table">
                        <tbody>
                          {list.map((r) => (
                            <tr key={r._uuid}>
                              <td>
                                <span className="hr-person">
                                  <HrAvatar url={r.employee?.profile_url} name={r.employee?.first_name} />
                                  <span>
                                    <b>{fullName(r.employee) || '—'}</b>
                                    <small className="acc-gl-ref">
                                      {r.employee?.emp_code}{r.employee?.department ? ` · ${r.employee.department.depart_name}` : ''}
                                    </small>
                                  </span>
                                </span>
                              </td>
                              <td className="ot-time">
                                <b>{r.start_time && r.end_time ? `${r.start_time} – ${r.end_time}` : '—'}</b>
                                <small>{hoursText(r.hours, t)}</small>
                              </td>
                              <td><KindPill kind={r.kind} /></td>
                              <td><PayCell row={r} rate={data.rates[r.kind] ?? 0} /></td>
                              <td className="att-note">{r.note}</td>
                              <td className="acc-gl-tree-actions">
                                <button type="button" className="acc-gl-act" disabled={!canEdit || locked} title={t('edit')} onClick={() => setEditing(r)}>
                                  <i className="fa-solid fa-pen" />
                                </button>
                                <button type="button" className="acc-gl-act is-danger" disabled={!canDelete || locked} title={t('delete')} onClick={() => remove(r)}>
                                  <i className="fa-solid fa-trash" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="acc-gl-group">
              <div className="acc-rp-scroll">
                <table className="acc-gl-table hr-table att-table ot-summary">
                  <thead>
                    <tr>
                      <th>{t('hrEmployee')}</th>
                      {Object.entries(OT_KINDS).map(([k, meta]) => (
                        <th key={k} className="text-end"><span className={`ot-th ${meta.tone}`}><i className={`fa-solid ${meta.icon}`} /> {t(meta.label)}</span></th>
                      ))}
                      <th className="text-end">{t('otTotalHours')}</th>
                      <th className="text-end">{t('otEstimate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((s) => (
                      <tr key={s.employee_id}>
                        <td>
                          <span className="hr-person">
                            <HrAvatar url={s.employee?.profile_url} name={s.employee?.first_name} />
                            <span>
                              <b>{fullName(s.employee) || '—'}</b>
                              <small className="acc-gl-ref">{s.employee?.emp_code} · {s.records} {t('otRecords')}</small>
                            </span>
                          </span>
                        </td>
                        {Object.keys(OT_KINDS).map((k) => (
                          <td key={k} className={`text-end${s.by_kind[Number(k)] ? '' : ' acc-gl-ref'}`}>{s.by_kind[Number(k)] ? hoursText(s.by_kind[Number(k)], t) : '—'}</td>
                        ))}
                        <td className="text-end"><b>{hoursText(s.hours, t)}</b></td>
                        <td className="text-end"><b>₭ {kip(s.estimate)}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {editing && data && (
        <OvertimeForm data={data} record={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </div>
  );
};

export default OvertimePage;
