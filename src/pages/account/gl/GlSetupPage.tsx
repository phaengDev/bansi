import { useCallback, useEffect, useState } from 'react';
import { Loader } from 'rsuite';
import { getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { GlNotReady } from './glKit';

type Status = {
  ready: boolean;
  unposted?: { incomes: number; expenses: number; transfers: number };
  entries?: number;
};
type RebuildResult = { posted: number; skipped: number; failed: { source: string; message: string }[] };

/**
 * ສະຖານະຂອງລະບົບບັນຊີຄູ່ + ລົງບັນຊີຍ້ອນຫຼັງ: ເອກະສານ (ລາຍຮັບ/ລາຍຈ່າຍ/ໂອນ/ຍອດຍົກມາ) ທີ່ບັນທຶກກ່ອນເປີດລະບົບ
 * ຍັງບໍ່ມີໃບບັນທຶກ — ກົດເທື່ອດຽວຫຼັງຜູກບັນຊີແລ້ວ (ກົດຊ້ຳໄດ້ ບໍ່ລົງຊ້ຳ)
 */
const GlSetupPage = () => {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RebuildResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getApi('/gl/status');
      setStatus(res.data);
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rebuild = () => {
    Notific.confirm('glRebuildConfirm', async () => {
      try {
        setRunning(true);
        const res = await postApi('/gl/rebuild', {});
        setResult(res.data);
        Notific.success('glRebuildDone');
        load();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      } finally {
        setRunning(false);
      }
    });
  };

  if (!status) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;
  if (!status.ready) return <GlNotReady />;

  const unposted = status.unposted ?? { incomes: 0, expenses: 0, transfers: 0 };
  const pending = unposted.incomes + unposted.expenses + unposted.transfers;

  return (
    <div className="acs-page acc-gl">
      <div className="acc-gl-setup-card is-ok">
        <i className="fa-solid fa-circle-check" />
        <div>
          <b>{t('glReadyTitle')}</b>
          <p>{t('glReadyText')}</p>
        </div>
        <span className="acc-gl-setup-stat"><b>{status.entries ?? 0}</b> {t('glEntries')}</span>
      </div>

      <section className="acc-gl-steps">
        <header>{t('glStepsTitle')}</header>
        <ol>
          <li><b>{t('glStep1')}</b><small>{t('glStep1Hint')}</small></li>
          <li><b>{t('glStep2')}</b><small>{t('glStep2Hint')}</small></li>
          <li><b>{t('glStep3')}</b><small>{t('glStep3Hint')}</small></li>
          <li><b>{t('glStep4')}</b><small>{t('glStep4Hint')}</small></li>
        </ol>
      </section>

      <section className="acc-gl-rebuild">
        <div className="acc-gl-rebuild-stats">
          <span><b>{unposted.incomes}</b> {t('glSourceIncome')}</span>
          <span><b>{unposted.expenses}</b> {t('glSourceExpense')}</span>
          <span><b>{unposted.transfers}</b> {t('glSourceTransfer')}</span>
        </div>
        <p>{pending ? t('glRebuildPending') : t('glRebuildNone')}</p>
        <button type="button" className="acc-class-add" disabled={running || !canCreate} onClick={rebuild}>
          {running ? <Loader size="xs" /> : <i className="fa-solid fa-wand-magic-sparkles" />} {t('glRebuild')}
        </button>
        {result && (
          <div className="acc-gl-rebuild-result">
            <span className="is-ok"><i className="fa-solid fa-check" /> {t('glPosted')} {result.posted}</span>
            <span><i className="fa-solid fa-forward" /> {t('glSkipped')} {result.skipped}</span>
            {result.failed.length > 0 && (
              <>
                <span className="is-bad"><i className="fa-solid fa-triangle-exclamation" /> {t('glFailed')} {result.failed.length}</span>
                <ul>
                  {result.failed.slice(0, 30).map((f, i) => <li key={i}><b>{f.source}</b> — {f.message}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default GlSetupPage;
