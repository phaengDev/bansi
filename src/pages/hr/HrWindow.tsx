import { useMemo, type ReactNode } from 'react';
import AppPage from '../../components/Elements/AppPage';
import { useT } from '../../context/LanguageContext';
import { HR_MENU, toRailNav } from '../account/config/SidebarPopup';
import UserPage from './UserPage';
import CompanyPage from './CompanyPage';
import DepartmentPage from './DepartmentPage';
import PositionPage from './PositionPage';
import HrOptionPage from './HrOptionPage';
import SkillPage from './SkillPage';
import OrgChartPage from './org/OrgChartPage';
import AppReleasePage from './AppReleasePage';
import { useRailKey } from '../account/windowMemory';

/** key ຂອງເມນູ (HR_MENU) → ໜ້າ */
const HR_PAGES: Record<string, ReactNode> = {
  users: <UserPage />,
  company: <CompanyPage />,
  departments: <DepartmentPage />,
  positions: <PositionPage />,
  empOptions: <HrOptionPage />,
  skills: <SkillPage />,
  orgChart: <OrgChartPage />,
  appRelease: <AppReleasePage />,
};

/**
 * ໜ້າຕ່າງ ຕັ້ງຄ່າຂໍ້ມູນພື້ນຖານ (HR) — ແຖບຊ້າຍ: ຜູ້ໃຊ້ລະບົບ, ອັບເດດແອັບພະນັກງານ, ຂໍ້ມູນບໍລິສັດ, ພະແນກ ແລະ ຕຳແໜ່ງ
 * (ພະນັກງານ ແຍກເປັນໄອຄອນຂອງຕົນເອງເທິງ desktop — Shell.tsx).
 * ເປືອກດຽວກັບໜ້າຕັ້ງຄ່າບັນຊີ (ຫົວ = ຊື່ເມນູທີ່ເລືອກ)
 */
const HrWindow = () => {
  const t = useT();
  const [activeKey, setActiveKey] = useRailKey('hr', HR_MENU);
  const railNav = useMemo(() => toRailNav(HR_MENU, t), [t]);
  const active = railNav.find((item) => item.key === activeKey);
  const title = t('accountAppHr');

  return (
    <AppPage title={active?.label ?? title} subtitle={title} railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}>
      {HR_PAGES[activeKey]}
    </AppPage>
  );
};

export default HrWindow;
