import { useState, type KeyboardEvent } from 'react';
import { Input, Toggle } from 'rsuite';
import { deleteApi, postApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { ListState, SettingToolbar } from '../account/setting/settingKit';
import { useHrList, type HrOption, type HrOptionKind } from './hrApi';

const KINDS: { key: HrOptionKind; label: string; icon: string; hint: string }[] = [
  { key: 'employee_type', label: 'hrEmployeeType', icon: 'fa-user-tag', hint: 'hrEmployeeTypeHint' },
  { key: 'education_level', label: 'hrEducationLevel', icon: 'fa-graduation-cap', hint: 'hrEducationLevelHint' },
];

/** ແຖວ 1 ລາຍການ — ກົດຊື່ເພື່ອແກ້ (Enter ບັນທຶກ, Esc ຍົກເລີກ), ສະວິດເປີດ/ປິດ, ລຶບໄດ້ເມື່ອບໍ່ມີຄົນໃຊ້ */
const OptionRow = ({ row, onChanged }: { row: HrOption; onChanged: () => void }) => {
  const t = useT();
  const [name, setName] = useState<string | null>(null);
  const call = async (task: () => Promise<unknown>, done?: string) => {
    try {
      await task();
      if (done) Notific.success(done);
      onChanged();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  };
  const save = () => {
    const next = name?.trim();
    setName(null);
    if (next && next !== row.name) call(() => putApi(`/hr-option/${btoa(String(row._uuid))}`, { name: next }), 'saveSuccessDone');
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') setName(null);
  };
  const active = Number(row.status) === 1;
  return (
    <li className={`hr-option-row${active ? '' : ' is-off'}`}>
      {name !== null ? (
        <Input size="sm" autoFocus value={name} onChange={setName} onBlur={save} onKeyDown={onKey} />
      ) : (
        <button type="button" className="hr-option-name" disabled={!canEdit} onClick={() => setName(row.name)} title={t('edit')}>{row.name}</button>
      )}
      {!!row.employees && <span className="acs-chip"><i className="fa-solid fa-users" /> {row.employees}</span>}
      <Toggle size="sm" checked={active} disabled={!canEdit} title={t(active ? 'statusTurnOff' : 'statusTurnOn')}
        onChange={(on) => call(() => putApi(`/hr-option/${btoa(String(row._uuid))}`, { status: on ? 1 : 0 }))}
      />
      <button type="button" className="acc-gl-act is-danger" title={t('delete')} aria-label={t('delete')} disabled={!canDelete || !!row.employees}
        onClick={() => Notific.confirm(`${t('delete')}: ${row.name}`, () => call(() => deleteApi(`/hr-option/${btoa(String(row._uuid))}`), 'acsDeleted'))}
      >
        <i className="fa-solid fa-trash" />
      </button>
    </li>
  );
};

/**
 * ຕົວເລືອກຂໍ້ມູນພະນັກງານ — ປະເພດພະນັກງານ ແລະ ລະດັບການສຶກສາ: HR ເພີ່ມ / ປ່ຽນຊື່ / ປິດ ເອງ
 * (ຄ່າເລີ່ມຕົ້ນມາກັບລະບົບ; ອັນທີ່ມີພະນັກງານໃຊ້ ລຶບບໍ່ໄດ້ — ປິດແທນ)
 */
const HrOptionPage = () => {
  const t = useT();
  const { rows, loading, reload } = useHrList<HrOption>('/hr-option/fetch');
  const [adding, setAdding] = useState<Record<string, string>>({});

  const add = async (kind: HrOptionKind) => {
    const name = adding[kind]?.trim();
    if (!name) return;
    try {
      await postApi('/hr-option/create', { kind, name });
      setAdding((a) => ({ ...a, [kind]: '' }));
      reload();
    } catch (error) {
      Notific.error(getErrorMessage(error));
    }
  };

  return (
    <div className="acs-page">
      <SettingToolbar stats={KINDS.map((k) => ({ label: t(k.label), value: rows.filter((r) => r.kind === k.key).length }))} />
      <ListState loading={loading && !rows.length} empty={false} icon="fa-list">
        <div className="hr-option-grid">
          {KINDS.map((k) => (
            <section key={k.key} className="hr-option-card">
              <header>
                <span className="hr-option-icon"><i className={`fa-solid ${k.icon}`} /></span>
                <span>
                  <b>{t(k.label)}</b>
                  <small>{t(k.hint)}</small>
                </span>
              </header>
              <ul>{rows.filter((r) => r.kind === k.key).map((r) => <OptionRow key={r._uuid} row={r} onChanged={reload} />)}</ul>
              {canCreate && (
                <div className="hr-option-add">
                  <Input size="sm" value={adding[k.key] ?? ''} placeholder={t('hrOptionAddPlaceholder')}
                    onChange={(v) => setAdding((a) => ({ ...a, [k.key]: v }))} onKeyDown={(e) => e.key === 'Enter' && add(k.key)}
                  />
                  <button type="button" className="acc-rp-btn" disabled={!adding[k.key]?.trim()} onClick={() => add(k.key)}>
                    <i className="fa-solid fa-plus" /> {t('addShort')}
                  </button>
                </div>
              )}
            </section>
          ))}
        </div>
      </ListState>
    </div>
  );
};

export default HrOptionPage;
