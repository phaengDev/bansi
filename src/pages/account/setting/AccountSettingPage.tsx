import { useMemo, useState, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import AccountClassPage from './AccountClassPage';
import AccountTypePage from './AccountTypePage';
import BankDirectoryPage from './BankDirectoryPage';
import CurrencyRatePage from './CurrencyRatePage';
import DocNumberingPage from './DocNumberingPage';
import FinanceCategoryPage from './FinanceCategoryPage';
import FiscalYearPage from './FiscalYearPage';
import JournalTypePage from './JournalTypePage';
import MenuLockPage from './MenuLockPage';
import OpeningBalancePage from './OpeningBalancePage';
import PaymentMethodPage from './PaymentMethodPage';
import TaxPage from './TaxPage';
import { ACCOUNT_SETTING_MENU, firstRailKey, toRailNav } from '../config/SidebarPopup';

type AccountSettingPageProps = {
  /** ຫົວຂໍ້ຂອງໜ້າຕ່າງ popup — ເປີດເປັນ route ເສີຍໆບໍ່ສົ່ງມາ */
  title?: string;
  /** ບໍ່ສົ່ງມາ (ເປີດເປັນ route) ຈະບໍ່ມີປຸ່ມປິດຢູ່ທ້າຍໜ້າ */
  onClose?: () => void;
};

type SettingPage = {
  /** ເນື້ອຫາຂອງໜ້າ */
  element: ReactNode;
  /** false = ເຊື່ອງຫົວໜ້າ (ຊື່ + ຄຳອະທິບາຍ) ຂອງ <AppPage> — ບໍ່ໃສ່ = ສະແດງ */
  header?: boolean;
  /**
   * false = ບໍ່ມີທ້າຍໜ້າ · ໃສ່ເປັນ node = ໃຊ້ທ້າຍໜ້າຂອງໜ້ານັ້ນເອງ ·
   * ບໍ່ໃສ່ = ໃຊ້ທ້າຍໜ້າມາດຕະຖານ (ປຸ່ມປິດ, ມີສະເພາະຕອນເປີດເປັນ popup)
   */
  footer?: ReactNode | false;
};

/**
 * key ຂອງເມນູ (src/pages/account/config/SidebarPopup.ts) → ໜ້າທີ່ຈະສະແດງ.
 * ເພີ່ມໜ້າໃໝ່ = ເພີ່ມແຖວດຽວຢູ່ນີ້ ເຊັ່ນ `incomeType: { element: <IncomeTypePage />, footer: false }` —
 * key ທີ່ຍັງບໍ່ມີໃນນີ້ຈະຂຶ້ນເປັນ "ກຳລັງພັດທະນາ" ໃຫ້ເອງ.
 */
const SETTING_PAGES: Record<string, SettingPage> = {
  fiscalYear: { element: <FiscalYearPage /> },
  currency: { element: <CurrencyRatePage /> },
  accountClass: { element: <AccountClassPage /> },
  accountType: { element: <AccountTypePage /> },
  openingBalance: { element: <OpeningBalancePage /> },
  // key ແຍກກັນ — component ດຽວກັນ ຖ້າບໍ່ມີ key ຈະເກັບ state (ຄຳຄົ້ນ, ຟອມ) ຂ້າມລະຫວ່າງສອງເມນູ
  incomeType: { element: <FinanceCategoryPage key="income" kind={1} /> },
  expenseType: { element: <FinanceCategoryPage key="expense" kind={2} /> },
  bankAccount: { element: <BankDirectoryPage /> },
  paymentMethod: { element: <PaymentMethodPage /> },
  journalType: { element: <JournalTypePage /> },
  docNumbering: { element: <DocNumberingPage /> },
  tax: { element: <TaxPage /> },
  menuLock: { element: <MenuLockPage /> },
};

/** ເປີດມາຢູ່ເມນູທຳອິດທີ່ມີເນື້ອຫາແລ້ວ — ຍັງບໍ່ມີຈັກໜ້າກໍ່ເປີດເມນູທຳອິດ */
const firstReadyKey =
  ACCOUNT_SETTING_MENU.flatMap((group) => group.items).find((item) => SETTING_PAGES[item.key])?.key
  ?? firstRailKey(ACCOUNT_SETTING_MENU);

/**
 * ໜ້າຕັ້ງຄ່າບັນຊີ — ເປືອກນອກ (ຫົວ + ແຖບເມນູຊ້າຍ + ທ້າຍໜ້າ) ຂອງທຸກໜ້າຕັ້ງຄ່າບັນຊີ ແບບດຽວກັບ
 * LifeSettingPage. ກົດເມນູຊ້າຍແລ້ວປ່ຽນເນື້ອຫາຢູ່ໃນໜ້າຕ່າງເລີຍ ບໍ່ navigate ອອກໄປ route ອື່ນ.
 */
const AccountSettingPage = ({ title, onClose }: AccountSettingPageProps) => {
  const t = useT();
  const [activeKey, setActiveKey] = useState(firstReadyKey);

  const railNav = useMemo(() => toRailNav(ACCOUNT_SETTING_MENU, t), [t]);
  const active = railNav.find((item) => item.key === activeKey);
  const page = SETTING_PAGES[activeKey];

  const defaultFooter = onClose && (
    <>
      <span><i className="fa-solid fa-gears" aria-hidden="true" /> {active?.group}</span>
      <span className="app-page-actions">
        <button type="button" onClick={onClose}>{t('closeAction')}</button>
      </span>
    </>
  );

  return (
    <AppPage
      title={active?.label ?? title ?? t('accountAppSettings')}
      subtitle={title ?? t('accountAppSettings')}
      showHeader={page?.header ?? true}
      railNav={railNav}
      railActiveKey={activeKey}
      onRailSelect={setActiveKey}
      footer={page?.footer ?? defaultFooter}
    >
      {page?.element ?? (
        <div className="life-app-form-card text-center">
          <div className="life-app-form-card-heading justify-content-center border-0 pb-0">
            <span><i className={active?.icon ?? 'fa-solid fa-screwdriver-wrench'} aria-hidden="true" /></span>
            <div className="text-start">
              <h3>{active?.label}</h3>
              <small>{t('lifeSettingsComingSoon')}</small>
            </div>
          </div>
        </div>
      )}
    </AppPage>
  );
};

export default AccountSettingPage;
