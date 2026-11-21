import { useMemo, type ReactNode } from 'react';
import AppPage from '../../components/Elements/AppPage';
import { useT } from '../../context/LanguageContext';
import { MY_MENU, toRailNav } from '../account/config/SidebarPopup';
import { useRailKey } from '../account/windowMemory';
import { useMyEmployee } from '../account/accountMenus';
import MyToday from './MyToday';
import MyAttendance from './MyAttendance';

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

  if (me === null) {
    return (
      <AppPage showHeader={false}>
        <div className="acc-class-empty"><i className="fa-solid fa-user-slash" /><p>{t('myNotLinked')}</p></div>
      </AppPage>
    );
  }

  const pages: Record<string, ReactNode> = {
    today: <MyToday onOpen={setActiveKey} />,
    attendance: <MyAttendance />,
  };

  return (
    <AppPage title={active?.label ?? t('accountAppMySpace')} subtitle={t('accountAppMySpace')} railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}>
      {pages[activeKey]}
    </AppPage>
  );
};

export default MyWindow;
