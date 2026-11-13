import { useMemo, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { ATTENDANCE_MENU, toRailNav } from '../../account/config/SidebarPopup';
import { useHrPending } from '../hrPending';
import AttendanceDaily from './AttendanceDaily';
import AttendanceMonthly from './AttendanceMonthly';
import CorrectionPage from './CorrectionPage';
import HolidayPage from './HolidayPage';
import LeavePage from './LeavePage';
import LeaveTypePage from './LeaveTypePage';
import OvertimePage from './OvertimePage';
import { useRailKey } from '../../account/windowMemory';

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
  const [activeKey, setActiveKey] = useRailKey('attendance', ATTENDANCE_MENU);
  const pending = useHrPending();
  // ຕົວເລກສີແດງ = ຄຳຂໍລາພັກ / ແຈ້ງລືມສະແກນ ທີ່ລໍຖ້າອະນຸມັດ
  const railNav = useMemo(() => toRailNav(ATTENDANCE_MENU, t).map((item) => ({
    ...item,
    badge: item.key === 'leaves' ? pending?.leave : item.key === 'corrections' ? pending?.correction : undefined,
  })), [t, pending]);
  const active = railNav.find((item) => item.key === activeKey);
  const title = t('accountAppAttendance');

  return (
    <AppPage title={active?.label ?? title} subtitle={title} railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}>
      {PAGES[activeKey]}
    </AppPage>
  );
};

export default AttendanceWindow;
