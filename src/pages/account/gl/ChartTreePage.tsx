import { useMemo, useState } from 'react';
import { deleteApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { exportExcel } from '../../../utils/exportHelpers';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { useLangField, useT } from '../../../context/LanguageContext';
import { ListState, SettingToolbar } from '../setting/settingKit';
import { useStatusToggle } from '../setting/settingApi';
import {
  CREDIT, GROUPS, buildTree, flatten, money, naturalOf, roleLabelOf, rollup, typeLabelOf,
  type ChartAccount, type TreeNode,
} from './glApi';
import { AccountCode, GlNotReady, useChartAccounts } from './glKit';
import ChartAccountForm from './ChartAccountForm';
import AccountLedgerModal from './AccountLedgerModal';

/**
 * ຜັງບັນຊີ — 5 ກຸ່ມ (ຊັບສິນ, ໜີ້ສິນ, ທຶນ, ລາຍຮັບ, ລາຍຈ່າຍ) ເປັນຕົ້ນໄມ້: ບັນຊີຫົວພັບ/ກາງໄດ້ ແລະ ລວມຍອດລູກ.
 * ຍອດ = ສະສົມທັງໝົດຕາມຝັ່ງປົກກະຕິຂອງບັນຊີ; ກົດບັນຊີລົງລາຍການ = ເປີດປຶ້ມບັນຊີໃຫຍ່ຂອງບັນຊີນັ້ນ
 */
const ChartTreePage = () => {
  const t = useT();
  const lf = useLangField();
  const { rows, loading, notReady, reload } = useChartAccounts();
  // ຟອມບໍ່ມີຊ່ອງສະຖານະ — ເປີດ/ປິດໃຊ້ງານຈາກປຸ່ມໃນແຖວ
  const statusToggle = useStatusToggle('/chart-account', reload);
  const [keyword, setKeyword] = useState('');
  const [groupFilter, setGroupFilter] = useState<number>(0);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<{ data: ChartAccount | null; parentId?: number | null } | null>(null);
  const [ledger, setLedger] = useState<ChartAccount | null>(null);

  const roots = useMemo(() => buildTree(rows), [rows]);
  const totals = useMemo(() => rollup(roots, (a) => (Number(a.debit) || 0) - (Number(a.credit) || 0)), [roots]);
  const all = useMemo(() => flatten(roots), [roots]);
  const byId = useMemo(() => new Map(rows.map((r) => [r._uuid, r])), [rows]);

  // ຄົ້ນຫາ: ສະແດງບັນຊີທີ່ກົງ + ບັນຊີແມ່ທັງສາຍ (ບໍ່ສົນການພັບ)
  const q = keyword.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q) return null;
    const show = new Set<number>();
    rows.forEach((r) => {
      const text = `${r.account_code} ${r.name_la} ${r.name_en ?? ''} ${r.name_cn ?? ''}`.toLowerCase();
      if (!text.includes(q)) return;
      for (let a: ChartAccount | undefined = r; a; a = a.parent_id ? byId.get(a.parent_id) : undefined) show.add(a._uuid);
    });
    return show;
  }, [q, rows, byId]);

  const isHidden = (node: TreeNode) => {
    if (visible) return !visible.has(node._uuid);
    for (let p = node.parent_id ? byId.get(node.parent_id) : undefined; p; p = p.parent_id ? byId.get(p.parent_id) : undefined) {
      if (collapsed.has(p._uuid)) return true;
    }
    return false;
  };

  const toggle = (id: number) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const remove = (account: ChartAccount) => {
    Notific.confirm(`${t('glDeleteConfirm')} ${account.account_code} ${lf(account, 'name')}?`, async () => {
      try {
        await deleteApi(`/chart-account/${btoa(String(account._uuid))}`);
        Notific.success('deleteDataSuccess');
        reload();
      } catch (error) {
        Notific.error(getErrorMessage(error));
      }
    });
  };

  const exportRows = () => {
    const col = { code: t('glAccountCode'), name: t('name'), group: t('glGroup'), type: t('glAccountType'), side: t('glNormalSide'), kind: t('glAccountKind'), balance: t('glBalance') };
    exportExcel(all.map((a) => ({
      [col.code]: a.account_code,
      [col.name]: `${'   '.repeat(a.depth)}${lf(a, 'name')}`,
      [col.group]: t(GROUPS[a.account_group - 1]?.label ?? ''),
      [col.type]: t(typeLabelOf(a.account_group, a.account_type)),
      [col.side]: Number(a.normal_side) === CREDIT ? 'Cr' : 'Dr',
      [col.kind]: t(Number(a.is_postable) === 1 ? 'glPostable' : 'glHeader'),
      [col.balance]: naturalOf(a.normal_side, totals.get(a._uuid) ?? 0),
    })), 'chart-of-accounts', t('accountAppChartOfAccounts'));
  };

  if (notReady) return <GlNotReady />;

  const postable = rows.filter((r) => Number(r.is_postable) === 1).length;
  const groups = GROUPS.filter((g) => !groupFilter || g.value === groupFilter);

  return (
    <div className="acs-page acc-gl">
      <SettingToolbar
        stats={[
          { label: t('glAccounts'), value: rows.length },
          { label: t('glPostable'), value: postable, tone: 'green' },
          { label: t('glHeader'), value: rows.length - postable, tone: 'violet' },
        ]}
        keyword={keyword}
        onKeyword={setKeyword}
        placeholder={t('glSearchAccount')}
        addLabel={t('glAccountAdd')}
        onAdd={() => setEditing({ data: null })}
        canAdd={canCreate}
      >
        <div className="acc-type-segment" role="tablist">
          <button type="button" role="tab" aria-selected={!groupFilter} className={!groupFilter ? 'is-active' : ''} onClick={() => setGroupFilter(0)}>
            {t('all')}
          </button>
          {GROUPS.map((g) => (
            <button key={g.value} type="button" role="tab" aria-selected={groupFilter === g.value}
              className={groupFilter === g.value ? 'is-active' : ''} onClick={() => setGroupFilter(g.value)}
            >
              {g.value} {t(g.label)}
            </button>
          ))}
        </div>
        <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!rows.length}>
          <i className="fa-solid fa-file-excel" /> Excel
        </button>
      </SettingToolbar>

      <ListState loading={loading && !rows.length} empty={!rows.length} icon="fa-sitemap">
        {groups.map((g) => {
          const nodes = all.filter((n) => n.account_group === g.value && !isHidden(n));
          if (visible && !nodes.length) return null;
          const groupTotal = roots.filter((r) => r.account_group === g.value).reduce((n, r) => n + (totals.get(r._uuid) ?? 0), 0);
          return (
            <section key={g.value} className={`acc-gl-group acc-tone ${g.tone}`}>
              <header>
                <span className="acc-gl-group-icon"><i className={`fa-solid ${g.icon}`} /></span>
                <span className="acc-gl-group-title">
                  <b>{g.value} · {t(g.label)}</b>
                  <small>{t(g.side === CREDIT ? 'glSideCredit' : 'glSideDebit')} · {nodes.length} {t('glAccounts')}</small>
                </span>
                <span className="acc-gl-group-total">{money(naturalOf(g.side, groupTotal))}</span>
              </header>
              <div className="acc-rp-scroll">
                <table className="acc-gl-tree">
                  <tbody>
                    {nodes.map((n) => {
                      const header = Number(n.is_postable) === 0;
                      const balance = naturalOf(n.normal_side, totals.get(n._uuid) ?? 0);
                      const removable = Number(n.is_system) !== 1 && !n.lines && !n.children.length;
                      return (
                        <tr key={n._uuid}
                          className={`${header ? 'is-header' : 'is-postable'}${Number(n.status) !== 1 ? ' is-off' : ''}`}
                          onClick={() => !header && setLedger(n)}
                        >
                          <td className="acc-gl-tree-name" style={{ paddingLeft: 12 + n.depth * 22 }}>
                            {header ? (
                              <button type="button" className="acc-gl-caret" onClick={(e) => { e.stopPropagation(); toggle(n._uuid); }}
                                aria-label={t('glToggle')} disabled={!!visible || !n.children.length}
                              >
                                <i className={`fa-solid ${collapsed.has(n._uuid) && !visible ? 'fa-caret-right' : 'fa-caret-down'}`} />
                              </button>
                            ) : <span className="acc-gl-caret is-leaf" />}
                            <AccountCode code={n.account_code} group={n.account_group} />
                            <span className="acc-gl-name">{lf(n, 'name')}</span>
                            {Number(n.is_system) === 1 && <i className="fa-solid fa-lock acc-gl-lock" title={t('glSystemAccount')} />}
                            {n.roles?.map((r) => <span key={r} className="acc-gl-role">{t(roleLabelOf(r))}</span>)}
                            {Number(n.status) !== 1 && <span className="acc-gl-off">{t('inactive')}</span>}
                          </td>
                          <td className="acc-gl-tree-type">{t(typeLabelOf(n.account_group, n.account_type))}</td>
                          <td className="acc-gl-tree-side">
                            <span className={`acc-gl-side${Number(n.normal_side) === CREDIT ? ' is-cr' : ''}`}>
                              {Number(n.normal_side) === CREDIT ? 'Cr' : 'Dr'}
                            </span>
                          </td>
                          <td className="acc-gl-tree-balance">{money(balance)}</td>
                          <td className="acc-gl-tree-actions" onClick={(e) => e.stopPropagation()}>
                            {header && (
                              <button type="button" className="acc-gl-act" disabled={!canCreate} title={t('glAddChild')}
                                onClick={() => setEditing({ data: null, parentId: n._uuid })}
                              >
                                <i className="fa-solid fa-plus" />
                              </button>
                            )}
                            <button type="button" className="acc-gl-act" disabled={!canEdit} title={t('edit')}
                              onClick={() => setEditing({ data: n })}
                            >
                              <i className="fa-solid fa-pen" />
                            </button>
                            <button type="button" className={`acc-gl-act acc-gl-switch${Number(n.status) === 1 ? ' is-on' : ''}`}
                              disabled={!canEdit || statusToggle.busyId === n._uuid}
                              title={t(Number(n.status) === 1 ? 'statusTurnOff' : 'statusTurnOn')}
                              onClick={() => statusToggle.toggle(n._uuid, Number(n.status) !== 1)}
                            >
                              <i className={`fa-solid ${Number(n.status) === 1 ? 'fa-toggle-on' : 'fa-toggle-off'}`} />
                            </button>
                            {removable && (
                              <button type="button" className="acc-gl-act is-danger" disabled={!canDelete} title={t('delete')}
                                onClick={() => remove(n)}
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </ListState>

      {editing && (
        <ChartAccountForm data={editing.data} parentId={editing.parentId} accounts={rows}
          onClose={() => setEditing(null)} onSaved={reload}
        />
      )}
      {ledger && <AccountLedgerModal account={ledger} onClose={() => setLedger(null)} />}
    </div>
  );
};

export default ChartTreePage;
