import { useRef, useState } from 'react';
import { Button, Form, Modal, Textarea, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { postApi, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { canDelete } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import type { AccountClass } from './AccountClassForm';
import { toneOf } from './accountTone';
import { FormStep, PickerField, StatusPill, codeLabel } from './settingKit';

export type AccountType = {
  _uuid: number;
  typeId: number;
  currencyId: number;
  treasury_code: string;
  treasury_name: string;
  description?: string;
  status: number;
  currency?: { _id: number; name: string; laos?: string; icon?: string; genus?: string };
  types?: AccountClass;
};

/** ຕົວເລືອກສະກຸນເງິນຈາກ useCurrency() — icon = ທຸງ, genus = ສັນຍາລັກ (₭, $, ฿) */
type CurrencyOption = { label: string; value: number; icon?: string; genus?: string };

type Props = {
  /** null = ເພີ່ມໃໝ່ */
  data: AccountType | null;
  /** ໝວດບັນຊີທັງໝົດ — ລະຫັດປະເພດໃໝ່ຂຶ້ນຕົ້ນດ້ວຍລະຫັດໝວດທີ່ເລືອກ */
  classes: AccountClass[];
  currencies: CurrencyOption[];
  /** ລະຫັດປະເພດທີ່ມີແລ້ວ — ໃຊ້ເດົາລະຫັດທີ່ຈະໄດ້ ໃຫ້ກົງກັບ codeType ຂອງ backend */
  usedCodes: string[];
  onClose: () => void;
  onSaved: () => void;
  /** ມີເມື່ອແກ້ໄຂ — ໜ້າລາຍການຖາມຢືນຢັນ, ລຶບ ແລ້ວປິດຟອມເອງ */
  onDelete?: () => void;
};

/** ສະກຸນເງິນໃນ PickerField — ທຸງ + ລະຫັດ + ສັນຍາລັກ */
const currencyLabel = (_: unknown, item: any) => item && (
  <span className="acc-book-opt">
    {item.icon && <i className="acc-book-opt-flag">{item.icon}</i>}
    <span>{item.label}</span>
    {item.genus && <em>{item.genus}</em>}
  </span>
);

/**
 * ຟອມເພີ່ມ/ແກ້ໄຂປະເພດບັນຊີ — POST /type-treasury/create, PUT /type-treasury/:id (id ເປັນ base64).
 * ຕອນເພີ່ມ ສົ່ງລະຫັດໝວດໄປເປັນ `treasury_code` ແລ້ວ backend (codeType) ຕໍ່ເລກລຳດັບໃຫ້ເອງ ເຊັ່ນ 101 → 1011, 1012.
 * ຊ້າຍ: ບັດຕົວຢ່າງແບບດຽວກັບໃນລາຍການ (AccountTypePage) ທີ່ອັບເດດຕາມທີ່ປ້ອນ + ສະຖານະ. ຂວາ: ຊ່ອງປ້ອນເປັນຂັ້ນຕອນ.
 */
const AccountTypeForm = ({ data, classes, currencies, usedCodes, onClose, onSaved, onDelete }: Props) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({
    typeId: data?.typeId ?? null,
    currencyId: data?.currencyId ?? null,
    treasury_name: data?.treasury_name ?? '',
    description: data?.description ?? '',
  });
  const [active, setActive] = useState(data ? Number(data.status) === 1 : true);

  const model = createModel<any>({
    typeId: requiredField(t('selectRequired'), 'number'),
    currencyId: requiredField(t('selectRequired'), 'number'),
    treasury_name: requiredField(t('inputRequired'), 'string'),
  });

  // label ເປັນຂໍ້ຄວາມໃຫ້ຊ່ອງຄົ້ນຫາ — ສ່ວນທີ່ສະແດງແທ້ແມ່ນ codeLabel
  const classOptions = classes.map((c) => ({
    label: `${c.type_code} ${c.type_name}`,
    value: c._uuid,
    code: c.type_code,
    name: c.type_name,
    tone: toneOf(c.type_code),
  }));
  const cls = classes.find((c) => c._uuid === inputs.typeId) ?? data?.types;
  const classCode = cls?.type_code;
  const tone = toneOf(classCode ?? '');
  const currency = currencies.find((c) => Number(c.value) === Number(inputs.currencyId));
  const name = String(inputs.treasury_name ?? '').trim();

  /** ເລກທຳອິດທີ່ຍັງວ່າງ — ຄືກັບ codeType ຂອງ backend (101 → 1011, 1012, …) */
  const nextCode = (() => {
    if (!classCode) return '';
    const used = new Set(usedCodes);
    let n = 1;
    while (used.has(`${classCode}${n}`)) n++;
    return `${classCode}${n}`;
  })();
  const code = data ? data.treasury_code : nextCode;

  const handleSubmit = async () => {
    if (!formRef.current?.check()) return;
    if (!data && !classCode) {
      Notific.warning('selectRequired');
      return;
    }
    try {
      setSaving(true);
      if (data) {
        // ລະຫັດ ແລະ ໝວດ ບໍ່ປ່ຽນຕອນແກ້ໄຂ — ລະຫັດຜູກກັບໝວດຕັ້ງແຕ່ສ້າງ
        await putApi(`/type-treasury/${btoa(String(data._uuid))}`, {
          currencyId: inputs.currencyId,
          treasury_name: inputs.treasury_name,
          description: inputs.description,
          status: active ? 1 : 0,
        });
      } else {
        await postApi('/type-treasury/create', {
          ...inputs,
          treasury_code: classCode,
          status: active ? 1 : 0,
        });
      }
      Notific.success('saveSuccessDone');
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" className="acc-book-modal is-steps is-type">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon">
            <i className={`fa-solid ${data ? 'fa-pen-to-square' : 'fa-layer-group'}`} />
          </span>
          <span>
            <Modal.Title>{data ? t('accountTypeEdit') : t('accountTypeAdd')}</Modal.Title>
            <small>{t('accountTypeFormHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-book-layout">
          {/* ---- ຊ້າຍ: ບັດຕົວຢ່າງ (ໜ້າຕາດຽວກັບໃນລາຍການ) + ສະຖານະ ---- */}
          <aside className="acc-book-aside">
            <span className="acc-book-aside-label">{t('accountTypePreview')}</span>
            <div className={`acc-tone ${tone}`}>
              <article className={`acc-type-card is-preview${active ? '' : ' is-off'}${cls ? '' : ' is-blank'}`}>
                <div className="acc-type-card-top">
                  <span className="acc-type-card-code">{code || '····'}</span>
                  <StatusPill active={active} />
                </div>
                <h4 className={name ? '' : 'is-placeholder'}>{name || t('accountTypeNamePlaceholder')}</h4>
                <p className="acc-type-card-desc">{inputs.description || '—'}</p>
                <div className="acc-type-card-info">
                  <div>
                    <small><i className="fa-solid fa-sitemap" /> {t('accountSetAccountClass')}</small>
                    {cls ? <b title={cls.type_name}>{cls.type_code} · {cls.type_name}</b> : <em>{t('notSpecified')}</em>}
                  </div>
                  <div>
                    <small><i className="fa-solid fa-coins" /> {t('accountTypeCurrency')}</small>
                    {currency ? <b>{currency.icon} {currency.label}</b> : <em>{t('notSpecified')}</em>}
                  </div>
                </div>
              </article>
            </div>

            <label className={`acc-book-status${active ? ' is-on' : ''}`}>
              <span>
                <b>{active ? t('active') : t('inactive')}</b>
                <small>{t('status')}</small>
              </span>
              <Toggle checked={active} onChange={setActive} />
            </label>
          </aside>

          {/* ---- ຂວາ: ຊ່ອງປ້ອນ ---- */}
          <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs} className="acc-book-main">
            <FormStep no={1} done={!!classCode} title={t('accountTypeStepClass')} hint={t('accountTypeCodeAuto')}>
              <PickerField name="typeId" label={t('accountSetAccountClass')} data={classOptions}
                disabled={!!data} cleanable={false} placeholder={t('select')}
                renderOption={codeLabel} renderValue={codeLabel}
              />
              {/* ລະຫັດອ່ານຢ່າງດຽວ — ຕອນເພີ່ມ backend ຕໍ່ເລກໃຫ້, ຕອນແກ້ໄຂລັອກໄວ້ */}
              <div className="rs-form-group">
                <label className="form-label">{t('accountTypeCode')}</label>
                <div className={`acc-book-code-field acc-tone ${tone}${code ? '' : ' is-empty'}`}>
                  <i className={`fa-solid ${data ? 'fa-lock' : 'fa-wand-magic-sparkles'}`} />
                  <b>{code || '—'}</b>
                  <small>{data ? t('accountTypeCodeLocked') : t('accountTypeCodeAutoShort')}</small>
                </div>
              </div>
            </FormStep>

            <FormStep no={2} done={!!inputs.currencyId && !!name} title={t('accountTypeStepInfo')} hint={t('accountTypeStepInfoHint')}>
              <PickerField name="currencyId" label={t('accountTypeCurrency')} data={currencies}
                cleanable={false} placeholder={t('select')}
                renderOption={currencyLabel} renderValue={currencyLabel}
              />
              <InputField name="treasury_name" label={t('name')} placeholder={t('accountTypeNamePlaceholder')}
                icon={<i className="fa-solid fa-tag" />}
              />
              <div className="is-wide">
                <InputField name="description" label={t('detail')} accepter={Textarea} rows={3} required={false} />
              </div>
            </FormStep>
          </Form>
        </div>
      </Modal.Body>

      <Modal.Footer>
        {onDelete && (
          <Button appearance="default" className="acc-book-btn is-delete" disabled={!canDelete} onClick={onDelete}>
            <i className="fa-solid fa-trash" /> {t('delete')}
          </Button>
        )}
        <span className="acc-book-footnote"><span className="text-danger">*</span> {t('requiredFieldsNote')}</span>
        <Button appearance="default" className="acc-book-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} onClick={handleSubmit}>
          <i className="fa-solid fa-check" /> {t('save')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AccountTypeForm;
