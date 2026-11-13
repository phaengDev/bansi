import { useState } from 'react';
import { Loader } from 'rsuite';
import moment from 'moment';
import { deleteApi, formatNumber, putApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useLangField, useT } from '../../../context/LanguageContext';
import { GlNotReady, useChartAccounts } from '../gl/glKit';
import { SettingToolbar } from '../setting/settingKit';
import { DISPOSED, lifeText, useFixedAssets, type FixedAsset } from './faApi';
import { AssetForm, DisposeForm } from './AssetForm';

const show = (s: string | null | undefined) => (s ? moment(s).format('DD/MM/YYYY') : '—');

type Filter = 'active' | 'disposed' | 'all';

/** ສະຖານະຂອງຊັບສົມບັດ — ຈຳໜ່າຍແລ້ວ / ຫຼຸ້ຍຫ້ຽນຄົບ / ໃຊ້ງານ */
const statusOf = (r: FixedAsset) =>
  r.status === DISPOSED ? { key: 'disposed', icon: 'fa-building-circle-xmark', label: 'faStatusDisposed' }
    : r.fully_depreciated ? { key: 'full', icon: 'fa-circle-check', label: 'faFullyDepreciated' }
      : { key: 'active', icon: 'fa-circle-play', label: 'faStatusActive' };

/**
 * ທະບຽນຊັບສົມບັດຄົງທີ່ — ກັ່ນຕາມສະຖານະ + ຄົ້ນຫາ, ແຕ່ລະແຖວມີສະຖານະ ແລະ ແຖບສ່ວນທີ່ຫຼຸ້ຍຫ້ຽນແລ້ວ;
 * ເພີ່ມ / ແກ້ໄຂ (AssetForm), ຈຳໜ່າຍ (DisposeForm), ຍົກເລີກການຈຳໜ່າຍ, ລຶບ (ສະເພາະທີ່ຍັງບໍ່ເຄີຍລົງຄ່າຫຼຸ້ຍຫ້ຽນ)
 */
const AssetRegister = () => {
  const t = useT();
  const lf = useLangField();
  const { rows, nextCode, loading, error, notReady, reload } = useFixedAssets();
  const { rows: accounts } = useChartAccounts();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [editing, setEditing] = useState<FixedAsset | null | undefined>(undefined);
  const [disposing, setDisposing] = useState<FixedAsset | null>(null);

  if (notReady) return <GlNotReady />;
  if (error) return <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>;

  const active = rows.filter((r) => r.status !== DISPOSED);
  const disposedCount = rows.length - active.length;
  const q = keyword.trim().toLowerCase();
  const shown = rows
    .filter((r) => filter === 'all' || (filter === 'disposed' ? r.status === DISPOSED : r.status !== DISPOSED))
    .filter((r) => !q || `${r.asset_code} ${r.name} ${r.location ?? ''} ${r.serial_no ?? ''}`.toLowerCase().includes(q));
  const accountOf = (id: number) => accounts.find((a) => a._uuid === id);

  const remove = (row: FixedAsset) =>
    Notific.confirm(`${t('faDeleteConfirm')} ${row.asset_code} ${row.name}`, async () => {
      try {
        await deleteApi(`/fixed-asset/${row._uuid}`);
        Notific.success('acsDeleted');
        reload();
      } catch (err) {
        Notific.error(getErrorMessage(err));
      }
    });
  const restore = (row: FixedAsset) =>
    Notific.confirm(`${t('faRestoreConfirm')} ${row.asset_code}`, async () => {
      try {
        await putApi(`/fixed-asset/restore/${row._uuid}`, {});
        Notific.success('acsSaved');
        reload();
      } catch (err) {
        Notific.error(getErrorMessage(err));
      }
    });

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'active', label: t('faFilterActive'), count: active.length },
    { key: 'disposed', label: t('faFilterDisposed'), count: disposedCount },
    { key: 'all', label: t('faFilterAll'), count: rows.length },
  ];

  return (
    <div className="acs-page acc-fa">
      <SettingToolbar
        stats={[
          { label: t('faCount'), value: active.length },
          { label: t('faCost'), value: formatNumber(active.reduce((n, r) => n + r.cost, 0)) },
          { label: t('faNbv'), value: formatNumber(active.reduce((n, r) => n + r.nbv, 0)), tone: 'green' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        addLabel={t('faAdd')}
        onAdd={() => setEditing(null)}
        canAdd={canCreate}
      />

      {rows.length > 0 && (
        <div className="acc-type-segment acc-fa-filter-tabs" role="tablist">
          {filters.map((f) => (
            <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
              className={filter === f.key ? 'is-active' : ''} onClick={() => setFilter(f.key)}
            >
              {f.label} <small>{f.count}</small>
            </button>
          ))}
        </div>
      )}

      {loading && !rows.length ? (
        <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
      ) : !rows.length ? (
        <div className="acc-class-empty acc-fa-empty">
          <i className="fa-solid fa-building" />
          <p><b>{t('faEmpty')}</b><br />{t('faEmptyHint')}</p>
          {canCreate && (
            <button type="button" className="acc-rp-btn" onClick={() => setEditing(null)}>
              <i className="fa-solid fa-plus" /> {t('faAdd')}
            </button>
          )}
        </div>
      ) : !shown.length ? (
        <div className="acc-class-empty"><i className="fa-solid fa-magnifying-glass" /><p>{t('rpEmpty')}</p></div>
      ) : (
        <div className="acc-rp-scroll">
          <table className="acc-fs-table acc-fa-table">
            <thead>
              <tr>
                <th>{t('faAsset')}</th>
                <th>{t('faAcquisitionDate')}</th>
                <th>{t('faLife')}</th>
                <th>{t('faCost')}</th>
                <th>{t('faAccumulated')}</th>
                <th>{t('faNbv')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const disposed = r.status === DISPOSED;
                const status = statusOf(r);
                const base = r.cost - r.salvage_value;
                const pct = base > 0 ? Math.min(100, (r.accumulated / base) * 100) : 0;
                const account = accountOf(r.asset_account_id);
                return (
                  <tr key={r._uuid} className={`is-line${disposed ? ' is-disposed' : ''}`}>
                    <td>
                      <div className="acc-fa-name">
                        <span className="acc-fs-code">{r.asset_code}</span>
                        <b>{r.name}</b>
                        <em className={`acc-fa-chip is-${status.key}`}><i className={`fa-solid ${status.icon}`} /> {t(status.label)}</em>
                      </div>
                      <small>
                        {account ? `${account.account_code} ${lf(account, 'name')}` : ''}
                        {r.location && ` · ${r.location}`}
                        {disposed
                          ? ` · ${t('faDisposedOn')} ${show(r.disposal_date)}`
                          : !r.fully_depreciated && ` · ${t('faMonthly')} ${formatNumber(r.monthly)}${r.last_period ? ` · ${t('faLastPosted')} ${moment(r.last_period, 'YYYY-MM').format('MM/YYYY')}` : ''}`}
                      </small>
                    </td>
                    <td>{show(r.acquisition_date)}</td>
                    <td>{lifeText(r.useful_life_months, t)}</td>
                    <td>{formatNumber(r.cost)}</td>
                    <td>
                      {formatNumber(r.accumulated)}
                      <span className="acc-fa-bar" title={`${pct.toFixed(0)}%`}><i style={{ width: `${pct}%` }} /></span>
                    </td>
                    <td><b>{disposed ? '—' : formatNumber(r.nbv)}</b></td>
                    <td className="acc-fa-actions">
                      {disposed ? (
                        <button type="button" disabled={!canEdit} onClick={() => restore(r)} title={t('faRestore')} aria-label={t('faRestore')}>
                          <i className="fa-solid fa-rotate-left" />
                        </button>
                      ) : (
                        <>
                          <button type="button" disabled={!canEdit} onClick={() => setEditing(r)} title={t('edit')} aria-label={t('edit')}><i className="fa-solid fa-pen" /></button>
                          <button type="button" disabled={!canEdit} onClick={() => setDisposing(r)} title={t('faDispose')} aria-label={t('faDispose')}><i className="fa-solid fa-building-circle-xmark" /></button>
                          {!r.last_period && (
                            <button type="button" className="is-danger" disabled={!canDelete} onClick={() => remove(r)} title={t('delete')} aria-label={t('delete')}><i className="fa-solid fa-trash" /></button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing !== undefined && <AssetForm row={editing} nextCode={nextCode} onClose={() => setEditing(undefined)} onSaved={reload} />}
      {disposing && <DisposeForm row={disposing} onClose={() => setDisposing(null)} onSaved={reload} />}
    </div>
  );
};

export default AssetRegister;
