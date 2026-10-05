import { useMemo, useState } from 'react';
import AppPage from '../../../components/Elements/AppPage';
import { useT } from '../../../context/LanguageContext';
import { PAYABLES_MENU, RECEIVABLES_MENU, firstRailKey, toRailNav } from '../config/SidebarPopup';
import { AR, type Kind } from './arapApi';
import ArApOverview from './ArApOverview';
import DocPage from './DocPage';
import PaymentPage from './PaymentPage';
import PartnerPage from './PartnerPage';
import AgingPage, { PartnerStatement } from './AgingPage';

/**
 * ໜ້າຕ່າງ ລູກໜີ້ (kind 1) / ເຈົ້າໜີ້ (kind 2) — ແຖບຊ້າຍ: ພາບລວມ, ໃບແຈ້ງໜີ້/ໃບບິນ, ຮັບ/ຈ່າຍຊຳລະ, ລູກຄ້າ/ຜູ້ສະໜອງ, ອາຍຸໜີ້.
 * ໃບແຈ້ງຍອດຂອງຄູ່ຄ້າເປີດໄດ້ຈາກທຸກແຖບ
 */
const ArApWindow = ({ kind }: { kind: Kind }) => {
  const t = useT();
  const menu = kind === AR ? RECEIVABLES_MENU : PAYABLES_MENU;
  const [activeKey, setActiveKey] = useState(firstRailKey(menu));
  const railNav = useMemo(() => toRailNav(menu, t), [menu, t]);
  const active = railNav.find((item) => item.key === activeKey);
  const [statement, setStatement] = useState<{ _uuid: number; name: string; partner_code?: string } | null>(null);
  const title = t(kind === AR ? 'accountAppReceivables' : 'accountAppPayables');

  const page = {
    overview: <ArApOverview kind={kind} onStatement={setStatement} />,
    docs: <DocPage kind={kind} />,
    payments: <PaymentPage kind={kind} />,
    partners: <PartnerPage kind={kind} onStatement={setStatement} />,
    aging: <AgingPage kind={kind} onStatement={setStatement} />,
  }[activeKey];

  return (
    <AppPage title={active?.label ?? title} subtitle={title} showHeader={false} railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}>
      {page}
      {statement && <PartnerStatement kind={kind} partner={statement} onClose={() => setStatement(null)} />}
    </AppPage>
  );
};

export default ArApWindow;
