import { useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { money } from '../gl/glApi';
import { GlNotReady } from '../gl/glKit';
import { BUCKETS, KINDS, amountText, openBase, overdueDays, usePartners, type Kind, type PartnerDoc } from './arapApi';
import { useAging } from './AgingPage';
import DocForm from './DocForm';
import PaymentForm from './PaymentForm';

/**
 * ພາບລວມລູກໜີ້ / ເຈົ້າໜີ້ — ຍອດຄ້າງ, ເກີນກຳນົດ, ຄົບກຳນົດໃນ 7 ມື້, ແຖບອາຍຸໜີ້, ຄູ່ຄ້າທີ່ຄ້າງຫຼາຍສຸດ
 * ແລະ ໃບທີ່ຕ້ອງຕິດຕາມ (ເກີນກຳນົດກ່ອນ). ຍອດເປັນ LAK ຕາມອັດຕາຂອງໃບ
 */
const ArApOverview = ({ kind, onStatement }: { kind: Kind; onStatement: (partner: { _uuid: number; name: string }) => void }) => {
  const t = useT();
  const cfg = KINDS[kind];
  const { docs, rows, totals, total, loading, notReady, reload } = useAging(kind);
  const { reload: reloadPartners } = usePartners();
  const [adding, setAdding] = useState<'doc' | 'pay' | null>(null);
  const [paying, setPaying] = useState<PartnerDoc | null>(null);

  if (notReady) return <GlNotReady />;
  if (loading && !docs.length) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const refresh = () => {
    reload();
    reloadPartners();
  };
  const overdue = total - totals.current;
  const overdueCount = docs.filter((d) => overdueDays(d.due_date) > 0).length;
  const dueSoon = docs.filter((d) => {
    const days = overdueDays(d.due_date);
    return days <= 0 && days > -8;
  });
  const watch = [...docs].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 8);
  const top = rows.slice(0, 6);
  const peak = Math.max(1, ...top.map((r) => r.total));

  return (
    <div className={`acc-rp acc-gl acc-arap acc-tone ${cfg.tone}`}>
      <div className="acc-arap-actions">
        <button type="button" className="acc-class-add" disabled={!canCreate} onClick={() => setAdding('doc')}>
          <i className={`fa-solid ${cfg.docIcon}`} /> {t(cfg.docAdd)}
        </button>
        <button type="button" className="acc-rp-btn" disabled={!canCreate} onClick={() => setAdding('pay')}>
          <i className={`fa-solid ${cfg.payIcon}`} /> {t(cfg.payAdd)}
        </button>
      </div>

      <div className="acc-rp-kpis">
        <div className="acc-rp-kpi is-main">
          <small>{t(cfg.open)}</small>
          <b>₭ {money(total)}</b>
          <em>{docs.length} {t('arapOpenDocs')} · {rows.length} {t(cfg.partners)}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('arapStatusOverdue')}</small>
          <b className="is-out">₭ {money(overdue)}</b>
          <em className="is-flat">{overdueCount} {t('arapOpenDocs')}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('arapDueThisWeek')}</small>
          <b>₭ {money(dueSoon.reduce((n, d) => n + openBase(d), 0))}</b>
          <em className="is-flat">{dueSoon.length} {t('arapOpenDocs')}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('arapOverdueShare')}</small>
          <b>{total ? `${((overdue / total) * 100).toFixed(1)}%` : '—'}</b>
          <em className="is-flat">{t('arapOverdueShareHint')}</em>
        </div>
      </div>

      <section className="acc-rp-card">
        <header><h4><i className="fa-solid fa-hourglass-half" /> {t('arapAging')}</h4></header>
        <div className="acc-arap-agebar">
          {BUCKETS.map((b) => totals[b.key] > 0 && (
            <i key={b.key} style={{ width: `${(totals[b.key] / (total || 1)) * 100}%`, background: b.tone }} title={`${t(b.label)}: ${money(totals[b.key])}`} />
          ))}
        </div>
        <div className="acc-arap-agelegend">
          {BUCKETS.map((b) => (
            <span key={b.key}><i style={{ background: b.tone }} /> {t(b.label)} <b>{money(totals[b.key])}</b></span>
          ))}
        </div>
      </section>

      <div className="acc-arap-split">
        <section className="acc-rp-card">
          <header><h4><i className={`fa-solid ${cfg.partnerIcon}`} /> {t('arapTopPartners')}</h4></header>
          {top.length ? top.map((r) => (
            <button key={r.partner._uuid} type="button" className="acc-arap-top" onClick={() => onStatement(r.partner)}>
              <span className="acc-arap-top-name">{r.partner.name}<small>{r.docs} {t('arapOpenDocs')}</small></span>
              <span className="acc-arap-top-bar"><i style={{ width: `${(r.total / peak) * 100}%` }} /></span>
              <b>{money(r.total)}</b>
            </button>
          )) : <p className="acc-arap-empty">{t('arapNoOpenDocs')}</p>}
        </section>

        <section className="acc-rp-card">
          <header><h4><i className="fa-solid fa-bell" /> {t('arapWatchList')}</h4></header>
          {watch.length ? watch.map((d) => {
            const late = overdueDays(d.due_date);
            return (
              <div key={d._uuid} className="acc-arap-watch">
                <span className={`acc-arap-days${late > 0 ? ' is-late' : ''}`}>
                  <b>{late > 0 ? `+${late}` : -late}</b><small>{t('days')}</small>
                </span>
                <span className="acc-arap-watch-text">
                  <b>{d.partner?.name}</b>
                  <small>{d.doc_number} · {t('arapDueDate')} {moment(d.due_date).format('DD/MM/YYYY')}</small>
                </span>
                <span className="acc-arap-watch-amount">{amountText(d.open, d.currency)}</span>
                <button type="button" className="acc-gl-act" title={t(cfg.payAdd)} disabled={!canCreate} onClick={() => setPaying(d)}>
                  <i className={`fa-solid ${cfg.payIcon}`} />
                </button>
              </div>
            );
          }) : <p className="acc-arap-empty">{t('arapNoOpenDocs')}</p>}
        </section>
      </div>

      {adding === 'doc' && <DocForm kind={kind} onClose={() => setAdding(null)} onSaved={refresh} />}
      {(adding === 'pay' || paying) && (
        <PaymentForm kind={kind} partnerId={paying?.partner_id} docId={paying?._uuid}
          onClose={() => {
            setAdding(null);
            setPaying(null);
          }}
          onSaved={refresh}
        />
      )}
    </div>
  );
};

export default ArApOverview;
