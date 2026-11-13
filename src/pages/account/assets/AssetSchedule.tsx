import { useEffect, useState } from 'react';
import { Loader, SelectPicker } from 'rsuite';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import { useFiscalYears } from '../../../utils/selectOption';
import StatementDoc from '../statements/StatementDoc';

type Row = {
  _uuid: number;
  asset_code: string;
  name: string;
  acquisition_date: string;
  cost: number;
  opening_accumulated: number;
  depreciation: number;
  closing_accumulated: number;
  nbv: number;
  disposed: boolean;
  disposal_date: string | null;
};

/**
 * ຕາຕະລາງຊັບສົມບັດຄົງທີ່ຂອງປີການເງິນ — ລາຄາທຶນ, ຄ່າຫຼຸ້ຍຫ້ຽນສະສົມຕົ້ນປີ, ຄ່າຫຼຸ້ຍຫ້ຽນໃນປີ, ສະສົມທ້າຍປີ,
 * ມູນຄ່າຍັງເຫຼືອ (ໃຊ້ແນບບົດອະທິບາຍງົບການເງິນ ແລະ ກວດນັບຊັບສົມບັດທ້າຍປີ)
 */
const AssetSchedule = () => {
  const t = useT();
  const years = useFiscalYears();
  const [fiscalId, setFiscalId] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const year = years.find((y) => y._uuid === fiscalId) ?? years.find((y) => Number(y.is_current) === 1) ?? years[0];

  useEffect(() => {
    if (!year) return;
    let cancelled = false;
    setRows(null);
    postApi('/fixed-asset/schedule', { start_date: year.start_date, end_date: year.end_date })
      .then((res) => !cancelled && setRows(res.data?.data ?? []))
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        Notific.error(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [year?._uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!year) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const period = `${moment(year.start_date).format('DD/MM/YYYY')} – ${moment(year.end_date).format('DD/MM/YYYY')}`;
  const sum = (k: keyof Row) => (rows ?? []).reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const exportRows = () =>
    exportExcel((rows ?? []).map((r) => ({
      [t('faCode')]: r.asset_code,
      [t('faName')]: r.name,
      [t('faAcquisitionDate')]: moment(r.acquisition_date).format('DD/MM/YYYY'),
      [t('faCost')]: r.cost,
      [t('faAccumOpening')]: r.opening_accumulated,
      [t('faDepreciationYear')]: r.depreciation,
      [t('faAccumClosing')]: r.closing_accumulated,
      [t('faNbv')]: r.nbv,
    })), `fixed-assets_${year.fiscal_code}`, `${t('faSchedule')} ${period}`);

  return (
    <div className="acs-page acc-fa">
      <div className="acc-fa-filter">
        <SelectPicker cleanable={false} searchable={false} value={year._uuid} onChange={(v) => setFiscalId(v ?? null)}
          data={years.map((y) => ({ value: y._uuid, label: y.fiscal_name || y.fiscal_code }))} />
      </div>
      <StatementDoc title={t('faSchedule')} period={period} unit="LAK" onExcel={exportRows}>
        {!rows ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : (
          <div className="acc-rp-scroll">
            <table className="acc-fs-table acc-fa-schedule">
              <thead>
                <tr>
                  <th>{t('faAsset')}</th>
                  <th>{t('faCost')}</th>
                  <th>{t('faAccumOpening')}</th>
                  <th>{t('faDepreciationYear')}</th>
                  <th>{t('faAccumClosing')}</th>
                  <th>{t('faNbv')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((r) => (
                  <tr key={r._uuid} className={`is-line${r.disposed ? ' is-disposed' : ''}`}>
                    <td>
                      <span className="acc-fs-code">{r.asset_code}</span>{r.name}
                      {r.disposed && <small>{t('faDisposedOn')} {moment(r.disposal_date).format('DD/MM/YYYY')}</small>}
                    </td>
                    <td>{formatNumber(r.cost)}</td>
                    <td>{formatNumber(r.opening_accumulated)}</td>
                    <td>{formatNumber(r.depreciation)}</td>
                    <td>{formatNumber(r.closing_accumulated)}</td>
                    <td><b>{formatNumber(r.nbv)}</b></td>
                  </tr>
                )) : (
                  <tr className="is-empty"><td colSpan={6}>{t('faEmpty')}</td></tr>
                )}
                <tr className="is-total">
                  <td>{t('total')}</td>
                  <td>{formatNumber(sum('cost'))}</td>
                  <td>{formatNumber(sum('opening_accumulated'))}</td>
                  <td>{formatNumber(sum('depreciation'))}</td>
                  <td>{formatNumber(sum('closing_accumulated'))}</td>
                  <td>{formatNumber(sum('nbv'))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </StatementDoc>
    </div>
  );
};

export default AssetSchedule;
