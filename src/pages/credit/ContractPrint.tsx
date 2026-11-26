import { useRef } from 'react';
import { Button, Modal } from 'rsuite';
import { formatNumber } from '../../utils/configApi';
import { printElementByFrame } from '../../utils/Print';
import { amountInLaoWords } from '../../utils/laoWords';
import { useT } from '../../context/LanguageContext';
import { useCompany } from '../hr/payroll/payrollApi';
import { useAccountSetting } from '../account/accountSettings';
import { LOAN_METHODS, money, showDate } from '../account/loans/loanApi';
import { ID_TYPES, collateralTypeOf, customerAddress, type ContractDetail } from './creditApi';
import { creditTermText, monthlyRate } from './creditKit';

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 14mm 16mm; }
  html, body { background: #fff !important; margin: 0; }
  .cr-agreement { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; }
  .cr-agreement-annex { break-before: page; }
  .cr-agreement-signs { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

/**
 * ສັນຍາກູ້ຢືມເງິນ (A4) — ຄູ່ສັນຍາ, ຈຳນວນ / ດອກເບ້ຍ / ໄລຍະ, ຄ່າທຳນຽມ, ການຊຳລະ, ຄ່າປັບ, ຫຼັກຊັບ, ຜູ້ຄ້ຳ, ການຜິດສັນຍາ,
 * ບ່ອນເຊັນ ແລະ ເອກະສານຊ້ອນທ້າຍ (ຕາຕະລາງຜ່ອນ). ເນື້ອໃນຂໍ້ກຳນົດເປັນແບບຕົວຢ່າງ — ໃຫ້ທີ່ປຶກສາກົດໝາຍກວດກ່ອນໃຊ້
 */
const ContractPrint = ({ contract, onClose }: { contract: ContractDetail; onClose: () => void }) => {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const company = useCompany();
  const setting = useAccountSetting();
  const c = contract.customer;
  const cur = contract.currency;
  const code = cur?.name ?? 'LAK';
  const maturity = contract.schedule[contract.schedule.length - 1]?.due_date;
  const companyAddress = [company?.village, company?.district?.district_name, company?.district?.province?.province_name].filter(Boolean).join(', ');
  const method = LOAN_METHODS.find((m) => m.value === Number(contract.method));
  const first = contract.schedule[0];
  const married = c && Number(c.marital_status) === 2 && c.spouse_name;
  const blank = '……………………………';
  let no = 0;
  const article = (title: string) => <h4>{t('crArticle').replace('{n}', String(++no))} {title}</h4>;

  return (
    <Modal open onClose={onClose} size="lg" className="cr-agreement-modal">
      <Modal.Header>
        <Modal.Title>{t('crAgreement')} {contract.loan_code}</Modal.Title>
        <small className="cr-agreement-warn"><i className="fa-solid fa-scale-balanced" /> {t('crAgreementWarn')}</small>
      </Modal.Header>
      <Modal.Body>
        <div ref={ref} className="cr-agreement">
          <p className="acc-ivp-nation">
            <span>ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ</span>
            <span>ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ</span>
          </p>
          <header className="cr-agreement-head">
            <div className="cr-receipt-head">
              {company?.logo_url && <img src={company.logo_url} alt="" />}
              <div><b>{company?.name_la ?? ''}</b><small>{[companyAddress, company?.phone1].filter(Boolean).join(' · ')}</small></div>
            </div>
            <span>{t('crAgreementNo')} <b>{contract.contract_no || contract.loan_code}</b><br />{t('date')} {showDate(contract.start_date)}</span>
          </header>
          <h2>{t('crAgreementTitle')}</h2>

          <p>{t('crAgreementIntro').replace('{d}', showDate(contract.start_date))}</p>
          <dl className="cr-agreement-party">
            <dt>{t('crLender')}</dt>
            <dd><b>{company?.name_la ?? blank}</b>, {t('crAddress')} {companyAddress || blank}, {t('phone')} {company?.phone1 ?? blank}{setting.director ? `, ${t('crRepresentedBy')} ${setting.director}` : ''}</dd>
            <dt>{t('crBorrowerParty')}</dt>
            <dd>
              <b>{c?.full_name ?? contract.counterparty}</b>, {t(ID_TYPES.find((x) => x.value === Number(c?.id_type))?.label ?? 'crIdNo')} {c?.id_no ?? blank},{' '}
              {t('crAddress')} {(c && [customerAddress(c), c.address].filter(Boolean).join(', ')) || blank}, {t('phone')} {c?.phone ?? blank}
              {c?.occupation ? `, ${t('crOccupation')} ${c.occupation}` : ''}
              {married ? `, ${t('crSpouseName')} ${c!.spouse_name}` : ''}
            </dd>
          </dl>

          {article(t('crArtAmount'))}
          <p>{t('crArtAmountText').replace('{a}', money(contract.principal, cur)).replace('{w}', amountInLaoWords(contract.principal, code)).replace('{p}', contract.purpose || blank)}</p>
          {article(t('crArtRate'))}
          <p>{t('crArtRateText').replace('{r}', String(contract.annual_rate)).replace('{m}', String(monthlyRate(contract.annual_rate))).replace('{method}', method ? t(method.label) : '')
            .replace('{term}', creditTermText(contract.term, contract.frequency_days, contract.frequency_months, t)).replace('{from}', showDate(contract.start_date)).replace('{to}', showDate(maturity))}</p>
          {article(t('crArtFees'))}
          <p>{t('crArtFeesText').replace('{fee}', money(contract.upfront_fee, cur)).replace('{pre}', String(contract.product?.prepayment_fee_rate ?? 0))}</p>
          {article(t('crArtPayment'))}
          <p>{t('crArtPaymentText').replace('{first}', showDate(first?.due_date)).replace('{amt}', first ? money(first.payment, cur) : blank).replace('{n}', String(contract.schedule.length))}</p>
          {article(t('crArtPenalty'))}
          <p>{contract.penalty_rate > 0 ? t(contract.grace_days > 0 ? 'crArtPenaltyText' : 'crArtPenaltyNoGrace').replace('{r}', String(contract.penalty_rate)).replace('{g}', String(contract.grace_days)) : t('crArtNoPenalty')}</p>
          {article(t('crArtCollateral'))}
          {contract.collaterals.length ? (
            <ol>{contract.collaterals.map((x) => <li key={x._uuid}>{t(collateralTypeOf(x.collateral_type).label)}: {x.description}{x.document_no ? ` (${x.document_no})` : ''} — {t('crAppraisedValue')} ₭ {formatNumber(x.appraised_value)}</li>)}</ol>
          ) : <p>{t('crArtNoCollateral')}</p>}
          {article(t('crArtGuarantor'))}
          {contract.guarantors.length ? (
            <><ol>{contract.guarantors.map((g, i) => <li key={g._uuid ?? i}>{g.full_name}{g.id_no ? `, ${g.id_no}` : ''}{g.phone ? `, ${g.phone}` : ''}{g.relationship ? ` (${g.relationship})` : ''}</li>)}</ol><p>{t('crArtGuarantorText')}</p></>
          ) : <p>{t('crArtNoGuarantor')}</p>}
          {article(t('crArtDefault'))}
          <p>{t('crArtDefaultText')}</p>
          {article(t('crArtGeneral'))}
          <p>{t('crArtGeneralText')}</p>

          <div className="cr-agreement-signs">
            <span>{t('crLender')}<small>{setting.director ?? ''}</small></span>
            <span>{t('crBorrowerParty')}<small>{c?.full_name ?? ''}</small></span>
            {married && <span>{t('crSpouseName')}<small>{c!.spouse_name}</small></span>}
            {contract.guarantors.map((g, i) => <span key={g._uuid ?? i}>{t('crGuarantors')}<small>{g.full_name}</small></span>)}
            <span>{t('crWitness')}<small /></span>
          </div>

          <section className="cr-agreement-annex">
            <h3>{t('crAnnexSchedule')}</h3>
            <table className="cr-receipt-lines cr-agreement-table">
              <thead><tr><th>#</th><th>{t('lnDue')}</th><th>{t('lnPrincipalShort')}</th><th>{t('lnInterestShort')}</th><th>{t('total')}</th></tr></thead>
              <tbody>
                {contract.schedule.map((r) => (
                  <tr key={r.no}><td>{r.no}</td><td>{showDate(r.due_date)}</td><td>{formatNumber(r.principal)}</td><td>{formatNumber(r.interest)}</td><td>{formatNumber(r.payment)}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('close')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" onClick={() => ref.current && printElementByFrame(ref.current, PRINT_CSS)}>
          <i className="fa-solid fa-print" /> {t('print')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ContractPrint;
