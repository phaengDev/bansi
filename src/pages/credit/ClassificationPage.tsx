import { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatNumber, getApi, postApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { money } from '../account/loans/loanApi';
import ContractDetail from './ContractDetail';
import type { Classification } from './creditApi';
import { DaysLateChip } from './collectKit';

/**
 * ຈັດຊັ້ນໜີ້ ແລະ ເງິນແຮ ທ້າຍເດືອນ — ສັນຍາທີ່ຍັງຄ້າງ ณ ທ້າຍເດືອນ ຈັດເປັນ A–E ຕາມມື້ກາຍກຳນົດ (ເກນໃນ ຕັ້ງຄ່າສິນເຊື່ອ),
 * ເງິນແຮ = ຕົ້ນທຶນຄ້າງ × %; ລົງບັນຊີສະເພາະສ່ວນຕ່າງກັບຍອດ 1186 ໃນປຶ້ມ. ຍົກເລີກໄດ້ສະເພາະເດືອນຫຼ້າສຸດ
 */
const ClassificationPage = () => {
  const t = useT();
  const [month, setMonth] = useState(() => moment().subtract(1, 'month').startOf('month').toDate());
  const [data, setData] = useState<Classification | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const period = moment(month).format('YYYY-MM');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getApi(`/credit/classification?period=${period}`);
      setData(res.data?.data ?? null);
    } catch (err) {
      Notific.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [period]);
  useEffect(() => {
    load();
  }, [load]);

  const post = async () => {
    try {
      setBusy(true);
      await postApi('/credit/classification', { period });
      Notific.success('saveSuccessDone');
      load();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const undo = () => Notific.confirm(`${t('crClassUndoConfirm')} ${moment(month).format('MM/YYYY')}`, async () => {
    try {
      await deleteApi(`/credit/classification/${period}`);
      Notific.success('acsSaved');
      load();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });

  const monthText = moment(month).format('MM/YYYY');
  return (
    <div className={`acs-page cr-page cr-classify${loading ? ' is-loading' : ''}`}>
      <div className="cr-filters">
        <span className="cr-filter-label">{t('crClassMonth')}</span>
        <DatePicker format="MM/yyyy" value={month} onChange={(v) => v && setMonth(v)} cleanable={false} oneTap
          shouldDisableDate={(d) => moment(d).isSameOrAfter(moment().startOf('month'), 'day')}
        />
        {data && (
          <span className={`cr-status ${data.posted ? 'is-disbursed' : 'is-draft'}`}>
            <i className={`fa-solid ${data.posted ? 'fa-circle-check' : 'fa-pen'}`} /> {data.posted ? `${t('crClassPosted')} ${data.entry_number ?? ''}` : t('crClassPreview')}
          </span>
        )}
      </div>

      {!data ? <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div> : (
        <>
          <div className="cr-class-cards">
            {data.summary.map((s) => (
              <div key={s.loan_class} className={`cr-class-card${s.is_npl ? ' is-npl' : ''}`}>
                <span className={`cr-class is-${s.class_code}`}>{s.class_code}</span>
                <div>
                  <b>{s.name_la}</b>
                  <small>{s.contracts} {t('crContracts')} · {s.provision_rate}%{s.is_npl ? ' · NPL' : ''}</small>
                </div>
                <dl>
                  <div><dt>{t('lnOutstanding')}</dt><dd>{formatNumber(s.outstanding)}</dd></div>
                  <div><dt>{t('crProvision')}</dt><dd>{formatNumber(s.provision)}</dd></div>
                </dl>
              </div>
            ))}
          </div>

          <div className="cr-grid">
            <section className="cr-card">
              <header><b>{t('crNplRatio')}</b><small>{t('crNplRatioHint')}</small></header>
              <div className="cr-npl">
                <b className={data.npl_ratio >= 5 ? 'cr-text-bad' : ''}>{data.npl_ratio}%</b>
                <span>{t('crNplOf').replace('{a}', formatNumber(data.npl)).replace('{b}', formatNumber(data.total))}</span>
              </div>
            </section>
            <section className="cr-card">
              <header><b>{t('crAllowance')}</b><small>{t('crAllowanceHint')}</small></header>
              {data.allowance.length ? data.allowance.map((a) => (
                <dl key={a.currency_id} className="acc-book-summary cr-allowance">
                  <div><dt>{t('crAllowanceTarget')}</dt><dd>{money(a.target, a.currency)}</dd></div>
                  <div><dt>{t('crAllowanceBooked')}</dt><dd>{money(a.balance, a.currency)}</dd></div>
                  <div className="is-total"><dt>{t(data.posted ? 'crAllowanceDiff' : 'crAllowancePost')}</dt><dd>{a.delta >= 0 ? '+' : '−'} {money(Math.abs(a.delta), a.currency)}</dd></div>
                </dl>
              )) : <p className="cr-muted">—</p>}
            </section>
          </div>

          <section className="cr-card">
            <header><b>{t('crClassDetail').replace('{m}', monthText)}</b><small>{data.rows.length} {t('crContracts')}</small></header>
            {data.rows.length ? (
              <div className="acc-rp-scroll">
                <table className="acc-fs-table cr-class-table">
                  <thead>
                    <tr>
                      <th>{t('crContract')}</th><th>{t('crDaysLate')}</th><th>{t('lnOutstanding')}</th><th>{t('lnOverdue')}</th>
                      <th>{t('crClass')}</th><th>{t('crProvision')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.loan_id} className="is-line is-click" onClick={() => setViewing(r.loan_id)}>
                        <td><span className="acc-fs-code">{r.loan_code}</span> {r.counterparty}</td>
                        <td>{r.days_overdue ? <DaysLateChip days={r.days_overdue} /> : '—'}</td>
                        <td>{formatNumber(r.outstanding)}</td>
                        <td>{r.overdue_principal + r.overdue_interest ? formatNumber(r.overdue_principal + r.overdue_interest) : '—'}</td>
                        <td><span className={`cr-class is-${r.class_code} is-sm`}>{r.class_code}</span></td>
                        <td>{formatNumber(r.provision_amount)} <small className="acc-gl-ref">{r.provision_rate}%</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-circle-check" /><p>{t('crClassNothing')}</p></div>}
            <footer className="acc-fa-foot">
              <span>{t('crClassFoot').replace('{d}', moment(data.end).format('DD/MM/YYYY'))}</span>
              {data.can_undo && canDelete && (
                <Button appearance="default" onClick={undo}><i className="fa-solid fa-rotate-left" /> {t('crClassUndo')}</Button>
              )}
              {!data.posted && (
                <Button appearance="primary" loading={busy} disabled={!canCreate || !data.can_post || !data.rows.length} onClick={post}
                  title={!data.can_post && data.latest ? t('crClassAfterLatest').replace('{m}', moment(data.latest, 'YYYY-MM').format('MM/YYYY')) : undefined}
                >
                  <i className="fa-solid fa-check" /> {t('crClassPost')} {monthText}
                </Button>
              )}
            </footer>
          </section>
        </>
      )}
      {viewing && <ContractDetail id={viewing} onClose={() => setViewing(null)} onChanged={load} />}
    </div>
  );
};

export default ClassificationPage;
