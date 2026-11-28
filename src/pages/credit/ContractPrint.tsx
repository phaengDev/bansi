import { useRef, useState } from 'react';
import moment from 'moment';
import { Button, Input, InputNumber, Modal } from 'rsuite';
import { formatNumber } from '../../utils/configApi';
import { printElementByFrame } from '../../utils/Print';
import { amountInLaoWords } from '../../utils/laoWords';
import { useT } from '../../context/LanguageContext';
import { useCompany } from '../hr/payroll/payrollApi';
import { useAccountSetting } from '../account/accountSettings';
import { LOAN_METHODS, money, showDate } from '../account/loans/loanApi';
import { ID_TYPES, collateralTypeOf, customerAddress, frequencyOf, type ContractDetail } from './creditApi';
import { creditTermText, monthlyRate } from './creditKit';

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 14mm 16mm; }
  html, body { background: #fff !important; margin: 0; }
  .cr-agreement { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; }
  .cr-agreement-annex { break-before: page; }
  .cr-agreement-signs { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`;

type Format = 'standard' | 'article';
/** ຕົວເລືອກການພິມທີ່ຈື່ໄວ້ (ແບບ, ສະຖານທີ່ເຮັດສັນຍາ, ຈຳນວນວັນຄ້າງ → ຈ່າຍທັງໝົດ) */
const OPTIONS_KEY = 'creditAgreementOptions';
const readOptions = (): { format?: Format; place?: string; days?: number } => {
  try {
    return JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
};
const saveOptions = (value: { format: Format; place: string; days: number }) => {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(value));
  } catch {
    /* ບໍ່ຈື່ກໍ່ໄດ້ */
  }
};

/**
 * ສັນຍາກູ້ຢືມເງິນ (A4) — 2 ແບບ:
 *  - ແບບຟອມມາດຕະຖານ (ຕາມແບບທີ່ລູກຄ້າສົ່ງມາ 2026-11-28): ຝ່າຍ ກ / ຝ່າຍ ຂ, ຂໍ້ມູນຜູ້ກູ້ (ອາຍຸ, ອາຊີບ, ບ້ານ ເມືອງ ແຂວງ, ໂທ, ຜົວ/ເມຍ),
 *    ຈຳນວນເງິນເປັນຕົວເລກ + ຕົວໜັງສື, ການຊຳລະ, ຄ້າງເກີນ N ວັນ = ຈ່າຍທັງໝົດ, ຊັບສິນຊົດໃຊ້, ຫຼົບຫຼີກ, ຜົນສັກສິດ, ລາຍເຊັນ + ນາຍບ້ານຢັ້ງຢືນ
 *  - ແບບມາດຕາ: ຂໍ້ກຳນົດເປັນມາດຕາ (ອັດຕາ, ຄ່າທຳນຽມ, ຄ່າປັບ, ຫຼັກຊັບ, ຜູ້ຄ້ຳ, ການຜິດສັນຍາ)
 * ທັງສອງແບບມີຕາຕະລາງຊຳລະຊ້ອນທ້າຍ. ເນື້ອໃນເປັນແບບຕົວຢ່າງ — ໃຫ້ທີ່ປຶກສາກົດໝາຍກວດກ່ອນໃຊ້
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
  const saved = readOptions();
  const [format, setFormat] = useState<Format>(saved.format ?? 'standard');
  const [place, setPlace] = useState(saved.place ?? [company?.district?.district_name, company?.district?.province?.province_name].filter(Boolean).join(', '));
  const [days, setDays] = useState<number>(saved.days ?? 5);
  const remember = (patch: Partial<{ format: Format; place: string; days: number }>) => saveOptions({ format, place, days, ...patch });
  let no = 0;
  // ແທນ {key} ໃນຂໍ້ຄວາມ (ທຸກບ່ອນ)
  const fill = (text: string, values: Record<string, string>) => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(v), text);
  const person = Number(c?.customer_type) !== 2;
  const age = c?.birth_date ? String(moment(contract.start_date).diff(moment(c.birth_date), 'years')) : null;
  // ໄລຍະຊຳລະ: "ທຸກມື້ / ທຸກອາທິດ" ໃຊ້ຕາມນັ້ນ, "1 ເດືອນ / 3 ເດືອນ" → "ທຸກໆ 1 ເດືອນ"
  const freqLabel = t(frequencyOf(contract.frequency_days, contract.frequency_months).label);
  const everyText = freqLabel.startsWith(t('crStdEveryTest')) ? freqLabel : t('crStdEvery').replace('{f}', freqLabel);
  const scheduleTotal = contract.schedule.reduce((n, r) => n + r.payment, 0);
  const sameInstallments = contract.schedule.length > 0 && contract.schedule.slice(0, -1).every((r) => Math.abs(r.payment - contract.schedule[0].payment) < 1);
  const article = (title: string) => <h4>{t('crArticle').replace('{n}', String(++no))} {title}</h4>;

  return (
    <Modal open onClose={onClose} size="lg" className="cr-agreement-modal">
      <Modal.Header>
        <Modal.Title>{t('crAgreement')} {contract.loan_code}</Modal.Title>
        <small className="cr-agreement-warn"><i className="fa-solid fa-scale-balanced" /> {t('crAgreementWarn')}</small>
      </Modal.Header>
      <Modal.Body>
        <div className="cr-agreement-options">
          <div className="acc-type-segment" role="tablist">
            {(['standard', 'article'] as Format[]).map((f) => (
              <button key={f} type="button" role="tab" aria-selected={format === f} className={format === f ? 'is-active' : ''} onClick={() => { setFormat(f); remember({ format: f }); }}>
                <i className={`fa-solid ${f === 'standard' ? 'fa-file-lines' : 'fa-list-ol'}`} /> {t(f === 'standard' ? 'crStdFormat' : 'crArticleFormat')}
              </button>
            ))}
          </div>
          {format === 'standard' && (
            <>
              <label><small>{t('crStdPlace')}</small><Input size="sm" value={place} onChange={(v) => { setPlace(v); remember({ place: v }); }} /></label>
              <label>
                <small>{t('crStdDaysLabel')}</small>
                <InputNumber size="sm" min={0} max={365} value={days} onChange={(v) => { const n = Math.max(0, Number(v) || 0); setDays(n); remember({ days: n }); }} postfix={t('crDays')} />
              </label>
            </>
          )}
        </div>
        <div ref={ref} className="cr-agreement">
          <p className="acc-ivp-nation">
            <span>ສາທາລະນະລັດ ປະຊາທິປະໄຕ ປະຊາຊົນລາວ</span>
            <span>ສັນຕິພາບ ເອກະລາດ ປະຊາທິປະໄຕ ເອກະພາບ ວັດທະນະຖາວອນ</span>
            <span className="cr-std-ornament">⚬⚬⚬⚬⚬⚬⚬⚬⚬⚬</span>
          </p>
          <header className="cr-agreement-head">
            <div className="cr-receipt-head">
              {company?.logo_url && <img src={company.logo_url} alt="" />}
              <div><b>{company?.name_la ?? ''}</b><small>{[companyAddress, company?.phone1].filter(Boolean).join(' · ')}</small></div>
            </div>
            <span>{t('crAgreementNo')} <b>{contract.contract_no || contract.loan_code}</b><br />{t('date')} {showDate(contract.start_date)}</span>
          </header>
          {format === 'standard' ? (
            <div className="cr-std">
              <h2>{t('crStdTitle')}</h2>
              <p>{fill(t('crStdMadeAt'), { place: place || blank, date: showDate(contract.start_date) })}</p>
              <p>{fill(t('crStdPartyA'), { rep: setting.director || blank, company: company?.name_la ?? blank })}</p>
              <p>{t('crStdOther')}</p>
              <p>
                {fill(t('crStdBorrower'), {
                  title: person ? t(Number(c?.gender) === 2 ? 'crStdMs' : 'crStdMr') : '',
                  name: c?.full_name ?? contract.counterparty, age: age ?? blank, job: c?.occupation || blank,
                })}
              </p>
              <p>{fill(t('crStdId'), { kind: t(ID_TYPES.find((x) => x.value === Number(c?.id_type))?.label ?? 'crIdNo'), no: c?.id_no || blank })}</p>
              <p>
                {fill(t('crStdAddress'), {
                  village: c?.village || blank, house: c?.address || blank,
                  district: c?.district?.district_name || blank, province: c?.district?.province?.province_name || blank,
                })}
              </p>
              <p>{fill(t('crStdPhone'), { phone: c?.phone || blank, spouse: married ? c!.spouse_name! : blank })}</p>
              <p>{t('crStdAgree')}</p>
              <ol className="cr-std-terms">
                <li>
                  {fill(t('crStdAmount'), {
                    amount: money(contract.principal, cur), words: amountInLaoWords(contract.principal, code),
                    purpose: contract.purpose ? fill(t('crStdPurpose'), { p: contract.purpose }) : '',
                    rate: String(contract.annual_rate), monthly: String(monthlyRate(contract.annual_rate)),
                    term: creditTermText(contract.term, contract.frequency_days, contract.frequency_months, t), from: showDate(contract.start_date), to: showDate(maturity),
                  })}
                  {contract.upfront_fee > 0 && ` ${fill(t('crStdFee'), { fee: money(contract.upfront_fee, cur) })}`}
                </li>
                <li>
                  {fill(t(sameInstallments ? 'crStdRepay' : 'crStdRepayVaries'), {
                    first: showDate(first?.due_date), freq: everyText,
                    each: first ? money(first.payment, cur) : blank, n: String(contract.schedule.length),
                    total: money(scheduleTotal, cur), words: amountInLaoWords(scheduleTotal, code),
                  })}
                </li>
                <li>
                  {t('crStdOnTime')}
                  {contract.penalty_rate > 0 && ` ${fill(t(contract.grace_days > 0 ? 'crStdPenalty' : 'crStdPenaltyNoGrace'), { r: String(contract.penalty_rate), g: String(contract.grace_days) })}`}
                  {days > 0 && ` ${fill(t('crStdAccelerate'), { d: String(days) })}`}
                </li>
                <li>
                  {contract.collaterals.length ? (
                    <>
                      {t('crStdCollateral')}
                      <ul>{contract.collaterals.map((x) => <li key={x._uuid}>{t(collateralTypeOf(x.collateral_type).label)}: {x.description}{x.document_no ? ` (${x.document_no})` : ''} — {t('crAppraisedValue')} {money(x.appraised_value, cur)}</li>)}</ul>
                      {t('crStdCollateralUse')}
                    </>
                  ) : t('crStdAssets')}
                </li>
                {contract.guarantors.length > 0 && (
                  <li>{fill(t('crStdGuarantor'), { names: contract.guarantors.map((g) => [g.full_name, g.relationship && `(${g.relationship})`].filter(Boolean).join(' ')).join(', ') })}</li>
                )}
                <li>{t('crStdEvade')}</li>
                <li>{t('crStdValid')}</li>
              </ol>
              <div className="cr-std-signs">
                <span>{t('crStdSignBorrower')}<small>{c?.full_name ?? ''}</small></span>
                {married && <span>{t('crStdSignSpouse')}<small>{c!.spouse_name}</small></span>}
                {contract.guarantors.map((g, i) => <span key={g._uuid ?? i}>{t('crStdSignGuarantor')}<small>{g.full_name}</small></span>)}
                <span>{t('crStdSignOfficer')}<small>{contract.officer ?? ''}</small></span>
                <span>{t('crStdSignWriter')}<small /></span>
                <span>{t('crStdSignLender')}<small>{setting.director ?? ''}</small></span>
              </div>
              <div className="cr-std-chief">
                <span>{fill(t('crStdChief'), { village: c?.village || '' })}<small /></span>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}

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
