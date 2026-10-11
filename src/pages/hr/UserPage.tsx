import { useRef, useState } from 'react';
import { Checkbox, Form, Schema, Toggle } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../utils/inputFields';
import { deleteApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { useEmployees, useUserTypes, type EmployeeOption } from '../../utils/selectOption';
import { ChoiceTiles, FormSection, ListState, PickerField, SettingModal, SettingToolbar } from '../account/setting/settingKit';
import { runSave, saveSetting, useStatusToggle } from '../account/setting/settingApi';
import {
  ALLOW, DEFAULT_USER_LEVEL, DENY, PERMISSIONS, fullName, selfId, useHrList, userLevelIcon,
  type PermissionKey, type User, type UserType,
} from './hrApi';
import { HrAvatar } from './hrKit';

const { StringType, NumberType } = Schema.Types;
const MIN_PASSWORD = 6;
/** TextFieldProps ຂອງ InputField ບໍ່ໄດ້ປະກາດ type — ສົ່ງຕໍ່ໃຫ້ Input ຄືກັບ MenuLockPage */
const newSecret = { type: 'password', autoComplete: 'new-password' } as object;
const currentSecret = { type: 'password', autoComplete: 'current-password' } as object;

/** ພະນັກງານໃນ SelectPicker — ຮູບ + ລະຫັດ + ຊື່ + ພະແນກ */
const employeeLabel = (_: unknown, item: any) => item && (
  <span className="hr-opt">
    <HrAvatar url={item.employee.profile_url} name={item.employee.first_name} size="sm" />
    <span>
      <b>{item.employee.emp_code}</b> {fullName(item.employee)}
      {item.employee.department && <small>{item.employee.department.depart_name}</small>}
    </span>
  </span>
);

const UserForm = ({ data, types, onClose, onSaved }: {
  data: User | null;
  types: UserType[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const isSelf = !!data && data.user_uuid === selfId();
  const [saving, setSaving] = useState(false);
  const employees = useEmployees();
  const [type, setType] = useState<number>(
    data?.type_user ?? types.find((x) => x._uuid === DEFAULT_USER_LEVEL)?._uuid ?? types[types.length - 1]?._uuid ?? DEFAULT_USER_LEVEL
  );
  const [perms, setPerms] = useState<Record<PermissionKey, boolean>>({
    creates: data ? Number(data.creates) === ALLOW : true,
    updates: data ? Number(data.updates) === ALLOW : true,
    deletes: data ? Number(data.deletes) === ALLOW : false,
  });
  const [inputs, setInputs] = useState<any>({
    user_name: data?.user_name ?? '',
    phones: data?.phones ?? '',
    employee_id: data?.employee_id ?? null,
    password: '',
    confirm: '',
  });

  // ພະນັກງານທີ່ລາອອກແລ້ວບໍ່ຢູ່ໃນ option — ສະແດງຄົນທີ່ຜູກໄວ້ເດີມນຳ
  const employeeList: EmployeeOption[] = data?.employee && !employees.some((e) => e._uuid === data.employee_id)
    ? [{ ...data.employee, user_id: data.user_uuid }, ...employees]
    : employees;
  const employeeOptions = employeeList.map((e) => ({
    value: e._uuid,
    label: `${e.emp_code} ${fullName(e)}`,
    employee: e,
    // ຜູກກັບບັນຊີອື່ນແລ້ວ ເລືອກບໍ່ໄດ້
    disabled: !!e.user_id && e.user_id !== data?.user_uuid,
  }));

  const model = Schema.Model<any>({
    user_name: StringType().isRequired(t('inputRequired')),
    phones: StringType().isRequired(t('inputRequired')).pattern(/^\+?[\d\s-]{6,24}$/, t('hrPhoneInvalid')),
    employee_id: NumberType(),
    ...(data
      ? {}
      : {
        password: StringType().isRequired(t('inputRequired')).minLength(MIN_PASSWORD, t('hrPasswordShort')),
        confirm: StringType().isRequired(t('inputRequired'))
          .addRule((value, form) => value === form.password, t('hrPasswordMismatch')),
      }),
  });

  /** ເລືອກພະນັກງານ → ເຕີມຊື່ ແລະ ເບີໂທໃຫ້ (ຖ້າຍັງຫວ່າງ) */
  const handleChange = (next: any) => {
    if (next.employee_id && next.employee_id !== inputs.employee_id) {
      const employee = employeeList.find((e) => e._uuid === next.employee_id);
      if (employee) {
        next = {
          ...next,
          user_name: String(next.user_name).trim() ? next.user_name : fullName(employee),
          phones: String(next.phones).trim() ? next.phones : employee.phone ?? '',
        };
      }
    }
    setInputs(next);
  };

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = {
      user_name: String(inputs.user_name).trim(),
      phones: String(inputs.phones).replace(/[\s-]/g, ''),
      employee_id: inputs.employee_id || null,
      type_user: type,
      ...Object.fromEntries(PERMISSIONS.map((p) => [p.key, perms[p.key] ? ALLOW : DENY])),
      ...(data ? {} : { password: inputs.password, status: 1 }),
    };
    if (await runSave(() => saveSetting('/user', data?.user_uuid, payload), setSaving)) {
      if (isSelf) {
        // ສິດໃນໜ້າເວັບອ່ານຕອນ login — ອັບເດດໄວ້ ແລະ ບອກໃຫ້ເຂົ້າລະບົບໃໝ່
        localStorage.setItem('user_name', payload.user_name);
        PERMISSIONS.forEach((p) => localStorage.setItem(p.key, String(perms[p.key] ? ALLOW : DENY)));
        Notific.warning('hrSelfReloginNote');
      }
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'hrUserEdit' : 'hrUserAdd')} hint={t('hrUserHint')} icon="fa-user-shield" saving={saving} onClose={onClose} onSubmit={submit} wide>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={handleChange}>
        <FormSection title={t('hrAccount')}>
          <div className="is-wide">
            <PickerField name="employee_id" label={t('hrLinkEmployee')} data={employeeOptions} required={false}
              placeholder={t('hrNoEmployee')} renderOption={employeeLabel} renderValue={employeeLabel}
              disabledItemValues={employeeOptions.filter((o) => o.disabled).map((o) => o.value)}
            />
          </div>
          <InputField name="user_name" label={t('hrUserName')} icon={<i className="fa-solid fa-user" />} />
          <InputField name="phones" label={t('hrLoginPhone')} icon={<i className="fa-solid fa-phone" />} placeholder="20xxxxxxxx" />
          {!data && (
            <>
              <InputField name="password" label={t('hrPassword')} {...newSecret} icon={<i className="fa-solid fa-key" />} />
              <InputField name="confirm" label={t('hrPasswordConfirm')} {...newSecret} icon={<i className="fa-solid fa-key" />} />
            </>
          )}
          <ChoiceTiles<number>
            className="is-wide"
            label={t('hrUserType')}
            value={type}
            onChange={setType}
            options={types.map((x) => ({ value: x._uuid, label: x.names, icon: userLevelIcon(x._uuid) }))}
          />
        </FormSection>
        <FormSection title={t('hrPermissions')} note={isSelf && <><i className="fa-solid fa-circle-info" /> {t('hrSelfPermNote')}</>}>
          {/* ສິດທັງ 3 ເປັນ checkbox ແຖວດຽວ — ຕິກ = ອະນຸຍາດ */}
          <div className="is-wide hr-perms" role="group" aria-label={t('hrPermissions')}>
            {PERMISSIONS.map((p) => {
              const locked = isSelf && p.key === 'updates';
              return (
                <Checkbox key={p.key} checked={perms[p.key]} disabled={locked}
                  className={`hr-perm${perms[p.key] ? ' is-on' : ''}`}
                  onChange={(_, checked) => setPerms({ ...perms, [p.key]: checked })}
                >
                  <i className={`fa-solid ${p.icon}`} /> {t(p.label)}
                </Checkbox>
              );
            })}
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/** ປ່ຽນລະຫັດຜ່ານ — ຂອງຕົນເອງຕ້ອງໃສ່ລະຫັດປັດຈຸບັນ; ຂອງຄົນອື່ນຕັ້ງໃໝ່ໄດ້ເລີຍ (ຕ້ອງມີສິດແກ້ໄຂ) */
const PasswordForm = ({ user, onClose }: { user: User; onClose: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const isSelf = user.user_uuid === selfId();
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({ current_password: '', password: '', confirm: '' });

  const model = Schema.Model<any>({
    ...(isSelf ? { current_password: StringType().isRequired(t('inputRequired')) } : {}),
    password: StringType().isRequired(t('inputRequired')).minLength(MIN_PASSWORD, t('hrPasswordShort')),
    confirm: StringType().isRequired(t('inputRequired')).addRule((value, form) => value === form.password, t('hrPasswordMismatch')),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const payload = { password: inputs.password, ...(isSelf ? { current_password: inputs.current_password } : {}) };
    if (await runSave(() => putApi(`/user/password/${btoa(String(user.user_uuid))}`, payload), setSaving)) onClose();
  };

  return (
    <SettingModal title={t('hrChangePassword')} hint={`${user.user_name} · ${user.phones}`} icon="fa-key" saving={saving} onClose={onClose} onSubmit={submit} compact>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('hrPassword')}>
          {isSelf && (
            <div className="is-wide">
              <InputField name="current_password" label={t('hrPasswordCurrent')} {...currentSecret} />
            </div>
          )}
          <div className="is-wide">
            <InputField name="password" label={t('hrPasswordNew')} {...newSecret} />
          </div>
          <div className="is-wide">
            <InputField name="confirm" label={t('hrPasswordConfirm')} {...newSecret} />
          </div>
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ບັດຜູ້ໃຊ້ — ແຖບສີຕາມລະດັບ (1 ສູງສຸດ = ມ່ວງ, 2 ທຳມະດາ = ຟ້າ, 3 ທົ່ວໄປ = ຂຽວ) + ຮູບໃຫຍ່, ຊື່ / ປະເພດ, ເບີເຂົ້າລະບົບ + ພະນັກງານທີ່ຜູກ,
 * ສິດ 3 ຊ່ອງ (ເພີ່ມ / ແກ້ໄຂ / ລຶບ) ແລະ ປຸ່ມ ແກ້ໄຂ · ປ່ຽນລະຫັດຜ່ານ · ລຶບ. ເປີດ/ປິດບັນຊີຢູ່ມຸມຂວາເທິງ (ບັນຊີຕົນເອງປິດບໍ່ໄດ້)
 */
const UserCard = ({ user, isSelf, toggling, onToggle, onEdit, onPassword, onDelete }: {
  user: User;
  isSelf: boolean;
  toggling: boolean;
  onToggle: (on: boolean) => void;
  onEdit: () => void;
  onPassword: () => void;
  onDelete: () => void;
}) => {
  const t = useT();
  const active = Number(user.status) === 1;
  const level = Number(user.type_user);
  const employee = user.employee;
  const employeeText = employee ? `${employee.emp_code} · ${fullName(employee)}` : '';

  return (
    <article className={`hr-user is-level-${level}${active ? '' : ' is-off'}`}>
      <div className="hr-user-cover">
        <span className={`hr-user-state${active ? ' is-on' : ''}`}>
          {isSelf ? (
            <><i className="hr-user-dot" /> {t('active')}</>
          ) : (
            <label title={t(active ? 'statusTurnOff' : 'statusTurnOn')}>
              <Toggle size="sm" checked={active} loading={toggling} disabled={!canEdit || toggling} onChange={onToggle} />
              {t(active ? 'active' : 'inactive')}
            </label>
          )}
        </span>
      </div>

      <div className="hr-user-id">
        <span className="hr-user-photo"><HrAvatar url={employee?.profile_url} name={user.user_name} size="lg" /></span>
        <span className="hr-user-name">
          <b title={user.user_name}>{user.user_name}</b>
          <span>
            <em className="hr-user-type"><i className={`fa-solid ${userLevelIcon(level)}`} /> {user.typeuser?.names ?? '—'}</em>
            {isSelf && <span className="hr-self">{t('hrYou')}</span>}
          </span>
        </span>
      </div>

      <dl className="hr-user-info">
        <div>
          <dt><i className="fa-solid fa-phone" /></dt>
          <dd><small>{t('hrLoginPhone')}</small><b>{user.phones}</b></dd>
        </div>
        <div>
          <dt><i className="fa-solid fa-id-card" /></dt>
          <dd>
            <small>{t('hrLinkEmployee')}</small>
            {employee ? <b title={employeeText}>{employeeText}</b> : <b className="is-muted">{t('hrNoEmployee')}</b>}
            {employee?.department && <span>{employee.department.depart_name}</span>}
          </dd>
        </div>
      </dl>

      <div className="hr-user-perms" role="list" aria-label={t('hrPermissions')}>
        {PERMISSIONS.map((p) => {
          const on = Number(user[p.key]) === ALLOW;
          return (
            <span key={p.key} role="listitem" className={on ? 'is-on' : ''} title={`${t(p.label)}: ${t(on ? 'active' : 'inactive')}`}>
              <i className={`fa-solid ${p.icon}`} />
              <small>{t(p.label)}</small>
              <em><i className={`fa-solid ${on ? 'fa-check' : 'fa-xmark'}`} /></em>
            </span>
          );
        })}
      </div>

      <div className="hr-user-actions">
        <button type="button" disabled={!canEdit} onClick={onEdit}><i className="fa-solid fa-pen" /> {t('edit')}</button>
        <button type="button" disabled={!isSelf && !canEdit} onClick={onPassword}><i className="fa-solid fa-key" /> {t('hrChangePassword')}</button>
        {!isSelf && (
          <button type="button" className="is-danger" disabled={!canDelete} title={t('delete')} aria-label={t('delete')} onClick={onDelete}>
            <i className="fa-solid fa-trash" />
          </button>
        )}
      </div>
    </article>
  );
};

/**
 * ຜູ້ໃຊ້ລະບົບ — ບັນຊີເຂົ້າລະບົບ (ເບີໂທ + ລະຫັດຜ່ານ), ປະເພດ, ພະນັກງານທີ່ຜູກ ແລະ ສິດ ເພີ່ມ/ແກ້/ລຶບ.
 * ເປີດ/ປິດບັນຊີຈາກບັດ (ບັນຊີຕົນເອງປິດບໍ່ໄດ້), ປ່ຽນລະຫັດຜ່ານ, ລຶບ
 */
const UserPage = () => {
  const t = useT();
  const { rows, loading, reload } = useHrList<User>('/user/fetch', 'post');
  const types = useUserTypes();
  const statusToggle = useStatusToggle('/user', reload);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [password, setPassword] = useState<User | null>(null);
  const me = selfId();

  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((r) =>
    !q || `${r.user_name} ${r.phones} ${r.employee?.emp_code ?? ''} ${fullName(r.employee)}`.toLowerCase().includes(q));

  const remove = (user: User) =>
    Notific.confirm(`${t('hrUserDeleteConfirm')} ${user.user_name}`, async () => {
      try {
        await deleteApi(`/user/${btoa(String(user.user_uuid))}`);
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
          { label: t('hrUsers'), value: rows.length },
          { label: t('active'), value: rows.filter((r) => Number(r.status) === 1).length, tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('hrUserAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate && types.length > 0}
      />

      <ListState loading={loading} empty={!shown.length} icon="fa-user-shield">
        <div className="hr-users">
          {shown.map((r) => {
            const isSelf = r.user_uuid === me;
            return (
              <UserCard key={r.user_uuid} user={r} isSelf={isSelf}
                toggling={statusToggle.busyId === r.user_uuid}
                onToggle={(on) => statusToggle.toggle(r.user_uuid, on)}
                onEdit={() => setEditing(r)}
                onPassword={() => setPassword(r)}
                onDelete={() => remove(r)}
              />
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && <UserForm data={editing} types={types} onClose={() => setEditing(undefined)} onSaved={reload} />}
      {password && <PasswordForm user={password} onClose={() => setPassword(null)} />}
    </div>
  );
};

export default UserPage;
