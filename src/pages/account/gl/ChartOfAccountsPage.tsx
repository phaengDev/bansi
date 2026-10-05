import { useMemo, useState, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { CHART_MENU, firstRailKey, toRailNav } from '../config/SidebarPopup';
import ChartTreePage from './ChartTreePage';
import GlMappingPage from './GlMappingPage';
import GlSetupPage from './GlSetupPage';

/** ໜ້າຕ່າງ ຜັງບັນຊີ — ແຖບຊ້າຍ: ຜັງບັນຊີ / ຜູກບັນຊີ / ການເປີດໃຊ້ (ສະຖານະ + ລົງບັນຊີຍ້ອນຫຼັງ) */
const PAGES: Record<string, ReactNode> = {
  chart: <ChartTreePage />,
  mapping: <GlMappingPage />,
  setup: <GlSetupPage />,
};

const ChartOfAccountsPage = () => {
  const t = useT();
  const [activeKey, setActiveKey] = useState(firstRailKey(CHART_MENU));
  const railNav = useMemo(() => toRailNav(CHART_MENU, t), [t]);
  const active = railNav.find((item) => item.key === activeKey);

  return (
    <AppPage
      title={active?.label ?? t('accountAppChartOfAccounts')}
      subtitle={t('accountAppChartOfAccounts')}
      showHeader={false}
      railNav={railNav}
      railActiveKey={activeKey}
      onRailSelect={setActiveKey}
    >
      {PAGES[activeKey]}
    </AppPage>
  );
};

export default ChartOfAccountsPage;
