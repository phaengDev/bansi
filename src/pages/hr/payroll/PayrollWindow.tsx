import { useMemo, useState } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { PAYROLL_MENU, firstRailKey, toRailNav } from '../../account/config/SidebarPopup';
import { useHrPending } from '../hrPending';
import PayrollList from './PayrollList';
import PayrollDetail from './PayrollDetail';
import PayrollSettingPage from './PayrollSettingPage';
import AdvancePage from './AdvancePage';

/**
 * ໜ້າຕ່າງ ເງິນເດືອນ — ແຖບຊ້າຍ: ໃບເງິນເດືອນປະຈຳເດືອນ (ລາຍການ → ລາຍລະອຽດ), ເງິນເບີກລ່ວງໜ້າ ແລະ ຕັ້ງຄ່າ (ປກສ, ອາກອນ, ການຫັກ)
 */
const PayrollWindow = () => {
  const t = useT();
  const [activeKey, setActiveKey] = useState(firstRailKey(PAYROLL_MENU));
  const [openId, setOpenId] = useState<number | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const pending = useHrPending();
  // ຕົວເລກສີແດງ = ເບີກເງິນທີ່ລໍຖ້າອະນຸມັດ + ອະນຸມັດແລ້ວລໍຖ້າຈ່າຍ
  const railNav = useMemo(() => toRailNav(PAYROLL_MENU, t).map((item) => ({
    ...item,
    badge: item.key === 'advances' && pending ? pending.advance + pending.advance_to_pay : undefined,
  })), [t, pending]);
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
      ) : activeKey === 'advances' ? (
        <AdvancePage />
      ) : openId ? (
        <PayrollDetail id={openId} onBack={() => setOpenId(null)} onChanged={() => setListVersion((v) => v + 1)} />
      ) : (
        <PayrollList key={listVersion} onOpen={setOpenId} />
      )}
    </AppPage>
  );
};

export default PayrollWindow;
