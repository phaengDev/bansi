import { useState } from 'react';
import { Input, InputGroup, Loader } from 'rsuite';
import moment from 'moment';
import { putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { money } from '../gl/glApi';
import { GlNotReady } from '../gl/glKit';
import { AR, KINDS, amountText, usePartnerPayments, usePartners, type Kind, type PartnerPayment } from './arapApi';
import PaymentForm from './PaymentForm';

type Period = 'month' | 'year' | 'all';
const startOf = (period: Period) =>
  period === 'all' ? undefined : moment().startOf(period === 'month' ? 'month' : 'year').format('YYYY-MM-DD');

/** ຮັບຊຳລະ (AR) / ຈ່າຍຊຳລະ (AP) — ລາຍການ, ໃບທີ່ຕັດ, ບັນຊີເງິນຄັງ; ຍົກເລີກ = ເງິນກັບຄືນ + ໃບກັບມາຄ້າງ */
const PaymentPage = ({ kind }: { kind: Kind }) => {
  const t = useT();
  const cfg = KINDS[kind];
  const [period, setPeriod] = useState<Period>('month');
  const [keyword, setKeyword] = useState('');
  const { reload: reloadPartners } = usePartners();
  const { rows, loading, notReady, reload } = usePartnerPayments(kind, { start_date: startOf(period) });
  const [adding, setAdding] = useState(false);

  if (notReady) return <GlNotReady />;

  const refresh = () => {
    reload();
    reloadPartners();
  };

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((p) => !q || `${p.pay_number} ${p.partner?.name ?? ''} ${p.reference ?? ''} ${p.description ?? ''}`.toLowerCase().includes(q));
  const active = shown.filter((p) => Number(p.status) === 1);
  const totalBase = active.reduce((n, p) => n + Number(p.amount) * (Number(p.exchange_rate) || 1), 0);

  const cancel = (p: PartnerPayment) => {
    Notific.confirm(`${t('arapCancelConfirm')} ${p.pay_number}?`, async () => {
      try {
        await putApi(`/partner-payment/cancel/${btoa(String(p._uuid))}`, {});
        Notific.success('saveSuccessDone');
        refresh();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });
  };

  const exportRows = () => {
    const c = { no: t(cfg.pay), date: t('date'), partner: t(cfg.partner), account: t('fsAccount'), amount: t('fsAmount'), cur: t('accountTypeCurrency'), docs: t(cfg.docs), status: t('status') };
    exportExcel(shown.map((p) => ({
      [c.no]: p.pay_number,
      [c.date]: moment(p.pay_date).format('DD/MM/YYYY'),
      [c.partner]: p.partner?.name ?? '',
      [c.account]: p.account?.acountName ?? '',
      [c.amount]: Number(p.amount),
      [c.cur]: p.account?.treasury?.currency?.name ?? 'LAK',
      [c.docs]: p.allocations.map((a) => a.doc?.doc_number).filter(Boolean).join(', '),
      [c.status]: Number(p.status) === 1 ? t('active') : t('arapStatusCancelled'),
    })), `${kind === AR ? 'receipts' : 'payments'}_${moment().format('YYYY-MM-DD')}`, t(cfg.pays));
  };

  return (
    <div className="acs-page acc-gl">
      <div className="acc-gl-journal-bar">
        <div className="acs-stats">
          <span><b>{active.length}</b> {t(cfg.pays)}</span>
          <span className="is-green"><b>{money(totalBase)}</b> LAK</span>
        </div>
        <div className="acc-type-segment" role="tablist">
          {(['month', 'year', 'all'] as Period[]).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} className={period === p ? 'is-active' : ''} onClick={() => setPeriod(p)}>
              {t(p === 'month' ? 'mvThisMonth' : p === 'year' ? 'mvThisYear' : 'all')}
            </button>
          ))}
        </div>
        <InputGroup inside size="sm" className="acs-search">
          <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
          <Input placeholder={t('search')} value={keyword} onChange={setKeyword} />
        </InputGroup>
        <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!shown.length}>
          <i className="fa-solid fa-file-excel" /> Excel
        </button>
        <button type="button" className="acc-class-add" disabled={!canCreate} onClick={() => setAdding(true)}>
          <i className="fa-solid fa-plus" /> {t(cfg.payAdd)}
        </button>
      </div>

      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !shown.length ? (
        <div className="acc-class-empty"><i className={`fa-solid ${cfg.payIcon}`} /><p>{t('rpEmpty')}</p></div>
      ) : (
        <div className="acc-gl-group">
          <div className="acc-rp-scroll">
            <table className="acc-gl-table">
              <thead>
                <tr>
                  <th>{t(cfg.pay)}</th>
                  <th>{t(cfg.partner)}</th>
                  <th>{t('fsAccount')}</th>
                  <th>{t(cfg.docs)}</th>
                  <th className="is-num">{t('fsAmount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const cancelled = Number(p.status) !== 1;
                  const cur = p.account?.treasury?.currency;
                  return (
                    <tr key={p._uuid} className={cancelled ? 'is-reversed' : ''}>
                      <td>
                        <b className="acc-gl-mono">{p.pay_number}</b>
                        {cancelled && <span className="acc-gl-flag is-bad ms-1">{t('arapStatusCancelled')}</span>}
                        <small className="acc-gl-ref">{moment(p.pay_date).format('DD/MM/YYYY')}{p.reference ? ` · ${p.reference}` : ''}</small>
                      </td>
                      <td>{p.partner?.name}<small className="acc-gl-ref">{p.description}</small></td>
                      <td>
                        <span className="acc-arap-account">
                          <span className="acc-xfer-logo">{p.account?.banks?.url ? <img src={p.account.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}</span>
                          {p.account?.acountName}
                        </span>
                      </td>
                      <td>
                        {p.allocations.map((a) => (
                          <span key={a._uuid} className="acc-arap-chip">{a.doc?.doc_number} · {amountText(a.amount, cur)}</span>
                        ))}
                      </td>
                      <td className="is-num is-strong">{amountText(p.amount, cur)}</td>
                      <td className="acc-gl-tree-actions">
                        {!cancelled && (
                          <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('cancelDoc')} onClick={() => cancel(p)}>
                            <i className="fa-solid fa-ban" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adding && <PaymentForm kind={kind} onClose={() => setAdding(false)} onSaved={refresh} />}
    </div>
  );
};

export default PaymentPage;
