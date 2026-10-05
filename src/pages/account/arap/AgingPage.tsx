import { useMemo } from 'react';
import { Loader, Modal } from 'rsuite';
import moment from 'moment';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import StatementDoc from '../statements/StatementDoc';
import { money } from '../gl/glApi';
import { GlNotReady } from '../gl/glKit';
import {
  AR, BUCKETS, KINDS, bucketOf, openBase, usePartnerDocs, usePartnerPayments,
  type BucketKey, type Kind, type Partner,
} from './arapApi';

type AgingRow = { partner: { _uuid: number; name: string; partner_code?: string }; buckets: Record<BucketKey, number>; total: number; docs: number };

/** ຍອດຄ້າງແຍກຕາມອາຍຸ (LAK ຕາມອັດຕາຂອງໃບ) ຕໍ່ຄູ່ຄ້າ — ໃຊ້ທັງໜ້າອາຍຸໜີ້ ແລະ ພາບລວມ */
export const useAging = (kind: Kind) => {
  const { rows: docs, loading, notReady, reload } = usePartnerDocs(kind, { open_only: true });
  const rows = useMemo(() => {
    const map = new Map<number, AgingRow>();
    docs.forEach((d) => {
      const row = map.get(d.partner_id) ?? {
        partner: d.partner ?? { _uuid: d.partner_id, name: `#${d.partner_id}` },
        buckets: { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 },
        total: 0,
        docs: 0,
      };
      const value = openBase(d);
      row.buckets[bucketOf(d.due_date)] += value;
      row.total += value;
      row.docs += 1;
      map.set(d.partner_id, row);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [docs]);
  const totals = BUCKETS.reduce((m, b) => ({ ...m, [b.key]: rows.reduce((n, r) => n + r.buckets[b.key], 0) }), {} as Record<BucketKey, number>);
  const total = rows.reduce((n, r) => n + r.total, 0);
  return { docs, rows, totals, total, loading, notReady, reload };
};

/**
 * ໃບແຈ້ງຍອດຂອງຄູ່ຄ້າ — ທຸກໃບ (ເພີ່ມໜີ້) ແລະ ການຊຳລະ (ຫຼຸດໜີ້) ທີ່ໃຊ້ງານ ລຽງຕາມວັນທີ ພ້ອມຍອດສະສົມ ແຍກຕາມສະກຸນ
 */
export const PartnerStatement = ({ kind, partner, onClose }: { kind: Kind; partner: Pick<Partner, '_uuid' | 'name'> & { partner_code?: string }; onClose: () => void }) => {
  const t = useT();
  const cfg = KINDS[kind];
  const { rows: docs, loading: l1 } = usePartnerDocs(kind, { partner_id: partner._uuid });
  const { rows: payments, loading: l2 } = usePartnerPayments(kind, { partner_id: partner._uuid });

  const groups = useMemo(() => {
    type Event = { key: string; date: string; number: string; label: string; due?: string; up: number; down: number };
    const byCurrency = new Map<string, Event[]>();
    const push = (cur: string, e: Event) => byCurrency.set(cur, [...(byCurrency.get(cur) ?? []), e]);
    docs.filter((d) => Number(d.status) === 1).forEach((d) => push(d.currency?.name ?? 'LAK', {
      key: `d${d._uuid}`, date: d.doc_date, number: d.doc_number, label: d.description || t(cfg.doc), due: d.due_date, up: Number(d.total), down: 0,
    }));
    payments.filter((p) => Number(p.status) === 1).forEach((p) => push(p.account?.treasury?.currency?.name ?? 'LAK', {
      key: `p${p._uuid}`, date: p.pay_date, number: p.pay_number, label: p.description || t(cfg.pay), up: 0, down: Number(p.amount),
    }));
    return [...byCurrency.entries()].map(([currency, events]) => {
      let running = 0;
      const lines = events
        .sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
        .map((e) => {
          running += e.up - e.down;
          return { ...e, balance: running };
        });
      return { currency, lines, balance: running };
    });
  }, [docs, payments, cfg, t]);

  const exportRows = () => {
    exportExcel(groups.flatMap((g) => g.lines.map((l) => ({
      [t('accountTypeCurrency')]: g.currency,
      [t('date')]: moment(l.date).format('DD/MM/YYYY'),
      [t('glEntryNumber')]: l.number,
      [t('detail')]: l.label,
      [t('arapIncrease')]: l.up || '',
      [t('arapDecrease')]: l.down || '',
      [t('glBalance')]: l.balance,
    }))), `statement_${partner.partner_code ?? partner._uuid}`, `${t('arapStatement')} — ${partner.name}`);
  };

  return (
    <Modal open onClose={onClose} size="lg" className="acc-gl-ledger-modal">
      <Modal.Header>
        <Modal.Title>{t('arapStatement')}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {l1 || l2 ? (
          <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
        ) : (
          <StatementDoc title={partner.name} period={`${t(cfg.partner)} ${partner.partner_code ?? ''} · ${t('glBsAsOf')} ${moment().format('DD/MM/YYYY')}`}
            unit="" onExcel={exportRows}
          >
            {!groups.length && <p className="acc-arap-empty">{t('rpEmpty')}</p>}
            {groups.map((g) => (
              <div key={g.currency} className="acc-rp-scroll mb-3">
                <table className="acc-gl-table">
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      <th>{t('glEntryNumber')}</th>
                      <th>{t('detail')}</th>
                      <th className="is-num">{t('arapIncrease')}</th>
                      <th className="is-num">{t('arapDecrease')}</th>
                      <th className="is-num">{t('glBalance')} ({g.currency})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.key}>
                        <td>{moment(l.date).format('DD/MM/YYYY')}</td>
                        <td><b className="acc-gl-mono">{l.number}</b></td>
                        <td>{l.label}{l.due && <small className="acc-gl-ref">{t('arapDueDate')} {moment(l.due).format('DD/MM/YYYY')}</small>}</td>
                        <td className="is-num">{l.up ? money(l.up) : ''}</td>
                        <td className="is-num">{l.down ? money(l.down) : ''}</td>
                        <td className="is-num is-strong">{money(l.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={5}>{t(cfg.open)}</td><td className="is-num">{money(g.balance)} {g.currency}</td></tr>
                  </tfoot>
                </table>
              </div>
            ))}
          </StatementDoc>
        )}
      </Modal.Body>
    </Modal>
  );
};

/** ອາຍຸໜີ້ — ຍອດຄ້າງຂອງແຕ່ລະຄູ່ຄ້າ ແຍກ ຍັງບໍ່ຄົບກຳນົດ / ເກີນ 1–30 / 31–60 / 61–90 / ເກີນ 90 ມື້ (LAK) */
const AgingPage = ({ kind, onStatement }: { kind: Kind; onStatement: (partner: AgingRow['partner']) => void }) => {
  const t = useT();
  const cfg = KINDS[kind];
  const { rows, totals, total, loading, notReady } = useAging(kind);

  if (notReady) return <GlNotReady />;
  if (loading && !rows.length) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const exportRows = () => {
    exportExcel([
      ...rows.map((r) => ({
        [t(cfg.partner)]: r.partner.name,
        ...Object.fromEntries(BUCKETS.map((b) => [t(b.label), Math.round(r.buckets[b.key] * 100) / 100])),
        [t('total')]: Math.round(r.total * 100) / 100,
      })),
      { [t(cfg.partner)]: t('total'), ...Object.fromEntries(BUCKETS.map((b) => [t(b.label), Math.round(totals[b.key] * 100) / 100])), [t('total')]: Math.round(total * 100) / 100 },
    ], `aging_${kind === AR ? 'receivable' : 'payable'}_${moment().format('YYYY-MM-DD')}`, t('arapAging'));
  };

  return (
    <div className="acc-rp acc-fs acc-gl">
      <StatementDoc title={`${t('arapAging')} — ${t(kind === AR ? 'accountAppReceivables' : 'accountAppPayables')}`}
        period={`${t('glBsAsOf')} ${moment().format('DD/MM/YYYY')}`} unit="LAK" onExcel={exportRows}
        note={<p>{t('arapAgingNote')}</p>}
      >
        <div className="acc-rp-scroll">
          <table className="acc-gl-tb acc-arap-aging">
            <thead>
              <tr>
                <th>{t(cfg.partner)}</th>
                {BUCKETS.map((b) => <th key={b.key}><i className="acc-arap-dot" style={{ background: b.tone }} /> {t(b.label)}</th>)}
                <th>{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.partner._uuid} className="is-postable" onClick={() => onStatement(r.partner)}>
                  <td>{r.partner.name}<small className="acc-gl-ref">{r.docs} {t('arapOpenDocs')}</small></td>
                  {BUCKETS.map((b) => <td key={b.key} className={b.key !== 'current' && r.buckets[b.key] ? 'is-late' : ''}>{money(r.buckets[b.key])}</td>)}
                  <td className="is-strong">{money(r.total)}</td>
                </tr>
              ))}
              {!rows.length && <tr className="is-empty"><td colSpan={BUCKETS.length + 2}>{t('arapNoOpenDocs')}</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td>{t('total')}</td>
                {BUCKETS.map((b) => <td key={b.key}>{money(totals[b.key])}</td>)}
                <td>{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </StatementDoc>
    </div>
  );
};

export default AgingPage;
