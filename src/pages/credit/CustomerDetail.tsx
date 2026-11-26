import { useCallback, useEffect, useState } from 'react';
import { Loader, Modal } from 'rsuite';
import { deleteApi, getApi, putApi } from '../../utils/configApi';
import { getErrorMessage } from '../../utils/useCRUD';
import { Notific } from '../../utils/Notification';
import { canCreate, canDelete, canEdit } from '../../utils/localStorage';
import { useT } from '../../context/LanguageContext';
import { money, showDate } from '../account/loans/loanApi';
import CustomerForm from './CustomerForm';
import CollateralForm from './CollateralForm';
import ApplicationForm from './ApplicationForm';
import ApplicationDetail from './ApplicationDetail';
import ContractDetail from './ContractDetail';
import DocumentsPanel from './DocumentsPanel';
import { ID_TYPES, customerAddress, type Application, type Collateral, type Contract, type CreditCustomer } from './creditApi';
import { AppStatusChip, CollateralList, DetailTabs, InfoRows, RiskChip, creditTermText, useCreditProducts } from './creditKit';

type Full = CreditCustomer & { loans: Contract[]; applications: Application[]; collaterals: Collateral[]; guaranteeing: number };
type Tab = 'info' | 'collateral' | 'applications' | 'contracts' | 'documents';

/**
 * ລູກຄ້າສິນເຊື່ອ — KYC, ຫຼັກຊັບ (ເພີ່ມ / ແກ້ / ສົ່ງຄືນ / ຍຶດ), ຄຳຮ້ອງ ແລະ ສັນຍາທັງໝົດຂອງລູກຄ້າ;
 * ຍື່ນຄຳຮ້ອງໃໝ່ຈາກນີ້ໄດ້ເລີຍ (ລູກຄ້າຖືກເລືອກໃຫ້)
 */
const CustomerDetail = ({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) => {
  const t = useT();
  const { rows: products } = useCreditProducts();
  const [c, setC] = useState<Full | null>(null);
  const [tab, setTab] = useState<Tab>('info');
  const [editing, setEditing] = useState(false);
  const [collateral, setCollateral] = useState<Collateral | null | 'new'>(null);
  const [applying, setApplying] = useState(false);
  const [appId, setAppId] = useState<number | null>(null);
  const [contractId, setContractId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getApi(`/credit/customer/${id}`);
      setC(res.data?.data ?? null);
    } catch (err) {
      Notific.error(getErrorMessage(err));
      onClose();
    }
  }, [id, onClose]);
  useEffect(() => {
    load();
  }, [load]);
  const changed = () => {
    load();
    onChanged();
  };

  if (!c) {
    return (
      <Modal open onClose={onClose} size="lg" className="acc-ln-detail">
        <Modal.Body><div className="text-center py-5"><Loader size="md" content={t('loadingDots')} vertical /></div></Modal.Body>
      </Modal>
    );
  }

  const open = c.loans.filter((l) => !l.closed);
  const outstanding = open.reduce((n, l) => n + l.outstanding, 0);
  const overdue = open.filter((l) => l.overdue_count > 0);
  const held = c.collaterals.filter((x) => Number(x.status) === 1);
  const person = Number(c.customer_type) === 1;
  const blacklisted = Number(c.blacklisted) === 1;

  const setCollateralStatus = (x: Collateral, status: number, confirmKey: string) => Notific.confirm(`${t(confirmKey)} ${x.description}`, async () => {
    try {
      await putApi(`/credit/collateral/${x._uuid}`, { status });
      Notific.success('acsSaved');
      changed();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });
  const removeCollateral = (x: Collateral) => Notific.confirm(`${t('crCollateralDeleteConfirm')} ${x.description}`, async () => {
    try {
      await deleteApi(`/credit/collateral/${x._uuid}`);
      Notific.success('acsDeleted');
      changed();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });
  const remove = () => Notific.confirm(`${t('crCustomerDeleteConfirm')} ${c.customer_code} ${c.full_name}`, async () => {
    try {
      await deleteApi(`/credit/customer/${c._uuid}`);
      Notific.success('acsDeleted');
      onChanged();
      onClose();
    } catch (err) {
      Notific.error(getErrorMessage(err));
    }
  });

  return (
    <Modal open onClose={onClose} size="lg" className="acc-ln-detail cr-detail">
      <Modal.Header>
        <div className="acc-ln-head">
          <span className={`acc-ln-head-icon cr-person${blacklisted ? ' is-black' : ''}`}><i className={`fa-solid ${person ? 'fa-user' : 'fa-building'}`} /></span>
          <span className="acc-ln-head-text">
            <Modal.Title>{c.full_name}</Modal.Title>
            <small>
              <span className="acc-fs-code">{c.customer_code}</span>
              {[c.phone, c.id_no, customerAddress(c)].filter(Boolean).join(' · ')}
            </small>
          </span>
          <span className="acc-ln-head-actions">
            <RiskChip level={c.risk_level} />
            {canEdit && <button type="button" className="acc-rp-btn" onClick={() => setEditing(true)}><i className="fa-solid fa-pen" /> {t('edit')}</button>}
            {canDelete && !c.loans.length && !c.applications.length && (
              <button type="button" className="acc-rp-btn is-danger" onClick={remove}><i className="fa-solid fa-trash" /> {t('delete')}</button>
            )}
            {canCreate && !blacklisted && Number(c.status) === 1 && (
              <button type="button" className="acc-rp-btn is-primary" onClick={() => setApplying(true)}><i className="fa-solid fa-file-pen" /> {t('crAppAdd')}</button>
            )}
          </span>
        </div>
      </Modal.Header>

      <Modal.Body>
        {blacklisted && <div className="cr-issues"><b><i className="fa-solid fa-ban" /> {t('crBlacklist')}</b> {c.blacklist_reason}</div>}

        <div className="acc-ln-kpis">
          <div className="acc-ln-kpi is-main">
            <small>{t('lnOutstanding')}</small>
            <b>{money(outstanding, null)}</b>
            <em>{open.length} {t('crActiveContracts')}{c.credit_limit ? ` · ${t('crCreditLimit')} ${money(c.credit_limit, null)}` : ''}</em>
          </div>
          <div className={`acc-ln-kpi${overdue.length ? ' is-bad' : ''}`}>
            <small>{t('lnOverdue')}</small>
            <b>{overdue.length ? money(overdue.reduce((n, l) => n + l.overdue_amount, 0), null) : '—'}</b>
            <em>{overdue.length} {t('crContracts')}</em>
          </div>
          <div className="acc-ln-kpi">
            <small>{t('crCollateralHeld')}</small>
            <b>{money(held.reduce((n, x) => n + x.appraised_value, 0), null)}</b>
            <em>{held.length} {t('crItems')}</em>
          </div>
          <div className="acc-ln-kpi">
            <small>{t('crMonthlyIncome')}</small>
            <b>{c.monthly_income ? money(c.monthly_income, null) : '—'}</b>
            <em>{c.monthly_expense ? `${t('crMonthlyExpense')} ${money(c.monthly_expense, null)}` : ''}</em>
          </div>
        </div>

        <DetailTabs<Tab> value={tab} onChange={setTab} tabs={[
          { key: 'info', icon: 'fa-address-card', label: t('crKyc') },
          { key: 'collateral', icon: 'fa-house-lock', label: t('crCollaterals'), count: c.collaterals.length },
          { key: 'applications', icon: 'fa-file-pen', label: t('crApplicationsMenu'), count: c.applications.length },
          { key: 'contracts', icon: 'fa-file-signature', label: t('crContractsMenu'), count: c.loans.length },
          { key: 'documents', icon: 'fa-folder-open', label: t('crDocuments') },
        ]}
        />

        {tab === 'info' && (
          <div className="cr-split">
            <InfoRows rows={[
              [t('crCustomerType'), t(person ? 'crBorrowerPerson' : 'crBorrowerCompany')],
              [t('crNameEn'), c.name_en],
              [t('crGender'), person && c.gender ? t(Number(c.gender) === 1 ? 'crMale' : 'crFemale') : ''],
              [t('crBirthDate'), c.birth_date ? showDate(c.birth_date) : ''],
              [t(ID_TYPES.find((x) => x.value === Number(c.id_type))?.label ?? 'crIdNo'), c.id_no && `${c.id_no}${c.id_expiry_date ? ` · ${t('crIdExpiry')} ${showDate(c.id_expiry_date)}` : ''}`],
              [t('crTaxNumber'), c.tax_number],
              [t('phone'), [c.phone, c.phone2].filter(Boolean).join(' · ')],
              [t('email'), c.email],
              [t('crAddress'), [customerAddress(c), c.address].filter(Boolean).join(' · ')],
            ]}
            />
            <InfoRows rows={[
              [t('crMarital'), person && c.marital_status ? t(`crMarital${c.marital_status}`) : ''],
              [t('crSpouseName'), [c.spouse_name, c.spouse_id_no].filter(Boolean).join(' · ')],
              [t(person ? 'crOccupation' : 'crBusinessType'), c.occupation],
              [t(person ? 'crWorkplace' : 'crBusinessPlace'), c.workplace],
              [t('crGuaranteeing'), c.guaranteeing ? t('crGuaranteeingN').replace('{n}', String(c.guaranteeing)) : ''],
              [t('note'), c.note],
            ]}
            />
          </div>
        )}

        {tab === 'collateral' && (
          <>
            {canCreate && (
              <div className="cr-tab-actions">
                <button type="button" className="acc-rp-btn" onClick={() => setCollateral('new')}><i className="fa-solid fa-plus" /> {t('crCollateralAdd')}</button>
              </div>
            )}
            <CollateralList rows={c.collaterals} actions={(x) => Number(x.status) === 1 && (
              <>
                {canEdit && <button type="button" onClick={() => setCollateral(x)} title={t('edit')} aria-label={t('edit')}><i className="fa-solid fa-pen" /></button>}
                {canEdit && <button type="button" onClick={() => setCollateralStatus(x, 2, 'crReturnConfirm')} title={t('crReturn')} aria-label={t('crReturn')}><i className="fa-solid fa-rotate-left" /></button>}
                {canEdit && <button type="button" className="is-danger" onClick={() => setCollateralStatus(x, 3, 'crSeizeConfirm')} title={t('crSeize')} aria-label={t('crSeize')}><i className="fa-solid fa-gavel" /></button>}
                {canDelete && !x.loan_id && <button type="button" className="is-danger" onClick={() => removeCollateral(x)} title={t('delete')} aria-label={t('delete')}><i className="fa-solid fa-trash" /></button>}
              </>
            )}
            />
          </>
        )}

        {tab === 'applications' && (
          c.applications.length ? (
            <div className="acc-rp-scroll acc-ln-table-wrap">
              <table className="acc-fs-table acc-ln-table">
                <thead><tr><th>{t('crAppNo')}</th><th>{t('crProduct')}</th><th>{t('crRequestedAmount')}</th><th>{t('status')}</th></tr></thead>
                <tbody>
                  {c.applications.map((a) => (
                    <tr key={a._uuid} className="is-line is-click" onClick={() => setAppId(a._uuid)}>
                      <td><b>{a.application_no}</b><small className="acc-gl-ref">{showDate(a.apply_date)}</small></td>
                      <td>{products.find((p) => p._uuid === a.product_id)?.name_la ?? '—'}</td>
                      <td>{money(a.requested_amount, null)}<small className="acc-gl-ref">{creditTermText(a.requested_term, a.frequency_days, a.frequency_months, t)}</small></td>
                      <td><AppStatusChip status={Number(a.status)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-file-pen" /><p>{t('crNoApplications')}</p></div>
        )}

        {tab === 'contracts' && (
          c.loans.length ? (
            <div className="acc-rp-scroll acc-ln-table-wrap">
              <table className="acc-fs-table acc-ln-table">
                <thead><tr><th>{t('crContract')}</th><th>{t('lnPrincipal')}</th><th>{t('lnOutstanding')}</th><th>{t('lnNextDue')}</th></tr></thead>
                <tbody>
                  {c.loans.map((l) => (
                    <tr key={l._uuid} className={`is-line is-click${l.closed ? ' is-disposed' : ''}`} onClick={() => setContractId(l._uuid)}>
                      <td><b>{l.loan_code}</b><small className="acc-gl-ref">{[l.product?.name, showDate(l.start_date)].filter(Boolean).join(' · ')}</small></td>
                      <td>{money(l.principal, l.currency)}</td>
                      <td><b>{money(l.outstanding, l.currency)}</b></td>
                      <td>
                        {l.closed ? <span className="acc-ln-state is-paid"><i className="fa-solid fa-circle-check" /> {t('lnClosed')}</span>
                          : l.next ? <>{money(l.next.amount, l.currency)}<small className="acc-gl-ref">{showDate(l.next.due_date)}</small></> : '—'}
                        {l.overdue_count > 0 && <span className="hr-expiry-chip is-over"><i className="fa-solid fa-triangle-exclamation" /> {t('lnOverdueN').replace('{n}', String(l.overdue_count))}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="acc-class-empty cr-empty-sm"><i className="fa-solid fa-file-signature" /><p>{t('crNoContracts')}</p></div>
        )}
        {tab === 'documents' && <DocumentsPanel ownerType="customer" ownerId={c._uuid} />}
      </Modal.Body>

      {editing && <CustomerForm row={c} nextCode="" onClose={() => setEditing(false)} onSaved={changed} />}
      {collateral && <CollateralForm customerId={c._uuid} row={collateral === 'new' ? null : collateral} onClose={() => setCollateral(null)} onSaved={changed} />}
      {applying && <ApplicationForm row={null} customerId={c._uuid} onClose={() => setApplying(false)} onSaved={(newId) => { changed(); if (newId) setAppId(newId); }} />}
      {appId && <ApplicationDetail id={appId} onClose={() => setAppId(null)} onChanged={changed} />}
      {contractId && <ContractDetail id={contractId} onClose={() => setContractId(null)} onChanged={changed} />}
    </Modal>
  );
};

export default CustomerDetail;
