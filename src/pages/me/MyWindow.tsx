import { useCallback, useMemo, useState, type ReactNode } from 'react';
import AppPage from '../../components/Elements/AppPage';
import { useT } from '../../context/LanguageContext';
import { MY_MENU, toRailNav } from '../account/config/SidebarPopup';
import { useRailKey } from '../account/windowMemory';
import { useMyEmployee } from '../account/accountMenus';
import MyToday from './MyToday';
import MyAttendance from './MyAttendance';
import MyLeaves from './MyLeaves';
import MyCorrections from './MyCorrections';
import MyAdvances from './MyAdvances';
import type { MyIntent, MyOpen } from './meApi';

/**
 * ໜ້າຕ່າງ ພື້ນທີ່ຂອງຂ້ອຍ — ສຳລັບຜູ້ໃຊ້ທີ່ຜູກກັບພະນັກງານ: ໃຊ້ຂໍ້ມູນ ແລະ ຄຳຮ້ອງຂອງຕົນເອງຜ່ານຄອມ ຄືກັນກັບ app ພະນັກງານ
 * (route /…/me ຂອງ backend). ແຖບຊ້າຍ: ມື້ນີ້, ເຂົ້າ-ອອກວຽກ …
 */
const MyWindow = () => {
  const t = useT();
  const me = useMyEmployee();
  const [activeKey, setActiveKey] = useRailKey('mySpace', MY_MENU);
  const railNav = useMemo(() => toRailNav(MY_MENU, t), [t]);
  const active = railNav.find((item) => item.key === activeKey);
  /** ສິ່ງທີ່ໜ້າປາຍທາງຕ້ອງເຮັດເມື່ອເປີດ (ເຊັ່ນ ເປີດຟອມຂໍໃໝ່) — ໜ້າເຮັດແລ້ວລ້າງ */
  const [intent, setIntent] = useState<(MyIntent & { key: string }) | null>(null);
  const open: MyOpen = useCallback((key, next) => {
    setActiveKey(key);
    setIntent(next ? { ...next, key } : null);
  }, [setActiveKey]);
  const done = useCallback(() => setIntent(null), []);
  const intentOf = (key: string) => (intent?.key === key ? intent : null);

  if (me === null) {
    return (
      <AppPage showHeader={false}>
        <div className="acc-class-empty"><i className="fa-solid fa-user-slash" /><p>{t('myNotLinked')}</p></div>
      </AppPage>
    );
  }

  const pages: Record<string, ReactNode> = {
    today: <MyToday onOpen={open} />,
    attendance: <MyAttendance onReport={(date) => open('corrections', { action: 'new', date })} />,
    leaves: <MyLeaves intent={intentOf('leaves')} onIntentDone={done} />,
    corrections: <MyCorrections intent={intentOf('corrections')} onIntentDone={done} />,
    advances: <MyAdvances intent={intentOf('advances')} onIntentDone={done} />,
  };

  return (
    <AppPage title={active?.label ?? t('accountAppMySpace')} subtitle={t('accountAppMySpace')} railNav={railNav} railActiveKey={activeKey} onRailSelect={(key) => open(key)}>
      {pages[activeKey]}
    </AppPage>
  );
};

export default MyWindow;
