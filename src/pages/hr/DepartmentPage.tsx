import { useState } from 'react';
import { deleteApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { CardAction, ListState, MetaChip, SettingCard, SettingToolbar } from '../account/setting/settingKit';
import { useStatusToggle } from '../account/setting/settingApi';
import { useHrList, type Department } from './hrApi';
import DepartmentForm from './DepartmentForm';

/**
 * ພະແນກ — ລະຫັດ, ຊື່ ແລະ ຂັ້ນບໍລິຫານ (ຕຳແໜ່ງເປັນລາຍຊື່ກາງຢູ່ໜ້າ ຕຳແໜ່ງ).
 * ເປີດ/ປິດໃຊ້ງານຈາກບັດ; ລຶບໄດ້ສະເພາະພະແນກທີ່ບໍ່ເຄີຍມີພະນັກງານ
 */
const DepartmentPage = () => {
  const t = useT();
  const { rows, loading, reload } = useHrList<Department>('/department/fetch');
  const statusToggle = useStatusToggle('/department', reload);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<Department | null | undefined>(undefined);

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) =>
    !q || `${r.depart_code} ${r.depart_name}`.toLowerCase().includes(q));

  const remove = (row: Department) =>
    Notific.confirm(`${t('hrDepartmentDeleteConfirm')} ${row.depart_name}`, async () => {
      try {
        await deleteApi(`/department/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('hrDepartments'), value: rows.filter((r) => Number(r.executive) !== 1).length },
          { label: t('hrEmployees'), value: rows.reduce((n, r) => n + (r.employees ?? 0), 0), tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('hrDepartmentAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-sitemap">
        <div className="acs-grid">
          {shown.map((r) => {
            return (
              <SettingCard
                key={r._uuid}
                tone="is-violet"
                badge={r.depart_code}
                title={r.depart_name}
                subtitle={r.description || undefined}
                meta={
                  <>
                    {Number(r.executive) === 1 && <MetaChip icon="fa-crown" tone="gold">{t('hrExecutive')}</MetaChip>}
                    <MetaChip icon="fa-users" tone="green">{r.employees ?? 0} {t('hrPeople')}</MetaChip>
                  </>
                }
                active={Number(r.status) === 1}
                onToggle={(on) => statusToggle.toggle(r._uuid, on)}
                toggling={statusToggle.busyId === r._uuid}
                canEdit={canEdit}
                onEdit={() => setEditing(r)}
                actions={!r.employees && (
                  <CardAction text icon="fa-trash" label={t('delete')} tone="danger" disabled={!canDelete} onClick={() => remove(r)} />
                )}
              />
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && (
        <DepartmentForm data={editing} codes={rows.map((r) => r.depart_code)} onClose={() => setEditing(undefined)} onSaved={reload} />
      )}
    </div>
  );
};

export default DepartmentPage;
