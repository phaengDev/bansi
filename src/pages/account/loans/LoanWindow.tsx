import { useMemo, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { LOAN_MENU, toRailNav } from '../config/SidebarPopup';
import { useRailKey } from '../windowMemory';
import LoanList from './LoanList';
import LoanAccrualPage from './LoanAccrualPage';
import { BORROWED, LENT } from './loanApi';

/** ໜ້າຕ່າງ ເງິນກູ້ — ເງິນກູ້ຢືມ, ເງິນໃຫ້ກູ້, ດອກເບ້ຍຄ້າງທ້າຍເດືອນ */
const LoanWindow = () => {
  const t = useT();
  const railNav = useMemo(() => toRailNav(LOAN_MENU, t), [t]);
  const [activeKey, setActiveKey] = useRailKey('loans', LOAN_MENU);
  const active = railNav.find((item) => item.key === activeKey);
  const pages: Record<string, ReactNode> = {
    borrowed: <LoanList key="borrowed" direction={BORROWED} />,
    lent: <LoanList key="lent" direction={LENT} />,
    accrual: <LoanAccrualPage />,
  };
  return (
    <AppPage title={active?.label ?? t('accountAppLoans')} subtitle={t('accountAppLoans')}
      railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}
    >
      {pages[activeKey] ?? null}
    </AppPage>
  );
};

export default LoanWindow;
