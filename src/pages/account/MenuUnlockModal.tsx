import { useState, type FormEvent } from 'react';
import { Button, Input, InputGroup, Modal } from 'rsuite';
import { getErrorMessage } from '../../utils/useCRUD';
import { useT } from '../../context/LanguageContext';
import { verifyMenuPassword, type AccountMenu } from './accountMenus';

/** ຖາມລະຫັດຜ່ານກ່ອນເປີດເມນູທີ່ລັອກໄວ້ — ຖືກແລ້ວຈຶ່ງເອີ້ນ onUnlocked; ຜິດ ລ້າງຊ່ອງ ແລະ ສະແດງເຫດຜົນຈາກ backend */
const MenuUnlockModal = ({ menu, onClose, onUnlocked }: { menu: AccountMenu; onClose: () => void; onUnlocked: () => void }) => {
  const t = useT();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || checking || menu.menuId == null) return;
    try {
      setChecking(true);
      await verifyMenuPassword(menu.menuId, password);
      onUnlocked();
    } catch (err) {
      setError(getErrorMessage(err));
      setPassword('');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="xs" className="acc-lock-modal">
      <Modal.Body>
        <form className="acc-lock" onSubmit={submit}>
          <span className={`life-desktop-shortcut-icon is-${menu.tone} acc-lock-icon`}>
            <i className={menu.iconClass} aria-hidden="true" />
            <em><i className="fa-solid fa-lock" aria-hidden="true" /></em>
          </span>
          <h4>{menu.name}</h4>
          <p>{t('menuLockPrompt')}</p>

          <InputGroup inside className={`acc-lock-input${error ? ' is-error' : ''}`}>
            <InputGroup.Addon><i className="fa-solid fa-key" /></InputGroup.Addon>
            <Input
              autoFocus
              type={visible ? 'text' : 'password'}
              autoComplete="off"
              placeholder={t('menuLockPassword')}
              value={password}
              onChange={(value) => {
                setPassword(value);
                setError('');
              }}
            />
            <InputGroup.Button onClick={() => setVisible((v) => !v)} aria-label={t('menuLockShow')} title={t('menuLockShow')}>
              <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'}`} />
            </InputGroup.Button>
          </InputGroup>
          {error && <small className="acc-lock-error"><i className="fa-solid fa-circle-exclamation" /> {error}</small>}

          <div className="acc-lock-actions">
            <Button appearance="default" className="acc-lock-btn is-cancel" onClick={onClose}>{t('cancel')}</Button>
            <Button appearance="primary" type="submit" className="acc-lock-btn is-open" loading={checking} disabled={!password}>
              <i className="fa-solid fa-unlock" /> {t('menuLockUnlock')}
            </Button>
          </div>
        </form>
      </Modal.Body>
    </Modal>
  );
};

export default MenuUnlockModal;
