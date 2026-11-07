import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Form, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { InputField } from '../../../utils/inputFields';
import { canCreate, canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import type { FinanceSubCategory } from '../../../utils/selectOption';
import { FormSection, PickerField, SettingModal } from '../setting/settingKit';

/** ປັອບອັບເພີ່ມລາຍການຍ່ອຍໃຫ້ປະເພດທີ່ເລືອກໃນຟອມ — ຊື່ຊ້ຳ = backend ຄືນອັນເດີມ (ເລືອກໃຫ້ແທນ) */
const CreateSubModal = ({ categoryId, categoryLabel, onClose, onCreated }: {
  categoryId: number;
  categoryLabel: string;
  onClose: () => void;
  onCreated: (sub: FinanceSubCategory) => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({ name: '' });
  const [saving, setSaving] = useState(false);
  // Modal ຍຶດ focus ໄປທີ່ກ່ອງຕອນເປີດ — ລໍໃຫ້ເປີດແລ້ວຄ່ອຍຍ້າຍມາຊ່ອງຊື່ ໃຫ້ພິມໄດ້ເລີຍ
  useEffect(() => {
    const timer = window.setTimeout(() => document.querySelector<HTMLInputElement>('.acc-sub-create-modal input[name="name"]')?.focus(), 200);
    return () => window.clearTimeout(timer);
  }, []);
  const model = Schema.Model({ name: Schema.Types.StringType().isRequired(t('inputRequired')).maxLength(150, t('inputRequired')) });

  const save = async () => {
    if (saving || !formRef.current?.check() || !inputs.name.trim()) return;
    try {
      setSaving(true);
      const res = await postApi(`/finance-category/sub/${btoa(String(categoryId))}`, { name: inputs.name.trim() });
      if (res.data?.existed) Notific.warning('fcSubExists');
      else Notific.success('saveSuccessDone');
      onCreated(res.data.data);
      onClose();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      save();
    }
  };

  return (
    <SettingModal compact className="acc-sub-create-modal" title={t('fcSubCreateTitle')} hint={`${t('fcSubOf')} ${categoryLabel}`} icon="fa-list-ul"
      saving={saving} onClose={onClose} onSubmit={save} submit={{ label: t('fcSubAddShort'), icon: 'fa-plus' }}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(v) => setInputs(v as Record<string, string>)}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide">
            <InputField name="name" label={t('fcSubName')} placeholder={t('fcSubPlaceholder')} onKeyDown={onKey} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/** ທ້າຍລາຍການຂອງຊ່ອງເລືອກ — "+ ເພີ່ມໃໝ່" ເປີດປັອບອັບ */
const CreateFooter = ({ onClick }: { onClick: () => void }) => {
  const t = useT();
  return (
    <button type="button" className="acc-sub-create" onClick={onClick}>
      <i className="fa-solid fa-plus" /> {t('fcSubCreate')}
    </button>
  );
};

/**
 * ຊ່ອງເລືອກລາຍການຍ່ອຍຂອງຟອມລາຍຮັບ / ລາຍຈ່າຍ (ບັງຄັບ — ລາຍຮັບ / ລາຍຈ່າຍເກັບແຕ່ລາຍການຍ່ອຍ) — ຜູ້ມີສິດເພີ່ມ/ແກ້ໄຂ ກົດ "+ ເພີ່ມໃໝ່" ທ້າຍລາຍການ → ປັອບອັບເພີ່ມລາຍການຍ່ອຍ
 * ແລ້ວເລືອກໃຫ້ເລີຍ (ປະເພດທີ່ຍັງບໍ່ມີລາຍການຍ່ອຍ ກໍ່ເປີດຊ່ອງນີ້ໄດ້ ເພື່ອເພີ່ມອັນທຳອິດ)
 */
const SubCategoryField = ({ categoryId, categoryLabel, options, expense, onCreated }: {
  categoryId: number | null;
  /** "EX-001 · ຊື່ປະເພດ" — ສະແດງໃນຫົວປັອບອັບ */
  categoryLabel: string;
  options: { label: string; value: number }[];
  /** ຟອມລາຍຈ່າຍ — ລາຍການເປີດຢູ່ນອກຟອມ (portal) ຈຶ່ງບອກສີຂອງຟອມເອງ */
  expense?: boolean;
  onCreated: (sub: FinanceSubCategory) => void;
}) => {
  const t = useT();
  /** ຄວບຄຸມການເປີດ-ປິດລາຍການເອງ — ກົດ "ເພີ່ມໃໝ່" ແລ້ວປິດລາຍການກ່ອນເປີດປັອບອັບ */
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const canAdd = (canCreate || canEdit) && !!categoryId;
  const empty = !!categoryId && !options.length;
  const startAdding = () => {
    setOpen(false);
    setAdding(true);
  };
  return (
    <>
      <PickerField name="sub_category_id" label={t('fcSubs')} data={options} cleanable={false}
        disabled={!categoryId || (empty && !canAdd)} searchable
        placeholder={empty ? t(canAdd ? 'fcNoSubsAdd' : 'fcNoSubs') : t('select')}
        locale={{ noResultsText: t('fcNoSubs') }}
        renderOption={(label: ReactNode) => <span className="acc-sub-opt"><i className="fa-solid fa-arrow-right" />{label}</span>}
        open={open} onOpen={() => setOpen(true)} onClose={() => setOpen(false)} popupClassName={`acc-book-menu${expense ? ' is-expense' : ''}`}
        renderExtraFooter={canAdd ? () => <CreateFooter onClick={startAdding} /> : undefined}
      />
      {adding && categoryId && (
        <CreateSubModal categoryId={categoryId} categoryLabel={categoryLabel} onClose={() => setAdding(false)} onCreated={onCreated} />
      )}
    </>
  );
};

export default SubCategoryField;
