import { useEffect, useRef, useState } from 'react';
import { Form, Schema } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { InputField } from '../../../utils/inputFields';
import { canEdit } from '../../../utils/localStorage';
import { useT } from '../../../context/LanguageContext';
import { shortcutDescKeys } from '../DesktopShared';
import { refreshAccountMenus, removeMenuPassword, saveMenuPassword, useAccountMenus, type AccountMenu } from '../accountMenus';
import { CardAction, FormSection, SettingModal, SettingToolbar } from './settingKit';
import { runSave } from './settingApi';

export type MenuLockMode = 'set' | 'change' | 'remove';

/** ຕ້ອງກົງກັບ MIN_LENGTH ຂອງ backend (menuLockController) */
const MIN_LENGTH = 4;

const { StringType } = Schema.Types;

/**
 * ຊ່ອງລະຫັດຜ່ານ — TextFieldProps ຂອງ InputField ບໍ່ໄດ້ປະກາດ type/autoComplete ແຕ່ສົ່ງຕໍ່ໃຫ້ Input ຢູ່ແລ້ວ (ຄື postfixProp).
 * "new-password" ກັນ browser ເອົາລະຫັດ login ມາໃສ່ໃຫ້ເອງ
 */
const secretProps = { type: 'password', autoComplete: 'new-password' } as object;

/**
 * ຟອມລະຫັດຜ່ານເມນູ (ໃຊ້ທັງໜ້ານີ້ ແລະ ຄລິກຂວາໃນ Start menu ຂອງ Shell) — set: ລະຫັດໃໝ່ + ຢືນຢັນ; change: ລະຫັດປັດຈຸບັນ + ລະຫັດໃໝ່ + ຢືນຢັນ; remove: ລະຫັດປັດຈຸບັນ
 */
export const MenuLockForm = ({ menu, mode, onClose }: { menu: AccountMenu; mode: MenuLockMode; onClose: () => void }) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [inputs, setInputs] = useState<any>({ current: '', password: '', confirm: '' });

  const needsCurrent = mode !== 'set';
  const needsNew = mode !== 'remove';
  const model = Schema.Model<any>({
    ...(needsCurrent ? { current: StringType().isRequired(t('inputRequired')) } : {}),
    ...(needsNew
      ? {
        password: StringType().isRequired(t('inputRequired')).minLength(MIN_LENGTH, t('menuLockMinLength')),
        confirm: StringType()
          .isRequired(t('inputRequired'))
          .addRule((value, data) => value === data.password, t('menuLockMismatch')),
      }
      : {}),
  });

  const submit = async () => {
    const menuId = menu.menuId;
    if (!formRef.current?.check() || menuId == null) return;
    const task = mode === 'remove'
      ? () => removeMenuPassword(menuId, inputs.current)
      : () => saveMenuPassword(menuId, inputs.password, needsCurrent ? inputs.current : undefined);
    if (await runSave(task, setSaving)) {
      await refreshAccountMenus();
      onClose();
    }
  };

  const title = { set: 'menuLockSet', change: 'menuLockChange', remove: 'menuLockRemove' }[mode];
  const icon = { set: 'fa-lock', change: 'fa-key', remove: 'fa-lock-open' }[mode];

  return (
    <SettingModal title={`${t(title)} · ${menu.name}`} hint={t('menuLockHint')} icon={icon}
      saving={saving} onClose={onClose} onSubmit={submit} compact={mode === 'remove'}
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormSection title={t('menuLockPassword')}>
          {needsCurrent && (
            <div className="is-wide">
              <InputField name="current" label={t('menuLockCurrent')} {...secretProps}
                icon={<i className="fa-solid fa-key" />}
              />
            </div>
          )}
          {needsNew && (
            <>
              <InputField name="password" label={t('menuLockNew')} {...secretProps}
                placeholder={t('menuLockMinLength')} icon={<i className="fa-solid fa-lock" />}
              />
              <InputField name="confirm" label={t('menuLockConfirm')} {...secretProps}
                icon={<i className="fa-solid fa-lock" />}
              />
            </>
          )}
        </FormSection>
      </Form>
    </SettingModal>
  );
};

/**
 * ລະຫັດຜ່ານເມນູ — ຕັ້ງ/ປ່ຽນ/ຍົກເລີກ ລະຫັດທີ່ຕ້ອງປ້ອນກ່ອນເປີດໂມດູນໃນໜ້າ desktop ບັນຊີ (ເຊັ່ນ ປຶ້ມບັນຊີໃຫຍ່).
 * ເມນູມາຈາກ GET /menu/main (tbl_main_menu types 2); backend ເກັບແຕ່ bcrypt hash ໃນ tbl_main_menu.password.
 * ປ່ຽນ ຫຼື ຍົກເລີກ ຕ້ອງໃສ່ລະຫັດປັດຈຸບັນຖືກ. ຕັ້ງໄດ້ຈາກການຄລິກຂວາໃນ Start menu ນຳ
 */
const MenuLockPage = () => {
  const t = useT();
  const menus = useAccountMenus().filter((menu) => menu.lockable);
  const [editing, setEditing] = useState<{ menu: AccountMenu; mode: MenuLockMode } | null>(null);

  useEffect(() => {
    refreshAccountMenus();
  }, []);

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('menuLockMenus'), value: menus.length },
          { label: t('menuLockLocked'), value: menus.filter((menu) => menu.locked).length, tone: 'gold' },
        ]}
      />

      <p className="acc-lock-note">
        <i className="fa-solid fa-circle-info" /> {t('menuLockNote')}
      </p>

      {menus.length ? (
        <div className="acc-lock-list">
          {menus.map((menu) => {
            const descKey = shortcutDescKeys[menu.id];
            return (
              <article key={menu.id} className={`acc-lock-row${menu.locked ? ' is-locked' : ''}`}>
                <span className={`life-desktop-shortcut-icon is-${menu.tone}`}>
                  <i className={menu.iconClass} aria-hidden="true" />
                </span>
                <span className="acc-lock-row-text">
                  <b>{menu.name}</b>
                  {descKey && <small>{t(descKey)}</small>}
                </span>
                <span className={`acc-lock-state${menu.locked ? ' is-on' : ''}`}>
                  <i className={`fa-solid ${menu.locked ? 'fa-lock' : 'fa-lock-open'}`} /> {t(menu.locked ? 'menuLockLocked' : 'menuLockOpen')}
                </span>
                <span className="acc-lock-row-actions">
                  {menu.locked ? (
                    <>
                      <CardAction text icon="fa-key" label={t('menuLockChange')} disabled={!canEdit}
                        onClick={() => setEditing({ menu, mode: 'change' })}
                      />
                      <CardAction text icon="fa-lock-open" label={t('menuLockRemove')} tone="danger" disabled={!canEdit}
                        onClick={() => setEditing({ menu, mode: 'remove' })}
                      />
                    </>
                  ) : (
                    <CardAction text icon="fa-lock" label={t('menuLockSet')} tone="accent" disabled={!canEdit}
                      onClick={() => setEditing({ menu, mode: 'set' })}
                    />
                  )}
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="acc-class-empty">
          <i className="fa-solid fa-lock" />
          <p>{t('menuLockNoMenus')}</p>
        </div>
      )}

      {editing && <MenuLockForm menu={editing.menu} mode={editing.mode} onClose={() => setEditing(null)} />}
    </div>
  );
};

export default MenuLockPage;
