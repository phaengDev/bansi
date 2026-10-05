import React from 'react';
import { useT } from '../../context/LanguageContext';
import { shortcutDescKeys, shortcutNameKeys, shortcuts, type ShortcutId } from './DesktopShared';

/**
 * Placeholder body for an accounting module's <AppWindow> until its real page is built — swap the
 * `<AccountModule id=… />` in Shell.tsx for the page component once it exists.
 */
const AccountModule: React.FC<{ id: ShortcutId }> = ({ id }) => {
  const t = useT();
  const shortcut = shortcuts.find((item) => item.id === id);
  const descKey = shortcutDescKeys[id];

  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center h-100 p-5">
      <span className={`life-desktop-shortcut-icon is-${shortcut?.tone ?? 'slate'} mb-3`}>
        <i className={`fa-solid ${shortcut?.icon ?? 'fa-calculator'}`} aria-hidden="true" />
      </span>
      <h4 className="mb-2">{t(shortcutNameKeys[id])}</h4>
      {descKey && <p className="text-muted mb-3">{t(descKey)}</p>}
      <span className="badge bg-warning text-dark fs-13px">{t('lifeSettingsComingSoon')}</span>
    </div>
  );
};

export default AccountModule;
