import { useState, type KeyboardEvent } from 'react';
import { Input, TagInput, Toggle } from 'rsuite';
import { deleteApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { ListState, SettingModal, SettingToolbar } from '../account/setting/settingKit';
import { useHrList, type SkillType } from './hrApi';

const enc = (id: number) => btoa(String(id));

/** ຟອມໝວດທັກສະ — ຊື່ + ລະດັບ (ຈາກຕ່ຳຫາສູງ, Enter ເພີ່ມທີລະອັນ) */
const SkillTypeForm = ({ data, onClose, onSaved }: { data: SkillType | null; onClose: () => void; onSaved: () => void }) => {
  const t = useT();
  const [name, setName] = useState(data?.name ?? '');
  const [levels, setLevels] = useState<string[]>(data?.levels ?? []);
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!name.trim() || !levels.length) return Notific.warning(t('hrSkillTypeRequired'));
    try {
      setSaving(true);
      const payload = { name: name.trim(), levels };
      if (data) await putApi(`/skill-type/${enc(data._uuid)}`, payload);
      else await postApi('/skill-type/create', payload);
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
    <SettingModal title={t(data ? 'hrSkillTypeEdit' : 'hrSkillTypeAdd')} hint={t('hrSkillTypeHint')} icon="fa-layer-group" saving={saving}
      onClose={onClose} onSubmit={submit} compact keyboard={false}
    >
      <div className="hr-resume-form">
        <label className="hr-field">
          <span>{t('hrSkillTypeName')} <em>*</em></span>
          <Input value={name} onChange={setName} placeholder={t('hrSkillTypeNameHint')} />
        </label>
        <div className="hr-field">
          <span>{t('hrSkillLevels')} <em>*</em></span>
          <TagInput block trigger={['Enter', 'Comma']} value={levels} onChange={(v) => setLevels((v as string[] | null) ?? [])}
            placeholder={t('hrSkillLevelsHint')} menuStyle={{ display: 'none' }}
          />
          <small className="hr-field-note">{t('hrSkillLevelsNote')}</small>
        </div>
      </div>
    </SettingModal>
  );
};

/** ບັດໝວດທັກສະ — ລະດັບ, ທັກສະ (ກົດຊື່ເພື່ອແກ້, × ລຶບເມື່ອບໍ່ມີຄົນໃຊ້), ຊ່ອງເພີ່ມທັກສະ */
const SkillTypeCard = ({ type, onEdit, onChanged }: { type: SkillType; onEdit: () => void; onChanged: () => void }) => {
  const t = useT();
  const [newSkill, setNewSkill] = useState('');
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const used = type.skills.reduce((n, s) => n + (s.employees ?? 0), 0);
  const call = async (task: () => Promise<unknown>, done?: string) => {
    try {
      await task();
      if (done) Notific.success(done);
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  };
  const add = () => {
    const name = newSkill.trim();
    if (!name) return;
    setNewSkill('');
    call(() => postApi('/skill/create', { type_id: type._uuid, name }));
  };
  const rename = () => {
    const r = renaming;
    setRenaming(null);
    const original = type.skills.find((s) => s._uuid === r?.id)?.name;
    if (r && r.name.trim() && r.name.trim() !== original) call(() => putApi(`/skill/${enc(r.id)}`, { name: r.name.trim() }));
  };
  const onRenameKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') rename();
    if (e.key === 'Escape') setRenaming(null);
  };
  const active = Number(type.status) === 1;
  return (
    <section className={`hr-option-card hr-skill-card${active ? '' : ' is-off'}`}>
      <header>
        <span className="hr-option-icon"><i className="fa-solid fa-layer-group" /></span>
        <span>
          <b>{type.name}</b>
          <span className="hr-skill-levels is-static">{type.levels.map((l) => <em key={l}>{l}</em>)}</span>
        </span>
        <span className="hr-skill-card-actions">
          <Toggle size="sm" checked={active} disabled={!canEdit} onChange={(on) => call(() => putApi(`/skill-type/${enc(type._uuid)}`, { status: on ? 1 : 0 }))} />
          <button type="button" className="acc-gl-act" title={t('edit')} aria-label={t('edit')} disabled={!canEdit} onClick={onEdit}><i className="fa-solid fa-pen" /></button>
          <button type="button" className="acc-gl-act is-danger" title={t('delete')} aria-label={t('delete')} disabled={!canDelete || used > 0}
            onClick={() => Notific.confirm(`${t('delete')}: ${type.name}`, () => call(() => deleteApi(`/skill-type/${enc(type._uuid)}`), 'acsDeleted'))}
          >
            <i className="fa-solid fa-trash" />
          </button>
        </span>
      </header>
      <div className="hr-skill-list">
        {type.skills.map((s) => (renaming?.id === s._uuid ? (
          <Input key={s._uuid} size="sm" autoFocus value={renaming.name} onChange={(v) => setRenaming({ id: s._uuid, name: v })} onBlur={rename} onKeyDown={onRenameKey}
            className="hr-skill-rename"
          />
        ) : (
          <span key={s._uuid} className={`hr-skill-tag${Number(s.status) === 1 ? '' : ' is-off'}`}>
            <button type="button" disabled={!canEdit} onClick={() => setRenaming({ id: s._uuid, name: s.name })} title={t('edit')}>{s.name}</button>
            {!!s.employees && <em>{s.employees}</em>}
            {!s.employees && canDelete && (
              <button type="button" className="hr-skill-x" aria-label={t('delete')} onClick={() => call(() => deleteApi(`/skill/${enc(s._uuid)}`))}>
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </span>
        )))}
        {!type.skills.length && <small className="hr-skill-none">{t('hrSkillNone')}</small>}
      </div>
      {canCreate && (
        <div className="hr-option-add">
          <Input size="sm" value={newSkill} placeholder={t('hrSkillAddPlaceholder')} onChange={setNewSkill} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button type="button" className="acc-rp-btn" disabled={!newSkill.trim()} onClick={add}><i className="fa-solid fa-plus" /> {t('addShort')}</button>
        </div>
      )}
    </section>
  );
};

/** ທັກສະ — ໝວດ (ພາສາ, ຄອມພິວເຕີ…) ພ້ອມລະດັບຂອງໝວດ ແລະ ລາຍຊື່ທັກສະ; ໃຊ້ໃນລາຍລະອຽດພະນັກງານ */
const SkillPage = () => {
  const t = useT();
  const { rows, loading, reload } = useHrList<SkillType>('/skill/fetch');
  const [editing, setEditing] = useState<SkillType | null | undefined>(undefined);
  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('hrSkillTypes'), value: rows.length },
          { label: t('hrSkills'), value: rows.reduce((n, r) => n + r.skills.length, 0), tone: 'violet' },
        ]}
        addLabel={t('hrSkillTypeAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />
      <ListState loading={loading && !rows.length} empty={!rows.length} icon="fa-star">
        <div className="hr-option-grid">
          {rows.map((r) => <SkillTypeCard key={r._uuid} type={r} onEdit={() => setEditing(r)} onChanged={reload} />)}
        </div>
      </ListState>
      {editing !== undefined && <SkillTypeForm data={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
    </div>
  );
};

export default SkillPage;
