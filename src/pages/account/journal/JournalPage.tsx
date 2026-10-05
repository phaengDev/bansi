import { useMemo, useState, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { JOURNAL_MENU, firstRailKey, toRailNav } from '../config/SidebarPopup';
import IncomePage from './IncomePage';
import ExpensePage from './ExpensePage';
import EntryReport from './EntryReport';
import GeneralJournalPage from '../gl/GeneralJournalPage';

/**
 * ໜ້າຕ່າງ ບັນທຶກບັນຊີປະຈຳວັນ — ແຖບເມນູຊ້າຍ (ລາຍຮັບ / ລາຍຈ່າຍ) ປ່ຽນເນື້ອຫາຢູ່ໃນໜ້າຕ່າງເລີຍ ແບບດຽວກັບ ຕັ້ງຄ່າບັນຊີ.
 * ເພີ່ມໜ້າ = ເພີ່ມແຖວໃນ PAGES; key ທີ່ຍັງບໍ່ມີຂຶ້ນ "ກຳລັງພັດທະນາ"
 */
const PAGES: Record<string, ReactNode> = {
  income: <IncomePage />,
  expense: <ExpensePage />,
  incomeReport: <EntryReport key="income" kind="income" />,
  expenseReport: <EntryReport key="expense" kind="expense" />,
  generalEntry: <GeneralJournalPage key="manual" manualOnly />,
  journalBook: <GeneralJournalPage key="book" />,
};

const JournalPage = () => {
  const t = useT();
  const [activeKey, setActiveKey] = useState(firstRailKey(JOURNAL_MENU));
  const railNav = useMemo(() => toRailNav(JOURNAL_MENU, t), [t]);
  const active = railNav.find((item) => item.key === activeKey);
  const page = PAGES[activeKey];

  return (
    <AppPage
      title={active?.label ?? t('accountAppJournal')}
      subtitle={t('accountAppJournal')}
      showHeader={false}
      railNav={railNav}
      railActiveKey={activeKey}
      onRailSelect={setActiveKey}
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
