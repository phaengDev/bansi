import { useState, type ReactNode } from 'react';
import { Button, Input, InputGroup, Loader, Modal, NumberInput } from 'rsuite';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import CompanyMap from './CompanyMap';
import { LAT_LNG, MAX_RADIUS, MIN_RADIUS, MAP_SHORT_LINK, fixedCoord, parseCoord, parseLatLng, resolveMapLink, satelliteSnapshot } from './hrApi';
import { getErrorMessage } from '../../utils/useCRUD';

export type CompanyLocationValue = { lat: number | null; lng: number | null; radius: number };

/**
 * ທີ່ຕັ້ງແບບຫຍໍ້ — ຮູບດາວທຽມນິ່ງ (ໝຸດ + ວົງມົນໄລຍະສະແກນ) + ພິກັດ + ໄລຍະ; children = ປຸ່ມຄຳສັ່ງ.
 * ໃຊ້ໃນໜ້າສະແດງຂໍ້ມູນບໍລິສັດ ແລະ ຂັ້ນທີ 3 ຂອງຟອມ — ແຜນທີ່ເຕັມຢູ່ໃນ LocationModal
 */
export const LocationPreview = ({ lat, lng, radius, children }: CompanyLocationValue & { children?: ReactNode }) => {
  const t = useT();
  // ຮູບກວ້າງ 5 ເທົ່າຂອງໄລຍະ (ຢ່າງໜ້ອຍ 250 ແມັດ) — ເຫັນວົງມົນທັງວົງ ແລະ ອ້ອມຂ້າງ
  const width = Math.max(radius * 5, 250);
  const pinned = lat !== null && lng !== null;

  return (
    <div className="hr-loc">
      <span className={`hr-loc-thumb${pinned ? '' : ' is-empty'}`}>
        {pinned ? (
          <>
            <img src={satelliteSnapshot(lat, lng, width)} alt="" loading="lazy" />
            <span className="hr-loc-circle" style={{ width: `${(radius * 2 / width) * 100}%` }} />
            <i className="fa-solid fa-location-dot hr-loc-pin" />
          </>
        ) : (
          <i className="fa-solid fa-map-location-dot" />
        )}
      </span>
      <div className="hr-loc-info">
        {pinned ? (
          <dl>
            <div><dt>{t('hrCompanyCoords')}</dt><dd>{fixedCoord(lat)}, {fixedCoord(lng)}</dd></div>
            <div><dt>{t('hrCompanyRadiusShort')}</dt><dd>{radius} {t('hrMeters')}</dd></div>
          </dl>
        ) : (
          <p className="hr-note is-warn"><i className="fa-solid fa-triangle-exclamation" /> {t('hrCompanyNoLocation')}</p>
        )}
        {children && <div className="hr-loc-actions">{children}</div>}
      </div>
    </div>
  );
};

/**
 * Modal ແຜນທີ່ — ຄົ້ນຫາ, ດາວທຽມ/ແຜນທີ່, ປັກ/ລາກໝຸດ, ຕຳແໜ່ງປັດຈຸບັນ, ພິກັດ ແລະ ໄລຍະສະແກນ.
 * onApply ຄືນ Promise (ບັນທຶກທັນທີ) → ປຸ່ມໝູນລໍຖ້າ; ຜູ້ເອີ້ນປິດ modal ເອງເມື່ອສຳເລັດ
 */
export const LocationModal = ({ value, applyLabel, onClose, onApply }: {
  value: CompanyLocationValue;
  applyLabel: string;
  onClose: () => void;
  onApply: (location: { lat: number; lng: number; radius: number }) => void | Promise<void>;
}) => {
  const t = useT();
  const [latText, setLatText] = useState(value.lat !== null ? fixedCoord(value.lat) : '');
  const [lngText, setLngText] = useState(value.lng !== null ? fixedCoord(value.lng) : '');
  const [radius, setRadius] = useState<number | string>(value.radius);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const lat = parseCoord(latText, 90);
  const lng = parseCoord(lngText, 180);
  const pinned = lat !== null && lng !== null;
  const radiusNumber = Number(radius);
  const radiusOk = Number.isFinite(radiusNumber) && radiusNumber >= MIN_RADIUS && radiusNumber <= MAX_RADIUS;

  const pick = (pickedLat: number, pickedLng: number) => {
    setLatText(fixedCoord(pickedLat));
    setLngText(fixedCoord(pickedLng));
  };

  /** ວາງ "lat, lng" (ສຳເນົາຈາກ Google Maps) ໃສ່ຊ່ອງ latitude → ແຍກໃສ່ທັງສອງຊ່ອງ */
  const changeLat = (text: string) => {
    const pair = text.match(LAT_LNG);
    if (pair) pick(Number(pair[1]), Number(pair[2]));
    else setLatText(text);
  };

  /**
   * ຊ່ອງວາງພິກັດ / ລິ້ງ Google Maps → ປັກໝຸດ ແລະ ລ້າງຊ່ອງ; ຜິດ = ຄ້າງໄວ້ໃຫ້ແກ້ (ຂອບແດງ).
   * ລິ້ງສັ້ນ (Share → Copy link) ບໍ່ມີພິກັດໃນຕົວ → ໃຫ້ api-bansi ຕາມ redirect ຫາລິ້ງເຕັມກ່ອນ
   */
  const applyPasted = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || resolving) return;
    setPasteText(trimmed);
    let point = parseLatLng(trimmed);
    if (!point && MAP_SHORT_LINK.test(trimmed)) {
      try {
        setResolving(true);
        point = await resolveMapLink(trimmed);
      } catch (error) {
        console.error(error);
        setPasteError(true);
        return Notific.error(getErrorMessage(error));
      } finally {
        setResolving(false);
      }
    }
    if (!point) {
      setPasteError(true);
      return Notific.warning('hrCompanyPasteInvalid');
    }
    pick(point.lat, point.lng);
    setPasteText('');
  };

  const pasteClipboard = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return Notific.warning('hrCompanyPasteDenied');
    }
    applyPasted(text);
  };

  /** ຕຳແໜ່ງຂອງເຄື່ອງນີ້ — ຄອມພິວເຕີມັກໃຊ້ Wi-Fi/IP ຈຶ່ງອາດຄາດເຄື່ອນ ໃຫ້ກວດໝຸດໃນແຜນທີ່ອີກເທື່ອ */
  const locate = () => {
    if (!navigator.geolocation) return Notific.warning('hrCompanyLocateUnsupported');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        pick(position.coords.latitude, position.coords.longitude);
        if (position.coords.accuracy > 100) Notific.warning(`${t('hrCompanyLocateInaccurate')} (± ${Math.round(position.coords.accuracy)} m)`);
      },
      (error) => {
        setLocating(false);
        Notific.error(error.code === error.PERMISSION_DENIED ? 'hrCompanyLocateDenied' : 'hrCompanyLocateFailed');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const apply = async () => {
    if (lat === null || lng === null) return Notific.warning('hrCompanyPinRequired');
    if (!radiusOk) return Notific.warning('hrCompanyRadiusRange');
    try {
      setSaving(true);
      await onApply({ lat, lng, radius: Math.round(radiusNumber) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" className="acc-book-modal is-steps hr-map-modal">
      <Modal.Header>
        <div className="acc-book-modal-head">
          <span className="acc-book-modal-icon"><i className="fa-solid fa-map-location-dot" /></span>
          <span>
            <Modal.Title>{t('hrCompanyLocation')}</Modal.Title>
            <small>{t('hrCompanyLocationHint')}</small>
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="acc-book-main">
          <div className="hr-map-wrap">
            <CompanyMap lat={lat} lng={lng} radius={radiusOk ? radiusNumber : value.radius} onPick={pick} />
            <div className="hr-map-bar">
              <span><i className="fa-solid fa-hand-pointer" /> {t(pinned ? 'hrCompanyMapDrag' : 'hrCompanyMapClick')}</span>
              <button type="button" className="acc-rp-btn" disabled={locating} onClick={locate}>
                {locating ? <Loader size="xs" /> : <i className="fa-solid fa-location-crosshairs" />} {t('hrCompanyLocateMe')}
              </button>
            </div>
          </div>

          <div className={`hr-map-paste${pasteError ? ' is-error' : ''}`}>
            <span className="hr-map-paste-icon"><i className="fa-solid fa-map-pin" /></span>
            <div className="hr-map-paste-body">
              <label className="form-label" htmlFor="hr-map-paste-input">{t('hrCompanyPasteCoords')}</label>
              <div className="hr-map-paste-row">
                <InputGroup inside>
                  <InputGroup.Addon>{resolving ? <Loader size="xs" /> : <i className="fa-solid fa-paste" />}</InputGroup.Addon>
                  <Input id="hr-map-paste-input" value={pasteText} disabled={resolving} placeholder={t('hrCompanyPastePlaceholder')}
                    onChange={(next) => {
                      setPasteText(next);
                      setPasteError(false);
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      applyPasted(e.clipboardData.getData('text'));
                    }}
                    onKeyDown={(e) => {
                      // Enter ໃນ modal — ໃຊ້ພິກັດ ບໍ່ submit ຟອມບໍລິສັດ
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      applyPasted(pasteText);
                    }}
                  />
                </InputGroup>
                <button type="button" className="acc-rp-btn is-primary" disabled={resolving} onClick={pasteClipboard}>
                  <i className="fa-solid fa-clipboard" /> {t('hrCompanyPaste')}
                </button>
              </div>
              <small className="hr-field-hint">{t('hrCompanyPasteHint')}</small>
            </div>
          </div>

          <div className="hr-map-fields">
            <div className={`rs-form-group${latText.trim() && lat === null ? ' is-error' : ''}`}>
              <label className="form-label">Latitude</label>
              <Input value={latText} onChange={changeLat} placeholder="17.9757000" />
            </div>
            <div className={`rs-form-group${lngText.trim() && lng === null ? ' is-error' : ''}`}>
              <label className="form-label">Longitude</label>
              <Input value={lngText} onChange={setLngText} placeholder="102.6331000" />
            </div>
            <div className={`rs-form-group${radiusOk ? '' : ' is-error'}`}>
              <label className="form-label">{t('hrCompanyRadius')}</label>
              <NumberInput value={radius} onChange={(next) => setRadius(next ?? '')} min={MIN_RADIUS} max={MAX_RADIUS} step={10}
                postfix={t('hrMeters')}
              />
            </div>
          </div>
          <small className="hr-field-hint">{t('hrCompanyRadiusHint')}</small>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <span className="acc-book-footnote">{pinned ? `${fixedCoord(lat)}, ${fixedCoord(lng)}` : t('hrCompanyMapClick')}</span>
        <Button appearance="default" className="acc-book-btn is-cancel" disabled={saving} onClick={onClose}>{t('cancel')}</Button>
        <Button appearance="primary" className="acc-book-btn is-save" loading={saving} disabled={!pinned || !radiusOk} onClick={apply}>
          <i className="fa-solid fa-check" /> {applyLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
