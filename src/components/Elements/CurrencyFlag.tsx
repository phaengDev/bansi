import type { ReactNode } from 'react';

/**
 * ທຸງຂອງສະກຸນເງິນ — tbl_currency.icon ເກັບເປັນ "flag-LA" (ຫຼື "LA", "fi-la", emoji 🇱🇦); ບໍ່ມີ icon ກໍ່ເດົາຈາກລະຫັດສະກຸນ (LAK → LA).
 * ສະກຸນທີ່ໃຊ້ຫຼາຍໃນລາວ ແຕ້ມເປັນ SVG ໃນຕົວ (ສະແດງຄືກັນທຸກເຄື່ອງ ບໍ່ຕ້ອງໃຊ້ package); ອື່ນໆ ໃຊ້ emoji ທຸງ
 * (Windows ອາດສະແດງເປັນຕົວອັກສອນ 2 ຕົວ)
 */

/** ລະຫັດສະກຸນ → ປະເທດ (ໃຊ້ເມື່ອ icon ຫວ່າງ) */
const COUNTRY_OF_CURRENCY: Record<string, string> = {
  LAK: 'LA', THB: 'TH', USD: 'US', CNY: 'CN', VND: 'VN', EUR: 'EU', JPY: 'JP', KRW: 'KR', GBP: 'GB',
  SGD: 'SG', AUD: 'AU', MYR: 'MY', KHR: 'KH', MMK: 'MM', HKD: 'HK', TWD: 'TW', INR: 'IN', CHF: 'CH',
};

/** "flag-LA" / "fi-la" / "la" → "LA"; ອື່ນ → null */
export const flagCountry = (icon?: string | null, currency?: string | null) => {
  const match = String(icon ?? '').trim().match(/^(?:flag-|fi-|fi\s+fi-)?([a-z]{2})$/i);
  if (match) return match[1].toUpperCase();
  return COUNTRY_OF_CURRENCY[String(currency ?? '').trim().toUpperCase()] ?? null;
};

/** ດາວ 5 ແຈ (ທຸງຈີນ, ຫວຽດນາມ) */
const star = (cx: number, cy: number, r: number, rotate = 0) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? r * 0.382 : r;
    const angle = ((-90 + rotate + i * 36) * Math.PI) / 180;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  });
  return points.join(' ');
};

/** SVG 4:3 (viewBox 20 × 15) ຂອງປະເທດທີ່ແຕ້ມໄວ້ */
const SVG_FLAGS: Record<string, ReactNode> = {
  LA: (
    <>
      <rect width="20" height="15" fill="#ce1126" />
      <rect y="3.75" width="20" height="7.5" fill="#002868" />
      <circle cx="10" cy="7.5" r="3" fill="#fff" />
    </>
  ),
  TH: (
    <>
      <rect width="20" height="15" fill="#a51931" />
      <rect y="2.5" width="20" height="10" fill="#f4f5f8" />
      <rect y="5" width="20" height="5" fill="#2d2a4a" />
    </>
  ),
  US: (
    <>
      <rect width="20" height="15" fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => <rect key={i} y={(i * 2 * 15) / 13} width="20" height={15 / 13} fill="#b22234" />)}
      <rect width="8.4" height={(7 * 15) / 13} fill="#3c3b6e" />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={1.1 + (i % 4) * 2.05} cy={1.25 + Math.floor(i / 4) * 2.75} r="0.42" fill="#fff" />
      ))}
    </>
  ),
  CN: (
    <>
      <rect width="20" height="15" fill="#de2910" />
      <polygon points={star(3.6, 3.6, 2.4)} fill="#ffde00" />
      <polygon points={star(7.2, 1.4, 0.8, 23)} fill="#ffde00" />
      <polygon points={star(8.6, 2.9, 0.8, 45)} fill="#ffde00" />
      <polygon points={star(8.6, 5, 0.8, 0)} fill="#ffde00" />
      <polygon points={star(7.2, 6.4, 0.8, 21)} fill="#ffde00" />
    </>
  ),
  VN: (
    <>
      <rect width="20" height="15" fill="#da251d" />
      <polygon points={star(10, 7.7, 4.6)} fill="#ffff00" />
    </>
  ),
};

/** emoji ທຸງ ຈາກລະຫັດປະເທດ 2 ຕົວ (regional indicator) */
const emojiOf = (country: string) =>
  String.fromCodePoint(...[...country].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

/** ທຸງນ້ອຍເທົ່າຕົວອັກສອນ — ບໍ່ຮູ້ປະເທດ = ບໍ່ສະແດງຫຍັງ (ບໍ່ສະແດງຂໍ້ຄວາມ "flag-XX" ອອກມາ) */
export const CurrencyFlag = ({ icon, currency, className = '' }: { icon?: string | null; currency?: string | null; className?: string }) => {
  const country = flagCountry(icon, currency);
  if (country && SVG_FLAGS[country]) {
    return (
      <svg className={`cur-flag ${className}`} viewBox="0 0 20 15" aria-hidden="true" focusable="false">
        {SVG_FLAGS[country]}
      </svg>
    );
  }
  if (country) return <span className={`cur-flag is-emoji ${className}`} aria-hidden="true">{emojiOf(country)}</span>;
  // ເກັບເປັນ emoji ໄວ້ແລ້ວ — ສະແດງຕາມນັ້ນ
  if (icon && /\p{Regional_Indicator}|\p{Extended_Pictographic}/u.test(icon)) {
    return <span className={`cur-flag is-emoji ${className}`} aria-hidden="true">{icon}</span>;
  }
  return null;
};

export default CurrencyFlag;
