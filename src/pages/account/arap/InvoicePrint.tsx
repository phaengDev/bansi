import { useEffect, useRef, useState } from 'react';
import moment from 'moment';
import { formatNumber, postApi } from '../../../utils/configApi';
import { printElementByFrame } from '../../../utils/Print';
import { amountInLaoWords } from '../../../utils/laoWords';
import { useT } from '../../../context/LanguageContext';
import { useTaxes } from '../../../utils/selectOption';
import { useCompany } from '../../hr/payroll/payrollApi';
import { useAccountSetting } from '../accountSettings';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import type { PartnerDoc } from './arapApi';
import InvoiceBackground from './InvoiceBackground';

/** ພິມສະເພາະໃບ — A4 ຕັ້ງ ບໍ່ມີຂອບເຈ້ຍ (ພື້ນຫຼັງເຕັມໜ້າ), 1 ສະບັບ = 1 ໜ້າ */
const PRINT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  .acc-ivp { position: static !important; left: auto !important; }
  .acc-ivp-page { box-shadow: none !important; margin: 0 !important; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/** ສະບັບ: 1 ສຳລັບຜູ້ຊື້ (ສີຂຽວ), 2 ສຳລັບຜູ້ຂາຍ ເກັບໄວ້ (ສີມ່ວງ) — ລາຍພື້ນຫຼັງດຽວກັນ ຕ່າງແຕ່ສີ */
const COPIES = [
  { no: 1, label: 'ivpCopyBuyer', en: 'Original — for buyer', tone: 'is-buyer', color: '#0b7a62' },
  { no: 2, label: 'ivpCopySeller', en: 'Copy — for seller', tone: 'is-seller', color: '#5a3ea8' },
];

/** ແຖວຕ່ຳສຸດຂອງຕາຕະລາງ (ເຕີມແຖວວ່າງ ໃຫ້ໃບເບິ່ງຄົບຄືແບບຟອມ) */
const MIN_ROWS = 5;

/** ກ່ອງເລກປະຈຳຕົວຜູ້ເສຍອາກອນ ແບບຟອມທາງການ: 9 - 1 - 2 ຕົວ (ເຊັ່ນ 574155778-0-00); ຫວ່າງ = ກ່ອງເປົ່າໃຫ້ຂຽນເອງ */
const TIN_GROUPS = [9, 1, 2];
const TinBoxes = ({ value }: { value?: string | null }) => {
  const digits = String(value ?? '').replace(/\D/g, '').split('');
  let index = 0;
  return (
    <span className="acc-ivp-tin">
      {TIN_GROUPS.map((size, g) => (
        <span key={g}>
          {g > 0 && <b>-</b>}
          {Array.from({ length: size }, () => {
            const i = index++;
            return <i key={i}>{digits[i] ?? ''}</i>;
          })}
        </span>
      ))}
    </span>
  );
};

/** ປ້າຍສອງພາສາ: ລາວ / English */
const Bi = ({ la, en }: { la: string; en: string }) => <><span>{la}</span> <em>/ {en}</em></>;

/**
 * ໃບເກັບເງິນອາກອນມູນຄ່າເພີ່ມ (ລູກໜີ້) ສຳລັບພິມ — ຮູບແບບຂອງລະບົບເຮົາ (ສອງພາສາ, ຜູ້ຂາຍຊ້າຍ / ຫົວໃບຂວາ) ເທິງພື້ນຫຼັງ
 * ລາຍດຽວກັບແບບຟອມທາງການ (InvoiceBackground). ອົງປະກອບຕາມແບບຟອມ: ຜູ້ຂາຍ + ທີ່ຢູ່ + ບັນຊີທະນາຄານ + ເລກອາກອນ (ກ່ອງ),
 * ຜູ້ຊື້ + ເລກອາກອນ, ຮູບການຊຳລະ, ລາຍການ (ລ/ດ · ເນື້ອໃນ · ຫົວໜ່ວຍ · ຈຳນວນ · ລາຄາຫົວໜ່ວຍ · ລວມ 6=4×5),
 * ລວມບໍ່ມີອາກອນ / ອາກອນ % / ລວມທັງໝົດ, ຈຳນວນເງິນເປັນຕົວໜັງສື, ອັດຕາແລກປ່ຽນ (ສະກຸນຕ່າງປະເທດ), ບ່ອນເຊັນ ຜູ້ຊື້-ຜູ້ຂາຍ,
 * ເລກທີໃບອະນຸຍາດນຳໃຊ້ໃບເກັບເງິນ. ພິມ 1 ຫຼື 2 ສະບັບ ຕາມ ຕັ້ງຄ່າບັນຊີ → ໃບເກັບເງິນອາກອນ.
 * ໃບຢູ່ນອກຈໍ — ກົດປຸ່ມແລ້ວພິມຜ່ານ iframe
 */
export const useInvoicePrint = (doc: PartnerDoc) => {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const company = useCompany();
  const setting = useAccountSetting();
  const taxes = useTaxes();
  const [bankAccount, setBankAccount] = useState<TreasuryAccount | null>(null);

  // ບັນຊີທະນາຄານຂອງບໍລິສັດທີ່ພິມໃສ່ໃບ (ຕັ້ງຄ່າບັນຊີ → ໃບເກັບເງິນອາກອນ)
  useEffect(() => {
    if (!setting.invoice_account_id) return;
    postApi('/treasury-account/fetch', {})
      .then((res) => setBankAccount((res.data?.data ?? []).find((a: TreasuryAccount) => a._uuid === Number(setting.invoice_account_id)) ?? null))
      .catch(() => setBankAccount(null));
  }, [setting.invoice_account_id]);

  const tax = taxes.find((x) => x._uuid === doc.tax_id);
  const taxed = Number(doc.tax) > 0;
  const code = String(doc.currency?.name ?? 'LAK').toUpperCase();
  const foreign = code !== 'LAK';
  const rate = Number(doc.exchange_rate) || 1;
  const money = (v: unknown) => formatNumber(Number(v) || 0);
  const address = [company?.village && `${t('ivpVillage')} ${company.village}`, company?.district?.district_name && `${t('ivpDistrict')} ${company.district.district_name}`,
    company?.district?.province?.province_name && `${t('ivpProvince')} ${company.district.province.province_name}`].filter(Boolean).join(', ');
  const phones = [company?.phone1, company?.phone2].filter(Boolean).join(', ');
  const bankName = bankAccount?.banks
    ? `${bankAccount.banks.name_la ?? ''}${bankAccount.banks.abbr ? ` (${bankAccount.banks.abbr})` : ''}`.trim()
    : '';
  const partner = doc.partner;
  const rows = [...doc.lines.map((l) => ({ ...l, empty: false })), ...Array.from({ length: Math.max(0, MIN_ROWS - doc.lines.length) }, () => null)];
  const copies = COPIES.slice(0, Number(setting.invoice_copies) === 1 ? 1 : 2);
  const qtyText = (v: unknown) => {
    const n = Number(v ?? 1) || 1;
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  };

  const page = (copy: (typeof COPIES)[number]) => (
    <section key={copy.no} className={`acc-ivp-page ${copy.tone}`}>
      <InvoiceBackground color={copy.color} />
      <div className="acc-ivp-body">
        <p className="acc-ivp-nation">
          <span>ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ</span>
          <span>ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ</span>
        </p>
        {/* ---- ຫົວ: ຜູ້ຂາຍ (ຊ້າຍ) + ບັດຫົວໃບ (ຂວາ) ---- */}
        <header className="acc-ivp-top">
          <div className="acc-ivp-seller">
            <div className="acc-ivp-brand">
              {company?.logo_url && <img src={company.logo_url} alt="" />}
              <span>
                <small><Bi la={t('ivpSeller')} en="Seller" /></small>
                <b>{company?.name_la}</b>
                {company?.name_en && <em>{company.name_en}</em>}
              </span>
            </div>
            <dl>
              <dt><Bi la={t('ivpAddress')} en="Address" /></dt><dd>{address || '……………………………………'}</dd>
              <dt><Bi la={t('ivpPhone')} en="Tel" /></dt><dd>{phones || '……………………'}</dd>
              <dt><Bi la={t('ivpAccNo')} en="Account no." /></dt><dd>{bankAccount?.acount_number || '……………………………………'}</dd>
              <dt><Bi la={t('ivpAccName')} en="Account name" /></dt><dd>{bankAccount?.acountName || '……………………………………'}</dd>
              <dt><Bi la={t('ivpBankName')} en="Bank" /></dt><dd>{bankName || '……………………………………'}</dd>
              <dt><Bi la={t('acgTaxId')} en="TIN" /></dt><dd><TinBoxes value={setting.tax_id} /></dd>
            </dl>
          </div>
          <div className="acc-ivp-titlecard">
            <span className="acc-ivp-copy">{t(copy.label)} · {copy.en}</span>
            <h1>{t('ivpTitle')}</h1>
            <h2>{taxed ? 'TAX INVOICE' : 'INVOICE'}</h2>
            {taxed && <p>{t('ivpVatLine')}</p>}
            <dl>
              <dt><Bi la={t('ivpNumber')} en="No." /></dt><dd><b>{doc.doc_number}</b></dd>
              <dt><Bi la={t('ivpDate')} en="Date" /></dt><dd>{moment(doc.doc_date).format('DD/MM/YYYY')}</dd>
              <dt><Bi la={t('ivpDue')} en="Due" /></dt><dd>{moment(doc.due_date).format('DD/MM/YYYY')}</dd>
              <dt><Bi la={t('ivpRef')} en="Ref." /></dt><dd>{doc.reference || '—'}</dd>
            </dl>
          </div>
        </header>

        {/* ---- ຜູ້ຊື້ + ຮູບການຊຳລະ ---- */}
        <section className="acc-ivp-buyer">
          <div>
            <small><Bi la={t('ivpBuyer')} en="Buyer" /></small>
            <b>{partner?.name ?? '……………………………………'}</b>
            <dl>
              <dt><Bi la={t('ivpAddress')} en="Address" /></dt><dd>{partner?.address || '……………………………………'}</dd>
              <dt><Bi la={t('ivpPhone')} en="Tel" /></dt><dd>{partner?.phone || '……………………'}</dd>
              <dt><Bi la={t('ivpAccNo')} en="Account no." /></dt><dd>……………………………………</dd>
              <dt><Bi la={t('ivpBankName')} en="Bank" /></dt><dd>……………………………………</dd>
              <dt><Bi la={t('acgTaxId')} en="TIN" /></dt><dd><TinBoxes value={partner?.tax_number} /></dd>
            </dl>
          </div>
          <div className="acc-ivp-pay">
            <small><Bi la={t('ivpPayment')} en="Payment" /></small>
            <span><i /> {t('ivpCash')} <em>Cash</em></span>
            <span><i /> {t('ivpTransfer')} <em>Transfer</em></span>
            <span><i /> {t('ivpCredit')} <em>Credit</em></span>
          </div>
        </section>

        {/* ---- ລາຍການ ---- */}
        <table className="acc-ivp-lines">
          <thead>
            <tr>
              <th><span>{t('ivpNo')}</span><em>No.</em></th>
              <th><span>{t('ivpItem')}</span><em>Description</em></th>
              <th><span>{t('ivpUnit')}</span><em>Unit</em></th>
              <th><span>{t('ivpQty')}</span><em>Qty</em></th>
              <th><span>{t('ivpUnitPrice')}</span><em>Unit price</em></th>
              <th><span>{t('ivpLineTotal')}</span><em>Amount ({code})</em></th>
            </tr>
            <tr className="is-index"><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6 = 4 × 5</td></tr>
          </thead>
          <tbody>
            {rows.map((l, i) => (l ? (
              <tr key={l._uuid}>
                <td>{i + 1}</td>
                <td>{l.description || (l.account ? l.account.name_la : '')}</td>
                <td>{l.unit || ''}</td>
                <td>{qtyText(l.quantity)}</td>
                <td>{money(l.unit_price ?? l.amount)}</td>
                <td>{money(l.amount)}</td>
              </tr>
            ) : (
              <tr key={`empty-${i}`} className="is-blank"><td /><td /><td /><td /><td /><td /></tr>
            )))}
          </tbody>
        </table>

        {/* ---- ລວມ + ຕົວໜັງສື ---- */}
        <section className="acc-ivp-totals">
          <div className="acc-ivp-words">
            <small><Bi la={t('ivpInWords')} en="Amount in words" /></small>
            <b>{amountInLaoWords(Number(doc.total) || 0, code)}</b>
            {foreign && (
              <em>
                {t('ivpRate')} 1 {code} = {formatNumber(rate)} LAK · {t('ivpLakEquivalent')} {formatNumber(Math.round((Number(doc.total) || 0) * rate))} LAK
                {taxed && <> · {t('ivpVatLak')} {formatNumber(Math.round((Number(doc.tax) || 0) * rate))} LAK</>}
              </em>
            )}
          </div>
          <dl>
            <dt><Bi la={t('ivpSubtotal')} en="Subtotal" /></dt><dd>{money(doc.subtotal)}</dd>
            <dt><Bi la={`${t('ivpVat')} ${tax ? `${Number(tax.rate)}%` : ''}`} en="VAT" /></dt><dd>{money(doc.tax)}</dd>
            <dt className="is-total"><Bi la={t('ivpTotal')} en={`Total (${code})`} /></dt><dd className="is-total">{money(doc.total)}</dd>
          </dl>
        </section>

        {doc.description && <p className="acc-ivp-note"><b>{t('ivpNote')}:</b> {doc.description}</p>}

        {/* ---- ບ່ອນເຊັນ ---- */}
        <footer className="acc-ivp-signs">
          {[{ la: t('ivpBuyerSign'), en: 'Buyer' }, { la: t('ivpSellerSign'), en: 'Seller' }].map((s) => (
            <span key={s.en}>
              <small>{t('ivpDate')}: ……………………</small>
              <b><Bi la={s.la} en={s.en} /></b>
              <i />
              <em>({t('ivpSignStamp')})</em>
            </span>
          ))}
        </footer>

        <div className="acc-ivp-foot">
          <span>{t('ivpLicense')}: <b>{setting.invoice_license || '……………………'}</b></span>
          <span>{t('ivpCopyNo')} {copy.no}/{copies.length} · {t('ivpPage')} 1/1</span>
        </div>
      </div>
    </section>
  );

  const sheet = <div ref={ref} className="acc-ivp" aria-hidden="true">{copies.map(page)}</div>;
  const print = () => ref.current && printElementByFrame(ref.current, PRINT_CSS);
  return { sheet, print };
};
