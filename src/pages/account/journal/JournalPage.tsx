import { useMemo, useState, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { JOURNAL_MENU, toRailNav } from '../config/SidebarPopup';
import IncomePage from './IncomePage';
import ExpensePage from './ExpensePage';
import EntryReport from './EntryReport';
import GeneralJournalPage from '../gl/GeneralJournalPage';
import JournalOverview from './JournalOverview';
import { useRailKey } from '../windowMemory';

/**
 * ໜ້າຕ່າງ ບັນທຶກບັນຊີປະຈຳວັນ — ແຖບເມນູຊ້າຍ (ພາບລວມ / ລາຍຮັບ / ລາຍຈ່າຍ …) ປ່ຽນເນື້ອຫາຢູ່ໃນໜ້າຕ່າງເລີຍ ແບບດຽວກັບ ຕັ້ງຄ່າບັນຊີ.
 * ເພີ່ມໜ້າ = ເພີ່ມແຖວໃນ PAGES; key ທີ່ຍັງບໍ່ມີຂຶ້ນ "ກຳລັງພັດທະນາ". ພາບລວມ ແລະ ລາຍຮັບ/ລາຍຈ່າຍ ສ້າງໃນ component
 * (ປຸ່ມ "+ ບັນທຶກ" ຂອງພາບລວມ ເປີດໜ້ານັ້ນພ້ອມຟອມໃໝ່)
 */
const PAGES: Record<string, ReactNode> = {
  incomeReport: <EntryReport key="income" kind="income" />,
  expenseReport: <EntryReport key="expense" kind="expense" />,
  generalEntry: <GeneralJournalPage key="manual" manualOnly />,
  journalBook: <GeneralJournalPage key="book" />,
};

const JournalPage = () => {
  const t = useT();
  const [activeKey, setActiveKey] = useRailKey('journal', JOURNAL_MENU);
  /** > 0 = ເປີດໜ້າລາຍຮັບ/ລາຍຈ່າຍ ພ້ອມຟອມໃໝ່ (ຄ່າໃໝ່ທຸກຄັ້ງ ໃຫ້ໜ້າສ້າງໃໝ່) */
  const [createNonce, setCreateNonce] = useState(0);
  const railNav = useMemo(() => toRailNav(JOURNAL_MENU, t), [t]);
  const active = railNav.find((item) => item.key === activeKey);
  const select = (key: string) => {
    setActiveKey(key);
    setCreateNonce(0);
  };
  const navigate = (key: 'income' | 'expense', create = false) => {
    setActiveKey(key);
    setCreateNonce(create ? Date.now() : 0);
  };
  const page = activeKey === 'overview' ? <JournalOverview onNavigate={navigate} />
    : activeKey === 'income' ? <IncomePage key={createNonce} startNew={createNonce > 0} />
      : activeKey === 'expense' ? <ExpensePage key={createNonce} startNew={createNonce > 0} />
        : PAGES[activeKey];

  return (
    <AppPage
      title={active?.label ?? t('accountAppJournal')}
      subtitle={t('accountAppJournal')}
      showHeader={false}
      railNav={railNav}
      railActiveKey={activeKey}
      onRailSelect={select}
    >
      {page ?? (
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

export default JournalPage;
