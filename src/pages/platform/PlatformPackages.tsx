import { useRef, useState } from 'react';
import { Form, NumberInput, Textarea } from 'rsuite';
import type { FormInstance } from 'rsuite';
import { formatNumber, postApi, putApi } from '../../utils/configApi';
import { InputField } from '../../utils/inputFields';
import { createModel, requiredField } from '../../utils/validate';
import { useT } from '../../context/LanguageContext';
import { FormStep, ListState, MetaChip, SettingModal, SettingToolbar, ToggleField } from '../account/setting/settingKit';
import { runSave } from '../account/setting/settingApi';
import { amountFormatter } from '../account/gl/glKit';
import { PLAN_MODULES, type ModuleCode } from '../account/companyPlan';
import { ModulePicker } from './platformKit';
import { numberOrNull, type PlatformCompany, type PlatformModule, type PlatformPackage } from './platformApi';

/** ຟອມແພັກເກດ 3 ຂັ້ນ: ຊື່, ໂມດູນ, ຈຳນວນ + ລາຄາ — ແກ້ແລ້ວທຸກບໍລິສັດທີ່ຖືແພັກເກດນີ້ຕາມທັນທີ */
const PackageForm = ({ data, modules, companies, onClose, onSaved }: {
  data: PlatformPackage | null;
  modules: PlatformModule[];
  companies: number;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const t = useT();
  const formRef = useRef<FormInstance>(null);
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<ModuleCode[]>(data?.modules ?? ['accounting']);
  const [active, setActive] = useState(data ? Number(data.status) === 1 : true);
  const [inputs, setInputs] = useState<any>({
    code: data?.code ?? '',
    name_la: data?.name_la ?? '',
    name_en: data?.name_en ?? '',
    description: data?.description ?? '',
    max_users: data?.max_users ?? '',
    max_employees: data?.max_employees ?? '',
    price_month: data?.price_month ?? '',
    price_year: data?.price_year ?? '',
    sort: data?.sort ?? '',
  });
  const model = createModel<any>({
    code: requiredField(t('inputRequired'), 'string'),
    name_la: requiredField(t('inputRequired'), 'string'),
  });

  const submit = async () => {
    if (!formRef.current?.check()) return;
    const body = {
      code: String(inputs.code).trim().toUpperCase(),
      name_la: String(inputs.name_la).trim(),
      name_en: String(inputs.name_en ?? '').trim(),
      description: String(inputs.description ?? '').trim(),
      modules: picked,
      max_users: numberOrNull(inputs.max_users),
      max_employees: numberOrNull(inputs.max_employees),
      price_month: numberOrNull(inputs.price_month),
      price_year: numberOrNull(inputs.price_year),
      sort: Number(inputs.sort) || 0,
      status: active ? 1 : 0,
    };
    if (await runSave(() => (data ? putApi(`/platform/package/${data._uuid}`, body) : postApi('/platform/package', body)), setSaving)) {
      onSaved();
      onClose();
    }
  };

  return (
    <SettingModal title={t(data ? 'platPackageEdit' : 'platPackageAdd')} hint={data && companies ? t('platPackageLive').replace('{n}', String(companies)) : t('platPackageHint')}
      icon="fa-box-open" saving={saving} onClose={onClose} onSubmit={submit} className="is-steps" keyboard={false} wide
    >
      <Form fluid ref={formRef} model={model} formValue={inputs} onChange={setInputs}>
        <FormStep no={1} done={!!String(inputs.name_la).trim() && !!String(inputs.code).trim()} title={t('platStepName')} hint={t('platStepNameHint')}>
          <InputField name="code" label={t('platPackageCode')} icon={<i className="fa-solid fa-hashtag" />} placeholder="BASIC" />
          <InputField name="name_la" label={t('platPackageName')} icon={<i className="fa-solid fa-box" />} />
          <InputField name="name_en" label={t('platPackageNameEn')} required={false} icon={<i className="fa-solid fa-language" />} />
          <ToggleField label={t('status')} checked={active} onChange={setActive} onText={t('platOnSale')} offText={t('platRetired')} />
          <div className="is-wide">
            <InputField name="description" label={t('platPackageDesc')} accepter={Textarea} rows={2} required={false} />
          </div>
        </FormStep>

        <FormStep no={2} done={picked.length > 0} title={t('platStepModules')} hint={t('platStepModulesHint')}
          note={`${picked.length} / ${modules.length}`}
        >
          <ModulePicker modules={modules} value={picked} onChange={setPicked} />
        </FormStep>

        <FormStep no={3} done={inputs.price_month !== '' || inputs.price_year !== ''} title={t('platStepPrice')} hint={t('platStepPriceHint')}>
          <InputField name="price_month" label={t('platPriceMonth')} accepter={NumberInput} required={false} formatter={amountFormatter}
            controls={false} prefix="₭" placeholder={t('platPriceUnset')}
          />
          <InputField name="price_year" label={t('platPriceYear')} accepter={NumberInput} required={false} formatter={amountFormatter}
            controls={false} prefix="₭" placeholder={t('platPriceUnset')}
          />
          <InputField name="max_users" label={t('platMaxUsers')} accepter={NumberInput} required={false} controls={false} placeholder={t('planUnlimited')} />
          <InputField name="max_employees" label={t('platMaxEmployees')} accepter={NumberInput} required={false} controls={false} placeholder={t('planUnlimited')} />
          <InputField name="sort" label={t('platSort')} accepter={NumberInput} required={false} controls={false} placeholder="0" />
        </FormStep>
      </Form>
    </SettingModal>
  );
};

/**
 * ແພັກເກດທີ່ຂາຍ — ລາຄາ (ຕັ້ງເອງ), ໂມດູນ, ຈຳນວນບັນຊີ / ພະນັກງານ ແລະ ຈຳນວນບໍລິສັດທີ່ໃຊ້ຢູ່.
 * ບໍ່ມີລຶບ: ເຊົາຂາຍ = ປິດ (ບໍລິສັດທີ່ຖືຢູ່ແລ້ວໃຊ້ຕໍ່ໄດ້)
 */
const PlatformPackages = ({ packages, modules, companies, reload }: {
  packages: PlatformPackage[];
  modules: PlatformModule[];
  companies: PlatformCompany[] | null;
  reload: () => void;
}) => {
  const t = useT();
  const [editing, setEditing] = useState<PlatformPackage | null | undefined>(undefined);
  const usedBy = (id: number) => (companies ?? []).filter((c) => c.package_id === id).length;
  const price = (value: number | null, unit: string) => (value === null ? null : <span>₭ {formatNumber(value)} <small>/ {t(unit)}</small></span>);

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('platPackages'), value: packages.length },
          { label: t('platOnSale'), value: packages.filter((p) => Number(p.status) === 1).length, tone: 'green' },
        ]}
        addLabel={t('platPackageAdd')}
        onAdd={() => setEditing(null)}
      />
      <ListState loading={!companies} empty={!packages.length} icon="fa-box-open">
        <div className="plat-packages">
          {packages.map((p) => {
            const on = Number(p.status) === 1;
            return (
              <article key={p._uuid} className={`plat-package${on ? '' : ' is-off'}`}>
                <header>
                  <span className="plat-package-icon"><i className="fa-solid fa-box" /></span>
                  <span className="plat-package-name">
                    <b>{p.name_la}</b>
                    <small>{p.code}{p.name_en ? ` · ${p.name_en}` : ''}</small>
                  </span>
                  <span className={`acc-class-status${on ? ' is-active' : ''}`}>
                    <i className="fa-solid fa-circle" /> {t(on ? 'platOnSale' : 'platRetired')}
                  </span>
                  <button type="button" className="acc-class-edit" aria-label={t('edit')} title={t('edit')} onClick={() => setEditing(p)}>
                    <i className="fa-solid fa-pen" />
                  </button>
                </header>
                <div className="plat-price">
                  {price(p.price_month, 'platPerMonth') ?? <em><i className="fa-solid fa-tag" /> {t('platPriceUnset')}</em>}
                  {price(p.price_year, 'platPerYear')}
                </div>
                {p.description && <p className="plat-package-desc">{p.description}</p>}
                <ul className="plat-package-modules">
                  {PLAN_MODULES.filter((m) => p.modules.includes(m.code)).map((m) => (
                    <li key={m.code}><span className={`hr-menu-icon is-${m.tone}`}><i className={`fa-solid ${m.icon}`} /></span> {t(m.label)}</li>
                  ))}
                </ul>
                <footer>
                  <MetaChip icon="fa-user-shield" tone="violet">{p.max_users ?? '∞'} {t('planUsers')}</MetaChip>
                  <MetaChip icon="fa-id-card" tone="violet">{p.max_employees ?? '∞'} {t('planEmployees')}</MetaChip>
                  <MetaChip icon="fa-building" tone="green">{usedBy(p._uuid)} {t('platCompanies')}</MetaChip>
                </footer>
              </article>
            );
          })}
        </div>
      </ListState>

      {editing !== undefined && (
        <PackageForm data={editing} modules={modules} companies={editing ? usedBy(editing._uuid) : 0}
          onClose={() => setEditing(undefined)} onSaved={reload}
        />
      )}
    </div>
  );
};

export default PlatformPackages;
