import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Loader } from 'rsuite';
import moment from 'moment';
import { getApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { isNotReady } from '../gl/glApi';
import { GlNotReady } from '../gl/glKit';
import { refreshAccountSetting } from '../accountSettings';

type Check = { key: 'depreciation' | 'bank' | 'fx'; ok: boolean; detail?: string };
type Month = { month: string; start: string; end: string; closed: boolean; entries: number; checks?: Check[] };
type Status = {
  fiscal: { _uuid: number; fiscal_code: string; fiscal_name?: string; start_date: string; end_date: string; status: number };
  lock_date: string | null;
  months: Month[];
  next: string | null;
};

/** ລາຍການກວດອັດຕະໂນມັດ → ຂໍ້ຄວາມ + ແຖບທີ່ໄປແກ້ */
const AUTO: Record<Check['key'], { label: string; target: string; window?: string }> = {
  depreciation: { label: 'closeCheckDepreciation', target: 'depreciation', window: 'fixedAssets' },
  bank: { label: 'closeCheckBank', target: 'bankRec' },
  fx: { label: 'closeCheckFx', target: 'fxReval' },
};

/** ສິ່ງທີ່ຕ້ອງເຮັດກ່ອນປິດເດືອນ (ກົດໝາຍບັນຊີ ມາດຕາ 23) — ຕິກຢືນຢັນເອງ, ບໍ່ບັນທຶກ */
const MANUAL = ['closeManualCash', 'closeManualParties', 'closeManualDocs', 'closeManualTrial'];

const monthText = (month: string) => moment(month, 'YYYY-MM').format('MM/YYYY');

/**
 * ປິດງວດປະຈຳເດືອນ — ທຸກເດືອນຂອງປີການເງິນປັດຈຸບັນ (ປິດແລ້ວ / ເປີດ), ເດືອນທີ່ຈະປິດຖັດໄປ ມີລາຍການກວດ
 * (ອັດຕະໂນມັດ: ຄ່າຫຼຸ້ຍຫ້ຽນ, ກະທົບຍອດທະນາຄານ, ປັບອັດຕາແລກປ່ຽນ — ຕາມຟັງຊັນທີ່ເປີດ; ຕິກເອງ: ນັບເງິນສົດ, ກວດກັບຄູ່ຄ້າ…).
 * ປິດແລ້ວ ລົງ/ແກ້/ຍົກເລີກ ເອກະສານວັນທີໃນງວດນັ້ນບໍ່ໄດ້ (backend ກວດ). ເປີດຄືນໄດ້ສະເພາະເດືອນທີ່ປິດລ່າສຸດ
 */
const PeriodClosePage = ({ onOpen }: { onOpen: (key: string) => void }) => {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ticked, setTicked] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await getApi('/period-close/status');
      setStatus(res.data);
      setError('');
    } catch (err) {
      if (isNotReady(err)) setNotReady(true);
      else setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (notReady) return <GlNotReady />;
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;
  if (!status) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const next = status.months.find((m) => m.month === status.next) ?? null;
  const lastClosed = [...status.months].reverse().find((m) => m.closed) ?? null;
  const yearClosed = Number(status.fiscal.status) === 2;
  const due = next ? moment(next.end).isBefore(moment(), 'day') || moment().isSame(next.end, 'month') : false;
  const warnings = next?.checks?.filter((c) => !c.ok) ?? [];

  const run = (path: string, month: string, confirmKey: string) =>
    Notific.confirm(`${t(confirmKey)} ${monthText(month)}`, async () => {
      try {
        setBusy(true);
        await putApi(path, { month });
        Notific.success('acsSaved');
        setTicked([]);
        await Promise.all([load(), refreshAccountSetting()]);
      } catch (err) {
        Notific.error(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    });

  return (
    <div className="acs-page acc-close">
      <div className="acc-close-head">
        <span>
          <small>{t('accountSetFiscalYear')}</small>
          <b>{status.fiscal.fiscal_name || status.fiscal.fiscal_code}</b>
          <em>{moment(status.fiscal.start_date).format('DD/MM/YYYY')} – {moment(status.fiscal.end_date).format('DD/MM/YYYY')}</em>
        </span>
        <span className={status.lock_date ? 'is-locked' : ''}>
          <i className={`fa-solid ${status.lock_date ? 'fa-lock' : 'fa-lock-open'}`} />
          {status.lock_date ? `${t('acgLockedThrough')} ${moment(status.lock_date).format('DD/MM/YYYY')}` : t('closeNothingClosed')}
        </span>
      </div>

      <div className="acc-close-months">
        {status.months.map((m) => {
          const isNext = m.month === status.next;
          const isLast = lastClosed?.month === m.month;
          return (
            <div key={m.month} className={`acc-close-month${m.closed ? ' is-closed' : ''}${isNext ? ' is-next' : ''}`}>
              <b>{monthText(m.month)}</b>
              <small>{m.entries} {t('closeEntries')}</small>
              <em>
                <i className={`fa-solid ${m.closed ? 'fa-lock' : isNext ? 'fa-hourglass-half' : 'fa-lock-open'}`} />
                {t(m.closed ? 'closeClosed' : isNext ? 'closeNext' : 'closeOpen')}
              </em>
              {isLast && !yearClosed && canEdit && (
                <button type="button" disabled={busy} onClick={() => run('/period-close/reopen', m.month, 'closeReopenConfirm')}>
                  <i className="fa-solid fa-rotate-left" /> {t('closeReopen')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {yearClosed ? (
        <p className="acc-close-note"><i className="fa-solid fa-circle-info" /> {t('closeYearClosed')}</p>
      ) : next && (
        <section className="acc-rp-card acc-close-check">
          <header>
            <h4><i className="fa-solid fa-list-check" /> {t('closeChecklist')} {monthText(next.month)}</h4>
            <small>{t('closeChecklistHint')}</small>
          </header>
          <ul>
            {(next.checks ?? []).map((c) => (
              <li key={c.key} className={c.ok ? 'is-ok' : 'is-warn'}>
                <i className={`fa-solid ${c.ok ? 'fa-circle-check' : 'fa-triangle-exclamation'}`} />
                <span>
                  {t(AUTO[c.key].label)}
                  {c.detail && <small>{c.detail}</small>}
                </span>
                {!c.ok && !AUTO[c.key].window && (
                  <button type="button" className="acc-rp-btn" onClick={() => onOpen(AUTO[c.key].target)}>
                    {t('closeGoFix')} <i className="fa-solid fa-arrow-right" />
                  </button>
                )}
                {!c.ok && AUTO[c.key].window && <em>{t('closeOpenFixedAssets')}</em>}
              </li>
            ))}
            {MANUAL.map((key) => (
              <li key={key} className={ticked.includes(key) ? 'is-ok' : ''}>
                <Checkbox checked={ticked.includes(key)} onChange={(_, on) => setTicked(on ? [...ticked, key] : ticked.filter((k) => k !== key))}>
                  {t(key)}
                </Checkbox>
              </li>
            ))}
          </ul>
          <footer>
            <span>
              {warnings.length
                ? <><i className="fa-solid fa-triangle-exclamation" /> {t('closeHasWarnings')}</>
                : !due ? <><i className="fa-solid fa-circle-info" /> {t('closeNotDue')}</> : <><i className="fa-solid fa-shield-halved" /> {t('closeLockNote')}</>}
            </span>
            <Button appearance="primary" loading={busy} disabled={!canEdit || !due || ticked.length < MANUAL.length}
              onClick={() => run('/period-close/close', next.month, warnings.length ? 'closeConfirmWithWarnings' : 'closeConfirm')}
            >
              <i className="fa-solid fa-lock" /> {t('closeCloseMonth')} {monthText(next.month)}
            </Button>
          </footer>
        </section>
      )}
    </div>
  );
};

export default PeriodClosePage;
