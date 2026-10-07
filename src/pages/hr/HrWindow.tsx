import { useMemo, useState, type ReactNode } from 'react';
import AppPage from '../../components/Elements/AppPage';
import { useT } from '../../context/LanguageContext';
import { HR_MENU, firstRailKey, toRailNav } from '../account/config/SidebarPopup';
import UserPage from './UserPage';
import DepartmentPage from './DepartmentPage';
import EmployeePage from './EmployeePage';

/** key ຂອງເມນູ (HR_MENU) → ໜ້າ */
const HR_PAGES: Record<string, ReactNode> = {
  users: <UserPage />,
  departments: <DepartmentPage />,
  employees: <EmployeePage />,
};

/**
 * ໜ້າຕ່າງ ຕັ້ງຄ່າຂໍ້ມູນພື້ນຖານ (HR) — ແຖບຊ້າຍ: ຜູ້ໃຊ້ລະບົບ, ພະແນກ ແລະ ຕຳແໜ່ງ, ພະນັກງານ.
 * ເປືອກດຽວກັບໜ້າຕັ້ງຄ່າບັນຊີ (ຫົວ = ຊື່ເມນູທີ່ເລືອກ)
 */
const HrWindow = () => {
  const t = useT();
  const [activeKey, setActiveKey] = useState(firstRailKey(HR_MENU));
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
