import { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatNumber, getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { BORROWED } from './loanApi';

type Row = {
  loan_id: number;
  loan_code: string;
  counterparty: string;
  direction: number;
  earned?: number;
  paid?: number;
  accrued: number;
  rate?: number;
  lak?: number;
  currency: string | null;
};
type Preview = {
  month: string;
  posted: { entry_number: string; entry_date: string; total: number; reversal_number: string | null; reversal_date: string | null } | null;
  latest: string | null;
  rows: Row[];
  payable: number;
  receivable: number;
};
type Run = { period: string; loans: number; entry_number: string | null; reversal_number: string | null; total: number };

/** ເດືອນເລີ່ມຕົ້ນ: ຕໍ່ຈາກເດືອນລ່າສຸດທີ່ຄິດແລ້ວ ຫຼື ເດືອນກ່ອນ */
const defaultMonth = (latest: string | null) =>
  (latest ? moment(latest, 'YYYY-MM').add(1, 'month') : moment().subtract(1, 'month')).startOf('month').toDate();

/**
 * ດອກເບ້ຍຄ້າງທ້າຍເດືອນ — ດອກເບ້ຍທີ່ເກີດແລ້ວແຕ່ຍັງບໍ່ທັນຈ່າຍ/ຮັບ ຂອງທຸກເງິນກູ້ (ຄ້າງຈ່າຍ / ຄ້າງຮັບ).
 * ລົງໃບທ້າຍເດືອນ + ໃບກັບຄືນອັດຕະໂນມັດວັນທີ 1 ຂອງເດືອນຖັດໄປ; ຄິດຊ້ຳ / ຍົກເລີກ ໄດ້ສະເພາະເດືອນລ່າສຸດ
 */
const LoanAccrualPage = () => {
  const t = useT();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRuns = useCallback(async () => {
    const res = await getApi('/loan/accrual-runs');
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
      const res = await postApi('/loan/accrual-preview', { month: monthKey });
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

  const monthText = moment(month).format('MM/YYYY');
  const before = !!preview?.latest && !!monthKey && monthKey < preview.latest;
  const nextFirst = moment(month).add(1, 'month').startOf('month').format('DD/MM/YYYY');

  const post = () =>
    Notific.confirm(`${t(preview?.posted ? 'lnAccrualRepostConfirm' : 'lnAccrualPostConfirm')} ${monthText}`, async () => {
      try {
        setBusy(true);
        const res = await postApi('/loan/accrue', { month: monthKey });
        Notific.success(`${t('faPosted')} ${res.data?.data?.entry_number ?? ''}`);
        await Promise.all([loadRuns(), loadPreview()]);
      } catch (err) {
        Notific.error(getErrorMessage(err));
      } finally {
        setBusy(false);
      }
    });

  const undo = (period: string) =>
    Notific.confirm(`${t('lnAccrualUndoConfirm')} ${moment(period, 'YYYY-MM').format('MM/YYYY')}`, async () => {
      try {
        await deleteApi(`/loan/accrue/${period}`);
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
          <h4><i className="fa-solid fa-percent" /> {t('lnAccrualTitle')}</h4>
          <DatePicker format="MM/yyyy" value={month} onChange={(v) => v && setMonth(v)} cleanable={false} oneTap placement="bottomEnd" />
        </header>

        {!preview ? (
          <div className="text-center py-4"><Loader size="sm" /></div>
        ) : (
          <>
            <p className={`acc-fa-status${preview.posted ? ' is-done' : ''}`}>
              <i className={`fa-solid ${preview.posted ? 'fa-circle-check' : before ? 'fa-ban' : 'fa-hourglass-half'}`} />
              {preview.posted
                ? <>{t('faPostedAs')} <b>{preview.posted.entry_number}</b> · {moment(preview.posted.entry_date).format('DD/MM/YYYY')}
                  {preview.posted.reversal_number && <> · {t('lnReversedOn')} <b>{preview.posted.reversal_number}</b> {moment(preview.posted.reversal_date).format('DD/MM/YYYY')}</>}</>
                : before ? t('lnAccrualBeforeLatest') : t('lnAccrualNotPosted')}
            </p>
            <div className="acc-ln-accrual-sum">
              <span className="is-payable"><small><i className="fa-solid fa-file-invoice-dollar" /> {t('lnAccruedPayable')}</small><b>₭ {formatNumber(preview.payable)}</b></span>
              <span className="is-receivable"><small><i className="fa-solid fa-hand-holding-dollar" /> {t('lnAccruedReceivable')}</small><b>₭ {formatNumber(preview.receivable)}</b></span>
            </div>
            <div className="acc-rp-scroll">
              <table className="acc-fs-table">
                <thead>
                  <tr>
                    <th>{t('lnLoan')}</th>
                    {!preview.posted && <th>{t('lnEarned')}</th>}
                    {!preview.posted && <th>{t('lnPaidShort')}</th>}
                    <th>{t('lnAccrued')} {monthText}</th>
                    {!preview.posted && <th>₭</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.length ? preview.rows.map((r) => (
                    <tr key={r.loan_id} className="is-line">
                      <td>
                        <span className="acc-fs-code">{r.loan_code}</span>{r.counterparty}
                        <em className={`acc-ln-dir is-${Number(r.direction) === BORROWED ? 'borrowed' : 'lent'}`}>{t(Number(r.direction) === BORROWED ? 'lnPayableShort' : 'lnReceivableShort')}</em>
                      </td>
                      {!preview.posted && <td>{formatNumber(r.earned ?? 0)}</td>}
                      {!preview.posted && <td>{formatNumber(r.paid ?? 0)}</td>}
                      <td>{formatNumber(r.accrued)} {r.currency && r.currency !== 'LAK' ? <small className="acc-gl-ref">{r.currency}</small> : null}</td>
                      {!preview.posted && <td>{formatNumber(r.lak ?? 0)}</td>}
                    </tr>
                  )) : (
                    <tr className="is-empty"><td colSpan={5}>{t('lnAccrualNothing')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="acc-fa-foot">
              <span>{t('lnAccrualHint').replace('{date}', nextFirst)}</span>
              <Button appearance="primary" loading={busy} disabled={!canCreate || before || !preview.rows.length || (!!preview.posted && preview.latest !== monthKey)} onClick={post}>
                <i className={`fa-solid ${preview.posted ? 'fa-rotate' : 'fa-check'}`} /> {t(preview.posted ? 'faRepost' : 'lnAccrualPost')} {monthText}
              </Button>
            </footer>
          </>
        )}
      </section>

      {!!runs.length && (
        <section className="acc-rp-card">
          <header><h4><i className="fa-solid fa-clock-rotate-left" /> {t('lnAccrualRuns')}</h4></header>
          <div className="acc-rp-scroll">
            <table className="acc-fs-table">
              <thead>
                <tr>
                  <th>{t('faMonth')}</th>
                  <th>{t('vatEntryNo')}</th>
                  <th>{t('lnReversalNo')}</th>
                  <th>{t('lnLoans')}</th>
                  <th>{t('total')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={r.period} className="is-line">
                    <td>{moment(r.period, 'YYYY-MM').format('MM/YYYY')}</td>
                    <td>{r.entry_number ?? '—'}</td>
                    <td>{r.reversal_number ?? '—'}</td>
                    <td>{r.loans}</td>
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

export default LoanAccrualPage;
