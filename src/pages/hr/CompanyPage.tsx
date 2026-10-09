import { useCallback, useEffect, useState, useRef, type ChangeEvent } from 'react';
import { Button, Form, Loader, Schema, TimePicker } from 'rsuite';
import type { FormInstance } from 'rsuite';
import moment from 'moment';
import { getApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { InputField } from '../../utils/inputFields';
import { canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { useDistricts, useProvinces } from '../../utils/selectOption';
import { FormStep, PickerField } from '../account/setting/settingKit';
import { MAX_FILE, type Company } from './hrApi';
import { LocationModal, LocationPreview, type CompanyLocationValue } from './CompanyLocation';

const { StringType } = Schema.Types;
const IMAGE = /^image\/(jpeg|png|webp)$/;
/** ຈັນ → ອາທິດ (ຄ່າ = Date.getDay(), ກົງກັບ days_off ຂອງ backend) */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

const toTime = (value: string | undefined, fallback: string) => moment(value || fallback, 'HH:mm').toDate();
const toHHmm = (value: Date | null | undefined) => (value ? moment(value).format('HH:mm') : '');
/** ຊົ່ວໂມງເຮັດວຽກຕໍ່ວັນ ຈາກ "HH:mm" (ອອກກ່ອນເຂົ້າ = 0) */
const workHours = (start: string, end: string) =>
  start && end && end > start ? Number((moment(end, 'HH:mm').diff(moment(start, 'HH:mm'), 'minutes') / 60).toFixed(1)) : 0;

type CompanyValues = Pick<Company, 'name_la' | 'name_en' | 'phone1' | 'phone2' | 'district_id' | 'village' | 'latitude'
  | 'longitude' | 'scan_radius' | 'work_start' | 'work_end' | 'days_off'>;

/** body ຂອງ PUT /company (multipart) — ໂລໂກ້ຕື່ມເອງ (ບໍ່ສົ່ງ = backend ບໍ່ແຕະໂລໂກ້) */
const companyBody = (v: CompanyValues) => {
  const body = new FormData();
  const text = (value: unknown) => String(value ?? '').trim();
  body.append('name_la', text(v.name_la));
  body.append('name_en', text(v.name_en));
  body.append('phone1', text(v.phone1));
  body.append('phone2', text(v.phone2));
  body.append('district_id', v.district_id ? String(v.district_id) : '');
  body.append('village', text(v.village));
  body.append('latitude', v.latitude === null ? '' : String(v.latitude));
  body.append('longitude', v.longitude === null ? '' : String(v.longitude));
  body.append('scan_radius', String(v.scan_radius));
  body.append('work_start', v.work_start);
  body.append('work_end', v.work_end);
  body.append('days_off', v.days_off.join(','));
  return body;
};

const googleMapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** ຊ່ອງທີ່ຕ້ອງສົ່ງ prop ຂອງ accepter ຕໍ່ (hideMinutes ຂອງ TimePicker) — InputField ບໍ່ຮັບ */
const ControlField = ({ name, label, ...rest }: { name: string; label: string } & Record<string, any>) => (
  <Form.Group controlId={`${name}-1`}>
    <Form.Label className="form-label">{label}</Form.Label>
    <Form.Control name={name} {...rest} />
  </Form.Group>
);

/** ໂລໂກ້ — ກ່ອງສີ່ຫຼ່ຽມມົນ (ໃຊ້ໂຄງຂອງຮູບພະນັກງານ), ກົດເພື່ອເລືອກ / ປ່ຽນ, × ລຶບ */
const LogoPicker = ({ url, onPick, onClear }: {
  url: string | null | undefined;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) => {
  const t = useT();
  return (
    <div className="hr-photo-pick">
      <div className="hr-photo-frame">
        <label className={`hr-photo-circle is-logo${url ? ' has-photo' : ''}`} title={t(url ? 'hrPhotoChange' : 'hrCompanyLogoPick')}>
          {url ? (
            <>
              <img src={url} alt="" />
              <span className="hr-photo-overlay"><i className="fa-solid fa-camera" /> {t('hrPhotoChange')}</span>
            </>
          ) : (
            <span className="hr-photo-empty">
              <i className="fa-solid fa-building" />
              <b>{t('hrCompanyLogoPick')}</b>
            </span>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />
        </label>
        {url && (
          <button type="button" className="hr-photo-clear" title={t('hrPhotoRemove')} aria-label={t('hrPhotoRemove')} onClick={onClear}>
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>
      <small>JPG, PNG, WEBP · ≤ 5MB</small>
    </div>
  );
};

/** ວັນໃນອາທິດ — ຂຽວ = ມື້ເຮັດວຽກ, ສົ້ມ = ວັນພັກ; onToggle = ກົດສະຫຼັບໄດ້ (ຟອມ) */
const WeekDays = ({ daysOff, onToggle }: { daysOff: number[]; onToggle?: (day: number) => void }) => {
  const t = useT();
  return (
    <div className={`hr-days${onToggle ? '' : ' is-static'}`} role="group" aria-label={t('hrCompanyDaysOff')}>
      {WEEK.map((day) => {
        const off = daysOff.includes(day);
        const content = (
          <>
            <i className={`fa-solid ${off ? 'fa-mug-hot' : 'fa-briefcase'}`} />
            <span>
              <b>{t(`weekday${day}`)}</b>
              <small>{t(off ? 'hrCompanyDayOff' : 'hrCompanyWorkday')}</small>
            </span>
          </>
        );
        return onToggle ? (
          <button key={day} type="button" aria-pressed={off} className={off ? 'is-off' : ''} onClick={() => onToggle(day)}>{content}</button>
        ) : (
          <span key={day} className={off ? 'is-off' : ''}>{content}</span>
        );
      })}
    </div>
  );
};

/** ຟອມແກ້ໄຂ — ສະແດງຫຼັງກົດ "ແກ້ໄຂ" (ຫຼື ທັນທີຖ້າຍັງບໍ່ເຄີຍບັນທຶກ); onCancel = ກັບໄປໜ້າສະແດງຂໍ້ມູນ */
const CompanyForm = ({ data, onSaved, onCancel }: {
  data: Company | null;
  onSaved: (company: Company) => void;
  onCancel?: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const provinces = useProvinces();
  const [saving, setSaving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [daysOff, setDaysOff] = useState<number[]>(data?.days_off ?? [6, 0]);
  const [location, setLocation] = useState<CompanyLocationValue>({
    lat: data?.latitude ?? null,
    lng: data?.longitude ?? null,
    radius: data?.scan_radius ?? 50,
  });
  const [inputs, setInputs] = useState<any>({
    name_la: data?.name_la ?? '',
    name_en: data?.name_en ?? '',
    phone1: data?.phone1 ?? '',
    phone2: data?.phone2 ?? '',
    // ແຂວງບໍ່ໄດ້ບັນທຶກ — ໃຊ້ກັ່ນລາຍການເມືອງເທົ່ານັ້ນ (ເອົາມາຈາກເມືອງທີ່ບັນທຶກໄວ້)
    province_id: data?.district?.province_id ?? null,
    district_id: data?.district_id ?? null,
    village: data?.village ?? '',
    work_start: toTime(data?.work_start, '08:00'),
    work_end: toTime(data?.work_end, '17:00'),
  });
  const districts = useDistricts(inputs.province_id);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const model = Schema.Model<any>({
    name_la: StringType().isRequired(t('inputRequired')),
  });

  /** ປ່ຽນແຂວງ → ລ້າງເມືອງ */
  const handleChange = (next: any) => {
    if (next.province_id !== inputs.province_id) next = { ...next, district_id: null };
    setInputs(next);
  };

  const toggleDay = (day: number) => {
    if (daysOff.includes(day)) return setDaysOff(daysOff.filter((d) => d !== day));
    if (daysOff.length >= 6) return Notific.warning('hrCompanyNeedWorkday');
    setDaysOff([...daysOff, day]);
  };

  const pickLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!IMAGE.test(file.type)) return Notific.warning('hrPhotoType');
    if (file.size > MAX_FILE) return Notific.warning('incomeFileSize');
    setLogo(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setLogo(null);
    setPreview(null);
    if (data?.logo_url) setRemoveLogo(true);
  };

  const start = toHHmm(inputs.work_start);
  const end = toHHmm(inputs.work_end);
  const hours = workHours(start, end);
  const pinned = location.lat !== null && location.lng !== null;

  const submit = async () => {
    if (!formRef.current?.check()) return;
    // ແຂວງບໍ່ໄດ້ບັນທຶກແຍກ — ເລືອກແຂວງແລ້ວຕ້ອງເລືອກເມືອງນຳ ບໍ່ດັ່ງນັ້ນແຂວງຈະຫາຍ
    if (inputs.province_id && !inputs.district_id) return Notific.warning('hrCompanyDistrictRequired');
    if (!start || !end || end <= start) return Notific.warning('hrCompanyTimeOrder');
    const body = companyBody({
      name_la: inputs.name_la,
      name_en: inputs.name_en,
      phone1: inputs.phone1,
      phone2: inputs.phone2,
      district_id: inputs.district_id,
      village: inputs.village,
      latitude: location.lat,
      longitude: location.lng,
      scan_radius: location.radius,
      work_start: start,
      work_end: end,
      days_off: daysOff,
    });
    if (logo) body.append('logo', logo);
    if (removeLogo && !logo) body.append('remove_logo', '1');
    try {
      setSaving(true);
      const res = await putApi('/company', body);
      Notific.success('saveSuccessDone');
      if (res.data?.data) onSaved(res.data.data);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const logoUrl = preview ?? (removeLogo ? null : data?.logo_url);

  return (
    <>
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={handleChange} className="acc-book-main">
        {/* ---- 1: ໂລໂກ້ + ຊື່ + ເບີໂທ ---- */}
        <FormStep no={1} done={!!String(inputs.name_la).trim()} title={t('hrCompanyInfo')} hint={t('hrCompanyInfoHint')}>
          <div className="is-wide hr-profile">
            <LogoPicker url={logoUrl} onPick={pickLogo} onClear={clearLogo} />
            <div className="hr-profile-fields">
              <div className="is-wide">
                <InputField name="name_la" label={t('hrCompanyNameLa')} icon={<i className="fa-solid fa-building" />} placeholder="ບໍລິສັດ … ຈຳກັດ" />
              </div>
              <div className="is-wide">
                <InputField name="name_en" label={t('hrCompanyNameEn')} required={false} icon={<i className="fa-solid fa-globe" />}
                  placeholder="… Co., Ltd."
                />
              </div>
              <InputField name="phone1" label={t('hrCompanyPhone1')} required={false} icon={<i className="fa-solid fa-phone" />} placeholder="021 xxx xxx" />
              <InputField name="phone2" label={t('hrCompanyPhone2')} required={false} icon={<i className="fa-solid fa-mobile-screen" />} placeholder="020 xxxx xxxx" />
            </div>
          </div>
        </FormStep>

        {/* ---- 2: ທີ່ຢູ່ (ບັນທຶກແຕ່ເມືອງ + ບ້ານ) ---- */}
        <FormStep no={2} done={!!inputs.district_id} title={t('hrAddress')} hint={t('hrAddressHint')}>
          <PickerField name="province_id" label={t('hrProvince')} data={provinces} required={false} placeholder={t('select')} />
          <PickerField name="district_id" label={t('hrDistrict')} data={districts} required={!!inputs.province_id}
            placeholder={inputs.province_id ? t('select') : t('hrPickProvinceFirst')} disabled={!inputs.province_id}
          />
          <div className="is-wide">
            <InputField name="village" label={t('hrVillage')} required={false} icon={<i className="fa-solid fa-location-dot" />} />
          </div>
        </FormStep>

        {/* ---- 3: ທີ່ຕັ້ງ + ໄລຍະສະແກນ — ແກ້ໃນ modal ແຜນທີ່ ---- */}
        <FormStep no={3} done={pinned} title={t('hrCompanyLocation')} hint={t('hrCompanyLocationHint')}
          note={pinned ? <><i className="fa-solid fa-circle-dot" /> {t('hrCompanyRadiusNote')} {location.radius} {t('hrMeters')}</> : undefined}
        >
          <div className="is-wide">
            <LocationPreview {...location}>
              <button type="button" className="acc-rp-btn is-primary" onClick={() => setMapOpen(true)}>
                <i className="fa-solid fa-map-location-dot" /> {t(pinned ? 'hrCompanyEditLocation' : 'hrCompanyPickOnMap')}
              </button>
            </LocationPreview>
          </div>
        </FormStep>

        {/* ---- 4: ເວລາເຮັດວຽກ + ວັນພັກ ---- */}
        <FormStep no={4} done={hours > 0} title={t('hrCompanyWorkTime')} hint={t('hrCompanyWorkTimeHint')}
          note={hours > 0 ? <><i className="fa-solid fa-clock" /> {7 - daysOff.length} {t('hrCompanyDaysPerWeek')} · {hours} {t('hrCompanyHoursPerDay')}</> : undefined}
        >
          <ControlField name="work_start" label={t('hrCompanyWorkStart')} accepter={TimePicker} format="HH:mm" block cleanable={false}
            hideMinutes={(minute: number) => minute % 5 !== 0}
          />
          <ControlField name="work_end" label={t('hrCompanyWorkEnd')} accepter={TimePicker} format="HH:mm" block cleanable={false}
            hideMinutes={(minute: number) => minute % 5 !== 0}
          />
          <div className="is-wide rs-form-group">
            <label className="form-label">{t('hrCompanyDaysOff')}</label>
            <WeekDays daysOff={daysOff} onToggle={toggleDay} />
          </div>
        </FormStep>

        <div className="hr-company-bar">
          <span>
            {data?.updatedAt
              ? <><i className="fa-regular fa-clock" /> {t('hrCompanyUpdated')} {moment(data.updatedAt).format('DD/MM/YYYY HH:mm')}</>
              : <><i className="fa-solid fa-circle-info" /> {t('hrCompanyNotSet')}</>}
          </span>
          <span className="hr-company-actions">
            {onCancel && <Button appearance="default" className="hr-company-cancel" disabled={saving} onClick={onCancel}>{t('cancel')}</Button>}
            <Button appearance="primary" className="hr-company-save" loading={saving} onClick={submit}>
              <i className="fa-solid fa-check" /> {t('save')}
            </Button>
          </span>
        </div>
      </Form>

      {mapOpen && (
        <LocationModal value={location} applyLabel={t('ok')} onClose={() => setMapOpen(false)}
          onApply={(next) => {
            setLocation(next);
            setMapOpen(false);
          }}
        />
      )}
    </>
  );
};

/** ໜ້າສະແດງຂໍ້ມູນບໍລິສັດ (ບໍ່ແມ່ນຟອມ) — ກົດ "ແກ້ໄຂ" ຈຶ່ງເປີດຟອມ; ທີ່ຕັ້ງແກ້ໃນ modal ແຜນທີ່ ແລ້ວບັນທຶກທັນທີ */
const CompanyView = ({ company, onEdit, onSaved }: { company: Company; onEdit: () => void; onSaved: (company: Company) => void }) => {
  const t = useT();
  const [mapOpen, setMapOpen] = useState(false);
  const address = [company.village, company.district?.district_name, company.district?.province?.province_name].filter(Boolean).join(', ');
  const phones = [company.phone1, company.phone2].filter((phone): phone is string => !!phone);
  const { latitude: lat, longitude: lng } = company;
  const hours = workHours(company.work_start, company.work_end);

  const saveLocation = async (next: { lat: number; lng: number; radius: number }) => {
    try {
      const res = await putApi('/company', companyBody({ ...company, latitude: next.lat, longitude: next.lng, scan_radius: next.radius }));
      Notific.success('saveSuccessDone');
      setMapOpen(false);
      if (res.data?.data) onSaved(res.data.data);
    } catch (error) {
      console.error(error);
      Notific.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <section className="hr-company-hero">
        <span className="hr-company-logo">
          {company.logo_url ? <img src={company.logo_url} alt="" /> : <i className="fa-solid fa-building" />}
        </span>
        <div className="hr-company-title">
          <h2>{company.name_la}</h2>
          {company.name_en && <p>{company.name_en}</p>}
          <small><i className="fa-solid fa-location-dot" /> {address || t('hrCompanyNoAddress')}</small>
          {phones.length > 0 && (
            <small className="hr-company-phones">
              <i className="fa-solid fa-phone" />
              {phones.map((phone) => <a key={phone} href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>)}
            </small>
          )}
        </div>
        <Button appearance="primary" className="hr-company-save" disabled={!canEdit} onClick={onEdit}>
          <i className="fa-solid fa-pen" /> {t('edit')}
        </Button>
      </section>

      <section className="acc-book-step hr-company-card">
        <header>
          <span className="hr-company-card-icon"><i className="fa-solid fa-map-location-dot" /></span>
          <span className="acc-book-step-title"><b>{t('hrCompanyLocation')}</b><small>{t('hrCompanyLocationHint')}</small></span>
        </header>
        <LocationPreview lat={lat} lng={lng} radius={company.scan_radius}>
          {canEdit && (
            <button type="button" className="acc-rp-btn is-primary" onClick={() => setMapOpen(true)}>
              <i className="fa-solid fa-map-location-dot" /> {t(lat !== null ? 'hrCompanyEditLocation' : 'hrCompanyPickOnMap')}
            </button>
          )}
          {lat !== null && lng !== null && (
            <a className="acc-rp-btn" href={googleMapsUrl(lat, lng)} target="_blank" rel="noreferrer">
              <i className="fa-solid fa-arrow-up-right-from-square" /> {t('hrCompanyOpenGoogle')}
            </a>
          )}
        </LocationPreview>
      </section>

      <section className="acc-book-step hr-company-card">
        <header>
          <span className="hr-company-card-icon"><i className="fa-solid fa-clock" /></span>
          <span className="acc-book-step-title"><b>{t('hrCompanyWorkTime')}</b></span>
          <em><i className="fa-solid fa-briefcase" /> {7 - company.days_off.length} {t('hrCompanyDaysPerWeek')} · {hours} {t('hrCompanyHoursPerDay')}</em>
        </header>
        <div className="hr-company-hours">
          <div><small>{t('hrCompanyWorkStart')}</small><b>{company.work_start}</b></div>
          <i className="fa-solid fa-arrow-right-long" />
          <div><small>{t('hrCompanyWorkEnd')}</small><b>{company.work_end}</b></div>
        </div>
        <WeekDays daysOff={company.days_off} />
      </section>

      <p className="hr-company-updated">
        <i className="fa-regular fa-clock" /> {t('hrCompanyUpdated')} {moment(company.updatedAt).format('DD/MM/YYYY HH:mm')}
      </p>

      {mapOpen && (
        <LocationModal value={{ lat, lng, radius: company.scan_radius }} applyLabel={t('save')}
          onClose={() => setMapOpen(false)} onApply={saveLocation}
        />
      )}
    </>
  );
};

/**
 * ຂໍ້ມູນບໍລິສັດ — ຊື່ ລາວ/ອັງກິດ, ໂລໂກ້, ທີ່ຢູ່, ທີ່ຕັ້ງ + ໄລຍະສະແກນເຂົ້າ-ອອກວຽກ,
 * ເວລາເຂົ້າ-ອອກວຽກ ແລະ ວັນພັກປະຈຳອາທິດ (GET/PUT /company, ແຖວດຽວ).
 * ບັນທຶກແລ້ວ = ໜ້າສະແດງຂໍ້ມູນ, ກົດແກ້ໄຂ = ຟອມ; ຍັງບໍ່ເຄີຍບັນທຶກ = ຟອມທັນທີ (ສະເພາະຜູ້ມີສິດແກ້ໄຂ)
 */
const CompanyPage = () => {
  const t = useT();
  // undefined = ກຳລັງໂຫຼດ, null = ຍັງບໍ່ໄດ້ຕັ້ງ
  const [company, setCompany] = useState<Company | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getApi('/company');
      setCompany(res.data?.data ?? null);
      setFailed(false);
    } catch (error) {
      console.error(error);
      setFailed(true);
      Notific.error(getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) {
    return (
      <div className="acc-arap-empty">
        <button type="button" className="acc-rp-btn" onClick={load}><i className="fa-solid fa-rotate-right" /> {t('reload')}</button>
      </div>
    );
  }
  if (company === undefined) return <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>;
  if (!company && !canEdit) return <p className="acc-arap-empty">{t('hrCompanyNotSet')}</p>;

  const saved = (next: Company) => {
    setCompany(next);
    setEditing(false);
  };

  return (
    <div className="acs-page hr-company">
      {company && !editing
        ? <CompanyView company={company} onEdit={() => setEditing(true)} onSaved={saved} />
        : <CompanyForm data={company} onCancel={company ? () => setEditing(false) : undefined} onSaved={saved} />}
    </div>
  );
};

export default CompanyPage;
