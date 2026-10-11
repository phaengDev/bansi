import { useMemo, useState } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { PAYROLL_MENU, firstRailKey, toRailNav } from '../../account/config/SidebarPopup';
import PayrollList from './PayrollList';
import PayrollDetail from './PayrollDetail';
import PayrollSettingPage from './PayrollSettingPage';

/**
 * ໜ້າຕ່າງ ເງິນເດືອນ — ແຖບຊ້າຍ: ໃບເງິນເດືອນປະຈຳເດືອນ (ລາຍການ → ລາຍລະອຽດ) ແລະ ຕັ້ງຄ່າ (ປກສ, ອາກອນ, ການຫັກ)
 */
const PayrollWindow = () => {
  const t = useT();
  const [activeKey, setActiveKey] = useState(firstRailKey(PAYROLL_MENU));
  const [openId, setOpenId] = useState<number | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const railNav = useMemo(() => toRailNav(PAYROLL_MENU, t), [t]);
  const active = railNav.find((item) => item.key === activeKey);
  const title = t('accountAppPayroll');

  const select = (key: string) => {
    setActiveKey(key);
    setOpenId(null);
  };

  return (
    <AppPage title={active?.label ?? title} subtitle={title} showHeader={activeKey !== 'runs' || !openId} railNav={railNav} railActiveKey={activeKey} onRailSelect={select}>
      {activeKey === 'settings' ? (
        <PayrollSettingPage />
      ) : openId ? (
        <PayrollDetail id={openId} onBack={() => setOpenId(null)} onChanged={() => setListVersion((v) => v + 1)} />
      ) : (
        <PayrollList key={listVersion} onOpen={setOpenId} />
      )}
    </AppPage>
  );
};

export default PayrollWindow;
