import { useState } from 'react';
import { SelectPicker } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatNumber } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { exportExcel } from '../../utils/exportHelpers';
import { useT } from '../../context/LanguageContext';
import { ListState, SettingToolbar } from '../account/setting/settingKit';
import { GENDERS, RESIGNED, WORKING, fullName, useHrList, type Employee } from './hrApi';
import { HrAvatar, WorkStatusPill } from './hrKit';
import EmployeeForm from './EmployeeForm';
import EmployeeDetail from './EmployeeDetail';

type StatusFilter = 'working' | 'resigned' | 'all';

const showDate = (value: string | null) => (value ? moment(value, 'YYYY-MM-DD').format('DD/MM/YYYY') : '—');

/**
 * ພະນັກງານ — ລາຍການ (ກັ່ນຕາມພະແນກ / ສະຖານະ / ຄຳຄົ້ນ), ເພີ່ມ/ແກ້ໄຂ, ລາຍລະອຽດ + ເອກະສານ, Excel.
 * ລຶບໄດ້ສະເພາະຄົນທີ່ບໍ່ມີບັນຊີຜູ້ໃຊ້ (ຄົນທີ່ອອກແລ້ວ ໃຫ້ຕັ້ງເປັນລາອອກແທນການລຶບ)
 */
const EmployeePage = () => {
  const t = useT();
  const { rows, extra, loading, reload } = useHrList<Employee>('/employee/fetch');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('working');
  const [department, setDepartment] = useState<number | null>(null);
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  const [viewing, setViewing] = useState<Employee | null>(null);

  const departments = [...new Map(rows.filter((r) => r.department).map((r) => [r.department_id, r.department!])).values()]
    .sort((a, b) => a.depart_name.localeCompare(b.depart_name));
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) =>
    (status === 'all' || (status === 'working' ? Number(r.work_status) === WORKING : Number(r.work_status) === RESIGNED))
    && (!department || r.department_id === department)
    && (!q || `${r.emp_code} ${fullName(r)} ${r.phone ?? ''} ${r.email ?? ''} ${r.position?.position_name ?? ''} ${r.bank_account_no ?? ''}`.toLowerCase().includes(q)));
  const working = rows.filter((r) => Number(r.work_status) === WORKING).length;

  const remove = (row: Employee) =>
    Notific.confirm(`${t('hrEmployeeDeleteConfirm')} ${row.emp_code} ${fullName(row)}`, async () => {
      try {
        await deleteApi(`/employee/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });

  const exportRows = () => {
    exportExcel(shown.map((r) => ({
      [t('hrEmployeeCode')]: r.emp_code,
      [t('hrFirstName')]: r.first_name,
      [t('hrLastName')]: r.last_name ?? '',
      [t('hrGender')]: t(GENDERS.find((g) => g.value === Number(r.gender))?.label ?? ''),
      [t('hrBirthday')]: showDate(r.birthday),
      [t('hrPhone')]: r.phone ?? '',
      [t('hrEmail')]: r.email ?? '',
      [t('hrDepartment')]: r.department?.depart_name ?? '',
      [t('hrPosition')]: r.position?.position_name ?? '',
      [t('hrStartDate')]: showDate(r.start_date),
      [t('hrEndDate')]: showDate(r.end_date),
      [t('hrBasicSalary')]: r.basic_salary,
      [t('hrBank')]: r.bank ? `${r.bank.abbr} ${r.bank.name_la}` : '',
      [t('hrBankAccountNo')]: r.bank_account_no ?? '',
      [t('hrBankAccountName')]: r.bank_account_name ?? '',
      [t('hrAddress')]: [r.village, r.district?.district_name, r.province?.province_name].filter(Boolean).join(', '),
      [t('hrWorkStatus')]: t(Number(r.work_status) === RESIGNED ? 'hrResigned' : 'hrWorking'),
    })), `employees_${moment().format('YYYY-MM-DD')}`, t('hrEmployees'));
  };

  const statuses: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'working', label: 'hrWorking', count: working },
    { key: 'resigned', label: 'hrResigned', count: rows.length - working },
    { key: 'all', label: 'all', count: rows.length },
  ];

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('hrEmployees'), value: rows.length },
          { label: t('hrWorking'), value: working, tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('hrEmployeeAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      >
        <div className="acc-type-segment" role="tablist">
          {statuses.map((s) => (
            <button key={s.key} type="button" role="tab" aria-selected={status === s.key} className={status === s.key ? 'is-active' : ''} onClick={() => setStatus(s.key)}>
              {t(s.label)} <em>{s.count}</em>
            </button>
          ))}
        </div>
        <SelectPicker size="sm" className="hr-filter" data={departments.map((d) => ({ value: d._uuid, label: d.depart_name }))}
          value={department} onChange={setDepartment} placeholder={t('hrAllDepartments')} searchable={false}
        />
        <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!shown.length}>
          <i className="fa-solid fa-file-excel" /> Excel
        </button>
      </SettingToolbar>

      <ListState loading={loading && !rows.length} empty={!shown.length} icon="fa-id-card">
        <div className="acc-gl-group">
          <div className="acc-rp-scroll">
            <table className="acc-gl-table hr-table">
              <thead>
                <tr>
                  <th>{t('hrEmployee')}</th>
                  <th>{t('hrDepartment')} / {t('hrPosition')}</th>
                  <th>{t('hrPhone')}</th>
                  <th>{t('hrStartDate')}</th>
                  <th className="is-num">{t('hrBasicSalary')}</th>
                  <th>{t('hrAccount')}</th>
                  <th>{t('status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r._uuid} className={`is-click${Number(r.work_status) === RESIGNED ? ' is-reversed' : ''}`} onClick={() => setViewing(r)}>
                    <td>
                      <span className="hr-person">
                        <HrAvatar url={r.profile_url} name={r.first_name} />
                        <span>
                          <b>{fullName(r)}</b>
                          <small className="acc-gl-ref">{r.emp_code}{r.documents.length ? <> · <i className="fa-solid fa-paperclip" /> {r.documents.length}</> : null}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      {r.department?.depart_name ?? '—'}
                      <small className="acc-gl-ref">{r.position?.position_name ?? ''}</small>
                    </td>
                    <td>{r.phone || '—'}</td>
                    <td>{showDate(r.start_date)}</td>
                    <td className="is-num">
                      {r.basic_salary ? formatNumber(r.basic_salary) : '—'}
                      {r.bank && r.bank_account_no
                        ? <small className="acc-gl-ref"><i className="fa-solid fa-building-columns" /> {r.bank.abbr} · {r.bank_account_no}</small>
                        : <small className="acc-gl-ref is-bad">{t('hrNoSalaryAccount')}</small>}
                    </td>
                    <td>
                      {r.user
                        ? <span className={`acs-chip${Number(r.user.status) === 1 ? ' is-green' : ''}`}><i className="fa-solid fa-user-shield" /> {r.user.user_name}</span>
                        : <span className="acc-gl-ref">—</span>}
                    </td>
                    <td><WorkStatusPill status={r.work_status} /></td>
                    <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="acc-gl-act" disabled={!canEdit} title={t('edit')} onClick={() => setEditing(r)}>
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button type="button" className="acc-gl-act is-danger" disabled={!canDelete || !!r.user}
                        title={r.user ? t('hrDeleteHasUser') : t('delete')} onClick={() => remove(r)}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ListState>

      {editing !== undefined && (
        <EmployeeForm data={editing} nextCode={extra.next_code as string | undefined} onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            reload();
            // ເພີ່ມໃໝ່ແລ້ວ ເປີດລາຍລະອຽດໃຫ້ອັບໂຫຼດເອກະສານຕໍ່ໄດ້ເລີຍ
            if (!editing && saved) setViewing(saved);
          }}
        />
      )}
      {viewing && (
        <EmployeeDetail employee={viewing} onClose={() => setViewing(null)} onChanged={reload}
          onEdit={(current) => {
            setEditing(current);
            setViewing(null);
          }}
        />
      )}
    </div>
  );
};

export default EmployeePage;
