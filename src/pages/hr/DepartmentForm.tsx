import { useRef, useState } from 'react';
import { Form, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../utils/inputFields';
import { createModel, requiredField } from '../../utils/validate';
import { useT } from '../../context/LanguageContext';
import { FormSection, SettingModal, SwitchRow } from '../account/setting/settingKit';
import { nextCode, runSave, saveSetting } from '../account/setting/settingApi';
import type { Department } from './hrApi';

/**
 * ຟອມພະແນກ — ລະຫັດ, ຊື່, ລາຍລະອຽດ ແລະ ສະວິດ "ຂັ້ນບໍລິຫານ" (ຄຸມທຸກພະແນກ — ຢູ່ເທິງສຸດຂອງໂຄງຮ່າງ, ບໍ່ນັບເປັນພະແນກ).
 * ຕຳແໜ່ງເປັນລາຍຊື່ກາງ (ໜ້າ ຕຳແໜ່ງ) ແລະ ຫົວໜ້າສາຍງານເລືອກຢູ່ຟອມພະນັກງານ
 */
const DepartmentForm = ({ data, codes, onClose, onSaved }: {
  data: Department | null;
  /** ລະຫັດທີ່ມີແລ້ວ — ອອກລະຫັດຕໍ່ໄປໃຫ້ */
  codes: string[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({
    depart_code: data?.depart_code ?? nextCode('DP-', codes, 2),
    depart_name: data?.depart_name ?? '',
    description: data?.description ?? '',
  });
  const [executive, setExecutive] = useState(Number(data?.executive) === 1);
  const model = createModel<any>({
    depart_code: requiredField(t('inputRequired'), 'string'),
    depart_name: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      ...inputs,
      depart_code: String(inputs.depart_code).trim().toUpperCase(),
      executive: executive ? 1 : 0,
      // ລຳດັບບໍ່ສະແດງໃນຟອມ — ພະແນກໃໝ່ຕໍ່ທ້າຍລາຍການ, ພະແນກເດີມຮັກສາລຳດັບເກົ່າ
      ...(data ? {} : { status: 1, sort: codes.length + 1 }),
    };
    if (await runSave(() => saveSetting('/department', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'hrDepartmentEdit' : 'hrDepartmentAdd')} hint={t('hrDepartmentHint')} icon="fa-sitemap" saving={saving}
      onClose={onClose} onSubmit={submit}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide acs-code-name">
            <InputField name="depart_code" label={t('code')} className="acc-book-upper" />
            <InputField name="depart_name" label={t('hrDepartmentName')} />
          </div>
          <div className="is-wide">
            <InputField name="description" label={t('detail')} accepter={Textarea} rows={2} required={false} />
          </div>
          <SwitchRow checked={executive} onChange={setExecutive} className={`is-wide hr-exec-toggle${executive ? ' is-on' : ''}`} label={t('hrExecutive')} end>
            <span className="hr-exec-icon"><i className="fa-solid fa-crown" /></span>
            <span className="hr-exec-text">
              <b>{t('hrExecutive')}</b>
              <small>{t('hrExecutiveHint')}</small>
            </span>
          </SwitchRow>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

export default DepartmentForm;
