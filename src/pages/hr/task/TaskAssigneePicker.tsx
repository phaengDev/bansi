import { useState } from 'react';
import { Button, Checkbox, Modal, SelectPicker } from 'rsuite';
import { Notific } from '../../../utils/Notification';
import { useT } from '../../../context/LanguageContext';
import { SearchBox } from '../../account/setting/settingKit';
import { HrAvatar } from '../hrKit';
import { TaskPager, slicePage } from './TaskBits';
import { MAX_TASK_ASSIGNEES, assigneeName, type TaskPerson } from './taskApi';

/**
 * ເລືອກຜູ້ຮັບຜິດຊອບ — ຄົ້ນຫາ, ກັ່ນຕາມພະແນກ, ຕິກຫຼາຍຄົນ (ກົດແຖວໄດ້), ຕິກຫົວຕາຕະລາງ = ທຸກຄົນທີ່ກັ່ນໄດ້.
 * ກົດມົງກຸດຂອງຄົນທີ່ເລືອກແລ້ວ = ຫົວໜ້າວຽກ. ການເລືອກມີຜົນທັນທີ (ຟອມຍັງບໍ່ບັນທຶກຈົນກວ່າຈະກົດບັນທຶກ)
 */
const TaskAssigneePicker = ({ people, value, lead, onChange, onLead, onClose }: {
  people: TaskPerson[];
  value: number[];
  lead: number | null;
  onChange: (ids: number[]) => void;
  onLead: (id: number) => void;
  onClose: () => void;
}) => {
  const t = useT();
  const [keyword, setKeyword] = useState('');
  const [department, setDepartment] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const departments = [...new Map(people.filter((p) => p.department).map((p) => [p.department!._uuid, p.department!])).values()];
  const q = keyword.trim().toLowerCase();
  const shown = people.filter((p) => (!department || p.department?._uuid === department)
    && (!q || `${p.emp_code} ${assigneeName(p)}`.toLowerCase().includes(q)));
  const { rows, current } = slicePage(shown, page, pageSize);
  const shownIds = shown.map((p) => p.employee_id);
  const selectedShown = shownIds.filter((id) => value.includes(id)).length;
  const filtered = !!q || !!department;

  const select = (ids: number[]) => {
    if (ids.length > MAX_TASK_ASSIGNEES) return Notific.warning('taskAssigneeMax');
    onChange(ids);
  };
  const toggle = (id: number) => select(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const toggleShown = () => select(selectedShown === shownIds.length
    ? value.filter((id) => !shownIds.includes(id))
    : [...value, ...shownIds.filter((id) => !value.includes(id))]);
  const filterBy = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <Modal open onClose={onClose} size="sm" className="acc-gl-ledger-modal task-picker">
      <Modal.Header>
        <div className="acc-gl-ledger-head">
          <span className="acc-gl-group-icon acc-tone is-violet"><i className="fa-solid fa-user-plus" /></span>
          <span>
            <Modal.Title>{t('taskAssignees')}</Modal.Title>
            <small>{t('taskAssigneeHint')}</small>
          </span>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="task-picker-tools">
          <SearchBox grow value={keyword} onChange={(v) => filterBy(() => setKeyword(v))} placeholder={t('taskPickerSearch')} />
          <SelectPicker size="sm" className="task-picker-filter" data={departments.map((d) => ({ value: d._uuid, label: d.depart_name }))} value={department}
            onChange={(v) => filterBy(() => setDepartment(v))} placeholder={t('hrAllDepartments')} searchable={departments.length > 8} popupClassName="acc-book-menu"
          />
        </div>
        <div className="task-picker-count">
          <span>{t('hrEmployee')} {shown.length} {t('taskPersons')}</span>
          {filtered && <button type="button" onClick={() => filterBy(() => { setKeyword(''); setDepartment(null); })}>{t('taskPickerClear')}</button>}
        </div>
        {!shown.length ? (
          <div className="acc-class-empty"><i className="fa-solid fa-user-slash" /><p>{t('noData')}</p></div>
        ) : (
          <div className="acc-gl-group">
            <div className="acc-rp-scroll">
              <table className="acc-gl-table hr-table task-pick-table">
                <thead>
                  <tr>
                    <th className="task-col-check">
                      <Checkbox checked={selectedShown === shownIds.length} indeterminate={selectedShown > 0 && selectedShown < shownIds.length} onChange={toggleShown} />
                    </th>
                    <th>{t('code')}</th>
                    <th>{t('hrEmployee')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const on = value.includes(p.employee_id);
                    const isLead = on && p.employee_id === lead;
                    return (
                      <tr key={p.employee_id} className={`is-click${on ? ' is-selected' : ''}`} onClick={() => toggle(p.employee_id)}>
                        <td className="task-col-check" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={on} onChange={() => toggle(p.employee_id)} />
                        </td>
                        <td><span className="acc-gl-ref">{p.emp_code}</span></td>
                        <td>
                          <span className="hr-person">
                            <span className={`task-avatar${Number(p.work_status) === 2 ? ' is-resigned' : ''}`}>
                              {on && (
                                <button type="button" className={`task-crown-btn${isLead ? ' is-on' : ''}`} title={t(isLead ? 'taskLead' : 'taskMakeLead')} aria-label={t('taskMakeLead')} aria-pressed={isLead}
                                  onClick={(e) => { e.stopPropagation(); onLead(p.employee_id); }}
                                >
                                  <i className="fa-solid fa-crown" />
                                </button>
                              )}
                              <HrAvatar url={p.profile_url} name={p.first_name} />
                            </span>
                            <span>
                              <b>{assigneeName(p)}</b>
                              <small className="acc-gl-ref">{Number(p.work_status) === 2 ? t('hrResigned') : p.department?.depart_name ?? ''}</small>
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {shown.length > 10 && <TaskPager total={shown.length} page={current} pageSize={pageSize} onPage={setPage} onPageSize={(n) => filterBy(() => setPageSize(n))} />}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <span className="task-picker-picked"><i className="fa-solid fa-user-check" /> {t('taskSelected')} {value.length} {t('taskPersons')}</span>
        <Button appearance="primary" className="acc-book-btn is-save" onClick={onClose}>{t('ok')}</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TaskAssigneePicker;
