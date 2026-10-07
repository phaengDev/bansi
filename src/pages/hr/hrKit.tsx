import { useT } from '../../context/LanguageContext';
import { RESIGNED, initialOf, type Bank } from './hrApi';

/** ຮູບພະນັກງານ / ຜູ້ໃຊ້ — ບໍ່ມີຮູບ = ຕົວອັກສອນທຳອິດຂອງຊື່ */
export const HrAvatar = ({ url, name, size = 'md' }: { url?: string | null; name?: string | null; size?: 'sm' | 'md' | 'lg' }) => (
  <span className={`hr-avatar is-${size}`}>
    {url ? <img src={url} alt="" loading="lazy" /> : <b>{initialOf(name)}</b>}
  </span>
);

/** ທະນາຄານໃນ picker — ໂລໂກ້ + ຕົວຫຍໍ້ + ຊື່ (item = option ຈາກ useBanks) */
export const bankLabel = (_: unknown, item: any) => {
  const bank: Bank | undefined = item?.abbr ? item : undefined;
  if (!bank) return null;
  return (
    <span className="acc-xfer-opt hr-bank-opt">
      <span className="acc-xfer-logo">{bank.url ? <img src={bank.url} alt="" /> : <i className="fa-solid fa-building-columns" />}</span>
      <span className="acc-xfer-opt-text">
        <b>{bank.abbr}</b>
        <small>{bank.name_la}</small>
      </span>
    </span>
  );
};

export const WorkStatusPill = ({ status }: { status: number }) => {
  const t = useT();
  const resigned = Number(status) === RESIGNED;
  return (
    <span className={`acs-pill ${resigned ? 'is-muted' : 'is-green'}`}>
      <i className={`fa-solid ${resigned ? 'fa-door-open' : 'fa-briefcase'}`} /> {t(resigned ? 'hrResigned' : 'hrWorking')}
    </span>
  );
};
