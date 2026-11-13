import { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatDecimal, formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { isNotReady } from '../gl/glApi';
import { GlNotReady } from '../gl/glKit';

type Item = { kind: 'treasury' | 'ar' | 'ap'; label: string; currency: string; foreign: number; book: number; rate: number; target: number; diff: number };
type Preview = {
  month: string;
  posted: { entry_number: string; entry_date: string; total: number } | null;
  latest: string | null;
  items: Item[];
  net: number;
};

const KIND_LABEL: Record<Item['kind'], string> = { treasury: 'fxKindTreasury', ar: 'fxKindAr', ap: 'fxKindAp' };

/**
 * ປັບມູນຄ່າເງິນຕາຕ່າງປະເທດທ້າຍເດືອນ — ຍອດ USD/THB… ຂອງ ບັນຊີເງິນຄັງ, ລູກໜີ້ ແລະ ເຈົ້າໜີ້ ຄິດເປັນກີບຕາມອັດຕາທ້າຍເດືອນ
 * (ຕັ້ງຢູ່ ຕັ້ງຄ່າບັນຊີ → ອັດຕາແລກປ່ຽນ), ສ່ວນຕ່າງ = ກຳໄລ/ຂາດທຶນອັດຕາແລກປ່ຽນ. ໃບດຽວຕໍ່ເດືອນ
 */
const FxRevalPage = () => {
  const t = useT();
  const [month, setMonth] = useState<Date>(() => moment().subtract(1, 'month').startOf('month').toDate());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const monthKey = moment(month).format('YYYY-MM');
  const monthText = moment(month).format('MM/YYYY');

  const load = useCallback(async () => {
    try {
      setPreview(null);
      const res = await postApi('/fx-reval/preview', { month: monthKey });
      setPreview(res.data);
    } catch (err) {
      if (isNotReady(err)) setNotReady(true);
      else Notific.error(getErrorMessage(err));
    }
  }, [monthKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (notReady) return <GlNotReady />;

  const before = !!preview?.latest && monthKey < preview.latest;
  const isLatest = preview?.latest === monthKey;

  const post = () =>
    Notific.confirm(`${t(preview?.posted ? 'fxRepostConfirm' : 'fxPostConfirm')} ${monthText}`, async () => {
      try {
        setBusy(true);
        const res = await postApi('/fx-reval/post', { month: monthKey });
        Notific.success(`${t('faPosted')} ${res.data?.data?.entry_number ?? ''}`);
        await load();
      } catch (err) {
        Notific.error(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    });

  const undo = () =>
    Notific.confirm(`${t('fxUndoConfirm')} ${monthText}`, async () => {
      try {
        await deleteApi(`/fx-reval/${monthKey}`);
        Notific.success('acsDeleted');
        await load();
      } catch (err) {
        Notific.error(getErrorMessage(err));
      }
    });

  return (
    <div className="acs-page acc-close">
      <section className="acc-rp-card">
        <header>
          <h4><i className="fa-solid fa-arrow-right-arrow-left" /> {t('closeFxReval')}</h4>
          <DatePicker format="MM/yyyy" value={month} onChange={(v) => v && setMonth(v)} cleanable={false} oneTap placement="bottomEnd" />
        </header>
        <p className="acc-close-note"><i className="fa-solid fa-circle-info" /> {t('fxHint')}</p>

        {!preview ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : preview.posted ? (
          <p className="acc-fa-status is-done">
            <i className="fa-solid fa-circle-check" /> {t('faPostedAs')} <b>{preview.posted.entry_number}</b> · {moment(preview.posted.entry_date).format('DD/MM/YYYY')}
            · ₭ {formatNumber(preview.posted.total)}
          </p>
        ) : (
          <div className="acc-rp-scroll">
            <table className="acc-fs-table acc-fx-table">
              <thead>
                <tr>
                  <th>{t('fxItem')}</th>
                  <th>{t('fxForeign')}</th>
                  <th>{t('fxRate')}</th>
                  <th>{t('fxBook')}</th>
                  <th>{t('fxTarget')}</th>
                  <th>{t('fxDiff')}</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.length ? preview.items.map((i, index) => (
                  <tr key={index} className="is-line">
                    <td><b>{i.label}</b><small>{t(KIND_LABEL[i.kind])}</small></td>
                    <td>{formatDecimal(i.foreign)} {i.currency}</td>
                    <td>{formatNumber(i.rate)}</td>
                    <td>{formatNumber(i.book)}</td>
                    <td>{formatNumber(i.target)}</td>
                    <td className={(i.kind === 'ap' ? -i.diff : i.diff) >= 0 ? 'is-gain' : 'is-loss'}>{formatNumber(i.diff)}</td>
                  </tr>
                )) : (
                  <tr className="is-empty"><td colSpan={6}>{t('fxNothing')}</td></tr>
                )}
                {!!preview.items.length && (
                  <tr className="is-total">
                    <td colSpan={5}>{t(preview.net >= 0 ? 'fxNetGain' : 'fxNetLoss')}</td>
                    <td>{formatNumber(Math.abs(preview.net))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {preview && (
          <footer className="acc-fa-foot">
            <span>{before ? t('fxBeforeLatest') : t('fxPostHint')}</span>
            <span className="acc-fa-foot-actions">
              {preview.posted && isLatest && canDelete && (
                <Button appearance="default" onClick={undo}><i className="fa-solid fa-rotate-left" /> {t('faUndo')}</Button>
              )}
              <Button appearance="primary" loading={busy}
                disabled={!canCreate || before || (!preview.posted && !preview.items.length) || (!!preview.posted && !isLatest)} onClick={post}
              >
                <i className={`fa-solid ${preview.posted ? 'fa-rotate' : 'fa-check'}`} /> {t(preview.posted ? 'faRepost' : 'faPost')} {monthText}
              </Button>
            </span>
          </footer>
        )}
      </section>
    </div>
  );
};

export default FxRevalPage;
