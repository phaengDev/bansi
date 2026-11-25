import { useMemo, type ReactNode } from 'react';
import AppPage from '../../components/Elements/AppPage';
import { useT } from '../../context/LanguageContext';
import { PLATFORM_MENU, toRailNav } from '../account/config/SidebarPopup';
import { useRailKey } from '../account/windowMemory';
import { refreshCompanyPlan } from '../account/companyPlan';
import PlatformCompanies from './PlatformCompanies';
import PlatformPackages from './PlatformPackages';
import { usePlatformData } from './platformApi';

/**
 * ໜ້າຕ່າງ ຈັດການບໍລິສັດ (ສະເພາະເຈົ້າຂອງລະບົບ) — ບໍລິສັດທີ່ໃຊ້ລະບົບ + ແພັກເກດທີ່ຂາຍ. ຂໍ້ມູນໂຫຼດເທື່ອດຽວໃຊ້ຮ່ວມກັນ
 */
const PlatformWindow = () => {
  const t = useT();
  const railNav = useMemo(() => toRailNav(PLATFORM_MENU, t), [t]);
  const [activeKey, setActiveKey] = useRailKey('platform', PLATFORM_MENU);
  const active = railNav.find((item) => item.key === activeKey) ?? railNav[0];
  const { companies, packages, modules, reload } = usePlatformData();
  // ແພັກເກດຂອງບໍລິສັດຕົນເອງອາດປ່ຽນນຳ (ເມນູ / ປ້າຍໃນ taskbar)
  const reloadAll = () => {
    reload();
    refreshCompanyPlan();
  };

  const pages: Record<string, ReactNode> = {
    companies: <PlatformCompanies companies={companies} packages={packages} modules={modules} reload={reloadAll} />,
    packages: <PlatformPackages packages={packages} modules={modules} companies={companies} reload={reloadAll} />,
  };

  return (
    <AppPage title={active?.label ?? t('accountAppPlatform')} subtitle={t('accountAppPlatform')}
      railNav={railNav} railActiveKey={active?.key} onRailSelect={setActiveKey}
    >
      {pages[active?.key ?? 'companies'] ?? null}
    </AppPage>
  );
};

export default PlatformWindow;
