import { useState } from 'react';
import { Input, InputGroup, Loader, Modal } from 'rsuite';
import moment from 'moment';
import { putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { canCreate, canDelete } from '../../../utils/localStorage';
import { useLangField, useT } from '../../../context/LanguageContext';
import { money } from '../gl/glApi';
import { AccountCode, GlNotReady } from '../gl/glKit';
import {
  AR, DOC_STATUS, KINDS, amountText, docStatusOf, openBase, overdueDays, usePartnerDocs, usePartners,
  type Kind, type PartnerDoc,
} from './arapApi';
import DocForm from './DocForm';
import PaymentForm from './PaymentForm';

type Period = 'month' | 'year' | 'all';
type StatusFilter = 'all' | 'unpaid' | 'overdue' | 'paid' | 'cancelled';

const startOf = (period: Period) =>
  period === 'all' ? undefined : moment().startOf(period === 'month' ? 'month' : 'year').format('YYYY-MM-DD');

/** ປ້າຍສະຖານະຂອງໃບ */
export const DocStatusPill = ({ doc }: { doc: PartnerDoc }) => {
  const t = useT();
  const status = DOC_STATUS[docStatusOf(doc)];
  return <span className={`acc-gl-source acc-tone ${status.tone}`}>{t(status.label)}</span>;
};

/** ລາຍລະອຽດຂອງໃບ — ລາຍການ, ອາກອນ, ຍອດ ແລະ ການຊຳລະທີ່ຕັດແລ້ວ */
const DocDetail = ({ kind, doc, onClose, onPay, onCancel }: {
  kind: Kind;
  doc: PartnerDoc;
  onClose: () => void;
  onPay: () => void;
  onCancel: () => void;
}) => {
  const t = useT();
  const lf = useLangField();
  const cfg = KINDS[kind];
  const status = docStatusOf(doc);
  const payments = doc.allocations.filter((a) => Number(a.payment?.status) === 1);
  return (
    <Modal open onClose={onClose} size="md" className="acc-gl-ledger-modal">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <span className={`acc-gl-group-icon acc-tone ${cfg.tone}`}><i className={`fa-solid ${cfg.docIcon}`} /></span>
          <span>
            <Modal.Title>{doc.doc_number} <DocStatusPill doc={doc} /></Modal.Title>
            <small>{doc.partner?.name} · {moment(doc.doc_date).format('DD/MM/YYYY')} → {moment(doc.due_date).format('DD/MM/YYYY')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        {(doc.reference || doc.description) && (
          <p className="acc-arap-desc">{[doc.reference, doc.description].filter(Boolean).join(' · ')}</p>
        )}
        <table className="acc-gl-table">
          <thead>
            <tr><th>{t('glAccount')}</th><th>{t('detail')}</th><th className="is-num">{t('fsAmount')}</th></tr>
          </thead>
          <tbody>
            {doc.lines.map((l) => (
              <tr key={l._uuid}>
                <td>{l.account && <AccountCode code={l.account.account_code} group={l.account.account_group} />}{l.account ? lf(l.account, 'name') : ''}</td>
                <td>{l.description}</td>
                <td className="is-num">{amountText(l.amount, doc.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={2}>{t('arapSubtotal')}</td><td className="is-num">{amountText(doc.subtotal, doc.currency)}</td></tr>
            {Number(doc.tax) > 0 && <tr><td colSpan={2}>{t('incomeTaxField')}</td><td className="is-num">{amountText(doc.tax, doc.currency)}</td></tr>}
            <tr><td colSpan={2}>{t('total')}</td><td className="is-num">{amountText(doc.total, doc.currency)}</td></tr>
          </tfoot>
        </table>

        <div className="acc-arap-paid">
          <b>{t(cfg.pays)}</b>
          {payments.length ? payments.map((a) => (
            <span key={a._uuid}>
              <i className="fa-solid fa-circle-check" /> {a.payment?.pay_number} · {moment(a.payment?.pay_date).format('DD/MM/YYYY')}
              <em>{amountText(a.amount, doc.currency)}</em>
            </span>
          )) : <span className="is-empty">{t('arapNoPayments')}</span>}
          <span className="is-total">{t('arapOpenAmount')} <em>{amountText(doc.open, doc.currency)}</em></span>
        </div>
      </Modal.Body>
      <Modal.Footer>
        {status !== 'cancelled' && Number(doc.paid) <= 0 && (
          <button type="button" className="acc-rp-btn is-danger" disabled={!canDelete} onClick={onCancel}>
            <i className="fa-solid fa-ban" /> {t('cancelDoc')}
          </button>
        )}
        {status !== 'cancelled' && doc.open > 0 && (
          <button type="button" className="acc-class-add" disabled={!canCreate} onClick={onPay}>
            <i className={`fa-solid ${cfg.payIcon}`} /> {t(cfg.payAdd)}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

/** ໃບແຈ້ງໜີ້ (AR) / ໃບບິນ (AP) — ກັ່ນຕາມຊ່ວງ ແລະ ສະຖານະ, ເພີ່ມ, ເບິ່ງ, ຊຳລະ, ຍົກເລີກ */
const DocPage = ({ kind }: { kind: Kind }) => {
  const t = useT();
  const cfg = KINDS[kind];
  const [period, setPeriod] = useState<Period>('year');
  const [status, setStatus] = useState<StatusFilter>('unpaid');
  const [keyword, setKeyword] = useState('');
  const { reload: reloadPartners } = usePartners();
  const { rows, loading, notReady, reload } = usePartnerDocs(kind, { start_date: startOf(period) });
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<PartnerDoc | null>(null);
  const [paying, setPaying] = useState<PartnerDoc | null>(null);

  if (notReady) return <GlNotReady />;

  const refresh = () => {
    reload();
    reloadPartners();
  };

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((d) => {
    const s = docStatusOf(d);
    if (status === 'unpaid' && !['open', 'partial', 'overdue'].includes(s)) return false;
    if (status === 'overdue' && s !== 'overdue') return false;
    if (status === 'paid' && s !== 'paid') return false;
    if (status === 'cancelled' && s !== 'cancelled') return false;
    return !q || `${d.doc_number} ${d.partner?.name ?? ''} ${d.reference ?? ''} ${d.description ?? ''}`.toLowerCase().includes(q);
  });
  const openTotal = shown.filter((d) => Number(d.status) === 1).reduce((n, d) => n + openBase(d), 0);

  const cancel = (doc: PartnerDoc) => {
    Notific.confirm(`${t('arapCancelConfirm')} ${doc.doc_number}?`, async () => {
      try {
        await putApi(`/partner-doc/cancel/${btoa(String(doc._uuid))}`, {});
        Notific.success('saveSuccessDone');
        setViewing(null);
        refresh();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });
  };

  const exportRows = () => {
    const c = {
      no: t(cfg.doc), date: t('arapDocDate'), due: t('arapDueDate'), partner: t(cfg.partner),
      cur: t('accountTypeCurrency'), total: t('total'), paid: t('arapPaidAmount'), open: t('arapOpenAmount'), status: t('status'),
    };
    exportExcel(shown.map((d) => ({
      [c.no]: d.doc_number,
      [c.date]: moment(d.doc_date).format('DD/MM/YYYY'),
      [c.due]: moment(d.due_date).format('DD/MM/YYYY'),
      [c.partner]: d.partner?.name ?? '',
      [c.cur]: d.currency?.name ?? 'LAK',
      [c.total]: Number(d.total),
      [c.paid]: Number(d.paid),
      [c.open]: d.open,
      [c.status]: t(DOC_STATUS[docStatusOf(d)].label),
    })), `${kind === AR ? 'invoices' : 'bills'}_${moment().format('YYYY-MM-DD')}`, t(cfg.docs));
  };

  const statuses: { key: StatusFilter; label: string }[] = [
    { key: 'unpaid', label: 'arapStatusUnpaid' },
    { key: 'overdue', label: 'arapStatusOverdue' },
    { key: 'paid', label: 'arapStatusPaid' },
    { key: 'cancelled', label: 'arapStatusCancelled' },
    { key: 'all', label: 'all' },
  ];
  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: 'mvThisMonth' },
    { key: 'year', label: 'mvThisYear' },
    { key: 'all', label: 'all' },
  ];

  return (
    <div className="acs-page acc-gl">
      <div className="acc-gl-journal-bar">
        <div className="acs-stats">
          <span><b>{shown.length}</b> {t(cfg.docs)}</span>
          <span className="is-gold"><b>{money(openTotal)}</b> {t(cfg.open)} (LAK)</span>
        </div>
        <div className="acc-type-segment" role="tablist">
          {periods.map((p) => (
            <button key={p.key} type="button" role="tab" aria-selected={period === p.key} className={period === p.key ? 'is-active' : ''} onClick={() => setPeriod(p.key)}>
              {t(p.label)}
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
          <i className="fa-solid fa-plus" /> {t(cfg.docAdd)}
        </button>
      </div>
      <div className="acc-type-segment acc-gl-source-filter" role="tablist">
        {statuses.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={status === s.key} className={status === s.key ? 'is-active' : ''} onClick={() => setStatus(s.key)}>
            {t(s.label)}
          </button>
        ))}
      </div>

      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !shown.length ? (
        <div className="acc-class-empty"><i className={`fa-solid ${cfg.docIcon}`} /><p>{t('rpEmpty')}</p></div>
      ) : (
        <div className="acc-gl-group">
          <div className="acc-rp-scroll">
            <table className="acc-gl-table acc-arap-docs">
              <thead>
                <tr>
                  <th>{t(cfg.doc)}</th>
                  <th>{t(cfg.partner)}</th>
                  <th>{t('arapDueDate')}</th>
                  <th className="is-num">{t('total')}</th>
                  <th className="is-num">{t('arapOpenAmount')}</th>
                  <th>{t('status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const s = docStatusOf(d);
                  const late = overdueDays(d.due_date);
                  return (
                    <tr key={d._uuid} className={`is-click${s === 'cancelled' ? ' is-reversed' : ''}`} onClick={() => setViewing(d)}>
                      <td>
                        <b className="acc-gl-mono">{d.doc_number}</b>
                        <small className="acc-gl-ref">{moment(d.doc_date).format('DD/MM/YYYY')}{d.reference ? ` · ${d.reference}` : ''}</small>
                      </td>
                      <td>{d.partner?.name}<small className="acc-gl-ref">{d.description}</small></td>
                      <td>
                        {moment(d.due_date).format('DD/MM/YYYY')}
                        {s !== 'paid' && s !== 'cancelled' && late > 0 && <small className="acc-gl-ref is-bad">+{late} {t('days')}</small>}
                        {s !== 'paid' && s !== 'cancelled' && late <= 0 && late > -8 && <small className="acc-gl-ref">{t('arapDueIn')} {-late} {t('days')}</small>}
                      </td>
                      <td className="is-num">{amountText(d.total, d.currency)}</td>
                      <td className="is-num is-strong">{d.open > 0 && s !== 'cancelled' ? amountText(d.open, d.currency) : '–'}</td>
                      <td><DocStatusPill doc={d} /></td>
                      <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                        {d.open > 0 && s !== 'cancelled' && (
                          <button type="button" className="acc-gl-act" disabled={!canCreate} title={t(cfg.payAdd)} onClick={() => setPaying(d)}>
                            <i className={`fa-solid ${cfg.payIcon}`} />
                          </button>
                        )}
                        {s !== 'cancelled' && Number(d.paid) <= 0 && (
                          <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('cancelDoc')} onClick={() => cancel(d)}>
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

      {adding && <DocForm kind={kind} onClose={() => setAdding(false)} onSaved={refresh} />}
      {viewing && (
        <DocDetail kind={kind} doc={viewing} onClose={() => setViewing(null)} onCancel={() => cancel(viewing)}
          onPay={() => {
            setPaying(viewing);
            setViewing(null);
          }}
        />
      )}
      {paying && (
        <PaymentForm kind={kind} partnerId={paying.partner_id} docId={paying._uuid}
          onClose={() => setPaying(null)} onSaved={refresh}
        />
      )}
    </div>
  );
};

export default DocPage;
