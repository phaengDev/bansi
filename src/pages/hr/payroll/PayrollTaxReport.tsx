import { useEffect, useMemo, useState } from 'react';
import { Loader, SelectPicker } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import StatementDoc from '../../account/statements/StatementDoc';
import { isFullMode, useAccountSetting } from '../../account/accountSettings';

type Line = {
  employee_id: number;
  emp_code: string;
  employee_name: string;
  department_name: string | null;
  /** ເລກ ປກສ / ເລກບັດປະຈຳຕົວ — ຈາກຂໍ້ມູນພະນັກງານ (API ລຸ້ນເກົ່າ = ບໍ່ມີ) */
  sso_no?: string | null;
  id_card_no?: string | null;
  gross: number;
  sso_base: number;
  sso_employee: number;
  sso_employer: number;
  taxable: number;
  tax: number;
};
type Month = { period: string; number: string | null; pay_date: string | null; lines: Line[] };

const NUMS = ['gross', 'sso_base', 'sso_employee', 'sso_employer', 'taxable', 'tax'] as const;
type NumKey = (typeof NUMS)[number];
const sumOf = (lines: Line[], key: NumKey) => lines.reduce((n, l) => n + (Number(l[key]) || 0), 0);

/** ລວມປີຕໍ່ພະນັກງານ (ຄົນທີ່ມີໃນຫຼາຍເດືອນ ລວມເປັນແຖວດຽວ) */
const yearly = (months: Month[]) => {
  const map = new Map<number, Line & { months: number }>();
  for (const m of months) {
    for (const l of m.lines) {
      const cur = map.get(l.employee_id) ?? { ...l, gross: 0, sso_base: 0, sso_employee: 0, sso_employer: 0, taxable: 0, tax: 0, months: 0 };
      NUMS.forEach((k) => { cur[k] = Math.round((cur[k] + (Number(l[k]) || 0)) * 100) / 100; });
      map.set(l.employee_id, { ...cur, employee_name: l.employee_name, department_name: l.department_name, months: cur.months + 1 });
    }
  }
  return [...map.values()].sort((a, b) => String(a.emp_code).localeCompare(String(b.emp_code)));
};

/**
 * ລາຍງານອາກອນລາຍໄດ້ເງິນເດືອນ ແລະ ປະກັນສັງຄົມ — ສະເພາະເງິນເດືອນທີ່ຈ່າຍແລ້ວ (POST /payroll/tax-report):
 * ລາຍເດືອນ (ໃຊ້ແຈ້ງ ແລະ ນຳສົ່ງປະຈຳເດືອນ) ຫຼື ລວມປີຕໍ່ຄົນ. ບັນຊີແບບທຳມະດາ = ບໍ່ມີຖັນອາກອນ (ບໍ່ໄດ້ຫັກ). ພິມ / Excel
 */
const PayrollTaxReport = () => {
  const t = useT();
  const full = isFullMode(useAccountSetting());
  const thisYear = Number(moment().format('YYYY'));
  const [year, setYear] = useState(thisYear);
  const [months, setMonths] = useState<Month[] | null>(null);
  /** ເດືອນ "YYYY-MM" ຫຼື 'year' = ລວມປີ */
  const [view, setView] = useState<string>('year');

  useEffect(() => {
    setMonths(null);
    postApi('/payroll/tax-report', { year })
      .then((res) => {
        const data: Month[] = res.data?.data ?? [];
        setMonths(data);
        setView(data.length ? data[data.length - 1].period : 'year');
      })
      .catch((err) => {
        setMonths([]);
        Notific.error(getErrorMessage(err));
      });
  }, [year]);

  const month = months?.find((m) => m.period === view) ?? null;
  const rows: (Line & { months?: number })[] = useMemo(
    () => (view === 'year' ? yearly(months ?? []) : month?.lines ?? []),
    [view, months, month],
  );
  const cols: { key: NumKey; label: string }[] = [
    { key: 'gross', label: t('payGross') },
    { key: 'sso_base', label: `${t('paySsoBase')} ${t('tpKindSso')}` },
    { key: 'sso_employee', label: t('paySsoEmployee') },
    { key: 'sso_employer', label: t('paySsoEmployer') },
    ...(full ? [{ key: 'taxable' as NumKey, label: t('payTaxable') }, { key: 'tax' as NumKey, label: t('payTax') }] : []),
  ];
  const periodText = view === 'year' ? `${t('ptrYear')} ${year}` : `${t('ptrMonth')} ${moment(view, 'YYYY-MM').format('MM/YYYY')}`;

  const exportRows = () => exportExcel(rows.map((r) => ({
    [t('hrEmployeeCode')]: r.emp_code,
    [t('hrEmployee')]: r.employee_name,
    [t('hrDepartment')]: r.department_name ?? '',
    [t('hrSsoNo')]: r.sso_no ?? '',
    [t('hrIdCardNo')]: r.id_card_no ?? '',
    ...(view === 'year' ? { [t('ptrMonths')]: r.months ?? 0 } : {}),
    ...Object.fromEntries(cols.map((c) => [c.label, Number(r[c.key]) || 0])),
  })), `payroll_tax_${view}`, `${t('ptrTitle')} ${periodText}`);

  return (
    <div className="acs-page acc-close">
      <section className="acc-rp-card">
        <header>
          <h4><i className="fa-solid fa-file-invoice" /> {t('ptrTitle')}</h4>
          <span className="acc-rp-card-tools">
            <SelectPicker cleanable={false} searchable={false} value={year} onChange={(v) => v && setYear(v)}
              data={Array.from({ length: 5 }, (_, i) => thisYear - i).map((y) => ({ value: y, label: String(y) }))}
            />
          </span>
        </header>
        {!months ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : !months.length ? (
          <p className="acc-arap-empty">{t('ptrEmpty')}</p>
        ) : (
          <>
            <div className="acc-type-segment acc-ptr-months" role="tablist">
              {months.map((m) => (
                <button key={m.period} type="button" role="tab" aria-selected={view === m.period}
                  className={view === m.period ? 'is-active' : ''} onClick={() => setView(m.period)}
                >
                  {moment(m.period, 'YYYY-MM').format('MM/YY')}
                </button>
              ))}
              <button type="button" role="tab" aria-selected={view === 'year'} className={view === 'year' ? 'is-active' : ''} onClick={() => setView('year')}>
                {t('ptrYearTotal')}
              </button>
            </div>
            {/* ຍອດທີ່ຕ້ອງນຳສົ່ງ: ປກສ = ສ່ວນພະນັກງານ + ສ່ວນບໍລິສັດ, ອາກອນລາຍໄດ້ (ສະເພາະແບບຄົບຕາມມາດຕະຖານ) */}
            <div className="acc-ptr-remit">
              <span>
                <small><i className="fa-solid fa-shield-heart" /> {t('ptrRemitSso')}</small>
                <b>₭ {formatNumber(sumOf(rows, 'sso_employee') + sumOf(rows, 'sso_employer'))}</b>
                <em>{formatNumber(sumOf(rows, 'sso_employee'))} + {formatNumber(sumOf(rows, 'sso_employer'))}</em>
              </span>
              {full && (
                <span>
                  <small><i className="fa-solid fa-landmark" /> {t('ptrRemitTax')}</small>
                  <b>₭ {formatNumber(sumOf(rows, 'tax'))}</b>
                  <em>{rows.filter((r) => Number(r.tax) > 0).length} {t('ptrPeople')}</em>
                </span>
              )}
              {rows.some((r) => !r.sso_no) && (
                <span className="is-warn">
                  <small><i className="fa-solid fa-triangle-exclamation" /> {t('ptrNoSso')}</small>
                  <b>{rows.filter((r) => !r.sso_no).length} {t('ptrPeople')}</b>
                  <em>{t('ptrNoSsoHint')}</em>
                </span>
              )}
            </div>
            <StatementDoc title={t('ptrTitle')} period={periodText} unit="LAK" onExcel={exportRows}
              note={<p>{t(full ? 'ptrNote' : 'ptrNoteSimple')}</p>}
            >
              <div className="acc-rp-scroll">
                <table className="acc-fs-table acc-ptr-table">
                  <thead>
                    <tr>
                      <th>{t('hrEmployee')}</th>
                      {view === 'year' && <th>{t('ptrMonths')}</th>}
                      {cols.map((c) => <th key={c.key}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.employee_id} className="is-line">
                        <td>
                          <b>{r.emp_code} · {r.employee_name}</b>
                          <small>
                            {[r.department_name, r.sso_no && `${t('ptrSsoShort')} ${r.sso_no}`, r.id_card_no && `${t('ptrIdShort')} ${r.id_card_no}`].filter(Boolean).join(' · ')}
                            {!r.sso_no && <span className="acc-ptr-missing"> · <i className="fa-solid fa-triangle-exclamation" /> {t('ptrNoSso')}</span>}
                          </small>
                        </td>
                        {view === 'year' && <td>{r.months}</td>}
                        {cols.map((c) => <td key={c.key} className={c.key === 'tax' ? 'is-strong' : ''}>{formatNumber(Number(r[c.key]) || 0)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="is-total">
                      <td>{t('total')} · {rows.length} {t('ptrPeople')}</td>
                      {view === 'year' && <td />}
                      {cols.map((c) => <td key={c.key}>{formatNumber(sumOf(rows, c.key))}</td>)}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </StatementDoc>
          </>
        )}
      </section>
    </div>
  );
};

export default PayrollTaxReport;
