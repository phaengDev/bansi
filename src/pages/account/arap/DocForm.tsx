import { useEffect, useState } from 'react';
import { Button, DatePicker, Input, Modal, NumberInput, SelectPicker, Textarea } from 'rsuite';
import moment from 'moment';
import { getApi, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useCurrency } from '../../../utils/selectOption';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { isFutureDay, type Tax } from '../journal/journalKit';
import { FormStep } from '../setting/settingKit';
import { money } from '../gl/glApi';
import { accountOptionLabel, useAccountOptions, useChartAccounts, amountFormatter } from '../gl/glKit';
import { AP, AR, KINDS, isPartnerOf, usePartners, type Kind, type Partner } from './arapApi';
import { PartnerForm } from './PartnerPage';

type Line = { key: number; account_id: number | null; description: string; amount: number | null };
let seq = 0;
const blankLine = (): Line => ({ key: ++seq, account_id: null, description: '', amount: null });
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const isBlank = (l: Line) => !l.account_id && !(Number(l.amount) > 0) && !l.description.trim();

/** ຄິດອາກອນແບບດຽວກັບ backend (computeTax): 1 ລວມໃນລາຄາ, 2 ບວກເພີ່ມ — ປັດເປັນຈຳນວນເຕັມ */
const taxOf = (tax: Tax | undefined, subtotal: number) => {
  if (!tax || !subtotal) return { tax: 0, total: subtotal };
  const rate = Number(tax.rate) || 0;
  const inclusive = Number(tax.calc_method) === 1;
  const value = Math.round(inclusive ? subtotal - subtotal / (1 + rate / 100) : (subtotal * rate) / 100);
  return { tax: value, total: inclusive ? subtotal : subtotal + value };
};

/** ກຳນົດຊຳລະດ່ວນ (ມື້ນັບຈາກວັນທີເອກະສານ) */
const TERMS = [0, 7, 15, 30, 60];

/** ຄູ່ຄ້າໃນ picker — ລະຫັດ + ຊື່ + ເບີໂທ */
const partnerLabel = (_: unknown, item: any) => item && (
  <span className="acc-gl-opt">
    <span className="acc-gl-code acc-tone is-slate">{item.partner.partner_code}</span>
    <span>{item.partner.name}{item.partner.phone ? <small className="text-muted"> · {item.partner.phone}</small> : null}</span>
  </span>
);

/**
 * ໃບແຈ້ງໜີ້ (AR) / ໃບບິນຜູ້ສະໜອງ (AP) ແບບ 3 ຂັ້ນ — ຄືຟອມລາຍຈ່າຍ:
 * 1) ຄູ່ຄ້າ + ວັນທີ/ຄົບກຳນົດ (ເພີ່ມຄູ່ຄ້າໃໝ່ໄດ້ທັນທີ), 2) ລາຍການ (ບັນຊີ + ລາຍລະອຽດ + ຈຳນວນ), 3) ສະກຸນ, ອາກອນ, ສະຫຼຸບ.
 * ບັນທຶກແລ້ວລົງບັນຊີທັນທີ; ແກ້ບໍ່ໄດ້ — ຍົກເລີກແລ້ວອອກໃໝ່ (ຖ້າຍັງບໍ່ໄດ້ຕັດໜີ້)
 */
const DocForm = ({ kind, partnerId, onClose, onSaved }: {
  kind: Kind;
  partnerId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const cfg = KINDS[kind];
  const { rows: partners, reload: reloadPartners } = usePartners();
  const { rows: accounts, loading: accountsLoading } = useChartAccounts();
  const lineOptions = useAccountOptions(accounts, (a) => (cfg.lineGroups as readonly number[]).includes(Number(a.account_group)));
  const currencies = useCurrency() as unknown as { label: string; value: number; rate: number }[];
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [partner, setPartner] = useState<number | null>(partnerId ?? null);
  const [addingPartner, setAddingPartner] = useState(false);
  const [docDate, setDocDate] = useState<Date>(new Date());
  const [dueDays, setDueDays] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [taxId, setTaxId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>(() => [blankLine()]);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getApi('/tax/option').then((res) => setTaxes(res.data?.data ?? [])).catch((error) => console.error(error));
  }, []);

  const partnerOptions = partners
    .filter((p) => isPartnerOf(kind, p) && Number(p.status) === 1)
    .map((p) => ({ value: p._uuid, label: `${p.partner_code} ${p.name} ${p.phone ?? ''}`, partner: p }));
  const selected: Partner | undefined = partners.find((p) => p._uuid === partner);
  // ຄົບກຳນົດ: ເລືອກວັນເອງ > ປຸ່ມກຳນົດດ່ວນ > ກຳນົດຊຳລະຂອງຄູ່ຄ້າ
  const termDays = dueDays ?? selected?.credit_days ?? 0;
  const due = dueDate ?? moment(docDate).add(termDays, 'days').toDate();

  const currency = currencies.find((c) => c.value === currencyId);
  const isBase = !currency || String(currency.label).toUpperCase() === 'LAK';
  const effectiveRate = isBase ? 1 : rate ?? currency?.rate ?? 0;
  const code = isBase ? 'LAK' : currency?.label ?? '';

  const filled = lines.filter((l) => !isBlank(l));
  const lineErrors = (l: Line) => ({ account: !l.account_id, amount: !(Number(l.amount) > 0) });
  const linesValid = filled.length > 0 && filled.every((l) => { const e = lineErrors(l); return !e.account && !e.amount; });
  const subtotal = round2(filled.reduce((n, l) => n + (Number(l.amount) || 0), 0));
  const taxed = taxOf(taxes.find((x) => x._uuid === taxId), subtotal);
  const net = round2(taxed.total - taxed.tax);
  const ownBalance = selected ? (kind === AR ? selected.ar_open : selected.ap_open) : 0;

  const update = (key: number, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);

  const submit = async () => {
    setChecked(true);
    if (!partner || !linesValid || !(effectiveRate > 0)) {
      Notific.warning('arapFixErrors');
      return;
    }
    try {
      setSaving(true);
      await postApi('/partner-doc/create', {
        kind,
        partner_id: partner,
        doc_date: moment(docDate).format('YYYY-MM-DD'),
        due_date: moment(due).format('YYYY-MM-DD'),
        reference: reference.trim() || null,
        description: description.trim() || null,
        currency_id: currencyId,
        exchange_rate: isBase ? 1 : effectiveRate,
        tax_id: taxId,
        lines: filled.map((l) => ({ account_id: l.account_id, description: l.description.trim() || null, amount: Number(l.amount) })),
      });
      Notific.success('saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal open onClose={onClose} size="lg" className={`acc-book-modal is-steps is-xfer acc-arap-form${kind === AP ? ' is-expense' : ''}`}>
        <Modal.Header>
          <div className="acc-book-modal-head">
            <span className="acc-book-modal-icon"><i className={`fa-solid ${cfg.docIcon}`} /></span>
            <span>
              <Modal.Title>{t(cfg.docAdd)}</Modal.Title>
              <small>{t(kind === AR ? 'arInvoiceHint' : 'apBillHint')}</small>
            </span>
          </div>
        </Modal.Header>

        <Modal.Body>
          <div className="acc-book-main">
            {/* ---- ຂັ້ນ 1: ຄູ່ຄ້າ + ວັນທີ ---- */}
            <FormStep no={1} done={!!partner} title={t(kind === AR ? 'arStepPartner' : 'apStepPartner')} hint={t('arapStepPartnerHint')}>
              <div className="is-wide rs-form-group">
                <label className="form-label">{t(cfg.partner)}<span className="text-danger">*</span></label>
                <div className="acc-arap-picker-row">
                  <SelectPicker block data={partnerOptions} value={partner} onChange={(v) => setPartner(v as number | null)}
                    placeholder={t('arapChoosePartner')} renderOption={partnerLabel} renderValue={(_, item) => partnerLabel(_, item)}
                    className={checked && !partner ? 'has-error' : ''} popupClassName="acc-book-menu"
                    locale={{ noResultsText: t('arapNoPartnerYet') }}
                  />
                  <button type="button" className="acc-arap-quick-add" disabled={!canCreate} onClick={() => setAddingPartner(true)}>
                    <i className="fa-solid fa-user-plus" /> {t('arapPartnerAdd')}
                  </button>
                </div>
                {checked && !partner && <small className="acc-arap-error">{t('arapChoosePartner')}</small>}
                {selected && (
                  <div className="acc-arap-partner-info">
                    {selected.contact_person && <span><i className="fa-solid fa-user" /> {selected.contact_person}</span>}
                    {selected.phone && <span><i className="fa-solid fa-phone" /> {selected.phone}</span>}
                    <span><i className="fa-solid fa-calendar-days" /> {t('arapCreditDays')} {selected.credit_days} {t('days')}</span>
                    {ownBalance > 0 && <span className="is-warn"><i className="fa-solid fa-scale-unbalanced" /> {t(cfg.open)} {money(ownBalance)}</span>}
                  </div>
                )}
              </div>
              <div className="rs-form-group">
                <label className="form-label">{t('arapDocDate')}<span className="text-danger">*</span></label>
                <DatePicker value={docDate} onChange={(v) => v && setDocDate(v)} format="dd/MM/yyyy" oneTap cleanable={false}
                  shouldDisableDate={isFutureDay} block
                />
              </div>
              <div className="rs-form-group">
                <label className="form-label">{t('arapDueDate')}</label>
                <DatePicker value={due} onChange={(v) => { setDueDate(v); setDueDays(null); }} format="dd/MM/yyyy" oneTap block
                  cleanable={false} shouldDisableDate={(d) => moment(d).isBefore(docDate, 'day')}
                />
                <div className="acc-arap-chips">
                  {TERMS.map((d) => (
                    <button key={d} type="button" className={!dueDate && termDays === d ? 'is-active' : ''}
                      onClick={() => { setDueDays(d); setDueDate(null); }}
                    >
                      {d ? `${d} ${t('days')}` : t('arapDueNow')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="is-wide rs-form-group">
                <label className="form-label">{t(kind === AR ? 'arapReferenceAr' : 'arapReferenceAp')}</label>
                <Input value={reference} onChange={setReference} placeholder={kind === AR ? 'PO-…' : 'INV-…'} />
              </div>
            </FormStep>

            {/* ---- ຂັ້ນ 2: ລາຍການ ---- */}
            <FormStep no={2} done={linesValid} title={t('arapStepLines')} hint={t(kind === AR ? 'arStepLinesHint' : 'apStepLinesHint')}
              note={<><i className="fa-solid fa-list-ol" /> {filled.length} {t('incomeItems')}</>}
            >
              <div className="is-wide acc-ex-lines">
                <div className="acc-ex-row acc-arap-row is-head" aria-hidden="true">
                  <span>#</span>
                  <span>{t(kind === AR ? 'arapRevenueAccount' : 'arapExpenseAccount')}</span>
                  <span>{t('detail')}</span>
                  <span>{t('fsAmount')} ({code})</span>
                  <span />
                </div>
                {lines.map((l, i) => {
                  const err = checked && !isBlank(l) ? lineErrors(l) : null;
                  const emptyError = checked && !filled.length && i === 0;
                  return (
                    <div key={l.key} className="acc-ex-row acc-arap-row">
                      <span className="acc-ex-no">{i + 1}</span>
                      <div className={`acc-ex-cell is-name${err?.account || emptyError ? ' has-error' : ''}`}>
                        <small>{t(kind === AR ? 'arapRevenueAccount' : 'arapExpenseAccount')}</small>
                        <SelectPicker block data={lineOptions} value={l.account_id} groupBy="groupLabel" placeholder={t('glChooseAccount')}
                          renderOption={accountOptionLabel} renderValue={(_, item) => accountOptionLabel(_, item)} loading={accountsLoading}
                          onChange={(v) => update(l.key, { account_id: (v as number) ?? null })} popupClassName="acc-book-menu"
                        />
                      </div>
                      <label className="acc-ex-cell is-desc">
                        <small>{t('detail')}</small>
                        <Input value={l.description} onChange={(v) => update(l.key, { description: v })} placeholder={t('arapLinePlaceholder')} />
                      </label>
                      <label className={`acc-ex-cell is-money${err?.amount || emptyError ? ' has-error' : ''}`}>
                        <small>{t('fsAmount')}</small>
                        <NumberInput value={l.amount ?? ''} min={0} controls={false} formatter={amountFormatter} placeholder="0"
                          onChange={(v) => update(l.key, { amount: v === '' || v === null ? null : Number(v) })}
                          onKeyDown={(e) => { if (e.key === 'Enter' && i === lines.length - 1) { e.preventDefault(); addLine(); } }}
                        />
                      </label>
                      <button type="button" className="acc-ex-remove" disabled={lines.length === 1} title={t('delete')}
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </div>
                  );
                })}
                <div className="acc-ex-foot">
                  <button type="button" className="acc-ex-add" onClick={addLine}>
                    <i className="fa-solid fa-plus" /> {t('glAddLine')} <kbd>Enter</kbd>
                  </button>
                  <span className="acc-ex-subtotal">
                    <small>{t('arapSubtotal')}</small>
                    <b>{money(subtotal)} {code}</b>
                  </span>
                </div>
              </div>
            </FormStep>

            {/* ---- ຂັ້ນ 3: ສະກຸນ + ອາກອນ + ສະຫຼຸບ ---- */}
            <FormStep no={3} done={linesValid && !!partner} title={t('arapStepTotals')} hint={t('arapStepTotalsHint')}>
              <div className="rs-form-group">
                <label className="form-label">{t('accountTypeCurrency')}</label>
                <SelectPicker block data={currencies} value={currencyId} placeholder="LAK" popupClassName="acc-book-menu"
                  onChange={(v) => { setCurrencyId(v as number | null); setRate(null); }}
                />
              </div>
              {isBase ? (
                <div className="rs-form-group">
                  <label className="form-label">{t('incomeTaxField')}</label>
                  <SelectPicker block data={taxes.map((x) => ({ value: x._uuid, label: `${x.tax_code} · ${x.name} (${Number(x.rate)}%)` }))}
                    value={taxId} onChange={(v) => setTaxId(v as number | null)} placeholder={t('arapNoTax')} popupClassName="acc-book-menu"
                  />
                </div>
              ) : (
                <div className="rs-form-group">
                  <label className="form-label">{t('glExchangeRate')} (1 {code})<span className="text-danger">*</span></label>
                  <NumberInput value={effectiveRate || ''} min={0} controls={false} formatter={amountFormatter}
                    className={checked && !(effectiveRate > 0) ? 'has-error' : ''}
                    onChange={(v) => setRate(v === '' || v === null ? null : Number(v))}
                  />
                </div>
              )}
              {!isBase && (
                <div className="rs-form-group">
                  <label className="form-label">{t('incomeTaxField')}</label>
                  <SelectPicker block data={taxes.map((x) => ({ value: x._uuid, label: `${x.tax_code} · ${x.name} (${Number(x.rate)}%)` }))}
                    value={taxId} onChange={(v) => setTaxId(v as number | null)} placeholder={t('arapNoTax')} popupClassName="acc-book-menu"
                  />
                </div>
              )}
              <div className="is-wide rs-form-group">
                <label className="form-label">{t('glEntryDescription')}</label>
                <Textarea rows={2} value={description} onChange={setDescription} placeholder={t('arapDescPlaceholder')} />
              </div>
              <div className={`is-wide acc-jr-summary${kind === AP ? ' is-expense' : ''}`}>
                <div>
                  <small>{t('arapSubtotal')} · {filled.length} {t('incomeItems')}</small>
                  <b>{money(net)}</b>
                </div>
                <div>
                  <small>{t('incomeTaxField')}</small>
                  <b>{money(taxed.tax)}</b>
                </div>
                <div className="is-total">
                  <small>{t('total')} ({code})</small>
                  <b>{money(taxed.total)}</b>
                </div>
                <div className="is-balance">
                  <span><i className="fa-regular fa-calendar" /> {t('arapDueDate')} {moment(due).format('DD/MM/YYYY')}</span>
                  {!isBase && effectiveRate > 0 && <span>≈ <b>{money(taxed.total * effectiveRate)}</b> LAK</span>}
                </div>
              </div>
            </FormStep>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>
          <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
          <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={submit}>
            <i className="fa-solid fa-check" /> {t('save')}
          </Button>
        </Modal.Footer>
      </Modal>

      {addingPartner && (
        <PartnerForm kind={kind} data={null} partners={partners} onClose={() => setAddingPartner(false)}
          onSaved={(created) => {
            reloadPartners();
            if (created?._uuid) setPartner(created._uuid);
          }}
        />
      )}
    </>
  );
};

export default DocForm;
