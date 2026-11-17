import { useRef } from 'react';
import moment from 'moment';
import { printElementByFrame } from '../../../utils/Print';
import { useLangField, useT } from '../../../context/LanguageContext';
import { useTaxes } from '../../../utils/selectOption';
import { useCompany } from '../../hr/payroll/payrollApi';
import { useAccountSetting } from '../accountSettings';
import { amountText, type PartnerDoc } from './arapApi';

/** ພິມສະເພາະໃບ — A4 ຕັ້ງ (ໃບຢູ່ນອກຈໍ ຈົນກວ່າຈະພິມ) */
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 12mm; }
  html, body { background: #fff !important; margin: 0; }
  .acc-ivp { position: static !important; left: auto !important; width: auto !important; box-shadow: none !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * ໃບເກັບເງິນ (ລູກໜີ້) ສຳລັບພິມ — ຫົວບໍລິສັດ (ໂລໂກ້, ຊື່, ທີ່ຢູ່, ໂທ, ເລກອາກອນ), ລູກຄ້າ (ທີ່ຢູ່, ເລກອາກອນ), ລາຍການ,
 * ຍອດກ່ອນອາກອນ / ອາກອນມູນຄ່າເພີ່ມ / ລວມ ແລະ ບ່ອນເຊັນ. ມີອາກອນ = "ໃບເກັບເງິນອາກອນມູນຄ່າເພີ່ມ".
 * ໃບຢູ່ນອກຈໍ (ບໍ່ສະແດງ) — ກົດປຸ່ມແລ້ວພິມຜ່ານ iframe ຄືໃບລາຍງານອື່ນ
 */
export const useInvoicePrint = (doc: PartnerDoc) => {
  const t = useT();
  const lf = useLangField();
  const ref = useRef<HTMLDivElement>(null);
  const company = useCompany();
  const setting = useAccountSetting();
  const taxes = useTaxes();
  const tax = taxes.find((x) => x._uuid === doc.tax_id);
  const taxed = Number(doc.tax) > 0;
  const address = [company?.village, company?.district?.district_name, company?.district?.province?.province_name].filter(Boolean).join(', ');
  const phones = [company?.phone1, company?.phone2].filter(Boolean).join(', ');
  const partner = doc.partner as (PartnerDoc['partner'] & { address?: string | null; tax_number?: string | null }) | null | undefined;
  const money = (v: string | number) => amountText(v, doc.currency);

  const sheet = (
    <div ref={ref} className="acc-ivp" aria-hidden="true">
      <header className="acc-ivp-head">
        {company?.logo_url && <img src={company.logo_url} alt="" />}
        <div>
          <h2>{company?.name_la}</h2>
          {company?.name_en && <p>{company.name_en}</p>}
          {address && <small>{address}</small>}
          {(phones || setting.tax_id) && (
            <small>{[phones && `${t('ivpPhone')} ${phones}`, setting.tax_id && `${t('acgTaxIdShort')} ${setting.tax_id}`].filter(Boolean).join(' · ')}</small>
          )}
        </div>
        <span className="acc-ivp-title">
          <b>{t(taxed ? 'ivpTitleTax' : 'ivpTitle')}</b>
          <em>{taxed ? 'TAX INVOICE' : 'INVOICE'}</em>
        </span>
      </header>

      <section className="acc-ivp-info">
        <div>
          <small>{t('ivpBillTo')}</small>
          <b>{partner?.name}</b>
          {partner?.address && <span>{partner.address}</span>}
          {partner?.phone && <span>{t('ivpPhone')} {partner.phone}</span>}
          {partner?.tax_number && <span>{t('acgTaxIdShort')} {partner.tax_number}</span>}
        </div>
        <dl>
          <dt>{t('ivpNumber')}</dt><dd>{doc.doc_number}</dd>
          <dt>{t('ivpDate')}</dt><dd>{moment(doc.doc_date).format('DD/MM/YYYY')}</dd>
          <dt>{t('ivpDue')}</dt><dd>{moment(doc.due_date).format('DD/MM/YYYY')}</dd>
          {doc.reference && <><dt>{t('ivpRef')}</dt><dd>{doc.reference}</dd></>}
        </dl>
      </section>

      <table className="acc-ivp-lines">
        <thead>
          <tr><th>#</th><th>{t('ivpItem')}</th><th>{t('fsAmount')}</th></tr>
        </thead>
        <tbody>
          {doc.lines.map((l, i) => (
            <tr key={l._uuid}>
              <td>{i + 1}</td>
              <td>{l.description || (l.account ? lf(l.account, 'name') : '')}</td>
              <td>{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={2}>{t('arapSubtotal')}</td><td>{money(doc.subtotal)}</td></tr>
          {taxed && <tr><td colSpan={2}>{tax ? `${tax.name} ${Number(tax.rate)}%` : t('incomeTaxField')}</td><td>{money(doc.tax)}</td></tr>}
          <tr className="is-total"><td colSpan={2}>{t('ivpTotal')}</td><td>{money(doc.total)}</td></tr>
        </tfoot>
      </table>

      {doc.description && <p className="acc-ivp-note">{doc.description}</p>}

      <footer className="acc-ivp-signs">
        <span><b>{t('ivpIssuer')}</b><i /><em>{localStorage.getItem('user_name') || '........................'}</em></span>
        <span><b>{t('ivpReceiver')}</b><i /><em>........................</em></span>
      </footer>
    </div>
  );

  const print = () => ref.current && printElementByFrame(ref.current, PRINT_CSS);
  return { sheet, print };
};
