import { useEffect, useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import { isNotReady, money } from '../gl/glApi';
import { GlNotReady, SourceChip } from '../gl/glKit';
import type { StatementData } from './FinancialStatementsPage';
import StatementDoc from './StatementDoc';
import { Zero } from './StatementBits';

/** ແຖວຈາກ POST /tax/vat-report — base/vat ຕິດລົບ = ໃບກັບລາຍການ (ຍົກເລີກ) */
type VatRow = {
  entry_id: number;
  entry_number: string;
  date: string;
  source_type: string;
  reference: string | null;
  description: string | null;
  party: string | null;
  tax_number: string | null;
  doc_ref: string | null;
  base: number;
  vat: number;
};
type VatReportData = {
  sales: VatRow[];
  purchases: VatRow[];
  summary: { sales_base: number; output: number; purchase_base: number; input: number; payable: number };
};

const cell = (value: number) => (Math.abs(value) >= 0.005 ? money(value) : <Zero />);

/**
 * ລາຍງານອາກອນມູນຄ່າເພີ່ມ (VAT 10%) ຂອງງວດ — ໃບຂາຍ (ອາກອນຂາອອກ) ແລະ ໃບຊື້ (ອາກອນຂາເຂົ້າ) ຈາກສະໝຸດບັນຊີ,
 * ຍອດຕ້ອງຈ່າຍ = ຂາອອກ − ຂາເຂົ້າ (ຕິດລົບ = ຍົກໄປຫັກງວດໜ້າ). ໃຊ້ກະກຽມແບບແຈ້ງອາກອນປະຈຳເດືອນ
 */
const VatReport = ({ data }: { data: StatementData }) => {
  const t = useT();
  const { range } = data;
  const [report, setReport] = useState<VatReportData | null>(null);
  const [error, setError] = useState('');
  const [notReady, setNotReady] = useState(false);
  const startKey = range.start.format('YYYY-MM-DD');
  const endKey = range.end.format('YYYY-MM-DD');

  useEffect(() => {
    let cancelled = false;
    setError('');
    postApi('/tax/vat-report', { start_date: startKey, end_date: endKey })
      .then((res) => !cancelled && setReport(res.data))
      .catch((err) => {
        if (cancelled) return;
        if (isNotReady(err)) setNotReady(true);
        else setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [startKey, endKey]);

  if (notReady) return <GlNotReady />;
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;
  if (!report) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;

  const { summary } = report;
  const rangeText = `${range.start.format('DD/MM/YYYY')} – ${range.end.format('DD/MM/YYYY')}`;
  const credit = summary.payable < 0;

  const exportRows = () => {
    const toRow = (kind: string) => (r: VatRow) => ({
      [t('vatKind')]: kind,
      [t('date')]: moment(r.date).format('DD/MM/YYYY'),
      [t('vatEntryNo')]: r.entry_number,
      [t('vatDocNo')]: r.doc_ref || r.reference || '',
      [t('vatParty')]: r.party ?? '',
      [t('vatPartyTaxNo')]: r.tax_number ?? '',
      [t('description')]: r.description ?? '',
      [t('vatBase')]: r.base,
      [t('vatAmount')]: r.vat,
    });
    exportExcel(
      [...report.sales.map(toRow(t('vatSales'))), ...report.purchases.map(toRow(t('vatPurchases')))],
      `vat-report_${startKey}_${endKey}`,
      `${t('fsVatReport')} ${rangeText}`,
    );
  };

  const table = (rows: VatRow[], base: number, vat: number) => (
    <div className="acc-rp-scroll">
      <table className="acc-fs-table acc-fs-vat">
        <thead>
          <tr>
            <th>{t('date')}</th>
            <th>{t('vatDocNo')}</th>
            <th>{t('vatParty')}</th>
            <th>{t('vatBase')}</th>
            <th>{t('vatAmount')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((r) => (
            <tr key={r.entry_id} className={`is-line${r.vat < 0 ? ' is-negative' : ''}`}>
              <td>{moment(r.date).format('DD/MM/YYYY')}</td>
              <td>
                <b>{r.doc_ref || r.reference || r.entry_number}</b>
                <small><SourceChip type={r.source_type} /> {r.entry_number}</small>
              </td>
              <td>
                {r.party ?? r.description ?? '—'}
                {r.tax_number && <small>{t('acgTaxIdShort')} {r.tax_number}</small>}
              </td>
              <td>{cell(r.base)}</td>
              <td>{cell(r.vat)}</td>
            </tr>
          )) : (
            <tr className="is-empty"><td colSpan={5}>{t('rpEmpty')}</td></tr>
          )}
          <tr className="is-subtotal">
            <td colSpan={3}>{t('total')}</td>
            <td>{cell(base)}</td>
            <td>{cell(vat)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="acc-rp-kpis">
        <div className={`acc-rp-kpi is-main${credit ? '' : ' is-loss'}`}>
          <small>{t(credit ? 'vatCarryForward' : 'vatPayable')}</small>
          <b>₭ {money(Math.abs(summary.payable))}</b>
          <em className="is-flat">{t('vatPayableHint')}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('vatOutput')}</small>
          <b className="is-out">₭ {money(summary.output)}</b>
          <em className="is-flat">{t('vatBase')} ₭ {money(summary.sales_base)}</em>
        </div>
        <div className="acc-rp-kpi">
          <small>{t('vatInput')}</small>
          <b className="is-in">₭ {money(summary.input)}</b>
          <em className="is-flat">{t('vatBase')} ₭ {money(summary.purchase_base)}</em>
        </div>
      </div>

      <StatementDoc title={t('fsVatReport')} period={rangeText} unit="LAK" onExcel={exportRows} note={<p>{t('vatNote')}</p>}>
        <h5 className="acc-fs-subhead"><i className="fa-solid fa-arrow-up-right-from-square" /> {t('vatSales')} · {t('vatOutput')}</h5>
        {table(report.sales, summary.sales_base, summary.output)}
        <h5 className="acc-fs-subhead"><i className="fa-solid fa-cart-shopping" /> {t('vatPurchases')} · {t('vatInput')}</h5>
        {table(report.purchases, summary.purchase_base, summary.input)}
        <table className="acc-fs-table acc-fs-vat-sum">
          <tbody>
            <tr className="is-line"><td>{t('vatOutput')}</td><td>{cell(summary.output)}</td></tr>
            <tr className="is-line"><td>{t('vatInput')}</td><td>{Math.abs(summary.input) >= 0.005 ? `(${money(summary.input)})` : <Zero />}</td></tr>
            <tr className="is-total"><td>{t(credit ? 'vatCarryForward' : 'vatPayable')}</td><td>{money(Math.abs(summary.payable))}</td></tr>
          </tbody>
        </table>
      </StatementDoc>
    </>
  );
};

export default VatReport;
