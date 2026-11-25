import { Checkbox } from 'rsuite';
import { useT } from '../../context/LanguageContext';
import { PLAN_MODULES, type ModuleCode } from '../account/companyPlan';
import { withRequired, withoutModule, type PlatformModule } from './platformApi';

/**
 * ຕິກໂມດູນ (ຟອມແພັກເກດ / add-on ຂອງບໍລິສັດ) — ຕິກອັນທີ່ຕ້ອງມີໂມດູນອື່ນ = ຕິກອັນນັ້ນນຳ, ເອົາອອກ = ອັນທີ່ຂຶ້ນກັບມັນອອກນຳ.
 * included = ໂມດູນທີ່ມີຢູ່ແລ້ວ (ເຊັ່ນ ຢູ່ໃນແພັກເກດ) — ສະແດງເປັນຕິກແລ້ວ ກົດບໍ່ໄດ້. ໃຊ້ class ດຽວກັບຕາຕະລາງສິດເມນູ (hr-menu-*)
 */
export const ModulePicker = ({ modules, value, onChange, included = [], disabled }: {
  modules: PlatformModule[];
  value: ModuleCode[];
  onChange: (next: ModuleCode[]) => void;
  included?: ModuleCode[];
  disabled?: boolean;
}) => {
  const t = useT();
  const known = new Set(modules.map((m) => m.code));
  const toggle = (code: ModuleCode, on: boolean) =>
    onChange(on ? withRequired([...value, code], modules).filter((c) => !included.includes(c)) : withoutModule(value, code, modules));

  return (
    <div className="is-wide hr-menu-access plat-modules">
      <div className="hr-menu-grid">
        {PLAN_MODULES.filter((m) => known.has(m.code)).map((m) => {
          const inPackage = included.includes(m.code);
          const on = inPackage || value.includes(m.code);
          const needs = modules.find((x) => x.code === m.code)?.requires ?? [];
          return (
            <Checkbox key={m.code} checked={on} disabled={disabled || inPackage}
              className={`hr-menu-pick${on ? ' is-on' : ''}`}
              onChange={(_, checked) => toggle(m.code, checked)}
            >
              <span className={`hr-menu-icon is-${m.tone}`}><i className={`fa-solid ${m.icon}`} /></span>
              <span className="hr-menu-name">
                {t(m.label)}
                {inPackage
                  ? <small className="plat-module-note">{t('platInPackage')}</small>
                  : needs.length > 0 && <small className="plat-module-note">{t('platNeeds')} {needs.map((code) => t(PLAN_MODULES.find((x) => x.code === code)?.label ?? code)).join(', ')}</small>}
              </span>
            </Checkbox>
          );
        })}
      </div>
    </div>
  );
};

/** ຈຳນວນທີ່ໃຊ້ / ສູງສຸດ (ຕາຕະລາງບໍລິສັດ) — ເຕັມ = ສີແດງ */
export const SeatCount = ({ used, limit }: { used: number; limit: number | null }) => (
  <span className={`plat-seats${limit !== null && used >= limit ? ' is-full' : ''}`}>
    <b>{used}</b>
    <small>/ {limit ?? '∞'}</small>
  </span>
);
