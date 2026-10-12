import { useMemo, useState, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { ATTENDANCE_MENU, firstRailKey, toRailNav } from '../../account/config/SidebarPopup';
import AttendanceDaily from './AttendanceDaily';
import AttendanceMonthly from './AttendanceMonthly';
import CorrectionPage from './CorrectionPage';
import HolidayPage from './HolidayPage';
import LeavePage from './LeavePage';
import LeaveTypePage from './LeaveTypePage';
import OvertimePage from './OvertimePage';

const PAGES: Record<string, ReactNode> = {
  daily: <AttendanceDaily />,
  monthly: <AttendanceMonthly />,
  leaves: <LeavePage />,
  corrections: <CorrectionPage />,
  overtime: <OvertimePage />,
  holidays: <HolidayPage />,
  leaveTypes: <LeaveTypePage />,
};

/**
 * ໜ້າຕ່າງ ການເຂົ້າ-ອອກວຽກ — ແຖບຊ້າຍ: ລາຍວັນ, ລາຍເດືອນ, ຄຳຂໍລາພັກ, ລ່ວງເວລາ (OT), ວັນພັກ, ປະເພດການລາພັກ.
 * ພະນັກງານສະແກນຜ່ານ app ມືຖື (POST /attendance/scan) ພາຍໃນໄລຍະຂອງບໍລິສັດ (ຂໍ້ມູນບໍລິສັດ → ທີ່ຕັ້ງ)
 */
const AttendanceWindow = () => {
  const t = useT();
  const [activeKey, setActiveKey] = useState(firstRailKey(ATTENDANCE_MENU));
  const railNav = useMemo(() => toRailNav(ATTENDANCE_MENU, t), [t]);
  const active = railNav.find((item) => item.key === activeKey);
  const title = t('accountAppAttendance');

  return (
    <AppPage title={active?.label ?? title} subtitle={title} railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}>
      {PAGES[activeKey]}
    </AppPage>
  );
};

export default AttendanceWindow;
