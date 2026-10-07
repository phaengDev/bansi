import { useMemo, useState } from 'react';
import { Loader, SelectPicker } from 'rsuite';
import moment from 'moment';
import AppPage from '../../../components/Elements/AppPage';
import { deleteApi } from '../../../utils/configApi';
import { getErrorMessage } from '../../../utils/useCRUD';
import { Notific } from '../../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../../utils/localStorage';
import { exportExcel } from '../../../utils/exportHelpers';
import { useT } from '../../../context/LanguageContext';
import { BUDGET_MENU, firstRailKey, toRailNav } from '../config/SidebarPopup';
import {
  BUDGET_STATUS, monthLabel, percentText, statusOf, useBudgets,
  type BudgetRow, type Unbudgeted,
} from './budgetApi';
import { useFiscalYears } from '../../../utils/selectOption';
import BudgetOverview from './BudgetOverview';
import BudgetMonthly from './BudgetMonthly';
import BudgetForm from './BudgetForm';
import BudgetDetail from './BudgetDetail';

const showDate = (value: string) => moment(value, 'YYYY-MM-DD').format('DD/MM/YYYY');

/**
 * ໜ້າຕ່າງ ງົບປະມານ — ເລືອກປີການເງິນ (ຕັ້ງຕົ້ນ = ປີປັດຈຸບັນ), ແຖບຊ້າຍ: ຕິດຕາມງົບ / ລາຍເດືອນ.
 * ຕັ້ງ/ແກ້/ລຶບງົບໄດ້ສະເພາະປີທີ່ຍັງເປີດ; ຟອມ ແລະ ລາຍລະອຽດ ໃຊ້ຮ່ວມກັນທຸກແຖບ
 */
const BudgetWindow = () => {
  const t = useT();
  const railNav = useMemo(() => toRailNav(BUDGET_MENU, t), [t]);
  const [activeKey, setActiveKey] = useState(firstRailKey(BUDGET_MENU));
  const active = railNav.find((item) => item.key === activeKey);
  const title = t('accountAppBudget');
  const years = useFiscalYears();
  const [fiscalId, setFiscalId] = useState<number | null>(null);
  const { data, loading, error, reload } = useBudgets(fiscalId);
  /** row null = ຕັ້ງງົບໃໝ່ (categoryId = ປະເພດທີ່ເລືອກໄວ້ໃຫ້) */
  const [editing, setEditing] = useState<{ row: BudgetRow | null; categoryId?: number } | null>(null);
  const [viewing, setViewing] = useState<BudgetRow | Unbudgeted | null>(null);

  const fiscal = data?.fiscal;
  const closed = !!fiscal && Number(fiscal.status) === 2;
  const open = !!fiscal && !closed;

  const yearOptions = years.map((y) => ({
    value: y._uuid,
    label: `${y.fiscal_code}${y.fiscal_name && y.fiscal_name !== y.fiscal_code ? ` · ${y.fiscal_name}` : ''}${Number(y.status) === 2 ? ' 🔒' : ''}`,
  }));

  const remove = (row: BudgetRow) =>
    Notific.confirm(`${t('budgetDeleteConfirm')} ${row.category?.type_name ?? ''}`, async () => {
      try {
        await deleteApi(`/budget/${btoa(String(row._uuid))}`);
        Notific.success('acsDeleted');
        reload();
      } catch (err) {
        console.error(err);
        Notific.error(getErrorMessage(err));
      }
    });

  const exportRows = () => {
    if (!data) return;
    const name = t('expenseCategory');
    const categoryText = (r: BudgetRow | Unbudgeted) => `${r.category?.type_code ?? ''} ${r.category?.type_name ?? ''}`.trim();
    const sheet = `${title} ${data.fiscal.fiscal_name || data.fiscal.fiscal_code} (LAK)`;
    if (activeKey === 'monthly') {
      const rows: (BudgetRow | Unbudgeted)[] = [...data.data, ...data.unbudgeted];
      exportExcel(rows.map((r) => ({
        [name]: categoryText(r),
        ...Object.fromEntries(data.months.map((m) => [monthLabel(m), Math.round(r.actual_months[m] ?? 0)])),
        [t('budgetUsed')]: Math.round(r.actual),
        [t('budgetAmount')]: '_uuid' in r ? r.amount : '',
      })), `budget-monthly_${data.fiscal.fiscal_code}`, sheet);
      return;
    }
    exportExcel(data.data.map((r) => ({
      [name]: categoryText(r),
      [t('budgetAmount')]: r.amount,
      [t('budgetUsed')]: r.actual,
      [t('budgetRemaining')]: r.amount - r.actual,
      '%': percentText(r.amount, r.actual),
      [t('status')]: t(BUDGET_STATUS[statusOf(r.amount, r.actual)].label),
    })), `budget_${data.fiscal.fiscal_code}`, sheet);
  };

  const body = error && !data ? (
    <div className="acc-class-empty"><i className="fa-solid fa-triangle-exclamation" /><p>{error}</p></div>
  ) : !data ? (
    <div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div>
  ) : (
    <div className={`acc-rp-body${loading ? ' is-refreshing' : ''}`}>
      {activeKey === 'monthly' ? (
        <BudgetMonthly budget={data} onView={setViewing} />
      ) : (
        <BudgetOverview budget={data} canAdd={open && canCreate} canChange={open && canEdit} canRemove={open && canDelete}
          onAdd={(categoryId) => setEditing({ row: null, categoryId })}
          onEdit={(row) => setEditing({ row })}
          onDelete={remove}
          onView={setViewing}
        />
      )}
    </div>
  );

  return (
    <AppPage title={active?.label ?? title} subtitle={title} showHeader={false} railNav={railNav} railActiveKey={activeKey} onRailSelect={setActiveKey}>
      <div className="acc-rp acc-gl acc-bg">
        <div className="acc-rp-filters">
          <div className="acc-rp-filter-row">
            <SelectPicker className="acc-rp-select" data={yearOptions} value={fiscal?._uuid ?? null} cleanable={false} searchable={false}
              placeholder={t('accountSetFiscalYear')} onChange={(value) => value && setFiscalId(value)}
            />
            {fiscal && (
              <span className="acc-bg-period">
                <i className="fa-regular fa-calendar" /> {showDate(fiscal.start_date)} → {showDate(fiscal.end_date)}
                {closed && <span className="acs-pill is-muted"><i className="fa-solid fa-lock" /> {t('fyClosed')}</span>}
              </span>
            )}
            <div className="acc-rp-actions">
              <button type="button" className="acc-rp-btn" onClick={exportRows} disabled={!data || (!data.data.length && !data.unbudgeted.length)}>
                <i className="fa-solid fa-file-excel" /> Excel
              </button>
              <button type="button" className="acc-class-add" disabled={!open || !canCreate} onClick={() => setEditing({ row: null })}>
                <i className="fa-solid fa-plus" /> {t('budgetAdd')}
              </button>
            </div>
          </div>
        </div>
        {closed && <p className="acc-bg-note"><i className="fa-solid fa-lock" /> {t('budgetClosedYear')}</p>}
        {body}
      </div>

      {editing && data && (
        <BudgetForm fiscal={data.fiscal} months={data.months} budgets={data.data} data={editing.row} presetCategoryId={editing.categoryId}
          onClose={() => setEditing(null)} onSaved={reload}
        />
      )}
      {viewing && data && <BudgetDetail row={viewing} budget={data} onClose={() => setViewing(null)} />}
    </AppPage>
  );
};

export default BudgetWindow;
