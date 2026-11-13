import { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatNumber, getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { useFixedAssets } from './faApi';

type Preview = {
  month: string;
  posted: { entry_id: number; entry_number: string; entry_date: string } | null;
  latest: string | null;
  rows: { asset_id: number; amount: number; accumulated?: number }[];
  total: number;
};
type Run = { period: string; total: number; assets: number; entry_number: string | null };

/** ເດືອນເລີ່ມຕົ້ນ: ຕໍ່ຈາກເດືອນລ່າສຸດທີ່ລົງແລ້ວ ຫຼື ເດືອນກ່ອນ */
const defaultMonth = (latest: string | null) =>
  (latest ? moment(latest, 'YYYY-MM').add(1, 'month') : moment().subtract(1, 'month')).startOf('month').toDate();

/**
 * ຄ່າຫຼຸ້ຍຫ້ຽນປະຈຳເດືອນ — ເລືອກເດືອນ ເບິ່ງຍອດຂອງແຕ່ລະຊັບສົມບັດ ແລ້ວລົງບັນຊີ (ໃບດຽວ ວັນທີທ້າຍເດືອນ).
 * ລົງຊ້ຳເດືອນລ່າສຸດໄດ້ (ກັບໃບເກົ່າແລ້ວຄິດໃໝ່), ຍົກເລີກໄດ້ສະເພາະເດືອນລ່າສຸດ
 */
const DepreciationPage = () => {
  const t = useT();
  const { rows: assets } = useFixedAssets();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRuns = useCallback(async () => {
    const res = await getApi('/fixed-asset/runs');
    const list: Run[] = res.data?.data ?? [];
    setRuns(list);
    setMonth((cur) => cur ?? defaultMonth(list[0]?.period ?? null));
  }, []);

  useEffect(() => {
    loadRuns().catch((err) => Notific.error(getErrorMessage(err)));
  }, [loadRuns]);

  const monthKey = month ? moment(month).format('YYYY-MM') : null;
  const loadPreview = useCallback(async () => {
    if (!monthKey) return;
    try {
      const res = await postApi('/fixed-asset/depreciation-preview', { month: monthKey });
      setPreview(res.data);
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  }, [monthKey]);

  useEffect(() => {
    setPreview(null);
    loadPreview();
  }, [loadPreview]);

  if (!runs || !month) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const assetOf = (id: number) => assets.find((a) => a._uuid === id);
  const monthText = moment(month).format('MM/YYYY');
  const before = !!preview?.latest && !!monthKey && monthKey < preview.latest;

  const post = () =>
    Notific.confirm(`${t(preview?.posted ? 'faRepostConfirm' : 'faPostConfirm')} ${monthText}`, async () => {
      try {
        setBusy(true);
        const res = await postApi('/fixed-asset/depreciate', { month: monthKey });
        Notific.success(`${t('faPosted')} ${res.data?.data?.entry_number ?? ''}`);
        await Promise.all([loadRuns(), loadPreview()]);
      } catch (err) {
        Notific.error(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    });

  const undo = (period: string) =>
    Notific.confirm(`${t('faUndoConfirm')} ${moment(period, 'YYYY-MM').format('MM/YYYY')}`, async () => {
      try {
        await deleteApi(`/fixed-asset/depreciate/${period}`);
        Notific.success('acsDeleted');
        await Promise.all([loadRuns(), loadPreview()]);
      } catch (err) {
        Notific.error(getErrorMessage(err));
      }
    });

  return (
    <div className="acs-page acc-fa">
      <section className="acc-rp-card">
        <header>
          <h4><i className="fa-solid fa-chart-line" /> {t('faDepreciation')}</h4>
          <DatePicker format="MM/yyyy" value={month} onChange={(v) => v && setMonth(v)} cleanable={false} oneTap placement="bottomEnd" />
        </header>

        {!preview ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : (
          <>
            <p className={`acc-fa-status${preview.posted ? ' is-done' : ''}`}>
              <i className={`fa-solid ${preview.posted ? 'fa-circle-check' : before ? 'fa-ban' : 'fa-hourglass-half'}`} />
              {preview.posted
                ? <>{t('faPostedAs')} <b>{preview.posted.entry_number}</b> · {moment(preview.posted.entry_date).format('DD/MM/YYYY')}</>
                : before ? t('faBeforeLatest') : t('faNotPosted')}
            </p>
            <div className="acc-rp-scroll">
              <table className="acc-fs-table">
                <thead>
                  <tr>
                    <th>{t('faAsset')}</th>
                    <th>{t('faCost')}</th>
                    {!preview.posted && <th>{t('faAccumulatedBefore')}</th>}
                    <th>{t('faDepreciation')} {monthText}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.length ? preview.rows.map((r) => {
                    const a = assetOf(r.asset_id);
                    return (
                      <tr key={r.asset_id} className="is-line">
                        <td><span className="acc-fs-code">{a?.asset_code}</span>{a?.name ?? `#${r.asset_id}`}</td>
                        <td>{a ? formatNumber(a.cost) : ''}</td>
                        {!preview.posted && <td>{formatNumber(r.accumulated ?? 0)}</td>}
                        <td>{formatNumber(r.amount)}</td>
                      </tr>
                    );
                  }) : (
                    <tr className="is-empty"><td colSpan={4}>{t('faNothingToPost')}</td></tr>
                  )}
                  <tr className="is-total">
                    <td colSpan={preview.posted ? 2 : 3}>{t('total')}</td>
                    <td>{formatNumber(preview.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <footer className="acc-fa-foot">
              <span>{t('faPostHint')}</span>
              <Button appearance="primary" loading={busy} disabled={!canCreate || before || !preview.rows.length || (!!preview.posted && preview.latest !== monthKey)} onClick={post}>
                <i className={`fa-solid ${preview.posted ? 'fa-rotate' : 'fa-check'}`} /> {t(preview.posted ? 'faRepost' : 'faPost')} {monthText}
              </Button>
            </footer>
          </>
        )}
      </section>

      {!!runs.length && (
        <section className="acc-rp-card">
          <header><h4><i className="fa-solid fa-clock-rotate-left" /> {t('faRuns')}</h4></header>
          <div className="acc-rp-scroll">
            <table className="acc-fs-table">
              <thead>
                <tr>
                  <th>{t('faMonth')}</th>
                  <th>{t('vatEntryNo')}</th>
                  <th>{t('faCount')}</th>
                  <th>{t('total')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={r.period} className="is-line">
                    <td>{moment(r.period, 'YYYY-MM').format('MM/YYYY')}</td>
                    <td>{r.entry_number ?? '—'}</td>
                    <td>{r.assets}</td>
                    <td>{formatNumber(r.total)}</td>
                    <td className="acc-fa-actions">
                      {i === 0 && canDelete && (
                        <button type="button" className="is-danger" onClick={() => undo(r.period)} title={t('faUndo')} aria-label={t('faUndo')}>
                          <i className="fa-solid fa-rotate-left" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default DepreciationPage;
