import { useState } from 'react';
import moment from 'moment';
import { putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { useT } from '../../context/LanguageContext';
import { ListState, SettingToolbar } from '../account/setting/settingKit';
import { PLAN_WARN_DAYS } from '../account/companyPlan';
import PlatformPlanForm from './PlatformPlanForm';
import PlatformCompanyForm from './PlatformCompanyForm';
import { SeatCount } from './platformKit';
import { limitOf, type PlatformCompany, type PlatformModule, type PlatformPackage } from './platformApi';

type Filter = 'all' | 'trial' | 'soon' | 'expired' | 'suspended';

const isSoon = (c: PlatformCompany) => !c.expired && c.days_left !== null && c.days_left <= PLAN_WARN_DAYS;
const matches: Record<Filter, (c: PlatformCompany) => boolean> = {
  all: () => true,
  trial: (c) => Number(c.plan_trial) === 1 && !c.expired,
  soon: isSoon,
  expired: (c) => c.expired,
  suspended: (c) => Number(c.status) !== 1,
};

/**
 * ບໍລິສັດທັງໝົດທີ່ໃຊ້ລະບົບ — ແພັກເກດ, ວັນໝົດອາຍຸ, ຈຳນວນທີ່ໃຊ້ / ສູງສຸດ; ຕັ້ງແພັກເກດ, ຕໍ່ອາຍຸ, ລະງັບ / ເປີດຄືນ, ເພີ່ມບໍລິສັດ
 */
const PlatformCompanies = ({ companies, packages, modules, reload }: {
  companies: PlatformCompany[] | null;
  packages: PlatformPackage[];
  modules: PlatformModule[];
  reload: () => void;
}) => {
  const t = useT();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<PlatformCompany | null>(null);
  const [adding, setAdding] = useState(false);
  const rows = companies ?? [];
  const q = keyword.trim().toLowerCase();
  const shown = rows.filter((c) => matches[filter](c)
    && (!q || `${c._uuid} ${c.name_la} ${c.name_en ?? ''} ${c.phone1 ?? ''} ${c.package?.name_la ?? ''}`.toLowerCase().includes(q)));
  const count = (key: Filter) => rows.filter(matches[key]).length;

  const setStatus = (c: PlatformCompany) => {
    const on = Number(c.status) !== 1;
    Notific.confirm(`${t(on ? 'platEnableConfirm' : 'platSuspendConfirm')} ${c.name_la}`, async () => {
      try {
        await putApi(`/platform/company/${c._uuid}/status`, { status: on ? 1 : 0 });
        Notific.success('saveSuccessDone');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });
  };

  const expiryCell = (c: PlatformCompany) => {
    if (!c.plan_expires_at) return <span className="acc-gl-ref"><i className="fa-solid fa-infinity" /> {t('planNoExpiry')}</span>;
    const days = c.days_left ?? 0;
    return (
      <>
        {moment(c.plan_expires_at).format('DD/MM/YYYY')}
        <span className={`hr-expiry-chip${c.expired ? ' is-over' : days <= 7 ? ' is-soon' : ''}`}>
          <i className={`fa-solid ${c.expired ? 'fa-lock' : 'fa-hourglass-half'}`} />{' '}
          {c.expired ? t('planExpiredShort') : days === 0 ? t('planLastDay') : t('planDaysLeft').replace('{n}', String(days))}
        </span>
      </>
    );
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'all' },
    { key: 'trial', label: 'planTrial' },
    { key: 'soon', label: 'platSoon' },
    { key: 'expired', label: 'planExpiredShort' },
    { key: 'suspended', label: 'platSuspended' },
  ];

  return (
    <div className="acs-page">
      <SettingToolbar
        stats={[
          { label: t('platCompanies'), value: rows.length },
          { label: t('planTrial'), value: count('trial'), tone: 'violet' },
          { label: t('platSoon'), value: count('soon'), tone: 'gold' },
          { label: t('planExpiredShort'), value: count('expired'), tone: 'red' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('platCompanyAdd')}
        onAdd={() => setAdding(true)}
      >
        <div className="acc-type-segment" role="tablist">
          {filters.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'is-active' : ''} onClick={() => setFilter(f.key)}>
              {t(f.label)} <em>{count(f.key)}</em>
            </button>
          ))}
        </div>
      </SettingToolbar>

      <ListState loading={!companies} empty={!shown.length} icon="fa-building">
        <div className="acc-gl-group">
          <div className="acc-rp-scroll">
            <table className="acc-gl-table plat-table">
              <thead>
                <tr>
                  <th>{t('platCompany')}</th>
                  <th>{t('planPackage')}</th>
                  <th>{t('platExpiresAt')}</th>
                  <th className="is-num">{t('planUsers')}</th>
                  <th className="is-num">{t('planEmployees')}</th>
                  <th>{t('status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c._uuid} className={`is-click${Number(c.status) !== 1 ? ' is-reversed' : ''}`} onClick={() => setEditing(c)}>
                    <td>
                      <b>{c.name_la}</b>
                      <small className="acc-gl-ref">#{c._uuid}{c.phone1 ? ` · ${c.phone1}` : ''} · {t('platSince')} {moment(c.createdAt).format('DD/MM/YYYY')}</small>
                    </td>
                    <td>
                      {c.package
                        ? <span className="acs-chip is-violet"><i className="fa-solid fa-box" /> {c.package.name_la}</span>
                        : <span className="acs-chip is-green"><i className="fa-solid fa-infinity" /> {t('planAllModules')}</span>}
                      {Number(c.plan_trial) === 1 && <span className="acs-chip is-gold"><i className="fa-solid fa-flask" /> {t('planTrial')}</span>}
                      {c.plan_addons.length > 0 && <small className="acc-gl-ref">+ {c.plan_addons.length} {t('platModulesUnit')}</small>}
                    </td>
                    <td>{expiryCell(c)}</td>
                    <td className="is-num"><SeatCount used={c.users} limit={limitOf(c, 'users')} /></td>
                    <td className="is-num"><SeatCount used={c.employees} limit={limitOf(c, 'employees')} /></td>
                    <td>
                      <span className={`acc-class-status${Number(c.status) === 1 ? ' is-active' : ''}`}>
                        <i className="fa-solid fa-circle" /> {t(Number(c.status) === 1 ? 'active' : 'platSuspended')}
                      </span>
                    </td>
                    <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="acc-gl-act" title={t('platPlanEdit')} aria-label={t('platPlanEdit')} onClick={() => setEditing(c)}>
                        <i className="fa-solid fa-box-open" />
                      </button>
                      <button type="button" className={`acc-gl-act${Number(c.status) === 1 ? ' is-danger' : ''}`}
                        title={t(Number(c.status) === 1 ? 'platSuspend' : 'platEnable')} aria-label={t(Number(c.status) === 1 ? 'platSuspend' : 'platEnable')}
                        onClick={() => setStatus(c)}
                      >
                        <i className={`fa-solid ${Number(c.status) === 1 ? 'fa-ban' : 'fa-circle-play'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ListState>

      {editing && (
        <PlatformPlanForm key={editing._uuid} company={editing} packages={packages} modules={modules}
          onClose={() => setEditing(null)} onSaved={reload}
        />
      )}
      {adding && <PlatformCompanyForm packages={packages} onClose={() => setAdding(false)} onSaved={reload} />}
    </div>
  );
};

export default PlatformCompanies;
