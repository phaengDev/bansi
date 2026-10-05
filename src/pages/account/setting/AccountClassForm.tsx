import { useRef, useState } from 'react';
import { Form } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { createModel, requiredField } from '../../../utils/validate';
import { useT } from '../../../context/LanguageContext';
import { runSave, saveSetting } from './settingApi';
import { FormSection, SettingModal, ToggleField } from './settingKit';

export type AccountClass = {
  _uuid: number;
  type_code: string;
  type_name: string;
  status: number;
};

type Props = {
  /** null = ເພີ່ມໃໝ່ */
  data: AccountClass | null;
  onClose: () => void;
  onSaved: () => void;
};

/** ຟອມເພີ່ມ/ແກ້ໄຂໝວດບັນຊີ — POST /type-account/create, PUT /type-account/:id (id ເປັນ base64) */
const AccountClassForm = ({ data, onClose, onSaved }: Props) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState({
    type_code: data?.type_code ?? '',
    type_name: data?.type_name ?? '',
  });
  const [active, setActive] = useState(data ? Number(data.status) === 1 : true);

  const model = createModel<any>({
    type_code: requiredField(t('inputRequired'), 'string'),
    type_name: requiredField(t('inputRequired'), 'string'),
  });

  const handleSubmit = async () => {
    if (!formRef.current?.check()) return;
    const payload = { ...inputs, status: active ? 1 : 0 };
    if (await runSave(() => saveSetting('/type-account', data?._uuid, payload), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'accountClassEdit' : 'accountClassAdd')} hint={t('accountClassHint')} icon="fa-sitemap"
      saving={saving} onClose={onClose} onSubmit={handleSubmit}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={(v) => setInputs(v as typeof inputs)}>
        <FormSection title={t('acsInfo')}>
          <div className="is-wide acs-code-name">
            <InputField name="type_code" label={t('accountClassCode')} placeholder="101" />
            <InputField name="type_name" label={t('name')} />
          </div>
          <div className="is-wide">
            <ToggleField label={t('status')} checked={active} onChange={setActive} onText={t('active')} offText={t('inactive')} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

export default AccountClassForm;
