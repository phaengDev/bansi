import { useCallback, useState } from 'react';
import { useT } from '../../context/LanguageContext';

/** ວິທີສະແດງໜຶ່ງອັນ — label ເປັນ key ຂອງພາສາ */
export type ViewOption<T extends string> = { key: T; icon: string; label: string };

/**
 * ວິທີສະແດງທີ່ເລືອກ — ຈື່ໄວ້ໃນເຄື່ອງນີ້ (localStorage) ຕໍ່ໜ້າ. storage ປິດ ຫຼື ຄ່າທີ່ເກັບບໍ່ຢູ່ໃນລາຍການ = fallback
 * ໃຊ້ຮ່ວມ: ເງິນສົດ ແລະ ທະນາຄານ (ບັດ / ພາບລວມ / ກຣາບ), ໂຄງຮ່າງອົງກອນ, ໃບເງິນເດືອນ (ປຶ້ມ / ພາບລວມປີ)
 */
export const useSavedView = <T extends string>(storageKey: string, views: readonly ViewOption<T>[], fallback: T) => {
  const [view, setView] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return views.some((v) => v.key === saved) ? (saved as T) : fallback;
    } catch {
      return fallback;
    }
  });
  const pick = useCallback((next: T) => {
    setView(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // storage ປິດ — ຈື່ສະເພາະຄັ້ງນີ້
    }
  }, [storageKey]);
  return [view, pick] as const;
};

/** ປຸ່ມສະຫຼັບວິທີສະແດງ (ແຖບປຸ່ມຕິດກັນ ໄອຄອນ + ຊື່) — ແບບດຽວກັນທຸກໜ້າ */
const ViewSwitch = <T extends string>({ views, value, onChange, label, className = '' }: {
  views: readonly ViewOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** ຊື່ກຸ່ມປຸ່ມສຳລັບໂປຣແກຣມອ່ານໜ້າຈໍ (key ຂອງພາສາ) */
  label?: string;
  className?: string;
}) => {
  const t = useT();
  return (
    <div className={`acc-type-segment acc-view-switch ${className}`} role="tablist" aria-label={label ? t(label) : undefined}>
      {views.map((v) => (
        <button key={v.key} type="button" role="tab" aria-selected={value === v.key}
          className={value === v.key ? 'is-active' : ''} onClick={() => onChange(v.key)}
        >
          <i className={`fa-solid ${v.icon}`} /> {t(v.label)}
        </button>
      ))}
    </div>
  );
};

export default ViewSwitch;
