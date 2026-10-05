import { useMemo, useState } from 'react';
import { Button, DatePicker, Input, Modal, NumberInput, SelectPicker } from 'rsuite';
import moment from 'moment';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { useCurrency } from '../../../utils/selectOption';
import { useT } from '../../../context/LanguageContext';
import { isFutureDay } from '../journal/journalKit';
import { FormStep } from '../setting/settingKit';
import { money, type ChartAccount } from './glApi';
import { accountOptionLabel, amountFormatter, useAccountOptions } from './glKit';

type Line = { key: number; account_id: number | null; description: string; debit: number | null; credit: number | null };

let seq = 0;
const blankLine = (): Line => ({ key: ++seq, account_id: null, description: '', debit: null, credit: null });
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * ບັນທຶກທົ່ວໄປ (MANUAL) — ລາຍການທີ່ບໍ່ແມ່ນລາຍຮັບ-ລາຍຈ່າຍ-ໂອນ: ຊື້ຊັບສິນ, ເງິນກູ້, ເພີ່ມທຶນ, ຄ່າຫຼຸ້ຍຫ້ຽນ, ປັບປຸງ …
 * ແຕ່ລະແຖວໃສ່ໜີ້ ຫຼື ມີ ຢ່າງໃດຢ່າງໜຶ່ງ; ບັນທຶກໄດ້ເມື່ອ ໜີ້ລວມ = ມີລວມ. ທຸກແຖວເປັນສະກຸນດຽວ (ແປງເປັນ LAK ຕາມອັດຕາ)
 */
const JournalEntryForm = ({ accounts, onClose, onSaved }: { accounts: ChartAccount[]; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const currencies = useCurrency() as unknown as { label: string; value: number; rate: number }[];
  const options = useAccountOptions(accounts);
  const [date, setDate] = useState<Date>(new Date());
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>(() => [blankLine(), blankLine()]);
  const [saving, setSaving] = useState(false);

  const currency = currencies.find((c) => c.value === currencyId);
  const isBase = !currency || String(currency.label).toUpperCase() === 'LAK';
  const effectiveRate = isBase ? 1 : rate ?? currency?.rate ?? 0;

  const totals = useMemo(() => ({
    debit: round2(lines.reduce((n, l) => n + (Number(l.debit) || 0), 0)),
    credit: round2(lines.reduce((n, l) => n + (Number(l.credit) || 0), 0)),
  }), [lines]);
  const diff = round2(totals.debit - totals.credit);
  const filled = lines.filter((l) => l.account_id && (Number(l.debit) || Number(l.credit)));
  const missingAccount = lines.some((l) => !l.account_id && (Number(l.debit) || Number(l.credit)));
  const canSave = filled.length >= 2 && !diff && totals.debit > 0 && !missingAccount && effectiveRate > 0;

  const update = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /** ໃສ່ຍອດທີ່ຂາດໃຫ້ແຖວນີ້ ເພື່ອໃຫ້ໜີ້ = ມີ */
  const balanceInto = (line: Line) => {
    const others = lines.filter((l) => l.key !== line.key);
    const dr = others.reduce((n, l) => n + (Number(l.debit) || 0), 0);
    const cr = others.reduce((n, l) => n + (Number(l.credit) || 0), 0);
    const gap = round2(dr - cr);
    if (gap > 0) update(line.key, { credit: gap, debit: null });
    else if (gap < 0) update(line.key, { debit: -gap, credit: null });
  };

  const [checked, setChecked] = useState(false);

  const submit = async () => {
    setChecked(true);
    if (!canSave) {
      Notific.warning(diff ? 'glUnbalanced' : 'arapFixErrors');
      return;
    }
    try {
      setSaving(true);
      await postApi('/journal-entry/create', {
        entry_date: moment(date).format('YYYY-MM-DD'),
        reference: reference.trim() || null,
        description: description.trim() || null,
        currency_id: isBase ? null : currencyId,
        exchange_rate: isBase ? 1 : effectiveRate,
        lines: filled.map((l) => ({
          account_id: l.account_id,
          description: l.description.trim() || null,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
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

  const code = isBase ? 'LAK' : currency?.label ?? '';

  return (
    <Modal open onClose={onClose} size="lg" className="acc-book-modal is-steps is-xfer acc-arap-form">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className="fa-solid fa-pen-nib" /></span>
          <span>
            <Modal.Title>{t('glManualAdd')}</Modal.Title>
            <small>{t('glManualHint')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="acc-book-main">
          {/* ---- ຂັ້ນ 1: ຫົວໃບ ---- */}
          <FormStep no={1} done={!!description.trim()} title={t('glStepHeader')} hint={t('glStepHeaderHint')}>
            <div className="rs-form-group">
              <label className="form-label">{t('date')}<span className="text-danger">*</span></label>
              <DatePicker value={date} onChange={(v) => v && setDate(v)} format="dd/MM/yyyy" oneTap cleanable={false}
                shouldDisableDate={isFutureDay} block
              />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('glReference')}</label>
              <Input value={reference} onChange={setReference} placeholder={t('glReferencePlaceholder')} />
            </div>
            <div className="is-wide rs-form-group">
              <label className="form-label">{t('glEntryDescription')}</label>
              <Input value={description} onChange={setDescription} placeholder={t('glEntryDescriptionPlaceholder')} />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('accountTypeCurrency')}</label>
              <SelectPicker block data={currencies} value={currencyId} placeholder="LAK" popupClassName="acc-book-menu"
                onChange={(v) => { setCurrencyId(v as number | null); setRate(null); }}
              />
            </div>
            <div className="rs-form-group">
              <label className="form-label">{t('glExchangeRate')}</label>
              <NumberInput value={isBase ? 1 : effectiveRate || ''} min={0} controls={false} disabled={isBase}
                formatter={amountFormatter} onChange={(v) => setRate(v === '' || v === null ? null : Number(v))}
              />
            </div>
          </FormStep>

          {/* ---- ຂັ້ນ 2: ແຖວໜີ້/ມີ ---- */}
          <FormStep no={2} done={canSave} title={t('glStepLines')} hint={t('glStepLinesHint')}
            note={<><i className="fa-solid fa-list-ol" /> {filled.length} {t('incomeItems')}</>}
          >
            <div className="is-wide acc-ex-lines">
              <div className="acc-ex-row acc-gl-jrow is-head" aria-hidden="true">
                <span>#</span>
                <span>{t('glAccount')}</span>
                <span>{t('detail')}</span>
                <span>{t('glDebit')} ({code})</span>
                <span>{t('glCredit')} ({code})</span>
                <span />
              </div>
              {lines.map((l, i) => {
                const hasAmount = Number(l.debit) > 0 || Number(l.credit) > 0;
                const missing = checked && hasAmount && !l.account_id;
                return (
                  <div key={l.key} className="acc-ex-row acc-gl-jrow">
                    <span className="acc-ex-no">{i + 1}</span>
                    <div className={`acc-ex-cell is-name${missing ? ' has-error' : ''}`}>
                      <small>{t('glAccount')}</small>
                      <SelectPicker block data={options} value={l.account_id} groupBy="groupLabel" placeholder={t('glChooseAccount')}
                        renderOption={accountOptionLabel} renderValue={(_, item) => accountOptionLabel(_, item)}
                        onChange={(v) => update(l.key, { account_id: (v as number) ?? null })} popupClassName="acc-book-menu"
                      />
                    </div>
                    <label className="acc-ex-cell is-desc">
                      <small>{t('detail')}</small>
                      <Input value={l.description} onChange={(v) => update(l.key, { description: v })} placeholder={description || '—'} />
                    </label>
                    <label className="acc-ex-cell is-money">
                      <small>{t('glDebit')}</small>
                      <NumberInput value={l.debit ?? ''} min={0} controls={false} formatter={amountFormatter} placeholder="0"
                        onChange={(v) => update(l.key, { debit: v === '' || v === null ? null : Number(v), ...(Number(v) ? { credit: null } : {}) })}
                      />
                    </label>
                    <label className="acc-ex-cell is-money">
                      <small>{t('glCredit')}</small>
                      <NumberInput value={l.credit ?? ''} min={0} controls={false} formatter={amountFormatter} placeholder="0"
                        onChange={(v) => update(l.key, { credit: v === '' || v === null ? null : Number(v), ...(Number(v) ? { debit: null } : {}) })}
                      />
                    </label>
                    <span className="acc-gl-jrow-actions">
                      {diff !== 0 && !hasAmount && (
                        <button type="button" className="acc-gl-act" title={t('glFillBalance')} onClick={() => balanceInto(l)}>
                          <i className="fa-solid fa-scale-balanced" />
                        </button>
                      )}
                      <button type="button" className="acc-ex-remove" title={t('delete')} disabled={lines.length <= 2}
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      >
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </span>
                  </div>
                );
              })}
              <div className="acc-ex-foot">
                <button type="button" className="acc-ex-add" onClick={() => setLines((prev) => [...prev, blankLine()])}>
                  <i className="fa-solid fa-plus" /> {t('glAddLine')}
                </button>
                <span className="acc-gl-jtotals">
                  <span><small>{t('glDebit')}</small><b>{money(totals.debit)}</b></span>
                  <span><small>{t('glCredit')}</small><b>{money(totals.credit)}</b></span>
                </span>
              </div>
              <div className={`acc-gl-balance-check${diff ? ' is-bad' : totals.debit ? ' is-ok' : ''}`}>
                {diff ? (
                  <><i className="fa-solid fa-triangle-exclamation" /> {t('glUnbalanced')} {money(Math.abs(diff))} ({diff > 0 ? t('glCredit') : t('glDebit')})</>
                ) : totals.debit ? (
                  <><i className="fa-solid fa-circle-check" /> {t('glBalanced')}{!isBase && effectiveRate ? ` · ≈ ${money(totals.debit * effectiveRate)} LAK` : ''}</>
                ) : (
                  <><i className="fa-solid fa-circle-info" /> {t('glEnterLines')}</>
                )}
              </div>
              {missingAccount && checked && <p className="acc-ex-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('glMissingAccount')}</p>}
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

export default JournalEntryForm;
