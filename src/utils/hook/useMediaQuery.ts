import { useEffect, useState } from "react";

/** ຈຸດຫັກຂອງໜ້າຈໍ — ຕາມ Bootstrap 5 (sm / md / lg) */
export const MOBILE_QUERY = "(max-width: 575.98px)";
export const TABLET_QUERY = "(max-width: 767.98px)";
export const DESKTOP_QUERY = "(min-width: 992px)";

/**
 * ຕິດຕາມ media query ແບບ reactive — ຄ່າຈະປ່ຽນເມື່ອປ່ຽນຂະໜາດຈໍ ຫຼື ໝຸນເຄື່ອງ
 * (ຕ່າງຈາກການອ່ານ `window.innerWidth` ເທື່ອດຽວ ທີ່ບໍ່ອັບເດດ)
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** true ເມື່ອຄວາມກວ້າງຢູ່ໃນລະດັບໂທລະສັບ (≤ 575.98px) */
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);

/** true ເມື່ອຄວາມກວ້າງຢູ່ໃນລະດັບແທັບເລັດລົງມາ (≤ 767.98px) */
export const useIsTablet = () => useMediaQuery(TABLET_QUERY);

/** true ເມື່ອຢູ່ລະດັບ desktop (≥ 992px) — ບ່ອນທີ່ `col-lg-*` ແຍກເປັນ 2 ຖັນ */
export const useIsDesktop = () => useMediaQuery(DESKTOP_QUERY);
