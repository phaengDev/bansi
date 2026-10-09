import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Input, InputGroup, Loader } from 'rsuite';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { LAT_LNG } from './hrApi';

/** ນະຄອນຫຼວງວຽງຈັນ — ຈຸດເລີ່ມຕົ້ນຂອງແຜນທີ່ເມື່ອຍັງບໍ່ໄດ້ປັກໝຸດ */
const VIENTIANE: L.LatLngTuple = [17.9757, 102.6331];

/** ໝຸດແບບ Font Awesome (divIcon) — ບໍ່ໃຊ້ຮູບ marker ຂອງ leaflet ທີ່ bundler ຫາ path ບໍ່ເຫັນ */
const PIN = L.divIcon({
  className: 'hr-map-pin',
  html: '<i class="fa-solid fa-location-dot"></i>',
  iconSize: [32, 40],
  iconAnchor: [16, 38],
});

// ພື້ນແຜນທີ່ — ຟຣີ ບໍ່ຕ້ອງມີ API key (ຕ້ອງສະແດງ attribution): ແຜນທີ່ຖະໜົນ OpenStreetMap,
// ດາວທຽມ Esri World Imagery + ຊັ້ນຊື່ຖະໜົນ/ສະຖານທີ່ຂອງ Esri ທັບເທິງ
const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const ESRI_ATTR = 'Imagery &copy; Esri, Maxar, Earthstar Geographics';
const MAX_ZOOM = 20;

type Base = 'satellite' | 'street';
const BASES: { key: Base; icon: string; label: string }[] = [
  { key: 'satellite', icon: 'fa-satellite', label: 'hrMapSatellite' },
  { key: 'street', icon: 'fa-map', label: 'hrMapStreet' },
];

type Place = { id: number; name: string; detail: string; lat: number; lng: number };

/**
 * ຄົ້ນຫາຊື່ສະຖານທີ່ໃນລາວ — Nominatim (OpenStreetMap, ຟຣີ). ກົດ Enter / ປຸ່ມຄົ້ນຫາເທົ່ານັ້ນ:
 * ນະໂຍບາຍ Nominatim ຫ້າມຄົ້ນຫາທຸກຕົວອັກສອນທີ່ພິມ (autocomplete) ແລະ ຈຳກັດ 1 ຄັ້ງ/ວິນາທີ
 */
const searchPlaces = async (query: string): Promise<Place[]> => {
  const params = new URLSearchParams({ format: 'jsonv2', q: query, limit: '6', countrycodes: 'la', 'accept-language': 'lo,en' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows: any[] = await res.json();
  return rows.map((r) => {
    const parts = String(r.display_name ?? '').split(',').map((p: string) => p.trim());
    return { id: r.place_id, name: r.name || parts[0], detail: parts.slice(1).join(', '), lat: Number(r.lat), lng: Number(r.lon) };
  });
};

type Props = {
  lat: number | null;
  lng: number | null;
  /** ແມັດ — ວົງມົນຂອບເຂດສະແກນ */
  radius: number;
  onPick: (lat: number, lng: number) => void;
};

/**
 * ແຜນທີ່ປັກທີ່ຕັ້ງບໍລິສັດ (Leaflet) — ຄົ້ນຫາຊື່ສະຖານທີ່ / ພິກັດ, ສະຫຼັບ ດາວທຽມ ↔ ແຜນທີ່ຖະໜົນ,
 * ກົດໃສ່ແຜນທີ່ ຫຼື ລາກໝຸດ ເພື່ອປັກ, ວົງມົນສີຂຽວ = ໄລຍະທີ່ສະແກນໄດ້.
 * ລໍ້ເມົາຊູມໄດ້ຫຼັງກົດໃສ່ແຜນທີ່ (ບໍ່ດັ່ງນັ້ນເລື່ອນໜ້າແລ້ວແຜນທີ່ຊູມແທນ)
 */
const CompanyMap = ({ lat, lng, radius, onPick }: Props) => {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<Base, L.Layer> | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  // handler ລ່າສຸດ — listener ຂອງ leaflet ຜູກເທື່ອດຽວຕອນສ້າງແຜນທີ່
  const pickRef = useRef(onPick);
  const startRef = useRef<L.LatLngTuple | null>(lat !== null && lng !== null ? [lat, lng] : null);
  const [base, setBase] = useState<Base>('satellite');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  /** null = ບໍ່ສະແດງລາຍການ, [] = ບໍ່ພົບ */
  const [results, setResults] = useState<Place[] | null>(null);

  useEffect(() => {
    pickRef.current = onPick;
  });

  useEffect(() => {
    const box = boxRef.current!;
    const start = startRef.current;
    const map = L.map(box, { center: start ?? VIENTIANE, zoom: start ? 18 : 13, maxZoom: MAX_ZOOM, scrollWheelZoom: false });
    const esri = (path: string, attribution?: string) =>
      L.tileLayer(`${ESRI}/${path}/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom: 19, maxZoom: MAX_ZOOM, attribution });
    layersRef.current = {
      street: L.tileLayer(OSM, { maxNativeZoom: 19, maxZoom: MAX_ZOOM, attribution: OSM_ATTR }),
      satellite: L.layerGroup([
        esri('World_Imagery', ESRI_ATTR),
        esri('Reference/World_Transportation'),
        esri('Reference/World_Boundaries_and_Places'),
      ]),
    };
    map.on('click', (e: L.LeafletMouseEvent) => {
      pickRef.current(e.latlng.lat, e.latlng.lng);
    });
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    // ໜ້າຕ່າງປ່ຽນຂະໜາດ (ຂະຫຍາຍ/ຫຍໍ້ AppWindow) — ໃຫ້ leaflet ຄິດຂະໜາດໃໝ່ ບໍ່ດັ່ງນັ້ນ tile ຂາດເປັນແຖບເທົາ
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(box);
    mapRef.current = map;
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // ສະຫຼັບພື້ນແຜນທີ່
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    Object.values(layers).forEach((layer) => layer.remove());
    layers[base].addTo(map);
  }, [base]);

  // ໝຸດ + ວົງມົນ ຕາມພິກັດ ແລະ ໄລຍະ; ໝຸດຢູ່ນອກຈໍ (ປ້ອນພິກັດເອງ / ໃຊ້ຕຳແໜ່ງປັດຈຸບັນ) → ເລື່ອນແຜນທີ່ໄປຫາ
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat === null || lng === null) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }
    const at: L.LatLngTuple = [lat, lng];
    if (!markerRef.current) {
      const marker = L.marker(at, { icon: PIN, draggable: true, keyboard: false }).addTo(map);
      marker.on('dragend', () => {
        const point = marker.getLatLng();
        pickRef.current(point.lat, point.lng);
      });
      markerRef.current = marker;
      circleRef.current = L.circle(at, { radius, color: '#16c79a', weight: 2, fillColor: '#16c79a', fillOpacity: 0.15 }).addTo(map);
    } else {
      markerRef.current.setLatLng(at);
      circleRef.current?.setLatLng(at).setRadius(radius);
    }
    if (!map.getBounds().contains(at)) map.setView(at, Math.max(map.getZoom(), 18));
  }, [lat, lng, radius]);

  /** ໄປທີ່ຈຸດ (ຜົນຄົ້ນຫາ / ພິກັດທີ່ພິມ) ແລະ ປັກໝຸດໃຫ້ (ຍ້າຍຕໍ່ໄດ້) */
  const goTo = (toLat: number, toLng: number) => {
    setResults(null);
    mapRef.current?.setView([toLat, toLng], 18);
    pickRef.current(toLat, toLng);
  };

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    const pair = q.match(LAT_LNG);
    if (pair && Math.abs(Number(pair[1])) <= 90 && Math.abs(Number(pair[2])) <= 180) return goTo(Number(pair[1]), Number(pair[2]));
    try {
      setSearching(true);
      setResults(await searchPlaces(q));
    } catch (error) {
      console.error(error);
      Notific.error('hrMapSearchFailed');
    } finally {
      setSearching(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter ໃນຟອມ — ຄົ້ນຫາ ບໍ່ submit ຟອມບໍລິສັດ
    if (e.key === 'Enter') {
      e.preventDefault();
      search();
    }
    if (e.key === 'Escape') setResults(null);
  };

  return (
    <>
      <div className="hr-map-search">
        <InputGroup inside>
          <InputGroup.Addon><i className="fa-solid fa-magnifying-glass" /></InputGroup.Addon>
          <Input value={query} onChange={setQuery} onKeyDown={onKey} placeholder={t('hrMapSearchPlaceholder')} aria-label={t('hrMapSearch')} />
          {query && (
            <InputGroup.Button onClick={() => { setQuery(''); setResults(null); }} aria-label={t('custClear')} title={t('custClear')}>
              <i className="fa-solid fa-xmark" />
            </InputGroup.Button>
          )}
        </InputGroup>
        <button type="button" className="acc-rp-btn hr-map-search-btn" disabled={!query.trim() || searching} onClick={search}>
          {searching ? <Loader size="xs" /> : <i className="fa-solid fa-magnifying-glass" />} {t('hrMapSearch')}
        </button>

        {results && (
          <ul className="hr-map-results" role="listbox">
            {results.length ? results.map((place) => (
              <li key={place.id}>
                <button type="button" onClick={() => goTo(place.lat, place.lng)}>
                  <i className="fa-solid fa-location-dot" />
                  <span>
                    <b>{place.name}</b>
                    {place.detail && <small>{place.detail}</small>}
                  </span>
                </button>
              </li>
            )) : (
              <li className="is-empty"><i className="fa-solid fa-circle-info" /> {t('hrMapNoResult')}</li>
            )}
          </ul>
        )}
      </div>

      <div className="hr-map-stage">
        <div ref={boxRef} className="hr-map" />
        <div className="hr-map-base" role="group" aria-label={t('hrMapBase')}>
          {BASES.map((b) => (
            <button key={b.key} type="button" aria-pressed={base === b.key} className={base === b.key ? 'is-active' : ''} onClick={() => setBase(b.key)}>
              <i className={`fa-solid ${b.icon}`} /> {t(b.label)}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default CompanyMap;
