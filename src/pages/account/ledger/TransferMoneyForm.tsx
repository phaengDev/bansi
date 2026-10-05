import { useRef, useState } from 'react';
import { Button, Form, Modal, NumberInput, Schema, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { formatNumber, postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { InputField } from '../../../utils/inputFields';
import { toThousands } from '../../../utils/formater';
import { useT } from '../../../context/LanguageContext';
import type { AccountType } from '../setting/AccountTypeForm';
import { FormStep, PickerField } from '../setting/settingKit';
import type { TreasuryAccount } from './TreasuryAccountForm';
import { currencySymbol } from './currency';
import { ACCOUNT_POPUP_STYLE, accountOption, renderAccountOption } from './accountOption';

const { NumberType } = Schema.Types;


type Props = {
  /** ບັນຊີເງິນຄັງທັງໝົດຂອງໜ້າ (ມີ banks + treasury.currency ມາແລ້ວ) — ເລືອກໄດ້ສະເພາະອັນທີ່ໃຊ້ງານ */
  accounts: TreasuryAccount[];
  /** ປະເພດບັນຊີ — ໃຊ້ຫາສະກຸນເງິນເມື່ອແຖວບໍ່ມີ treasury include ມາ */
  types: AccountType[];
  /** ເປີດຈາກບັດບັນຊີ → ຕັ້ງເປັນບັນຊີໂອນອອກໄວ້ກ່ອນ */
  defaultFrom?: number;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * ຟອມໂອນຍ້າຍເງິນລະຫວ່າງບັນຊີເງິນຄັງ — POST /transfer-money/create.
 * ບັນຊີຮັບເລືອກໄດ້ສະເພາະສະກຸນເງິນດຽວກັບບັນຊີໂອນອອກ (ບໍ່ມີອັດຕາແລກປ່ຽນ), ຈຳນວນບໍ່ເກີນຍອດທີ່ໃຊ້ໄດ້.
 * backend ກວດຊ້ຳທຸກຂໍ້ ແລະ ອ່ານຍອດກ່ອນໂອນຈາກ DB ເອງ. ຢືນຢັນກ່ອນໂອນ ເພາະຍັງບໍ່ມີການຍົກເລີກລາຍການໂອນ
 */
const TransferMoneyForm = ({ accounts, types, defaultFrom, onClose, onSaved }: Props) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({
    account_outid: defaultFrom ?? null,
    account_inid: null,
    amount: null,
    description: '',
  });

  const typeOf = (a: TreasuryAccount) => a.treasury ?? types.find((x) => x._uuid === a.type_treasuryid);
  const currencyIdOf = (a?: TreasuryAccount) => (a ? Number(typeOf(a)?.currencyId ?? 0) : 0);
  const active = accounts.filter((a) => Number(a.status) === 1);
  const from = active.find((a) => a._uuid === inputs.account_outid);
  const to = active.find((a) => a._uuid === inputs.account_inid);
  const cur = from ? typeOf(from)?.currency : undefined;
  const symbol = currencySymbol(cur);
  const usable = Number(from?.balance_treasury ?? 0);
  const amount = Number(inputs.amount) || 0;
  const money = (value: number) => `${symbol} ${formatNumber(value)}`.trim();

  const option = (a: TreasuryAccount) => accountOption(a, typeOf(a));
  const fromOptions = active.map(option);
  // ບັນຊີຮັບ: ບໍ່ແມ່ນບັນຊີດຽວກັນ ແລະ ສະກຸນເງິນດຽວກັນ
  const toOptions = active
    .filter((a) => a._uuid !== inputs.account_outid && (!from || currencyIdOf(a) === currencyIdOf(from)))
    .map(option);

  const model = Schema.Model<any>({
    account_outid: NumberType().isRequired(t('selectRequired')),
    account_inid: NumberType().isRequired(t('selectRequired')),
    amount: NumberType()
      .isRequired(t('inputRequired'))
      .min(0.01, t('xferPositive'))
      .addRule((value) => !from || Number(value) <= usable, t('xferNotEnough')),
  });

  /** ປ່ຽນບັນຊີໂອນອອກ → ລ້າງບັນຊີຮັບຖ້າມັນບໍ່ເຂົ້າເງື່ອນໄຂອີກ (ບັນຊີດຽວກັນ ຫຼື ຄົນລະສະກຸນເງິນ) */
  const handleChange = (next: any) => {
    if (next.account_outid !== inputs.account_outid) {
      const nextFrom = active.find((a) => a._uuid === next.account_outid);
      const target = active.find((a) => a._uuid === next.account_inid);
      if (target && (target._uuid === next.account_outid || (nextFrom && currencyIdOf(target) !== currencyIdOf(nextFrom)))) {
        next = { ...next, account_inid: null };
      }
    }
    setInputs(next);
  };

  const swap = () => setInputs({ ...inputs, account_outid: inputs.account_inid, account_inid: inputs.account_outid });

  const submit = () => {
    if (!formRef.current?.check() || !from || !to) return;
    Notific.confirm(`${t('xferConfirm')} ${money(amount)} · ${from.acountName} → ${to.acountName}`, async () => {
      try {
        setSaving(true);
        await postApi('/transfer-money/create', {
          account_outid: from._uuid,
          account_inid: to._uuid,
          balance_transfer: amount,
          description: String(inputs.description ?? '').trim() || null,
          createby: localStorage.getItem('user_name'),
        });
        Notific.success('saveSuccessDone');
        onSaved();
        onClose();
      } catch (error) {
        console.error(error);
        Notific.error(getErrorMessage(error));
      } finally {
        setSaving(false);
      }
    });
  };

  const renderAccount = renderAccountOption(t('treasuryNoBank'));

  return (
    <Modal open onClose={onClose} size="lg" className="acc-book-modal is-steps is-xfer">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className="fa-solid fa-right-left" /></span>
          <span>
            <Modal.Title>{t('xferTitle')}</Modal.Title>
            <small>{t('xferHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <Form fluid ref={formRef} model={model} formValue={inputs} onChange={handleChange} className="acc-book-main">
          <FormStep no={1} done={!!from && !!to} title={t('xferStepAccounts')} hint={t('xferStepAccountsHint')}>
            <div className="is-wide acc-xfer-accounts">
              <PickerField name="account_outid" label={t('xferFrom')} data={fromOptions} placeholder={t('select')}
                cleanable={false} renderOption={renderAccount} renderValue={renderAccount} popupStyle={ACCOUNT_POPUP_STYLE}
              />
              <button type="button" className="acc-xfer-swap" onClick={swap} disabled={!from || !to}
                aria-label={t('xferSwap')} title={t('xferSwap')}
              >
                <i className="fa-solid fa-arrow-right" />
              </button>
              <PickerField name="account_inid" label={t('xferTo')} data={toOptions} placeholder={t('select')}
                cleanable={false} disabled={!from} renderOption={renderAccount} renderValue={renderAccount} popupStyle={ACCOUNT_POPUP_STYLE}
                locale={{ noResultsText: t('xferNoTarget') }}
              />
            </div>
          </FormStep>

          <FormStep no={2} done={!!from && amount > 0 && amount <= usable} title={t('xferStepAmount')} hint={t('xferStepAmountHint')}>
            <div className="acc-book-money is-usable">
              <InputField name="amount" label={t('xferAmount')} accepter={NumberInput}
                formatter={toThousands} prefix={symbol || undefined} controls={false} disabled={!from}
              />
              {from && (
                <button type="button" className="acc-xfer-available" onClick={() => setInputs({ ...inputs, amount: usable })}
                  title={t('xferUseAll')}
                >
                  {t('xferAvailable')} <b>{money(usable)}</b>
                </button>
              )}
            </div>
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />

            {/* ຍອດຫຼັງໂອນ ຂອງທັງສອງບັນຊີ — ເຫັນກ່ອນກົດໂອນ */}
            {from && to && (
              <div className="is-wide acc-xfer-preview">
                <span className="acc-xfer-preview-title">{t('xferPreview')}</span>
                {[
                  { account: from, delta: -amount, dir: 'out' },
                  { account: to, delta: amount, dir: 'in' },
                ].map(({ account, delta, dir }) => {
                  const before = Number(account.balance_treasury ?? 0);
                  const after = before + delta;
                  return (
                    <div key={dir} className={`acc-xfer-preview-row is-${dir}`}>
                      <span className="acc-xfer-logo">
                        {account.banks?.url ? <img src={account.banks.url} alt="" /> : <i className="fa-solid fa-wallet" />}
                      </span>
                      <span className="acc-xfer-opt-text">
                        <b>{account.acountName}</b>
                        <small>{t(dir === 'out' ? 'stmtOut' : 'stmtIn')} {delta >= 0 ? '+' : '−'}{formatNumber(Math.abs(delta))}</small>
                      </span>
                      <span className="acc-xfer-preview-bal">
                        <small>{formatNumber(before)}</small>
                        <i className="fa-solid fa-arrow-right" />
                        <b className={after < 0 ? 'is-negative' : ''}>{money(after)}</b>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </FormStep>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={submit}>
          <i className="fa-solid fa-right-left" /> {t('xferSubmit')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TransferMoneyForm;
