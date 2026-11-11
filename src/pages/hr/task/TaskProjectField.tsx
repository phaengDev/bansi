import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Form, Input, SelectPicker } from 'rsuite';
import { postApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { FormSection, SettingModal } from '../../account/setting/settingKit';
import { PROJECT_COLORS, type TaskProject } from './taskApi';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** ປັອບອັບເພີ່ມໂປຣເຈັກຈາກຟອມວຽກ — ຊື່ ແລະ ສີ; ຊື່ຊ້ຳກັບໂປຣເຈັກທີ່ໃຊ້ຢູ່ = ເລືອກອັນເດີມໃຫ້ (ບໍ່ສ້າງຊ້ຳ) */
const CreateProjectModal = ({ initialName, projects, onClose, onCreated }: {
  initialName: string;
  projects: TaskProject[];
  onClose: () => void;
  onCreated: (project: TaskProject) => void;
}) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  // ສີທຳອິດທີ່ຍັງບໍ່ມີໂປຣເຈັກໃຊ້ — ໃຫ້ແຕ່ລະໂປຣເຈັກແຍກສີກັນງ່າຍ
  const [color, setColor] = useState(() => {
    const used = new Set(projects.map((p) => p.color.toLowerCase()));
    return PROJECT_COLORS.find((c) => !used.has(c)) ?? PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
  });
  const [saving, setSaving] = useState(false);
  // Modal ຍຶດ focus ໄປທີ່ກ່ອງຕອນເປີດ — ລໍໃຫ້ເປີດແລ້ວຄ່ອຍຍ້າຍມາຊ່ອງຊື່ ໃຫ້ພິມໄດ້ເລີຍ
  useEffect(() => {
    const timer = window.setTimeout(() => document.querySelector<HTMLInputElement>('.task-project-create input')?.focus(), 200);
    return () => window.clearTimeout(timer);
  }, []);

  const save = async () => {
    if (saving) return;
    if (!name.trim()) return Notific.warning('taskProjectNameRequired');
    const existing = projects.find((p) => Number(p.status) === 1 && sameName(p.name, name));
    if (existing) {
      Notific.warning('taskProjectExists');
      onCreated(existing);
      return onClose();
    }
    try {
      setSaving(true);
      const res = await postApi('/task/project/create', { name: name.trim(), color });
      Notific.success('saveSuccessDone');
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
    <SettingModal compact className="task-project-create" title={t('taskProjectNew')} hint={t('taskProjectNewHint')} icon="fa-folder-plus"
      saving={saving} onClose={onClose} onSubmit={save} submit={{ label: t('taskProjectAdd'), icon: 'fa-plus' }}
    >
      <Form fluid>
      <FormSection title={t('acsInfo')}>
        <div className="is-wide rs-form-group">
          <label className="form-label">{t('taskProjectName')}<span className="text-danger">*</span></label>
          <Input value={name} onChange={setName} onKeyDown={onKey} maxLength={150} />
        </div>
        <div className="is-wide rs-form-group">
          <label className="form-label">{t('taskProjectColor')}</label>
          <span className="task-swatches" role="radiogroup" aria-label={t('taskProjectColor')}>
            {PROJECT_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={c === color} aria-label={c}
                className={c === color ? 'is-active' : ''} style={{ background: c }} onClick={() => setColor(c)}
              >
                {c === color && <i className="fa-solid fa-check" />}
              </button>
            ))}
          </span>
        </div>
      </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ຊ່ອງເລືອກໂປຣເຈັກຂອງຟອມວຽກ — ທ້າຍລາຍການມີ "+ ເພີ່ມໂປຣເຈັກໃໝ່" (ຜູ້ມີສິດເພີ່ມ): ເພີ່ມແລ້ວເລືອກໃສ່ວຽກນີ້ໃຫ້ເລີຍ
 * ບໍ່ຕ້ອງປິດຟອມໄປຕັ້ງຄ່າໂປຣເຈັກ. ພິມຄົ້ນຫາແລ້ວບໍ່ພົບ → ຊື່ທີ່ພິມໃສ່ໃຫ້ໃນປັອບອັບ. keepId = ໂປຣເຈັກເດີມຂອງວຽກ (ສະແດງເຖິງຈະປິດແລ້ວ)
 */
const TaskProjectField = ({ value, onChange, projects, keepId, onCreated }: {
  value: number | null;
  onChange: (id: number | null) => void;
  projects: TaskProject[];
  keepId?: number | null;
  /** ໃຫ້ໜ້າຫຼັກໂຫຼດລາຍຊື່ໂປຣເຈັກຄືນ */
  onCreated?: () => void;
}) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  /** ຊື່ທີ່ໃສ່ໃຫ້ໃນປັອບອັບ; null = ປິດ */
  const [adding, setAdding] = useState<string | null>(null);
  // ໂປຣເຈັກທີ່ຫາກໍ່ເພີ່ມ — ສະແດງ ແລະ ເລືອກໄດ້ເລີຍ ກ່ອນໜ້າຫຼັກໂຫຼດລາຍຊື່ຄືນແລ້ວ
  const [added, setAdded] = useState<TaskProject[]>([]);
  const all = [...projects, ...added.filter((a) => !projects.some((p) => p._uuid === a._uuid))];
  const options = all
    .filter((p) => Number(p.status) === 1 || p._uuid === keepId)
    .map((p) => ({ value: p._uuid, label: p.name, color: p.color }));

  const startAdding = () => {
    setAdding(keyword.trim());
    setOpen(false);
  };

  return (
    <>
      <SelectPicker block data={options} value={value} onChange={onChange} placeholder={t('taskNoProject')}
        popupClassName="acc-book-menu" searchable={options.length > 8}
        open={open} onOpen={() => setOpen(true)} onClose={() => { setOpen(false); setKeyword(''); }} onSearch={setKeyword}
        locale={{ searchPlaceholder: t('search'), noResultsText: t('taskNoProjects') }}
        renderOption={(label: ReactNode, item) => <span className="task-project-opt"><i style={{ background: String(item.color) }} />{label}</span>}
        renderExtraFooter={canCreate ? () => (
          <button type="button" className="acc-sub-create" onClick={startAdding}>
            <i className="fa-solid fa-plus" /> {t('taskProjectNew')}{keyword.trim() && !options.some((o) => sameName(o.label, keyword)) ? ` "${keyword.trim()}"` : ''}
          </button>
        ) : undefined}
      />
      {adding !== null && (
        <CreateProjectModal initialName={adding} projects={all} onClose={() => setAdding(null)} onCreated={(project) => {
          setAdded((list) => [...list, project]);
          onChange(project._uuid);
          onCreated?.();
        }} />
      )}
    </>
  );
};

export default TaskProjectField;
