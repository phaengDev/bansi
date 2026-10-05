import { useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Input, Loader, Modal, NumberInput, SelectPicker, Textarea } from 'rsuite';
import moment from 'moment';
import { postApi, formatNumber } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { isFutureDay } from '../journal/journalKit';
import { FormStep } from '../setting/settingKit';
import { ACCOUNT_POPUP_STYLE, accountOption, renderAccountOption } from '../ledger/accountOption';
import type { TreasuryAccount } from '../ledger/TreasuryAccountForm';
import { money } from '../gl/glApi';
import { amountFormatter } from '../gl/glKit';
import { AP, AR, KINDS, amountText, isPartnerOf, overdueDays, usePartnerDocs, usePartners, type Kind } from './arapApi';

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
/** ລະຫັດສະກຸນຂອງໃບ/ບັນຊີ — ບໍ່ມີ = LAK */
const codeOf = (c?: { name?: string } | null) => String(c?.name ?? 'LAK').toUpperCase();

const partnerLabel = (_: unknown, item: any) => item && (
  <span className="acc-gl-opt">
    <span className="acc-gl-code acc-tone is-slate">{item.partner.partner_code}</span>
    <span>{item.partner.name}</span>
  </span>
);

/**
 * ຮັບຊຳລະ (AR) / ຈ່າຍຊຳລະ (AP) ແບບ 3 ຂັ້ນ: 1) ຄູ່ຄ້າ + ບັນຊີເງິນຄັງ + ວັນທີ, 2) ຕັດໜີ້ໃບທີ່ຄ້າງ (ສະກຸນດຽວກັບບັນຊີ),
 * 3) ໝາຍເຫດ + ສະຫຼຸບ. ຍອດຊຳລະ = ລວມທີ່ຕັດ; ເງິນເຂົ້າ/ອອກບັນຊີເງິນຄັງ ແລະ ລົງບັນຊີທັນທີ
 */
const PaymentForm = ({ kind, partnerId, docId, onClose, onSaved }: {
  kind: Kind;
  partnerId?: number | null;
  /** ເລືອກໃບນີ້ໃຫ້ກ່ອນ (ກົດ "ຊຳລະ" ຈາກລາຍການໃບ) */
  docId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const cfg = KINDS[kind];
  const { rows: partners } = usePartners();
  const [partner, setPartner] = useState<number | null>(partnerId ?? null);
  const [accounts, setAccounts] = useState<TreasuryAccount[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [payDate, setPayDate] = useState<Date>(new Date());
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [alloc, setAlloc] = useState<Record<number, number | null>>({});
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const { rows: docs, loading } = usePartnerDocs(kind, { partner_id: partner ?? -1, open_only: true });

  useEffect(() => {
    postApi('/treasury-account/fetch', {})
      .then((res) => setAccounts((res.data?.data ?? []).filter((a: TreasuryAccount) => Number(a.status) === 1)))
      .catch((error) => console.error(error));
  }, []);

  const account = accounts.find((a) => a._uuid === accountId);
  const accountCode = account ? codeOf(account.treasury?.currency) : null;
  const openDocs = useMemo(() => [...docs].sort((a, b) => a.due_date.localeCompare(b.due_date)), [docs]);
  const usable = (code: string) => !accountCode || code === accountCode;

  // ເລືອກໃບທີ່ສົ່ງມາ ແລະ ບັນຊີທີ່ສະກຸນກົງກັນໃຫ້ກ່ອນ
  useEffect(() => {
    if (!docId) return;
    const doc = docs.find((d) => d._uuid === docId);
    if (!doc) return;
    setAlloc((prev) => (docId in prev ? prev : { ...prev, [docId]: doc.open }));
    if (!accountId) {
      const match = accounts.find((a) => codeOf(a.treasury?.currency) === codeOf(doc.currency));
      if (match) setAccountId(match._uuid);
    }
  }, [docId, docs, accounts, accountId]);

  const chosen = openDocs.filter((d) => usable(codeOf(d.currency)) && Number(alloc[d._uuid]) > 0);
  const total = round2(chosen.reduce((n, d) => n + Number(alloc[d._uuid]), 0));
  const over = chosen.some((d) => Number(alloc[d._uuid]) > d.open + 0.001);
  const available = Number(account?.balance_treasury) || 0;
  const short = kind === AP && !!account && total > available;
  const currencies = [...new Set(openDocs.map((d) => codeOf(d.currency)))];

  const partnerOptions = partners
    .filter((p) => isPartnerOf(kind, p))
    .map((p) => ({ value: p._uuid, label: `${p.partner_code} ${p.name}`, partner: p }));

  const changeAccount = (value: number | null) => {
    setAccountId(value);
    const next = accounts.find((a) => a._uuid === value);
    const code = next ? codeOf(next.treasury?.currency) : null;
    // ໃບຄົນລະສະກຸນ ເອົາອອກຈາກການຕັດ
    setAlloc((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => {
      const doc = docs.find((d) => d._uuid === Number(id));
      return !code || (doc && codeOf(doc.currency) === code);
    })));
  };

  const payAll = () => setAlloc(Object.fromEntries(openDocs.filter((d) => usable(codeOf(d.currency))).map((d) => [d._uuid, d.open])));

  const submit = async () => {
    setChecked(true);
    if (!partner || !account || !chosen.length || over || short) {
      Notific.warning('arapFixErrors');
      return;
    }
    try {
      setSaving(true);
      await postApi('/partner-payment/create', {
        kind,
        partner_id: partner,
        pay_date: moment(payDate).format('YYYY-MM-DD'),
        treasury_account_id: accountId,
        reference: reference.trim() || null,
        description: description.trim() || null,
        allocations: chosen.map((d) => ({ doc_id: d._uuid, amount: Number(alloc[d._uuid]) })),
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

  const renderAccount = renderAccountOption(t('treasuryNoBank'), kind === AP);

  return (
    <Modal open onClose={onClose} size="lg" className={`acc-book-modal is-steps is-xfer acc-arap-form${kind === AP ? ' is-expense' : ''}`}>
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className={`fa-solid ${cfg.payIcon}`} /></span>
          <span>
            <Modal.Title>{t(cfg.payAdd)}</Modal.Title>
            <small>{t(kind === AR ? 'arReceiptHint' : 'apPaymentHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-book-main">
          {/* ---- ຂັ້ນ 1: ຄູ່ຄ້າ + ບັນຊີ + ວັນທີ ---- */}
          <FormStep no={1} done={!!partner && !!account} title={t(kind === AR ? 'arStepReceive' : 'apStepPay')} hint={t('arapStepPayHint')}>
            <div className="is-wide rs-form-group">
              <label className="form-label">{t(cfg.partner)}<span className="text-danger">*</span></label>
              <SelectPicker block data={partnerOptions} value={partner} placeholder={t('arapChoosePartner')}
                onChange={(v) => { setPartner(v as number | null); setAlloc({}); }}
                renderOption={partnerLabel} renderValue={(_, item) => partnerLabel(_, item)}
                className={checked && !partner ? 'has-error' : ''} popupClassName="acc-book-menu"
                locale={{ noResultsText: t('arapNoPartnerYet') }}
              />
            </div>
            <div className="is-wide rs-form-group">
              <label className="form-label">{t(kind === AR ? 'arReceiveInto' : 'apPayFrom')}<span className="text-danger">*</span></label>
              <SelectPicker block data={accounts.map((a) => accountOption(a))} value={accountId} placeholder={t('glChooseAccount')}
                onChange={(v) => changeAccount(v as number | null)} renderOption={renderAccount} renderValue={renderAccount}
                popupStyle={ACCOUNT_POPUP_STYLE} className={checked && !account ? 'has-error' : ''} popupClassName="acc-book-menu"
              />
              {currencies.length > 0 && (
                <small className="acc-arap-hint">
                  <i className="fa-solid fa-circle-info" /> {t('arapCurrencyRule')} {currencies.join(', ')}
                </small>
              )}
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t(kind === AR ? 'arReceiveDate' : 'apPayDate')}<span className="text-danger">*</span></label>
              <DatePicker value={payDate} onChange={(v) => v && setPayDate(v)} format="dd/MM/yyyy" oneTap cleanable={false}
                shouldDisableDate={isFutureDay} block
              />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('glReference')}</label>
              <Input value={reference} onChange={setReference} placeholder={t('arapPayRefPlaceholder')} />
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 2: ຕັດໜີ້ ---- */}
          <FormStep no={2} done={chosen.length > 0 && !over} title={t('arapAllocate')} hint={t('arapAllocateHint')}
            note={partner && openDocs.length > 0
              ? <button type="button" className="acc-arap-note-btn" onClick={payAll} disabled={!account}><i className="fa-solid fa-check-double" /> {t('arapPayAll')}</button>
              : undefined}
          >
            <div className="is-wide acc-ex-lines">
              {!partner ? (
                <p className="acc-arap-empty">{t('arapChoosePartnerFirst')}</p>
              ) : loading ? (
                <div className="text-center py-3"><Loader size="sm" /></div>
              ) : !openDocs.length ? (
                <p className="acc-arap-empty">{t('arapNoOpenDocs')}</p>
              ) : (
                <>
                  <div className="acc-ex-row acc-arap-alloc-row is-head" aria-hidden="true">
                    <span />
                    <span>{t(cfg.doc)}</span>
                    <span>{t('arapDueDate')}</span>
                    <span>{t('arapOpenAmount')}</span>
                    <span>{t('arapAllocAmount')}</span>
                  </div>
                  {openDocs.map((d) => {
                    const code = codeOf(d.currency);
                    const enabled = !!account && usable(code);
                    const isChecked = Number(alloc[d._uuid]) > 0;
                    const late = overdueDays(d.due_date);
                    const tooMuch = Number(alloc[d._uuid]) > d.open + 0.001;
                    return (
                      <div key={d._uuid} className={`acc-ex-row acc-arap-alloc-row${enabled ? '' : ' is-off'}${isChecked ? ' is-on' : ''}`}>
                        <label className="acc-arap-check">
                          <input type="checkbox" checked={isChecked} disabled={!enabled}
                            onChange={(e) => setAlloc((prev) => ({ ...prev, [d._uuid]: e.target.checked ? d.open : null }))}
                          />
                        </label>
                        <span className="acc-arap-doc-cell">
                          <b className="acc-gl-mono">{d.doc_number}</b>
                          <small>{moment(d.doc_date).format('DD/MM/YYYY')}{d.reference ? ` · ${d.reference}` : ''}{!enabled && account ? ` · ${code}` : ''}</small>
                        </span>
                        <span className="acc-arap-doc-cell">
                          {moment(d.due_date).format('DD/MM/YYYY')}
                          {late > 0 ? <small className="is-bad">+{late} {t('days')}</small> : <small>{t('arapDueIn')} {-late} {t('days')}</small>}
                        </span>
                        <span className="acc-ex-cell is-total"><b>{amountText(d.open, d.currency)}</b></span>
                        <label className={`acc-ex-cell is-money${tooMuch ? ' has-error' : ''}`}>
                          <small>{t('arapAllocAmount')}</small>
                          <NumberInput value={alloc[d._uuid] ?? ''} min={0} controls={false} formatter={amountFormatter} disabled={!enabled} placeholder="0"
                            onChange={(v) => setAlloc((prev) => ({ ...prev, [d._uuid]: v === '' || v === null ? null : Number(v) }))}
                          />
                        </label>
                      </div>
                    );
                  })}
                </>
              )}
              {checked && partner && !chosen.length && openDocs.length > 0 && (
                <p className="acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('arapChooseDocs')}</p>
              )}
              {over && <p className="acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('arapOverAllocated')}</p>}
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 3: ໝາຍເຫດ + ສະຫຼຸບ ---- */}
          <FormStep no={3} done={chosen.length > 0 && !over && !short && !!account} title={t('arapStepSummary')} hint={t('arapStepSummaryHint')}>
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('glEntryDescription')}</label>
              <Textarea rows={2} value={description} onChange={setDescription} />
            </div>
            <div className={`is-wide acc-jr-summary${kind === AP ? ' is-expense' : ''}`}>
              <div>
                <small>{t('arapDocsChosen')}</small>
                <b>{chosen.length}</b>
              </div>
              <div>
                <small>{kind === AP ? t('arapAvailable') : t('fsAccount')}</small>
                <b>{account ? (kind === AP ? formatNumber(available) : account.acountName) : '—'}</b>
              </div>
              <div className="is-total">
                <small>{t(kind === AR ? 'arReceiveTotal' : 'apPayTotal')} ({accountCode ?? '—'})</small>
                <b>{kind === AR ? '+' : '−'}{money(total)}</b>
              </div>
              {short && <p className="acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('arapInsufficient')}</p>}
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
  );
};

export default PaymentForm;
