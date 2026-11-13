import { useMemo, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { CLOSING_MENU, toRailNav, withFeatures } from '../config/SidebarPopup';
import { useRailKey } from '../windowMemory';
import { featureOn, useAccountSetting } from '../accountSettings';
import PeriodClosePage from './PeriodClosePage';
import BankRecPage from './BankRecPage';
import FxRevalPage from './FxRevalPage';
import ProfitTaxPage from './ProfitTaxPage';
import WithholdingPage from './WithholdingPage';

/**
 * ໜ້າຕ່າງ ປິດງວດບັນຊີ — ວຽກທ້າຍເດືອນ/ທ້າຍປີ ຕາມກົດໝາຍບັນຊີ ມາດຕາ 23: ປິດງວດ (ລາຍການກວດ + ລັອກ), ກະທົບຍອດທະນາຄານ,
 * ປັບມູນຄ່າເງິນຕາຕ່າງປະເທດ, ອາກອນກຳໄລ ແລະ ອາກອນຫັກ ນ ທີ່ຈ່າຍ. ແຖບທີ່ບໍລິສັດປິດຟັງຊັນໄວ້ບໍ່ຂຶ້ນ
 */
const ClosingWindow = () => {
  const t = useT();
  const setting = useAccountSetting();
  const menu = useMemo(() => withFeatures(CLOSING_MENU, (f) => featureOn(setting, f)), [setting]);
  const railNav = useMemo(() => toRailNav(menu, t), [menu, t]);
  const [savedKey, setActiveKey] = useRailKey('closing', CLOSING_MENU);
  const activeKey = railNav.some((item) => item.key === savedKey) ? savedKey : railNav[0]?.key ?? 'periodClose';
  const active = railNav.find((item) => item.key === activeKey);

  const pages: Record<string, ReactNode> = {
    periodClose: <PeriodClosePage onOpen={setActiveKey} />,
    bankRec: <BankRecPage />,
    fxReval: <FxRevalPage />,
    profitTax: <ProfitTaxPage />,
    withholding: <WithholdingPage />,
  };

  return (
    <AppPage title={active?.label ?? t('accountAppClosing')} subtitle={t('accountAppClosing')}
      railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}
    >
      {pages[activeKey] ?? null}
    </AppPage>
  );
};

export default ClosingWindow;
