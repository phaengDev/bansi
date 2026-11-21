import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import AppPage from '../../components/Elements/AppPage';
import { useT } from '../../context/LanguageContext';
import { toRailNav, type SidebarPopupGroup } from '../account/config/SidebarPopup';
import { useRailKey } from '../account/windowMemory';
import { useMyEmployee } from '../account/accountMenus';
import { shortcutNameKeys, type ShortcutId } from '../account/DesktopShared';
import MyToday from './MyToday';
import MyAttendance from './MyAttendance';
import MyLeaves from './MyLeaves';
import MyCorrections from './MyCorrections';
import MyAdvances from './MyAdvances';
import MyPay from './MyPay';
import MyTasks from './MyTasks';
import MyWorkPlans from './MyWorkPlans';
import MyNotes from './MyNotes';
import { clearMyPageRequest, hasPage, openMyPage, useMyPageRequest } from './meNav';
import type { MyIntent, MyOpen } from './meApi';

/**
 * ໜ້າຕ່າງຂອງເມນູຂອງຂ້ອຍ (ການເຮັດວຽກ / ເງິນເດືອນ …) — ສຳລັບຜູ້ໃຊ້ທີ່ຜູກກັບພະນັກງານ: ໃຊ້ຂໍ້ມູນ ແລະ ຄຳຮ້ອງຂອງຕົນເອງຜ່ານຄອມ
 * ຄືກັນກັບ app ພະນັກງານ (route /…/me ຂອງ backend). ແຖບຊ້າຍ = ໜ້າຂອງເມນູນີ້; ເປີດໜ້າຂອງເມນູອື່ນ = ໜ້າຕ່າງນັ້ນເປີດຂຶ້ນ
 */
const MyWindow = ({ id, menu }: { id: ShortcutId; menu: SidebarPopupGroup[] }) => {
  const t = useT();
  const me = useMyEmployee();
  const [activeKey, setActiveKey] = useRailKey(id, menu);
  const railNav = useMemo(() => toRailNav(menu, t), [menu, t]);
  const active = railNav.find((item) => item.key === activeKey);
  /** ສິ່ງທີ່ໜ້າປາຍທາງຕ້ອງເຮັດເມື່ອເປີດ (ເຊັ່ນ ເປີດຟອມຂໍໃໝ່) — ໜ້າເຮັດແລ້ວລ້າງ */
  const [intent, setIntent] = useState<(MyIntent & { key: string }) | null>(null);
  const request = useMyPageRequest();

  // ຄຳຂໍຈາກໜ້າຂອງເມນູອື່ນ (ຫຼື ກ່ອນໜ້າຕ່າງນີ້ເປີດ) — ໄປທີ່ໜ້ານັ້ນ
  useEffect(() => {
    if (request?.window !== id) return;
    setActiveKey(request.key);
    setIntent(request.intent ? { ...request.intent, key: request.key } : null);
    clearMyPageRequest(request);
  }, [request, id, setActiveKey]);

  const open: MyOpen = useCallback((key, next) => {
    if (!hasPage(menu, key)) {
      openMyPage(key, next);
      return;
    }
    setActiveKey(key);
    setIntent(next ? { ...next, key } : null);
  }, [menu, setActiveKey]);
  const done = useCallback(() => setIntent(null), []);
  const intentOf = (key: string) => (intent?.key === key ? intent : null);

  if (me === null) {
    return (
      <AppPage showHeader={false}>
        <div className="acc-class-empty"><i className="fa-solid fa-user-slash" /><p>{t('myNotLinked')}</p></div>
      </AppPage>
    );
  }

  const pages: Record<string, () => ReactNode> = {
    today: () => <MyToday onOpen={open} />,
    attendance: () => <MyAttendance onReport={(date) => open('corrections', { action: 'new', date })} />,
    leaves: () => <MyLeaves intent={intentOf('leaves')} onIntentDone={done} />,
    corrections: () => <MyCorrections intent={intentOf('corrections')} onIntentDone={done} />,
    pay: () => <MyPay />,
    advances: () => <MyAdvances intent={intentOf('advances')} onIntentDone={done} />,
    tasks: () => <MyTasks key="received" mode="received" />,
    assigned: () => <MyTasks key="assigned" mode="assigned" />,
    workplans: () => <MyWorkPlans />,
    notes: () => <MyNotes />,
  };

  return (
    <AppPage title={active?.label ?? t(shortcutNameKeys[id])} subtitle={t(shortcutNameKeys[id])} railNav={railNav} railActiveKey={activeKey} onRailSelect={(key) => open(key)}>
      {pages[activeKey]?.()}
    </AppPage>
  );
};

export default MyWindow;
