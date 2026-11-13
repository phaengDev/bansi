import { useMemo, type ReactNode } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { FIXED_ASSET_MENU, toRailNav } from '../config/SidebarPopup';
import { useRailKey } from '../windowMemory';
import AssetRegister from './AssetRegister';
import DepreciationPage from './DepreciationPage';
import AssetSchedule from './AssetSchedule';

/** ໜ້າຕ່າງ ຊັບສົມບັດຄົງທີ່ — ທະບຽນ, ຄ່າຫຼຸ້ຍຫ້ຽນປະຈຳເດືອນ, ຕາຕະລາງຊັບສົມບັດ */
const FixedAssetWindow = () => {
  const t = useT();
  const railNav = useMemo(() => toRailNav(FIXED_ASSET_MENU, t), [t]);
  const [activeKey, setActiveKey] = useRailKey('fixedAssets', FIXED_ASSET_MENU);
  const active = railNav.find((item) => item.key === activeKey);
  const pages: Record<string, ReactNode> = {
    register: <AssetRegister />,
    depreciation: <DepreciationPage />,
    schedule: <AssetSchedule />,
  };
  return (
    <AppPage title={active?.label ?? t('accountAppFixedAssets')} subtitle={t('accountAppFixedAssets')}
      railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}
    >
      {pages[activeKey] ?? null}
    </AppPage>
  );
};

export default FixedAssetWindow;
